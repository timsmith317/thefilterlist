// File: src/photos.js → ~/Projects/thefilterlist/worker/src/photos.js
//
// Photo bytes, proxied through the Worker.
//
// WHY PROXY RATHER THAN PRESIGNED URLS — I proposed signed URLs earlier and
// changed my mind while writing this. Presigning R2 means the S3-compatible API,
// which means creating and storing separate R2 access keys, pulling in a signing
// library, and getting an expiry policy right. That's a meaningful amount of
// machinery and a second set of credentials to leak.
//
// These photos are ~50-140 KB, capped at 3 per filter. A Worker can stream that
// in either direction without noticing. Proxying means:
//   - ONE credential in the system (the bearer token), not two
//   - the bucket stays private with no public URL and no signing to misconfigure
//   - every byte transfer passes the same auth check as every other endpoint
// If photos ever became large or numerous, presigning would be worth revisiting.
// At this size it is complexity with no payoff.
//
// Object keys are `{accountId}/photos/{filename}`. The account prefix is what
// makes deletion a prefix sweep and makes cross-account access impossible by
// construction — a request can only ever name a filename, never a prefix.

// Filenames come from the client, so they are untrusted input. The app generates
// `<epoch-ms>.<ext>`; anything else is refused. This is not cosmetic — without
// it, a filename containing '../' or a '/' could write outside the account's
// prefix and reach another account's objects.
const FILENAME_RE = /^[0-9]{10,17}\.[a-z0-9]{2,4}$/i;

const MAX_PHOTO_BYTES = 5 * 1024 * 1024; // generous; the app caps ~200 KB

function keyFor(accountId, filename) {
  return `${accountId}/photos/${filename}`;
}

export function validFilename(name) {
  return typeof name === 'string' && FILENAME_RE.test(name);
}

/**
 * PUT a photo. Idempotent by design: photos are immutable, so re-uploading the
 * same filename is a no-op rather than an error. That matters because a client
 * whose sync was interrupted mid-upload will simply retry, and retrying must
 * never be destructive.
 */
export async function putPhoto(env, accountId, filename, request) {
  if (!validFilename(filename)) {
    return { ok: false, status: 400, error: 'bad_filename' };
  }

  const declared = Number(request.headers.get('content-length') || 0);
  if (declared > MAX_PHOTO_BYTES) {
    return { ok: false, status: 413, error: 'too_large' };
  }

  const key = keyFor(accountId, filename);

  // Already present and live? Nothing to do.
  const existing = await env.DB.prepare(
    `SELECT filename, deleted_at FROM photos WHERE account_id = ?1 AND filename = ?2`
  ).bind(accountId, filename).first();
  if (existing && existing.deleted_at === null) {
    return { ok: true, status: 200, deduped: true };
  }

  const bytes = await request.arrayBuffer();
  if (bytes.byteLength === 0) return { ok: false, status: 400, error: 'empty' };
  if (bytes.byteLength > MAX_PHOTO_BYTES) return { ok: false, status: 413, error: 'too_large' };

  await env.PHOTOS.put(key, bytes, {
    httpMetadata: { contentType: 'image/jpeg' },
  });

  // Manifest row goes in AFTER the bytes land. If it went first and the R2 write
  // failed, other devices would be told a photo exists that they can never
  // fetch. This ordering can leave an orphaned object if the DB write fails,
  // which the garbage collector cleans up — an unreferenced object is a cost,
  // a missing one is a bug.
  const now = Date.now();
  await env.DB.batch([
    env.DB.prepare(`UPDATE accounts SET seq = seq + 1, last_seen_at = ?2 WHERE id = ?1`)
      .bind(accountId, now),
    env.DB.prepare(
      `INSERT INTO photos (account_id, filename, byte_size, uploaded_at, deleted_at, server_seq)
       VALUES (?1, ?2, ?3, ?4, NULL, (SELECT seq FROM accounts WHERE id = ?1))
       ON CONFLICT (account_id, filename) DO UPDATE SET
         byte_size   = excluded.byte_size,
         uploaded_at = excluded.uploaded_at,
         deleted_at  = NULL,
         server_seq  = excluded.server_seq`
    ).bind(accountId, filename, bytes.byteLength, now),
  ]);

  return { ok: true, status: 201, bytes: bytes.byteLength };
}

/** GET a photo's bytes. */
export async function getPhoto(env, accountId, filename) {
  if (!validFilename(filename)) {
    return new Response(JSON.stringify({ error: 'bad_filename' }), {
      status: 400, headers: { 'content-type': 'application/json' },
    });
  }
  const object = await env.PHOTOS.get(keyFor(accountId, filename));
  if (!object) {
    return new Response(JSON.stringify({ error: 'not_found' }), {
      status: 404, headers: { 'content-type': 'application/json' },
    });
  }
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  // Photos are immutable, so they can be cached hard — but privately. A shared
  // cache must never hold one person's photo where another request could reach it.
  headers.set('cache-control', 'private, max-age=31536000, immutable');
  return new Response(object.body, { headers });
}

/**
 * Delete every R2 object belonging to an account. Used by account deletion.
 * Lists in pages because R2 truncates — a single list() call on a large account
 * would silently leave objects behind, which is exactly the failure that turns a
 * deletion promise into a false statement.
 */
export async function purgeAccountPhotos(env, accountId) {
  const prefix = `${accountId}/`;
  let cursor;
  let deleted = 0;

  for (;;) {
    const listed = await env.PHOTOS.list({ prefix, cursor, limit: 1000 });
    const keys = listed.objects.map(o => o.key);
    if (keys.length) {
      await env.PHOTOS.delete(keys);
      deleted += keys.length;
    }
    if (!listed.truncated) break;
    cursor = listed.cursor;
  }

  // Verify rather than assume. The deletion receipt we hand the user should be
  // based on an empty listing, not on the delete calls not having thrown.
  const check = await env.PHOTOS.list({ prefix, limit: 1 });
  return { deleted, empty: check.objects.length === 0 };
}
