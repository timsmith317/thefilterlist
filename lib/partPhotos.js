// lib/partPhotos.js — pick, persist, and save Part reference photos.
// No color correction, no Skia — just expo-image-picker for capture/selection,
// expo-file-system to copy into app docs (so URIs are stable), and
// expo-media-library to save to the iOS Photos library.

import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import { Alert } from 'react-native';

const PHOTO_DIR = FileSystem.documentDirectory + 'part-photos/';

async function ensureDir() {
  try {
    const info = await FileSystem.getInfoAsync(PHOTO_DIR);
    if (!info.exists) await FileSystem.makeDirectoryAsync(PHOTO_DIR, { intermediates: true });
  } catch (e) { console.warn('ensureDir failed', e); }
}

async function persist(sourceUri) {
  await ensureDir();
  const ext = (sourceUri.split('.').pop() || 'jpg').split('?')[0].toLowerCase();
  const dest = PHOTO_DIR + Date.now() + '.' + (ext === 'heic' ? 'jpg' : ext);
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

export async function saveToPhotos(uri) {
  const perm = await MediaLibrary.requestPermissionsAsync(true);
  if (!perm.granted) {
    Alert.alert('Photos access needed', 'Please allow Photos access in Settings to save photos.');
    return false;
  }
  try {
    await MediaLibrary.saveToLibraryAsync(uri);
    return true;
  } catch (e) {
    console.warn('saveToLibrary failed', e);
    Alert.alert('Save failed', 'Could not save the photo.');
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
