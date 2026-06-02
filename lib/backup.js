// lib/backup.js
//
// Full backup & restore to a single portable .filter file. Adapted from the
// Hanger app's backup.ts pattern with these differences:
//
//   - Single AsyncStorage key (thefilterlist.data.v2) instead of two
//   - Photos live under data.parts[].photos[]
//   - On restore, photos go to a known location (documentDirectory/fl-photos)
//     so they're stable across reinstalls
//   - Notification sync runs after restore so the device's scheduled
//     notifications match the restored filter set
//
// Backup file shape (JSON inside a ".filter" file):
//   {
//     format:      'thefilterlist-backup',
//     version:     1,
//     exportedAt:  ISO timestamp,
//     data:        the entire AsyncStorage value (categories, assets,
//                  filters, parts, settings),
//     photos:      { '<filename>': '<base64>', ... }
//   }
//
// Validation is by the internal `format` field — file extension is purely
// cosmetic. Older or renamed files (e.g. .json) restore fine as long as
// their `format` field matches.

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';

const STORAGE_KEY      = 'thefilterlist.data.v2';
const BACKUP_FORMAT    = 'thefilterlist-backup';
const BACKUP_VERSION   = 1;
const BACKUP_EXTENSION = 'filter';

// Permanent location for restored photos. expo-image-picker by default
// returns cache URIs, which iOS can purge — by writing restore photos here,
// they survive cache purges, reinstalls, and future backups.
const RESTORE_PHOTO_DIR = `${FileSystem.documentDirectory}fl-photos/`;

// ----- Helpers -----

function basename(uri) {
  if (!uri) return '';
  const noQuery = String(uri).split('?')[0];
  const parts = noQuery.split('/');
  return parts[parts.length - 1] || '';
}

function collectPhotoUris(data) {
  if (!data) return [];
  const uris = [];
  for (const part of (data.parts || [])) {
    if (Array.isArray(part.photos)) uris.push(...part.photos);
  }
  return Array.from(new Set(uris.filter(u => typeof u === 'string' && u)));
}

// ----- Export -----

/**
 * Build the backup file on disk. Returns the file URI (in cache dir) ready
 * to share, or null on failure.
 */
export async function exportBackup() {
  try {
    const dataJson = await AsyncStorage.getItem(STORAGE_KEY);
    const data = dataJson ? JSON.parse(dataJson) : null;

    // Read every photo as base64. Photos that are missing on disk (e.g.
    // cache was purged) are silently skipped — the rest of the backup
    // proceeds.
    const photoUris = collectPhotoUris(data);
    const photos = {};
    for (const uri of photoUris) {
      try {
        const b64 = await FileSystem.readAsStringAsync(uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        if (b64) photos[basename(uri)] = b64;
      } catch (e) {
        console.warn('exportBackup: skipping missing photo', uri);
      }
    }

    const backup = {
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      data,
      photos,
    };

    const date = new Date().toISOString().slice(0, 10);
    const fileUri = `${FileSystem.cacheDirectory}thefilterlist-backup-${date}.${BACKUP_EXTENSION}`;
    await FileSystem.writeAsStringAsync(fileUri, JSON.stringify(backup), {
      encoding: FileSystem.EncodingType.UTF8,
    });
    return fileUri;
  } catch (err) {
    console.error('exportBackup failed:', err);
    return null;
  }
}

/**
 * Open the iOS share sheet for the given file URI. User picks where to save
 * (Files, AirDrop, etc.).
 */
export async function shareBackup(fileUri) {
  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) throw new Error('Sharing is not available on this device.');
  await Sharing.shareAsync(fileUri, {
    mimeType: 'application/octet-stream',
    dialogTitle: 'Save your Filter List backup',
    // Neutral type so iOS preserves the ".filter" filename rather than
    // re-interpreting as JSON. If we later declare a custom UTI for .filter
    // in app.config.js, swap UTI to that identifier.
    UTI: 'public.data',
  });
}

// ----- Restore -----

/**
 * Show the iOS document picker. Returns the picked file URI, or null if
 * the user cancelled.
 */
export async function pickBackupFile() {
  const result = await DocumentPicker.getDocumentAsync({
    type: '*/*',           // allow any file — validation is by format field
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled) return null;
  return result.assets?.[0]?.uri || null;
}

/**
 * Read + parse + validate a backup file. On success, returns the parsed
 * payload PLUS a stats object suitable for showing in a preview UI. On
 * failure, returns { ok: false, reason }.
 *
 * This does NOT modify any device state — safe to call from a preview flow.
 */
export async function readAndValidateBackup(fileUri) {
  let parsed;
  try {
    const raw = await FileSystem.readAsStringAsync(fileUri, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    parsed = JSON.parse(raw);
  } catch (err) {
    console.error('readAndValidateBackup parse failed:', err);
    return { ok: false, reason: 'read-failed' };
  }

  if (!parsed || parsed.format !== BACKUP_FORMAT || !parsed.data) {
    return { ok: false, reason: 'invalid' };
  }

  const d = parsed.data;
  const stats = {
    exportedAt: parsed.exportedAt || null,
    version: parsed.version || 1,
    filterCount:   Array.isArray(d.filters)    ? d.filters.length    : 0,
    assetCount:    Array.isArray(d.assets)     ? d.assets.length     : 0,
    partCount:     Array.isArray(d.parts)      ? d.parts.length      : 0,
    categoryCount: Array.isArray(d.categories) ? d.categories.length : 0,
    photoCount:    parsed.photos ? Object.keys(parsed.photos).length : 0,
  };
  return { ok: true, parsed, stats };
}

/**
 * Apply a previously-validated restore payload. This OVERWRITES all current
 * data. The caller is responsible for confirming with the user first.
 *
 * Photos are written to a known permanent location and the photo URIs
 * inside the data are rewritten to match. Notifications are re-synced.
 */
export async function applyRestore(parsed) {
  try {
    // Ensure photo directory exists.
    try {
      await FileSystem.makeDirectoryAsync(RESTORE_PHOTO_DIR, { intermediates: true });
    } catch (_) {
      // Already exists, ignore.
    }

    // Write each backed-up photo. Map filename → new URI so we can remap
    // the data's photo arrays below. Failures are logged but don't abort
    // the whole restore.
    const nameToNewUri = {};
    const photos = parsed.photos || {};
    for (const [filename, b64] of Object.entries(photos)) {
      const newUri = `${RESTORE_PHOTO_DIR}${filename}`;
      try {
        await FileSystem.writeAsStringAsync(newUri, b64, {
          encoding: FileSystem.EncodingType.Base64,
        });
        nameToNewUri[filename] = newUri;
      } catch (err) {
        console.warn('Failed to write restored photo:', filename, err);
      }
    }

    // Clone data and rewrite each part's photo URIs to the new local paths.
    // basename() handles both relative and absolute input, so backups from
    // any era restore cleanly.
    const data = parsed.data;
    if (Array.isArray(data.parts)) {
      data.parts = data.parts.map(part => {
        if (!Array.isArray(part.photos)) return part;
        const newPhotos = part.photos
          .map(uri => nameToNewUri[basename(uri)] || null)
          .filter(Boolean);
        return { ...part, photos: newPhotos };
      });
    }

    // Replace AsyncStorage with the restored data.
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));

    // Re-sync notifications. Dynamic import so a missing native module
    // can't tank the restore.
    try {
      const { syncFilterNotifications } = await import('./notifications');
      await syncFilterNotifications(data);
    } catch (e) {
      console.warn('post-restore notifications sync failed (non-fatal):', e);
    }

    return { ok: true };
  } catch (err) {
    console.error('applyRestore failed:', err);
    return { ok: false, reason: 'write-failed' };
  }
}