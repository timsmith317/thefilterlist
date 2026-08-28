// File: lib/sync.js → ~/Projects/thefilterlist/lib/sync.js
//
// The merge. Pure functions only — no network, no filesystem, no AsyncStorage.
// Everything here takes a document and returns a new one, which is what makes it
// testable in plain node against the same scenarios the server was tested with.
//
// WHY THIS FILE IS SEPARATE FROM THE TRANSPORT:
//   Sync bugs are hard to see because both halves look fine in isolation — the
//   screen shows the right thing and the stored data is wrong, or the right data
//   arrives and gets applied to the wrong record. Keeping the decision logic
//   pure means every one of those cases is a unit test rather than a
//   two-device experiment with a rebuild in the middle.
//
// THE MERGE RULE, IDENTICAL TO THE SERVER'S:
//   Last write wins on updatedAt. On an exact tie, delete wins. Both halves must
//   agree exactly — if the client resolved a tie one way and the server the
//   other, the two would push conflicting states at each other forever, and the
//   user would watch a filter flip back and forth on its own.
//
// See worker/migrations/0001_init.sql for the server-side statement of the same
// rule. If you change one, change both.

// Record type -> the array it lives in. `settings` is deliberately absent: it's
// a single object on the document, not a list, and is handled separately.
const COLLECTION = {
  asset: 'assets',
  filter: 'filters',
  device: 'devices',
};

export const SETTINGS_ID = 'settings';

// ---------------------------------------------------------------------------
// Sync metadata
// ---------------------------------------------------------------------------
// Lives on the document so it survives with the data and needs no second store.
//
//   cursor      highest server_seq this device has fully applied
//   lastPushAt  highest updatedAt this device has successfully pushed
//
// lastPushAt is what makes "what do I owe the server?" answerable without
// tracking a dirty flag on every record: anything stamped later than the last
// successful push hasn't been sent. It's compared against the LOCAL clock only —
// both sides of the comparison are this device's own timestamps, so a device
// whose clock is wrong is still self-consistent.
export function getSyncMeta(data) {
  const m = (data && data.syncMeta) || {};
  return {
    cursor: typeof m.cursor === 'number' ? m.cursor : 0,
    lastPushAt: typeof m.lastPushAt === 'number' ? m.lastPushAt : 0,
  };
}

export function setSyncMeta(data, patch) {
  return { ...data, syncMeta: { ...getSyncMeta(data), ...patch } };
}

function indexById(list) {
  const map = new Map();
  for (const r of (list || [])) if (r && r.id) map.set(r.id, r);
  return map;
}

function tombstoneFor(data, type, id) {
  return (data.tombstones || []).find(t => t && t.type === type && t.id === id) || null;
}

// ---------------------------------------------------------------------------
// The decision
// ---------------------------------------------------------------------------
/**
 * Should the remote version replace what we have locally?
 *
 * `localAt`  the local record's updatedAt, or a local tombstone's deletedAt
 * `localDeleted` whether the local side is a tombstone
 *
 * Returns true to take the remote version. Exported so the tie-break can be
 * tested directly rather than inferred from a merged document.
 */
export function remoteWins(localAt, localDeleted, remoteAt, remoteDeleted) {
  if (localAt === undefined || localAt === null) return true;  // nothing local
  if (remoteAt > localAt) return true;
  if (remoteAt < localAt) return false;
  // Exact tie: a delete beats a live record; anything else keeps what we have.
  return !!remoteDeleted && !localDeleted;
}

// ---------------------------------------------------------------------------
// Applying a pulled page
// ---------------------------------------------------------------------------
/**
 * Merge one page of server changes into the local document.
 *
 * Returns { data, cursor, livePhotos, deletedPhotos, stats }.
 *   livePhotos    filenames the server says exist — the caller diffs these
 *                 against local files to decide what to download
 *   deletedPhotos filenames the server says are gone
 *
 * Photo BYTES are not this module's business; it only reports what the server
 * claims exists. Keeping the filesystem out of here is what keeps it testable.
 *
 * The caller must only advance its stored cursor after this returns AND the
 * result has been persisted. Advancing first would mean an interrupted sync
 * skips the page it never applied.
 */
export function applyPage(data, changes) {
  let next = { ...data };
  // Work on copies so a partially-applied merge can't mutate the caller's doc.
  for (const key of Object.values(COLLECTION)) {
    next[key] = [...(next[key] || [])];
  }
  next.tombstones = [...(next.tombstones || [])];

  const livePhotos = [];
  const deletedPhotos = [];
  const stats = { applied: 0, skipped: 0, deleted: 0, resurrected: 0, photos: 0 };
  let cursor = getSyncMeta(data).cursor;

  for (const change of (changes || [])) {
    if (!change || typeof change.seq !== 'number') continue;
    cursor = Math.max(cursor, change.seq);

    if (change.kind === 'photo') {
      stats.photos++;
      if (change.deletedAt) deletedPhotos.push(change.filename);
      else livePhotos.push(change.filename);
      continue;
    }

    if (change.kind !== 'record') continue;

    if (change.type === 'settings') {
      const localAt = (next.settings && next.settings.updatedAt) || 0;
      if (remoteWins(localAt, false, change.updatedAt, false) && change.body) {
        next.settings = { ...change.body, updatedAt: change.updatedAt };
        stats.applied++;
      } else stats.skipped++;
      continue;
    }

    const collection = COLLECTION[change.type];
    if (!collection) { stats.skipped++; continue; }

    const list = next[collection];
    const idx = list.findIndex(r => r && r.id === change.id);
    const local = idx >= 0 ? list[idx] : null;
    const localTomb = local ? null : tombstoneFor(next, change.type, change.id);

    const localAt = local ? local.updatedAt
                  : localTomb ? localTomb.deletedAt
                  : undefined;
    const localDeleted = !local && !!localTomb;

    if (!remoteWins(localAt, localDeleted, change.updatedAt, !!change.deletedAt)) {
      stats.skipped++;
      continue;
    }

    if (change.deletedAt) {
      // Remote deleted it and won. Drop the record and record the tombstone, so
      // this device's own state stays self-describing — a device that knows a
      // record is gone but holds no tombstone would re-add it the moment a third
      // device pushed the record back.
      if (idx >= 0) list.splice(idx, 1);
      next.tombstones = [
        ...next.tombstones.filter(t => !(t.type === change.type && t.id === change.id)),
        { type: change.type, id: change.id, deletedAt: change.deletedAt },
      ];
      stats.deleted++;
      continue;
    }

    // Remote has a live version that wins. If we were holding a tombstone, this
    // is a genuine resurrection — someone deleted it here and recreated it
    // elsewhere later. Clearing the tombstone matters: leaving it would let the
    // next push delete the record we just accepted.
    const record = { ...change.body, id: change.id, updatedAt: change.updatedAt };
    if (localTomb) {
      next.tombstones = next.tombstones.filter(
        t => !(t.type === change.type && t.id === change.id)
      );
      stats.resurrected++;
    }
    if (idx >= 0) list[idx] = record;
    else list.push(record);
    stats.applied++;
  }

  next = setSyncMeta(next, { cursor });
  return { data: next, cursor, livePhotos, deletedPhotos, stats };
}

// ---------------------------------------------------------------------------
// Collecting what to push
// ---------------------------------------------------------------------------
/**
 * Everything stamped since the last successful push.
 *
 * Returns { records, highWater }. `highWater` is the largest timestamp in the
 * batch; the caller stores it as lastPushAt ONLY after the server confirms,
 * so a failed push is simply retried rather than silently dropped.
 *
 * A record may be sent that the server already has at the same timestamp — an
 * echo of something we just pulled. That's harmless: the server's `>` comparison
 * rejects it, and because highWater then advances past it, it isn't sent again.
 * Suppressing echoes would need a dirty flag on every record, which is more
 * state to keep correct than the echo costs.
 */
export function collectPush(data) {
  const { lastPushAt } = getSyncMeta(data);
  const records = [];
  let highWater = lastPushAt;

  for (const [type, key] of Object.entries(COLLECTION)) {
    for (const r of (data[key] || [])) {
      if (!r || !r.id) continue;
      const at = r.updatedAt || 0;
      if (at <= lastPushAt) continue;
      records.push({ type, id: r.id, updatedAt: at, body: stripLocalFields(r) });
      if (at > highWater) highWater = at;
    }
  }

  const settingsAt = (data.settings && data.settings.updatedAt) || 0;
  if (settingsAt > lastPushAt) {
    records.push({
      type: 'settings',
      id: SETTINGS_ID,
      updatedAt: settingsAt,
      body: data.settings,
    });
    if (settingsAt > highWater) highWater = settingsAt;
  }

  // Tombstones travel as deletes. updatedAt MUST carry deletedAt, because that's
  // the value the server compares against the live record's timestamp — send the
  // wrong one and a delete either loses to the record it's meant to remove or
  // wins against edits that came after it.
  for (const t of (data.tombstones || [])) {
    if (!t || !t.type || !t.id) continue;
    const at = t.deletedAt || 0;
    if (at <= lastPushAt) continue;
    records.push({ type: t.type, id: t.id, updatedAt: at, deletedAt: at });
    if (at > highWater) highWater = at;
  }

  return { records, highWater };
}

// Fields that are meaningful only on this device and shouldn't be replicated.
// __starter is the sample-data marker: it arms "Delete Sample Data", and a
// device that received it from another device could offer to delete items the
// user had already kept deliberately.
function stripLocalFields(record) {
  const { __starter, ...rest } = record;
  return rest;
}

/** Record a successful push. Call ONLY after the server has confirmed. */
export function markPushed(data, highWater) {
  const { lastPushAt } = getSyncMeta(data);
  return setSyncMeta(data, { lastPushAt: Math.max(lastPushAt, highWater || 0) });
}

/**
 * Photo filenames referenced by any live filter. The caller diffs this against
 * what's on disk and against what the server reports to decide what to upload
 * and what to download.
 */
export function referencedPhotos(data) {
  const names = new Set();
  for (const f of (data.filters || [])) {
    for (const p of (f && f.photos) || []) if (typeof p === 'string' && p) names.add(p);
  }
  return names;
}

/**
 * Reset sync state so the next sync re-pulls everything from scratch.
 *
 * Needed after a RESTORE: a backup carries the exporting device's cursor, and a
 * device that adopts it would believe it had already seen server changes it has
 * never applied — those records would never arrive, silently. Resetting to 0
 * costs one full pull and is always correct.
 */
export function resetSyncState(data) {
  return setSyncMeta(data, { cursor: 0, lastPushAt: 0 });
}
