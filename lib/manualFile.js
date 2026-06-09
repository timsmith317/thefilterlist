// lib/manualFile.js — pick, persist, open, and delete a Device's owner's-manual file.
//
// A device's owner's manual is either a WEB LINK or a FILE. This module covers
// the FILE side: picking one from the iOS document browser (which surfaces
// iCloud Drive, OneDrive, Dropbox, and On-My-iPhone), copying it into the app's
// document directory so it opens OFFLINE, opening it for preview, and deleting
// it when replaced/removed.
//
// FileSystem uses the object-based expo-file-system API (File / Directory /
// Paths) — the same one lib/filterPhotos.js uses. The old top-level methods throw
// when imported from 'expo-file-system' since SDK 54.
//
// Native modules (need a dev rebuild after install):
//   expo-document-picker  — the Files browser
//   expo-sharing          — Quick Look / share-sheet preview of a saved file
//   expo-file-system      — persist the copy (already a dep via filter photos)

import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import { File, Directory, Paths } from 'expo-file-system';
import { Alert } from 'react-native';

// Persisted manuals live in <documentDirectory>/manuals/.
function manualsDir() {
  return new Directory(Paths.document, 'manuals');
}

async function ensureDir() {
  try {
    const dir = manualsDir();
    if (!dir.exists) await dir.create();
  } catch (e) { console.warn('manuals ensureDir failed', e); }
}

// Open the document browser and return the picked file as { uri, name }. The
// uri is a CACHE copy (copyToCacheDirectory) — NOT yet persisted; the form
// persists it on Save so a cancel never leaves an orphan. Returns null on
// cancel/error. PDFs and images are offered (a manual is usually a PDF, but a
// scanned photo is fine too).
export async function pickManualFile() {
  try {
    const res = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/*'],
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (res.canceled || !res.assets || !res.assets[0]) return null;
    const a = res.assets[0];
    return { uri: a.uri, name: a.name || 'Owner\u2019s manual' };
  } catch (e) {
    console.warn('pickManualFile failed', e);
    Alert.alert('Could not open files', 'There was a problem opening the file picker.');
    return null;
  }
}

// Copy a freshly-picked file into app documents so it survives offline / cache
// eviction. If the uri is ALREADY under app documents (an existing saved
// manual being re-saved unchanged), returns it as-is. Returns { uri, name }.
export async function persistManualFile(file) {
  if (!file || !file.uri) return null;
  if (file.uri.startsWith(Paths.document.uri)) return file;   // already persisted
  await ensureDir();
  const safeName = (file.name || 'manual').replace(/[^\w.\-]+/g, '_');
  try {
    const src = new File(file.uri);
    const dest = new File(manualsDir(), Date.now() + '_' + safeName);
    await src.copy(dest);
    return { uri: dest.uri, name: file.name || safeName };
  } catch (e) {
    console.warn('persistManualFile failed', e);
    return file;   // fall back to the cache uri rather than losing the pick
  }
}

// Open a saved manual FILE for viewing (iOS preview / share sheet). Web links
// are opened by the caller (a plain Linking.openURL on the URL box).
export async function openManualFile(file) {
  if (!file || !file.uri) return;
  try {
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(file.uri);
    } else {
      Alert.alert('Cannot open', 'Previewing files is not available on this device.');
    }
  } catch (e) { console.warn('openManualFile failed', e); }
}

// Delete a persisted manual file. Only touches files we copied into app
// documents — never a cache uri or anything we didn't create.
export async function deleteManualFile(uri) {
  if (!uri) return;
  try {
    if (uri.startsWith(Paths.document.uri)) {
      const f = new File(uri);
      if (f.exists) await f.delete();
    }
  } catch (e) { console.warn('deleteManualFile failed', e); }
}

// Short label for an editor row, summarizing whatever is set.
export function manualSummary(url, file) {
  const u = (url || '').trim();
  if (u && file) return 'Link + file';
  if (file) return file.name || 'File';
  if (u) return u;
  return 'Add owner\u2019s manual';
}