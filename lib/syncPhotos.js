// File: lib/syncPhotos.js → ~/Projects/thefilterlist/lib/syncPhotos.js
//
// Moving photo BYTES for sync, and deciding which ones to move.
//
// Photos are the easy half of sync precisely because they're immutable: the app
// writes `<epoch-ms>.jpg` once and never rewrites it. So there is no merge, no
// conflict, no timestamp comparison — a photo either exists somewhere or it
// doesn't. All the reasoning fits in planPhotoWork below, which is pure and
// tested.
//
// WHY THE LEGACY FileSystem API HERE:
//   Uploading and downloading raw bytes in React Native is a well-known source
//   of subtle breakage — base64 conversions, Blob support that varies by
//   platform, fetch bodies that silently stringify a Uint8Array. The legacy
//   `uploadAsync`/`downloadAsync` helpers do the binary handling natively, take
//   auth headers, and write straight to a file path. lib/backup.js already uses
//   this same legacy import successfully in this app, which makes it the proven
//   path rather than the theoretically nicer one.
//
//   Note this is `expo-file-system/legacy`, NOT the bare `expo-file-system`
//   top-level API — the latter now throws, which is what silently broke photo
//   persistence once already (see the header of lib/filterPhotos.js).

import * as FileSystem from 'expo-file-system/legacy';

const PHOTO_DIR = `${FileSystem.documentDirectory}part-photos/`;

function photoPath(filename) {
  return `${PHOTO_DIR}${filename}`;
}

async function ensureDir() {
  try {
    const info = await FileSystem.getInfoAsync(PHOTO_DIR);
    if (!info.exists) {
      await FileSystem.makeDirectoryAsync(PHOTO_DIR, { intermediates: true });
    }
  } catch (e) {
    console.warn('[TFL sync] ensureDir failed', e);
  }
}

/** Filenames actually present in part-photos on this device. */
export async function listLocalPhotos() {
  try {
    const info = await FileSystem.getInfoAsync(PHOTO_DIR);
    if (!info.exists) return [];
    return await FileSystem.readDirectoryAsync(PHOTO_DIR);
  } catch (e) {
    console.warn('[TFL sync] listLocalPhotos failed', e);
    return [];
  }
}

// ---------------------------------------------------------------------------
// The plan (pure — this is the part with the actual reasoning in it)
// ---------------------------------------------------------------------------
/**
 * Work out which photos to upload and which to download.
 *
 *   localNames     what's on this device's disk
 *   referenced     filenames any live local filter points at
 *   serverLive     filenames the server says it holds
 *   serverDeleted  filenames the server says are gone
 *
 * UPLOAD: referenced here, on disk here, unknown to the server.
 *   The "referenced" condition matters — a file left on disk after its filter
 *   was deleted shouldn't be uploaded just because it's still lying around.
 *
 * DOWNLOAD: referenced here, held by the server, missing from disk.
 *   This is the case that makes a second device useful: it pulled the filter
 *   record, so it knows a photo's name, but has never seen the bytes.
 *
 * DELETE LOCALLY: the server says gone AND nothing local references it.
 *   Both conditions are required. Deleting on the server's word alone would
 *   destroy a photo belonging to a filter this device has legitimately
 *   re-created — losing user data to obey a stale instruction.
 */
export function planPhotoWork({ localNames, referenced, serverLive, serverDeleted }) {
  const local = new Set(localNames || []);
  const refs = referenced instanceof Set ? referenced : new Set(referenced || []);
  const live = new Set(serverLive || []);
  const gone = new Set(serverDeleted || []);

  const upload = [];
  const download = [];
  const deleteLocal = [];

  for (const name of refs) {
    if (local.has(name) && !live.has(name)) upload.push(name);
    else if (!local.has(name) && live.has(name)) download.push(name);
  }

  for (const name of gone) {
    if (local.has(name) && !refs.has(name)) deleteLocal.push(name);
  }

  return { upload, download, deleteLocal };
}

// ---------------------------------------------------------------------------
// Transfer
// ---------------------------------------------------------------------------
/**
 * Upload one photo. Returns true on success.
 *
 * The server dedupes by filename, so re-uploading is safe and cheap — an
 * interrupted sync just retries. Never throws: one unreachable photo must not
 * abort the rest of a sync.
 */
export async function uploadPhoto(config, filename) {
  try {
    const path = photoPath(filename);
    const info = await FileSystem.getInfoAsync(path);
    if (!info.exists) return false;

    const res = await FileSystem.uploadAsync(
      `${config.url}/v1/photos/${encodeURIComponent(filename)}`,
      path,
      {
        httpMethod: 'PUT',
        uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
        headers: { authorization: `Bearer ${config.token}` },
      }
    );
    return res.status >= 200 && res.status < 300;
  } catch (e) {
    console.warn('[TFL sync] uploadPhoto failed', filename, e && e.message);
    return false;
  }
}

/**
 * Download one photo into part-photos. Returns true on success.
 *
 * Downloads to a temporary name first, then moves it into place. A partial
 * download landing at the real filename would look like a valid photo forever
 * after — the file exists, so nothing would ever try to fetch it again, and the
 * user would have a permanently corrupt thumbnail with no way to fix it.
 */
export async function downloadPhoto(config, filename) {
  const tmp = `${FileSystem.cacheDirectory}sync-${filename}`;
  try {
    await ensureDir();
    const res = await FileSystem.downloadAsync(
      `${config.url}/v1/photos/${encodeURIComponent(filename)}`,
      tmp,
      { headers: { authorization: `Bearer ${config.token}` } }
    );
    if (res.status !== 200) {
      try { await FileSystem.deleteAsync(tmp, { idempotent: true }); } catch (_) {}
      return false;
    }
    await FileSystem.moveAsync({ from: tmp, to: photoPath(filename) });
    return true;
  } catch (e) {
    console.warn('[TFL sync] downloadPhoto failed', filename, e && e.message);
    try { await FileSystem.deleteAsync(tmp, { idempotent: true }); } catch (_) {}
    return false;
  }
}

/** Remove a local photo file. Only called for names planPhotoWork cleared. */
export async function deleteLocalPhoto(filename) {
  try {
    await FileSystem.deleteAsync(photoPath(filename), { idempotent: true });
    return true;
  } catch (e) {
    console.warn('[TFL sync] deleteLocalPhoto failed', filename, e && e.message);
    return false;
  }
}
