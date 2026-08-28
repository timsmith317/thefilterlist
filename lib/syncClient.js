// File: lib/syncClient.js → ~/Projects/thefilterlist/lib/syncClient.js
//
// Sync orchestration. This is the only file that talks to the network.
//
// THE CONTRACT, and it is not negotiable:
//   SYNC NEVER BREAKS THE APP. If the server is down, the token is wrong, the
//   network is gone, or the response is garbage, syncNow() returns a result
//   object saying so and the app carries on exactly as it does offline. Nothing
//   here throws to a caller, nothing blocks a screen, nothing shows an error
//   dialog for a transient failure. The app worked for months without a server
//   and must keep working the same way when one is unreachable.
//
// ORDER: push, then pull.
//   Pushing first shortens the window where a local edit exists on exactly one
//   device. The pull that follows will echo some of what was just pushed; that's
//   harmless and self-limiting (see collectPush in lib/sync.js).
//
// CURSOR SAFETY: the cursor advances only after a page has been applied AND
// persisted. Advancing on receipt instead would mean an app killed mid-page
// skips those changes permanently — the worst class of sync bug, because
// nothing ever reports an error and the data is simply, quietly missing.

import { loadData, saveData } from '../data/store';
import { applyPage, collectPush, markPushed, referencedPhotos, getSyncMeta } from './sync';
import { getConfig, isConfigured } from './syncConfig';
import {
  listLocalPhotos, planPhotoWork, uploadPhoto, downloadPhoto, deleteLocalPhoto,
} from './syncPhotos';

const PULL_PAGE_LIMIT = 200;
const MAX_PAGES = 50;          // ~10k changes; a guard against a server loop
const REQUEST_TIMEOUT_MS = 20000;

// Single-flight. Two syncs running at once would both push, both pull, and race
// on saveData — the second write silently discarding the first one's merge.
let inFlight = null;

async function request(config, path, body, method = 'POST') {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${config.url}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${config.token}`,
        'content-type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    if (!res.ok) {
      return { ok: false, status: res.status, error: `http_${res.status}` };
    }
    return { ok: true, data: await res.json() };
  } catch (e) {
    // Abort, DNS failure, offline, TLS problem — all the same to us: not now.
    return { ok: false, error: e && e.name === 'AbortError' ? 'timeout' : 'network' };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Run one full sync. Safe to call from anywhere, at any time, concurrently.
 *
 * Returns { ok, reason?, pushed, pulled, photos:{uploaded,downloaded,deleted} }.
 * Callers may show this on the Sync settings screen; nothing else should react
 * to it.
 */
export function isSyncing() {
  return !!inFlight;
}

export function syncNow(opts = {}) {
  // Concurrent callers join the run already in progress rather than starting a
  // second one. Foreground + a debounced post-save trigger firing together is
  // the normal case, not an edge case.
  if (inFlight) return inFlight;
  inFlight = runSync(opts).finally(() => { inFlight = null; });
  return inFlight;
}

async function runSync(opts) {
  const result = {
    ok: false, reason: null, pushed: 0, pulled: 0,
    photos: { uploaded: 0, downloaded: 0, deleted: 0 },
  };

  const config = await getConfig();
  if (!isConfigured(config)) {
    result.reason = config.enabled ? 'not_configured' : 'disabled';
    return result;
  }

  let data;
  try {
    data = await loadData();
  } catch (e) {
    result.reason = 'load_failed';
    return result;
  }

  // ---- PUSH -------------------------------------------------------------
  const outgoing = collectPush(data);
  if (outgoing.records.length) {
    const res = await request(config, '/v1/push', { records: outgoing.records });
    if (!res.ok) {
      // Stop here. Pulling now would apply server state while our own changes
      // are still only local — which is safe (the merge is timestamp-based) but
      // pointless, and it would advance the cursor past changes we'd rather
      // reconcile in one pass. Try again next time.
      result.reason = res.error;
      return result;
    }
    // lastPushAt moves only after the server confirms. A push that failed
    // halfway must be re-sent in full next time, not assumed delivered.
    data = markPushed(data, outgoing.highWater);
    await saveData(data);
    result.pushed = outgoing.records.length;
  }

  // ---- PULL (paged) -----------------------------------------------------
  const livePhotos = new Set();
  const deletedPhotos = new Set();
  let pages = 0;

  for (;;) {
    if (++pages > MAX_PAGES) { result.reason = 'too_many_pages'; break; }

    const cursor = getSyncMeta(data).cursor;
    const res = await request(config, '/v1/pull', { cursor, limit: PULL_PAGE_LIMIT });
    if (!res.ok) { result.reason = res.error; break; }

    const page = res.data || {};
    const changes = Array.isArray(page.changes) ? page.changes : [];
    if (changes.length === 0) break;

    const merged = applyPage(data, changes);
    data = merged.data;

    // Persist BEFORE the loop moves on. applyPage already advanced the cursor
    // inside `data`, so saving is what makes that advance real — if the app dies
    // right here, the next run resumes from the last SAVED cursor and re-pulls
    // this page. Re-applying a page is harmless (the merge is idempotent);
    // skipping one is not.
    await saveData(data);

    merged.livePhotos.forEach(n => livePhotos.add(n));
    merged.deletedPhotos.forEach(n => deletedPhotos.add(n));
    result.pulled += changes.length;

    if (!page.hasMore) break;
  }

  // ---- PHOTOS -----------------------------------------------------------
  // Deliberately last, and deliberately not fatal. Records are what make the app
  // useful; a missing thumbnail is a cosmetic gap that fixes itself on the next
  // run. If photo work failed the sync as a whole, one unreachable image could
  // block every record from ever syncing.
  if (!opts.skipPhotos) {
    try {
      const plan = planPhotoWork({
        localNames: await listLocalPhotos(),
        referenced: referencedPhotos(data),
        serverLive: livePhotos,
        serverDeleted: deletedPhotos,
      });

      for (const name of plan.upload) {
        if (await uploadPhoto(config, name)) result.photos.uploaded++;
      }
      for (const name of plan.download) {
        if (await downloadPhoto(config, name)) result.photos.downloaded++;
      }
      for (const name of plan.deleteLocal) {
        if (await deleteLocalPhoto(name)) result.photos.deleted++;
      }
    } catch (e) {
      console.warn('[TFL sync] photo phase failed (non-fatal)', e && e.message);
    }
  }

  result.ok = !result.reason;
  return result;
}

// ---------------------------------------------------------------------------
// Triggers
// ---------------------------------------------------------------------------
// Debounced so a burst of edits — typing a filter name fires saveData per
// keystroke — produces one sync rather than thirty.
let pending = null;

export function scheduleSync(delayMs = 4000) {
  // runSync itself calls saveData several times, and saveData schedules a sync.
  // Without this guard every sync would queue another one — not an infinite
  // loop (the follow-up finds nothing to push and stops) but a pointless round
  // trip after every single sync, forever.
  if (inFlight) return;
  if (pending) clearTimeout(pending);
  pending = setTimeout(() => {
    pending = null;
    // Fire and forget: nothing waits on this and nothing surfaces its failure.
    syncNow().catch(() => {});
  }, delayMs);
}

export function cancelScheduledSync() {
  if (pending) { clearTimeout(pending); pending = null; }
}

/**
 * Check the endpoint and credentials without touching any data. Used by the
 * settings screen so "is my token right?" can be answered without a real sync
 * — a failing connection test and a failing sync are different questions and
 * shouldn't share an error message.
 */
/**
 * Erase this account's data from the server. Local data is NOT touched — the
 * caller decides separately whether to keep it, and the UI must make that
 * distinction unmissable. "Delete my cloud copy" and "delete my filters" are
 * very different intentions and a user who confuses them loses everything.
 */
export async function deleteCloudData(config) {
  const res = await request(config, '/v1/account', null, 'DELETE');
  if (!res.ok) return { ok: false, reason: res.error };
  return { ok: !!(res.data && res.data.ok), receipt: res.data };
}

export async function testConnection(config) {
  const res = await request(config, '/v1/pull', { cursor: 0, limit: 1 });
  if (res.ok) return { ok: true };
  if (res.status === 401) return { ok: false, reason: 'bad_token' };
  return { ok: false, reason: res.error };
}
