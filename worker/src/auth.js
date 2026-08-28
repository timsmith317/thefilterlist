// File: src/auth.js → ~/Projects/thefilterlist/worker/src/auth.js
//
// Resolving a request to an account. This is the ONLY place that decides whose
// data a request may touch, which is deliberate: in v2 the bearer token becomes
// a per-user credential minted after Sign in with Apple / Google, and that swap
// should mean editing this file and nothing else. Every handler already asks
// "which account is this?" rather than "is the token right?", so the rest of the
// Worker doesn't know or care how identity is established.
//
// v1: one shared secret mapping to one account id, both set as Worker secrets.

// Timing-safe string compare. A plain === leaks the token one character at a
// time to anyone who can measure response latency — slow, but real, and there's
// no reason to accept it when the fix is this small.
function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function bearerFrom(request) {
  const header = request.headers.get('authorization') || '';
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match ? match[1].trim() : null;
}

/**
 * Returns the account id for this request, or null if it isn't authenticated.
 * Never throws — callers turn null into a 401.
 */
export function accountIdFor(request, env) {
  const token = bearerFrom(request);
  if (!token) return null;
  if (!env.SYNC_TOKEN || !env.SYNC_ACCOUNT_ID) return null; // secrets not set
  if (!safeEqual(token, env.SYNC_TOKEN)) return null;
  return env.SYNC_ACCOUNT_ID;
}

/**
 * Ensure the account row exists. v1 has no signup step, so the first sync
 * creates the account rather than failing on a foreign key. Idempotent.
 */
export async function ensureAccount(env, accountId) {
  await env.DB.prepare(
    `INSERT INTO accounts (id, seq, created_at, last_seen_at)
     VALUES (?1, 0, ?2, ?2)
     ON CONFLICT (id) DO UPDATE SET last_seen_at = ?2`
  ).bind(accountId, Date.now()).run();
}
