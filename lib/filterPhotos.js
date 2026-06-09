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

async function ensureDir() {
  try {
    const dir = photosDir();
    if (!dir.exists) await dir.create();
  } catch (e) { console.warn('ensureDir failed', e); }
}

// Copy a picked/captured photo into app documents so it survives cache
// eviction. Preserve the ORIGINAL file extension when copying so the bytes and
// the extension always match (an earlier bug renamed HEIC files to .jpg, which
// broke saving them back to Photos).
async function persist(sourceUri) {
  await ensureDir();
  const rawExt = (sourceUri.split('.').pop() || 'jpg').split('?')[0].toLowerCase();
  const ext = rawExt.match(/^[a-z0-9]{2,4}$/) ? rawExt : 'jpg';
  try {
    const src = new File(sourceUri);
    const dest = new File(photosDir(), Date.now() + '.' + ext);
    await src.copy(dest);
    return dest.uri;
  } catch (e) {
    console.warn('persist failed', e);
    return sourceUri;
  }
}

// Crop a source image to `cropRect` ({ originX, originY, width, height } in
// source pixels) via expo-image-manipulator, then persist into app documents.
// Falls back to persisting the original if manipulate fails so a photo is never
// lost.
export async function cropAndPersist(sourceUri, cropRect) {
  try {
    const ctx = ImageManipulator.manipulate(sourceUri);
    ctx.crop(cropRect);
    const ref = await ctx.renderAsync();
    const out = await ref.saveAsync({ compress: 0.85, format: SaveFormat.JPEG });
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
export async function saveToPhotos(uri) {
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

export async function deleteFile(uri) {
  if (!uri) return;
  try {
    // Only delete files we persisted into app documents — never touch a
    // cache/library URI we didn't copy.
    if (uri.startsWith(Paths.document.uri)) {
      const f = new File(uri);
      if (f.exists) await f.delete();
    }
  } catch (e) { console.warn('deleteFile failed', e); }
}