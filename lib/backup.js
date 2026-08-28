// File: lib/backup.js → ~/Projects/thefilterlist/lib/backup.js
//
// lib/backup.js
//
// Full backup & restore to a single portable .filter file. Adapted from the
// Hanger app's backup.ts pattern with these differences:
//
//   - Single AsyncStorage key (thefilterlist.data.v5) instead of two
//   - Photos live under data.filters[].photos[] as bare filenames
//   - On restore, photos go to <documentDirectory>/part-photos/ — the same
//     place the app keeps them — and references are stored as relative
//     filenames so they're stable across reinstalls
//   - Notification sync runs after restore so the device's scheduled
//     notifications match the restored device set
//
// Backup file shape (JSON inside a ".filter" file):
//   {
//     format:      'thefilterlist-backup',
//     version:     1,
//     exportedAt:  ISO timestamp,
//     data:        the entire AsyncStorage value (categories, assets,
//                  devices, filters, settings),
//     photos:      { '<filename>': '<base64>', ... }
//   }
//
// SYNC FIELDS (schemaVersion 4): `data` now carries per-record `updatedAt`
// stamps and a `tombstones` array. Both pass through export and restore
// untouched — they are part of the data, not metadata about the file. Two
// consequences worth knowing:
//
//   - Restoring an older backup (no stamps) is safe: store.js's migrateSyncFields
//     stamps everything on the next load. Those records will all carry the same
//     timestamp, which is correct — we genuinely don't know when they last
//     changed.
//   - Tombstones are carried deliberately. A backup taken after you deleted a
//     filter should not resurrect it, and once sync exists, restoring a backup
//     that had "forgotten" a deletion would push the deleted record back to
//     every other device.
//
// BACKUP_VERSION stays 1: the envelope is unchanged and older builds reading a
// newer file would simply ignore fields they don't know about.
//
// Validation is by the internal `format` field — file extension is purely
// cosmetic. Older or renamed files (e.g. .json) restore fine as long as
// their `format` field matches.

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
// NOTE: expo-document-picker is intentionally NOT imported here. It's a native
// module and is loaded lazily inside pickBackupFile() instead — see the comment
// there. expo-file-system and expo-sharing stay top-level since they're core and
// always present in our builds.

// Single source of truth — same key the store reads/writes. Importing it (vs.
// hardcoding) is what guarantees backup can never drift off the store's schema
// version again.
import { KEY as STORAGE_KEY } from '../data/store';

const BACKUP_FORMAT    = 'thefilterlist-backup';
const BACKUP_VERSION   = 1;
const BACKUP_EXTENSION = 'filter';

// Photos live under <documentDirectory>/part-photos/ as bare filenames — the
// same location the app uses (see data/store.js / lib/filterPhotos). Storing
// relative names keeps them stable across reinstalls; the absolute path is
// rebuilt at render time. Restore writes here and stores relative names so the
// restored data matches the app's model exactly.
const PHOTO_DIR = `${FileSystem.documentDirectory}part-photos/`;

// ----- Helpers -----

function basename(uri) {
  if (!uri) return '';
  const noQuery = String(uri).split('?')[0];
  const filters = noQuery.split('/');
  return filters[filters.length - 1] || '';
}

function collectPhotoUris(data) {
  if (!data) return [];
  const uris = [];
  for (const filter of (data.filters || [])) {
    if (Array.isArray(filter.photos)) uris.push(...filter.photos);
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

    // Read every photo as base64. Stored values are bare filenames resolved
    // against part-photos at render time, so rebuild the absolute path here
    // (falling back to the raw value for any legacy absolute URIs). Photos
    // missing on disk are silently skipped — the rest of the backup proceeds.
    const photoRefs = collectPhotoUris(data);
    const photos = {};
    for (const ref of photoRefs) {
      const name = basename(ref);
      if (!name) continue;
      const abs = ref === name ? `${PHOTO_DIR}${name}` : ref;
      try {
        const b64 = await FileSystem.readAsStringAsync(abs, {
          encoding: FileSystem.EncodingType.Base64,
        });
        if (b64) photos[name] = b64;
      } catch (e) {
        console.warn('exportBackup: skipping missing photo', abs);
      }
    }

    // Never export the sample-data marker: a restored backup must always count
    // as the user's own data, never re-deletable as "sample". (store.js owns it.)
    let outData = data;
    if (data && data.__starter) { const { __starter, ...rest } = data; outData = rest; }

    const backup = {
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      data: outData,
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
 * Show the iOS document picker. Returns the picked file URI, or null if the
 * user cancelled.
 *
 * expo-document-picker is loaded lazily here rather than at module top level so
 * that a missing or stale native module can never crash the Backup screen on
 * mount — at worst this single action no-ops. In any correctly built binary the
 * module is present; this guard only matters if a native dep falls out of sync
 * with the JS (e.g. a dev build that wasn't recompiled after the dep was added).
 */
export async function pickBackupFile() {
  let DocumentPicker;
  try {
    DocumentPicker = await import('expo-document-picker');
  } catch (err) {
    // Native module not in this build — rebuild (npx expo run:ios) to link it.
    console.warn(
      'pickBackupFile: expo-document-picker is unavailable in this build — ' +
      'rebuild the native app to link the module.',
      err
    );
    return null;
  }

  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: '*/*',           // allow any file — validation is by format field
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (result.canceled) return null;
    return result.assets?.[0]?.uri || null;
  } catch (err) {
    console.warn('pickBackupFile: document picker failed', err);
    return null;
  }
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
    deviceCount:   Array.isArray(d.devices)    ? d.devices.length    : 0,
    assetCount:    Array.isArray(d.assets)     ? d.assets.length     : 0,
    filterCount:     Array.isArray(d.filters)      ? d.filters.length      : 0,
    categoryCount: Array.isArray(d.categories) ? d.categories.length : 0,
    photoCount:    parsed.photos ? Object.keys(parsed.photos).length : 0,
    // schemaVersion 4+. Shown so a restore can be sanity-checked at a glance.
    schemaVersion: typeof d.schemaVersion === 'number' ? d.schemaVersion : null,
    tombstoneCount: Array.isArray(d.tombstones) ? d.tombstones.length : 0,
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
      await FileSystem.makeDirectoryAsync(PHOTO_DIR, { intermediates: true });
    } catch (_) {
      // Already exists, ignore.
    }

    // Write each backed-up photo into part-photos. Track which filenames
    // landed so we can keep only those references. Failures are logged but
    // don't abort the whole restore.
    const written = new Set();
    const photos = parsed.photos || {};
    for (const [filename, b64] of Object.entries(photos)) {
      const name = basename(filename);
      if (!name) continue;
      try {
        await FileSystem.writeAsStringAsync(`${PHOTO_DIR}${name}`, b64, {
          encoding: FileSystem.EncodingType.Base64,
        });
        written.add(name);
      } catch (err) {
        console.warn('Failed to write restored photo:', name, err);
      }
    }

    // Clone data and reduce each filter's photos to bare filenames — the
    // app's model (resolved against part-photos at render time). basename()
    // handles relative and absolute input, so backups from any era restore
    // cleanly. Drop any reference whose image didn't land on disk.
    const data = parsed.data;
    // Defensive: a backup should never carry the sample-data marker, but strip
    // it on restore too — restored data is always the user's own.
    if (data && data.__starter) delete data.__starter;
    if (Array.isArray(data.filters)) {
      data.filters = data.filters.map(filter => {
        if (!Array.isArray(filter.photos)) return filter;
        const newPhotos = filter.photos
          .map(p => basename(p))
          .filter(name => written.has(name));
        return { ...filter, photos: newPhotos };
      });
    }

    // Older backups predate the tombstone array; give it a default so the
    // restored document is already in the current shape rather than relying on
    // the next load's migration to add it.
    if (!Array.isArray(data.tombstones)) data.tombstones = [];

    // RESET SYNC STATE. A backup carries the EXPORTING device's cursor, and a
    // device that adopted it would believe it had already applied server changes
    // it has never seen — those records would simply never arrive, with no error
    // anywhere. Clearing it costs one full pull and is always correct.
    delete data.syncMeta;

    // Replace AsyncStorage with the restored data.
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));

    // Re-sync notifications. Dynamic import so a missing native module
    // can't tank the restore.
    try {
      const { syncDeviceNotifications } = await import('./notifications');
      await syncDeviceNotifications(data);
    } catch (e) {
      console.warn('post-restore notifications sync failed (non-fatal):', e);
    }

    return { ok: true };
  } catch (err) {
    console.error('applyRestore failed:', err);
    return { ok: false, reason: 'write-failed' };
  }
}