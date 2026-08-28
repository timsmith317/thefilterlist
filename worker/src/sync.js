// File: src/sync.js → ~/Projects/thefilterlist/worker/src/sync.js
//
// Push and pull. All the merge reasoning lives in migrations/0001_init.sql; this
// file is the mechanics of applying it safely.

export const RECORD_TYPES = ['asset', 'filter', 'device', 'settings'];

// A client updated_at further ahead than this is clamped to server time.
//
// WHY: updated_at decides conflicts, and it comes from the client's clock. A
// device with its clock set years ahead would win every conflict forever, and
// no honest later edit from any device could ever beat it — the user's data
// would be permanently frozen in whatever state that device last pushed. We
// can't reject the write (the user's edit is real), so we clamp it.
//
// The window is generous because normal skew is seconds and we'd rather never
// clamp a legitimate edit. Clamping DOWN is always safe: the worst case is the
// edit loses a conflict it might have won, which is recoverable by editing
// again. Letting a bad clock through is not recoverable.
const MAX_FUTURE_SKEW_MS = 5 * 60 * 1000;

// Caps. A push beyond this is rejected rather than truncated — silently
// dropping half a client's changes would leave it believing they synced.
const MAX_PUSH_RECORDS = 500;
const MAX_PULL_LIMIT = 500;
const DEFAULT_PULL_LIMIT = 200;

function clampTimestamp(value, now) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return now;
  return n > now + MAX_FUTURE_SKEW_MS ? now : Math.floor(n);
}

/**
 * PULL — everything above the client's cursor, records and photos interleaved.
 *
 * Records and photos share one sequence counter, so ONE cursor covers both.
 * That matters more than it looks: with two cursors, a client that applied a
 * record page but failed on the photo page would have to reason about two
 * partially-advanced positions. With one, the rule is simply "advance only
 * after the whole page is applied", and an interrupted sync resumes cleanly.
 *
 * The UNION is ordered by server_seq so paging can never skip a row: an edited
 * record gets a fresh (higher) seq, which moves it ahead of the cursor rather
 * than leaving it behind one.
 */
export async function pull(env, accountId, body) {
  const cursor = Number.isFinite(Number(body?.cursor)) ? Math.max(0, Number(body.cursor)) : 0;
  const limit = Math.min(MAX_PULL_LIMIT, Math.max(1, Number(body?.limit) || DEFAULT_PULL_LIMIT));

  const { results } = await env.DB.prepare(
    `SELECT * FROM (
       SELECT 'record' AS kind, type, id AS key, updated_at AS ts,
              deleted_at, body, server_seq
       FROM records WHERE account_id = ?1 AND server_seq > ?2
       UNION ALL
       SELECT 'photo' AS kind, NULL AS type, filename AS key, uploaded_at AS ts,
              deleted_at, NULL AS body, server_seq
       FROM photos WHERE account_id = ?1 AND server_seq > ?2
     )
     ORDER BY server_seq
     LIMIT ?3`
  ).bind(accountId, cursor, limit).all();

  const rows = results || [];
  const changes = rows.map(r => (
    r.kind === 'record'
      ? {
          kind: 'record',
          type: r.type,
          id: r.key,
          updatedAt: r.ts,
          deletedAt: r.deleted_at,
          // Parsed here so the client gets an object, not a string it must
          // remember to parse. A corrupt body yields null rather than throwing
          // and killing the whole page.
          body: r.body ? safeParse(r.body) : null,
          seq: r.server_seq,
        }
      : {
          kind: 'photo',
          filename: r.key,
          uploadedAt: r.ts,
          deletedAt: r.deleted_at,
          seq: r.server_seq,
        }
  ));

  // The cursor only advances to what we actually returned. `hasMore` tells the
  // client to come straight back rather than waiting for the next sync — a
  // first sync on a full account is several pages.
  const nextCursor = rows.length ? rows[rows.length - 1].server_seq : cursor;
  return { changes, cursor: nextCursor, hasMore: rows.length === limit };
}

function safeParse(text) {
  try { return JSON.parse(text); } catch { return null; }
}

/**
 * PUSH — apply the client's changes, last-write-wins.
 *
 * SEQUENCE ALLOCATION, and why it looks odd:
 *   Every written row needs a unique, increasing server_seq. The obvious
 *   approach — read the counter, add N, write the rows — is a race: two devices
 *   syncing at once both read the same value and hand out the same sequence
 *   numbers, and a client pulling with a cursor in that range silently misses
 *   changes.
 *
 *   Instead the whole push is one D1 batch (a single transaction). Statement 0
 *   bumps the counter by N; every INSERT then computes its own sequence with a
 *   subquery reading the ALREADY-BUMPED value, offset by its position. Nothing
 *   is read into JS and written back, so there is no window for a race.
 *
 *   Rows the merge rejects (an older updated_at) still consume a sequence
 *   number. That's harmless — sequences only need to increase, not be dense.
 */
export async function push(env, accountId, body) {
  const records = Array.isArray(body?.records) ? body.records : [];
  const photoDeletes = Array.isArray(body?.photoDeletes) ? body.photoDeletes : [];

  if (records.length + photoDeletes.length === 0) {
    const cur = await currentSeq(env, accountId);
    return { ok: true, cursor: cur, applied: 0 };
  }
  if (records.length > MAX_PUSH_RECORDS) {
    return { ok: false, error: 'too_many_records', max: MAX_PUSH_RECORDS };
  }

  const now = Date.now();
  const statements = [];
  const total = records.length + photoDeletes.length;

  // Statement 0: reserve `total` sequence numbers for this transaction.
  statements.push(
    env.DB.prepare(`UPDATE accounts SET seq = seq + ?2, last_seen_at = ?3 WHERE id = ?1`)
      .bind(accountId, total, now)
  );

  // After the bump, accounts.seq is (old + total). The row at index i takes
  // seq - (total - 1 - i), so the first row gets old+1 and the last gets old+N.
  let index = 0;

  for (const rec of records) {
    const offset = total - 1 - index;
    index++;

    if (!RECORD_TYPES.includes(rec?.type) || typeof rec?.id !== 'string' || !rec.id) {
      // Skip malformed entries rather than failing the batch — one bad record
      // shouldn't block a user's other 40 edits. Its sequence number is simply
      // never used.
      continue;
    }

    const deletedAt = rec.deletedAt ? clampTimestamp(rec.deletedAt, now) : null;
    const updatedAt = clampTimestamp(rec.updatedAt, now);
    const bodyJson = deletedAt ? null : JSON.stringify(rec.body ?? null);

    statements.push(
      env.DB.prepare(
        `INSERT INTO records (account_id,type,id,updated_at,deleted_at,body,server_seq)
         VALUES (?1,?2,?3,?4,?5,?6, (SELECT seq FROM accounts WHERE id = ?1) - ?7)
         ON CONFLICT (account_id,type,id) DO UPDATE SET
           updated_at = excluded.updated_at,
           deleted_at = excluded.deleted_at,
           body       = excluded.body,
           server_seq = excluded.server_seq
         WHERE excluded.updated_at > records.updated_at
            OR (excluded.updated_at = records.updated_at
                AND excluded.deleted_at IS NOT NULL
                AND records.deleted_at IS NULL)`
      ).bind(accountId, rec.type, rec.id, updatedAt, deletedAt, bodyJson, offset)
    );
  }

  // Photo deletions. The R2 object is NOT removed here — see photos.js. Marking
  // the manifest is enough for the delete to propagate, and sweeping bytes
  // inline would risk stranding a photo another device hasn't downloaded yet.
  for (const filename of photoDeletes) {
    const offset = total - 1 - index;
    index++;
    if (typeof filename !== 'string' || !filename) continue;
    statements.push(
      env.DB.prepare(
        `UPDATE photos SET deleted_at = ?3,
                server_seq = (SELECT seq FROM accounts WHERE id = ?1) - ?4
         WHERE account_id = ?1 AND filename = ?2 AND deleted_at IS NULL`
      ).bind(accountId, filename, now, offset)
    );
  }

  await env.DB.batch(statements);
  const cursor = await currentSeq(env, accountId);
  return { ok: true, cursor, applied: statements.length - 1 };
}

async function currentSeq(env, accountId) {
  const row = await env.DB.prepare(`SELECT seq FROM accounts WHERE id = ?1`)
    .bind(accountId).first();
  return row ? row.seq : 0;
}
