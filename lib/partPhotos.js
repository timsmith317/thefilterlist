// lib/partPhotos.js — pick, persist, save, and delete Part reference photos.
// Uses the NEW class-based expo-media-library/next API. The previous
// createAssetAsync was itself deprecated; Asset.create is the replacement.

import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { Asset, requestPermissionsAsync } from 'expo-media-library/next';
import { Alert } from 'react-native';

const PHOTO_DIR = FileSystem.documentDirectory + 'part-photos/';

async function ensureDir() {
  try {
    const info = await FileSystem.getInfoAsync(PHOTO_DIR);
    if (!info.exists) await FileSystem.makeDirectoryAsync(PHOTO_DIR, { intermediates: true });
  } catch (e) { console.warn('ensureDir failed', e); }
}

// Preserve the ORIGINAL file extension when copying into app docs so that
// the bytes and the extension always match (the bug in earlier versions
// renamed HEIC files to .jpg which broke saving back to Photos).
async function persist(sourceUri) {
  await ensureDir();
  const rawExt = (sourceUri.split('.').pop() || 'jpg').split('?')[0].toLowerCase();
  const ext = rawExt.match(/^[a-z0-9]{2,4}$/) ? rawExt : 'jpg';
  const dest = PHOTO_DIR + Date.now() + '.' + ext;
  try {
    await FileSystem.copyAsync({ from: sourceUri, to: dest });
    return dest;
  } catch (e) {
    console.warn('persist failed', e);
    return sourceUri;
  }
}

export async function pickFromLibrary() {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    Alert.alert('Photo access needed', 'Please allow photo access in Settings to attach photos.');
    return null;
  }
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions ? ImagePicker.MediaTypeOptions.Images : ['images'],
    allowsEditing: false,
    quality: 0.85,
  });
  if (res.canceled || !res.assets || !res.assets[0]) return null;
  return await persist(res.assets[0].uri);
}

export async function takePhoto() {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) {
    Alert.alert('Camera access needed', 'Please allow camera access in Settings to take photos.');
    return null;
  }
  const res = await ImagePicker.launchCameraAsync({
    mediaTypes: ImagePicker.MediaTypeOptions ? ImagePicker.MediaTypeOptions.Images : ['images'],
    allowsEditing: false,
    quality: 0.85,
  });
  if (res.canceled || !res.assets || !res.assets[0]) return null;
  return await persist(res.assets[0].uri);
}

// Save to Photos library via the new class-based API.
// Pattern from Expo docs: requestPermissionsAsync() then Asset.create(uri).
export async function saveToPhotos(uri) {
  // Sanity check: file must exist
  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (!info.exists) {
      Alert.alert('Save failed', 'The photo file is missing.');
      console.warn('saveToPhotos: file does not exist', uri);
      return false;
    }
  } catch (e) {
    console.warn('saveToPhotos: getInfoAsync threw', e);
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
    if (uri.startsWith(FileSystem.documentDirectory)) {
      await FileSystem.deleteAsync(uri, { idempotent: true });
    }
  } catch (e) { console.warn('deleteFile failed', e); }
}
