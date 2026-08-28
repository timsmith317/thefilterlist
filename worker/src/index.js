// File: src/index.js → ~/Projects/thefilterlist/worker/src/index.js
//
// The Filter List — sync Worker entry point.
//
// Routes (all require Authorization: Bearer <token>, except /v1/health):
//   GET    /v1/health              liveness; no auth, no data
//   POST   /v1/pull                { cursor, limit } -> { changes, cursor, hasMore }
//   POST   /v1/push                { records[], photoDeletes[] } -> { cursor, applied }
//   PUT    /v1/photos/:filename    raw bytes -> { ok }
//   GET    /v1/photos/:filename    raw bytes
//   DELETE /v1/account             erase everything for this account
//
// The server is a relay. It does not compute due dates, low stock, or anything
// else the app understands — record bodies are opaque JSON. See
// migrations/0001_init.sql for why.
//
// LOGGING: never log record bodies or photo filenames. Account ids and counts
// only. A log line is data at rest we didn't tell anyone we were keeping.

import { accountIdFor, ensureAccount } from './auth.js';
import { pull, push } from './sync.js';
import { putPhoto, getPhoto, purgeAccountPhotos } from './photos.js';

const JSON_HEADERS = { 'content-type': 'application/json' };

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
}

function unauthorized() {
  return new Response(JSON.stringify({ error: 'unauthorized' }), {
    status: 401,
    headers: { ...JSON_HEADERS, 'www-authenticate': 'Bearer' },
  });
}

async function readJson(request) {
  try { return await request.json(); }
  catch { return null; }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method.toUpperCase();

    try {
      // Health check carries no data and needs no auth, so an uptime monitor
      // doesn't require a credential.
      if (path === '/v1/health' && method === 'GET') {
        return json({ ok: true, time: Date.now() });
      }

      const accountId = accountIdFor(request, env);
      if (!accountId) return unauthorized();

      // v1 has no signup step, so the first request creates the account row.
      await ensureAccount(env, accountId);

      if (path === '/v1/pull' && method === 'POST') {
        const body = await readJson(request);
        return json(await pull(env, accountId, body || {}));
      }

      if (path === '/v1/push' && method === 'POST') {
        const body = await readJson(request);
        if (!body) return json({ error: 'bad_json' }, 400);
        const result = await push(env, accountId, body);
        return json(result, result.ok ? 200 : 400);
      }

      const photoMatch = /^\/v1\/photos\/([^/]+)$/.exec(path);
      if (photoMatch) {
        const filename = decodeURIComponent(photoMatch[1]);
        if (method === 'PUT') {
          const r = await putPhoto(env, accountId, filename, request);
          return json(r, r.status);
        }
        if (method === 'GET') {
          return await getPhoto(env, accountId, filename);
        }
        return json({ error: 'method_not_allowed' }, 405);
      }

      if (path === '/v1/account' && method === 'DELETE') {
        return json(await deleteAccount(env, accountId));
      }

      return json({ error: 'not_found' }, 404);
    } catch (err) {
      // Log the shape of the failure, never the payload.
      console.error('worker error', path, method, err && err.message);
      return json({ error: 'internal' }, 500);
    }
  },
};

/**
 * Erase everything for an account.
 *
 * ORDER MATTERS: R2 first, then the account row.
 *   The account row is the only thing that ties objects to a person. If it were
 *   deleted first and the R2 sweep then failed, the objects would still exist
 *   with nothing left to find them by — permanently orphaned data belonging to
 *   someone who was told it was gone. Doing R2 first means a failure leaves the
 *   account intact and the operation simply retryable.
 *
 * The DELETE on accounts cascades to records, photos, and devices via foreign
 * keys, so the database side is genuinely one statement.
 *
 * The receipt reports what was actually verified, not what was attempted. If
 * the R2 listing isn't empty afterwards we say so rather than reporting success.
 */
async function deleteAccount(env, accountId) {
  const photos = await purgeAccountPhotos(env, accountId);

  if (!photos.empty) {
    // Stop. Reporting success here would be the one lie this system must never
    // tell — retry is safe and the account is still intact.
    return {
      ok: false,
      error: 'photo_purge_incomplete',
      photosDeleted: photos.deleted,
      retryable: true,
    };
  }

  await env.DB.prepare(`DELETE FROM accounts WHERE id = ?1`).bind(accountId).run();

  const remaining = await env.DB.prepare(
    `SELECT
       (SELECT COUNT(*) FROM records WHERE account_id = ?1) AS records,
       (SELECT COUNT(*) FROM photos  WHERE account_id = ?1) AS photos,
       (SELECT COUNT(*) FROM devices WHERE account_id = ?1) AS devices`
  ).bind(accountId).first();

  const clean = remaining
    && remaining.records === 0 && remaining.photos === 0 && remaining.devices === 0;

  console.log('account deleted', accountId, 'photos:', photos.deleted, 'clean:', !!clean);

  return {
    ok: !!clean,
    deletedAt: Date.now(),
    photosDeleted: photos.deleted,
    remaining,
    // Said plainly so it can be quoted straight into the privacy policy.
    note: 'Removed from active systems. Database point-in-time backups are '
        + 'retained for up to 30 days and cannot be selectively purged.',
  };
}
