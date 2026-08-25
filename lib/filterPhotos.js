// lib/filterPhotos.js — pick, persist, save, and delete Filter reference photos.
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
// MAX_PHOTO_EDGE caps the LONGER edge (not a forced square), preserving the tall
// label/model-number strips this cropper is designed for while bounding the
// worst case: an uncropped full-res import (tested: an 8.5 MB photo) is brought
// down to well under 200 KB. PHOTO_COMPRESS 0.5 was chosen by comparing the same
// filter photo at 0.4-0.85 — 0.5 is imperceptible on screen (the real viewing
// condition) while roughly a third the size of 0.85. 1024 is ample to read a
// printed model number. Both only affect NEWLY added photos; existing stored
// photos are untouched.
//
// If part-number text ever looks soft, raise PHOTO_COMPRESS to 0.6 (small size
// cost) before touching the dimension cap.
const MAX_PHOTO_EDGE = 1024;
const PHOTO_COMPRESS = 0.5;

// Crop a source image to `cropRect` ({ originX, originY, width, height } in
// source pixels) via expo-image-manipulator, cap the longer edge, then persist
// into app documents. Falls back to persisting the original if manipulate fails
// so a photo is never lost.
export async function cropAndPersist(sourceUri, cropRect) {
  try {
    const ctx = ImageManipulator.manipulate(sourceUri);
    ctx.crop(cropRect);

    // Resize only when the crop is larger than the cap, and scale by the LONGER
    // edge so aspect ratio is preserved (passing one dimension lets the
    // manipulator compute the other). cropRect is in source pixels, so it tells
    // us the post-crop size without needing to read the rendered image back.
    const longer = Math.max(cropRect.width, cropRect.height);
    if (longer > MAX_PHOTO_EDGE) {
      if (cropRect.width >= cropRect.height) {
        ctx.resize({ width: MAX_PHOTO_EDGE });
      } else {
        ctx.resize({ height: MAX_PHOTO_EDGE });
      }
    }

    const ref = await ctx.renderAsync();
    const out = await ref.saveAsync({ compress: PHOTO_COMPRESS, format: SaveFormat.JPEG });
    return await persist(out.uri);
  } catch (e) {
    console.warn('cropAndPersist failed', e);
    return await persist(sourceUri);
  }
}

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

export async function takePhoto() {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) {
    Alert.alert('Camera access needed', 'Please allow camera access in Settings to take photos.');
    return null;
  }
  const res = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    allowsEditing: false, // our custom PhotoCropper handles crop/zoom
    quality: 1,
  });
  if (res.canceled || !res.assets || !res.assets[0]) return null;
  const a = res.assets[0];
  return { uri: a.uri, width: a.width, height: a.height };
}

// Save to the Photos library via the class-based API.
// Pattern from Expo docs: requestPermissionsAsync() then Asset.create(uri).
// Accepts either a stored relative filename or an absolute URI.
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