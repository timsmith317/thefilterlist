// File: lib/filterPhotos.js → ~/Projects/thefilterlist/lib/filterPhotos.js
//
// lib/filterPhotos.js — pick, persist, save, and delete Filter reference photos.
//
// TWO PHOTO PATHS, DELIBERATELY SEPARATE:
//
//   CAMERA  →  captureAndPersist()  →  straight into the strip.
//     Point, shoot, saved. What the viewfinder showed is what gets stored. No
//     cropper, because the viewfinder IS the crop — you already framed it.
//
//   LIBRARY →  pickFromLibrary() → PhotoCropper → cropAndPersist().
//     The cropper stays here, where it earns its keep: pulling one face out of a
//     photo of three people. Its dimensions come from ImagePicker, which reports
//     them reliably.
//
//   WHY THEY WERE SPLIT: routing the camera through the cropper put three
//   coordinate systems in a row — the preview's window on the sensor, the full
//   sensor frame the capture returns, and the cropper re-deriving the frame from
//   REPORTED dimensions. The cropper's display reads the file directly while
//   computeCropRect reads those reported numbers, so when the two disagreed the
//   screen kept looking right and only the saved photo was wrong — invisible to
//   every screenshot. Deleting the seam removes that whole class of bug from the
//   camera path rather than merely fixing today's instance of it.
//
// FileSystem: migrated to the new object-based expo-file-system API
// (File / Directory / Paths), the default export since SDK 54. The old
// top-level methods (getInfoAsync, makeDirectoryAsync, copyAsync, deleteAsync)
// now THROW when imported from 'expo-file-system', which had been silently
// breaking persist() — a picked photo was left as a volatile cache URI instead
// of being copied into the app's document directory, so it could vanish when
// the OS evicted the cache. The new API restores reliable persistence.
//   Old top-level method            New object API
//   getInfoAsync(dir).exists    ->  new Directory(...).exists
//   makeDirectoryAsync(dir)     ->  directory.create()
//   copyAsync({ from, to })     ->  new File(from).copy(new File(dir, name))
//   getInfoAsync(uri).exists    ->  new File(uri).exists
//   deleteAsync(uri)            ->  new File(uri).delete()
//
// Photos library: still the class-based expo-media-library/next API
// (Asset.create), unchanged.

import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { File, Directory, Paths } from 'expo-file-system';
import { Asset, requestPermissionsAsync } from 'expo-media-library/next';
import { Alert } from 'react-native';

// Persisted copies live in <documentDirectory>/part-photos/.
function photosDir() {
  return new Directory(Paths.document, 'part-photos');
}

// Resolve a STORED photo value to an absolute file URI for display/IO. Stored
// values are relative filenames (see persist) — we rebuild the absolute URI
// against the CURRENT document directory, so a photo stays reachable even if the
// app's data-container path changes across a reinstall/update. An already-
// absolute value (legacy data, or an in-flight pick) is returned unchanged.
export function photoUri(stored) {
  if (!stored || typeof stored !== 'string') return stored;
  if (stored.startsWith('file:') || stored.startsWith('/')) return stored;
  try { return new File(photosDir(), stored).uri; }
  catch (e) { console.warn('photoUri failed', e); return stored; }
}

async function ensureDir() {
  try {
    const dir = photosDir();
    if (!dir.exists) await dir.create();
  } catch (e) { console.warn('ensureDir failed', e); }
}

// Copy a picked/captured photo into app documents so it survives cache
// eviction, and return the RELATIVE filename to store (never the absolute URI —
// that embeds the data-container UUID, which iOS can change across reinstalls/
// updates; photoUri() rebuilds the absolute path at read time). Preserve the
// ORIGINAL file extension when copying so the bytes and the extension always
// match (an earlier bug renamed HEIC files to .jpg, which broke saving them
// back to Photos).
async function persist(sourceUri) {
  await ensureDir();
  const rawExt = (sourceUri.split('.').pop() || 'jpg').split('?')[0].toLowerCase();
  const ext = rawExt.match(/^[a-z0-9]{2,4}$/) ? rawExt : 'jpg';
  try {
    const fileName = Date.now() + '.' + ext;
    const src = new File(sourceUri);
    const dest = new File(photosDir(), fileName);
    await src.copy(dest);
    return fileName;
  } catch (e) {
    console.warn('persist failed', e);
    return sourceUri;
  }
}

// Output constraints for a persisted reference photo. These exist because the
// photo is a REFERENCE (recognise a filter / read a model number a year later),
// not a keepsake — so we can trade fidelity for small, sync-friendly files.
//
// MAX_PHOTO_EDGE caps the LONGER edge, bounding the worst case: an uncropped
// full-res import (tested: an 8.5 MB photo) comes down to well under 200 KB.
// PHOTO_COMPRESS 0.5 was chosen by comparing the same filter photo at 0.4-0.85 —
// 0.5 is imperceptible on screen (the real viewing condition) while roughly a
// third the size of 0.85. 1024 is ample to read a printed model number. Both
// only affect NEWLY added photos; existing stored photos are untouched.
//
// If part-number text ever looks soft, raise PHOTO_COMPRESS to 0.6 (small size
// cost) before touching the dimension cap.
const MAX_PHOTO_EDGE = 1024;
const PHOTO_COMPRESS = 0.5;

// The capture viewfinder is a 3:4 PORTRAIT box that the preview FILLS (cover),
// so the visible region is the centred 3:4 rectangle of the sensor frame. Must
// stay in sync with CameraCaptureModal's frame and the 3:4 strip slot.
const VIEWFINDER_ASPECT = 3 / 4;

// The centred window of a WxH frame that a covering 3:4 preview displayed.
// Exported for unit testing. Returns null when the frame is already 3:4 (no crop
// needed) or the inputs are unusable.
export function viewfinderWindow(W, H) {
  if (!W || !H) return null;
  let cw = W;
  let ch = H;
  if (W / H > VIEWFINDER_ASPECT) cw = Math.round(H * VIEWFINDER_ASPECT);
  else if (W / H < VIEWFINDER_ASPECT) ch = Math.round(W / VIEWFINDER_ASPECT);
  cw = Math.max(1, Math.min(W, cw));
  ch = Math.max(1, Math.min(H, ch));
  if (cw === W && ch === H) return null;
  return {
    originX: Math.round((W - cw) / 2),
    originY: Math.round((H - ch) / 2),
    width: cw,
    height: ch,
  };
}

// CAMERA PATH. Takes the raw capture and returns the STORED relative filename,
// ready to drop into the strip. Point, shoot, saved.
//
// Steps, all inside the manipulator so nothing has to be re-measured or
// re-derived by anyone else:
//   1. Bake EXIF orientation into the pixels. The dimensions of the result come
//      from the manipulator that wrote it — the same source of truth as the
//      pixels, so they cannot drift.
//   2. Trim to the viewfinder window. Capture in portrait and the sensor frame
//      is already 3:4, so this is usually a no-op; it's here so an unusual
//      sensor aspect still produces exactly what was framed.
//   3. Cap the longer edge and compress.
//   4. Persist into app documents.
//
// Returns the stored filename, or null on failure (the caller adds nothing).
export async function captureAndPersist(uri, rawWidth, rawHeight) {
  try {
    // 1. Bake orientation; read the dimensions off what was actually written.
    const bakeCtx = ImageManipulator.manipulate(uri);
    const bakeRef = await bakeCtx.renderAsync();
    const baked = await bakeRef.saveAsync({ compress: 1, format: SaveFormat.JPEG });
    const W = baked.width || bakeRef.width || 0;
    const H = baked.height || bakeRef.height || 0;

    const win = viewfinderWindow(W, H);
    console.log('[TFL capture]', JSON.stringify({
      raw: { w: rawWidth, h: rawHeight },
      baked: { w: W, h: H },
      window: win || 'none (already 3:4)',
    }));

    // 2-3. Trim to the viewfinder window, then cap the longer edge.
    const outCtx = ImageManipulator.manipulate(baked.uri);
    const finalW = win ? win.width : W;
    const finalH = win ? win.height : H;
    if (win) outCtx.crop(win);
    if (finalW && finalH && Math.max(finalW, finalH) > MAX_PHOTO_EDGE) {
      if (finalH >= finalW) outCtx.resize({ height: MAX_PHOTO_EDGE });
      else outCtx.resize({ width: MAX_PHOTO_EDGE });
    }
    const outRef = await outCtx.renderAsync();
    const out = await outRef.saveAsync({ compress: PHOTO_COMPRESS, format: SaveFormat.JPEG });

    // 4. Persist.
    return await persist(out.uri);
  } catch (e) {
    console.warn('captureAndPersist failed, persisting raw capture', e);
    try { return await persist(uri); } catch (_) { return null; }
  }
}

// LIBRARY PATH. Crop a source image to `cropRect` ({ originX, originY, width,
// height } in source pixels) from the custom PhotoCropper, cap the longer edge,
// compress, and persist. Returns the stored relative filename. Falls back to
// persisting the uncropped source if manipulation fails.
export async function cropAndPersist(sourceUri, cropRect) {
  try {
    const ctx = ImageManipulator.manipulate(sourceUri);
    ctx.crop(cropRect);
    // Crop is 3:4 portrait, so height is the longer edge — cap by height.
    const longer = Math.max(cropRect.width, cropRect.height);
    if (longer > MAX_PHOTO_EDGE) {
      if (cropRect.height >= cropRect.width) ctx.resize({ height: MAX_PHOTO_EDGE });
      else ctx.resize({ width: MAX_PHOTO_EDGE });
    }
    const ref = await ctx.renderAsync();
    const out = await ref.saveAsync({ compress: PHOTO_COMPRESS, format: SaveFormat.JPEG });
    return await persist(out.uri);
  } catch (e) {
    console.warn('cropAndPersist failed', e);
    return await persist(sourceUri);
  }
}

// Library import: pick a photo and return it as an asset { uri, width, height }
// for the custom PhotoCropper (which does pinch/zoom/pan and calls
// cropAndPersist on confirm). Returns null on cancel.
export async function pickFromLibrary() {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    Alert.alert('Photo access needed', 'Please allow photo access in Settings to attach photos.');
    return null;
  }
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: false, // our custom PhotoCropper handles crop/zoom
    quality: 1,
  });
  if (res.canceled || !res.assets || !res.assets[0]) return null;
  const a = res.assets[0];
  return { uri: a.uri, width: a.width, height: a.height };
}

export async function saveToPhotos(stored) {
  const uri = photoUri(stored);
  // Sanity check: the source file must exist.
  try {
    if (!new File(uri).exists) {
      Alert.alert('Save failed', 'The photo file is missing.');
      console.warn('saveToPhotos: file does not exist', uri);
      return false;
    }
  } catch (e) {
    console.warn('saveToPhotos: existence check threw', e);
  }

  const { status } = await requestPermissionsAsync();
  if (status !== 'granted') {
    Alert.alert('Photos access needed', 'Please allow Photos access in Settings to save photos.');
    return false;
  }

  try {
    const asset = await Asset.create(uri);
    console.log('saveToPhotos: success', asset);
    return true;
  } catch (e) {
    const msg = (e && e.message) ? e.message : String(e);
    console.warn('saveToPhotos: Asset.create threw', msg, e);
    Alert.alert('Save failed', `Could not save the photo.\n\n${msg}`);
    return false;
  }
}

export async function deleteFile(stored) {
  if (!stored) return;
  const uri = photoUri(stored);
  try {
    // Only delete files we persisted into app documents — never touch a
    // cache/library URI we didn't copy.
    if (uri.startsWith(Paths.document.uri)) {
      const f = new File(uri);
      if (f.exists) await f.delete();
    }
  } catch (e) { console.warn('deleteFile failed', e); }
}
