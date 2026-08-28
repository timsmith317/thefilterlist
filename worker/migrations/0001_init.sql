-- File: migrations/0001_init.sql → ~/Projects/thefilterlist/worker/migrations/0001_init.sql
--
-- The Filter List — sync schema (Cloudflare D1).
--
-- DESIGN NOTE: THE SERVER IS A RELAY, NOT A MODEL
--   There is no `filters` table, no `devices` table mirroring the app's shapes.
--   Every syncable thing lands in one generic `records` table with its body as
--   opaque JSON. Three reasons:
--     1. The merge rule is identical for every type — last write wins on
--        updated_at, delete wins ties. Per-type tables would duplicate that
--        logic four times and let the copies drift.
--     2. The server never needs to read inside a record. It doesn't compute due
--        dates or low stock; the app does. Storing bodies opaquely means adding
--        a field to a filter needs no server change and no migration.
--     3. It keeps the door open on encryption. If bodies ever become ciphertext,
--        only the app changes — id/updated_at/deleted_at are already the only
--        columns the server reads.
--
-- WHAT THE SERVER DOES AND DOESN'T TRUST
--   TRUSTS the client's updated_at for CONFLICT RESOLUTION. It's the only
--   ordering available for edits made offline on two devices.
--   DOES NOT trust it for the SYNC CURSOR. Clients pull by server_seq, a
--   server-assigned counter. If cursors used client timestamps, one device with
--   a wrong clock would either miss changes forever or re-pull everything on
--   every sync. Clock skew must never cost you data.
--   The Worker should also CLAMP a client updated_at that's far in the future to
--   server time. A device with its clock set to 2030 would otherwise win every
--   conflict permanently, and no later honest edit could ever beat it.
--
-- ACCOUNT DELETION
--   Foreign keys cascade from `accounts`, so deleting the account row removes
--   every record, photo manifest entry, and device in one statement. The R2
--   objects under {account_id}/ must be deleted separately — SQL can't reach
--   them. See the deletion checklist at the bottom of this file.
--   D1 Time Travel retains point-in-time backups (up to 30 days) that cannot be
--   selectively purged, so the honest privacy-policy claim is "removed from
--   active systems immediately, purged from backups within 30 days".

PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------------------
-- accounts
-- ---------------------------------------------------------------------------
-- One row per person (NOT per device). In v1 there is exactly one row, created
-- by hand; in v2 a row is minted on first sign-in and `auth_provider` /
-- `auth_subject` carry the Apple/Google identity.
--
-- `seq` is this account's monotonic change counter. Every write bumps it inside
-- the same transaction and stamps the resulting row, which is what makes
-- cursor-based pulls exact: "give me everything above N" can never skip a row
-- and never repeat one.
CREATE TABLE accounts (
  id            TEXT PRIMARY KEY,          -- opaque; never derived from an email
  seq           INTEGER NOT NULL DEFAULT 0,
  created_at    INTEGER NOT NULL,          -- ms epoch, server clock
  last_seen_at  INTEGER,

  -- v2 fields. NULL for the v1 single-account case; no migration needed later.
  auth_provider TEXT,                      -- 'apple' | 'google'
  auth_subject  TEXT,                      -- provider's stable user id

  UNIQUE (auth_provider, auth_subject)
);

-- ---------------------------------------------------------------------------
-- records
-- ---------------------------------------------------------------------------
-- Every syncable entity. `type` is 'asset' | 'filter' | 'device' | 'settings'.
--
-- Settings is a single record per account with id 'settings' — the app already
-- treats it as one object with one updated_at, so modelling it as one row keeps
-- server and client agreeing about what a conflict even is.
--
-- A DELETED RECORD IS A ROW, NOT A MISSING ROW. deleted_at is set and body is
-- cleared. This is the server-side twin of the app's tombstone array: a delete
-- that leaves no row is a delete the other device can never learn about, and
-- the record would come back on its next push.
CREATE TABLE records (
  account_id  TEXT    NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  type        TEXT    NOT NULL CHECK (type IN ('asset','filter','device','settings')),
  id          TEXT    NOT NULL,
  updated_at  INTEGER NOT NULL,            -- CLIENT clock (clamped) — drives merge
  deleted_at  INTEGER,                     -- NULL = live
  body        TEXT,                        -- JSON; NULL when deleted
  server_seq  INTEGER NOT NULL,            -- SERVER counter — drives the cursor

  PRIMARY KEY (account_id, type, id)
);

-- The pull query: everything for an account above the client's cursor.
CREATE INDEX idx_records_pull ON records (account_id, server_seq);

-- ---------------------------------------------------------------------------
-- photos
-- ---------------------------------------------------------------------------
-- A MANIFEST, not the bytes. The image lives in R2 at {account_id}/photos/
-- {filename}; this table says which photos the account has so a client can work
-- out what to upload or fetch without parsing every record body.
--
-- Photos are IMMUTABLE — the app writes a timestamp filename once and never
-- rewrites it. That's why there is no updated_at and no conflict rule here:
-- a photo either exists or it doesn't. It is the one part of sync with no
-- merge logic at all.
--
-- deleted_at exists so a delete propagates; the actual R2 object should only be
-- removed once no live record references the filename (garbage collection, run
-- separately — never inline with a user's sync, or a slow delete could strand a
-- photo another device still needs).
CREATE TABLE photos (
  account_id  TEXT    NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  filename    TEXT    NOT NULL,            -- e.g. '1787931900930.jpg'
  byte_size   INTEGER,
  uploaded_at INTEGER NOT NULL,
  deleted_at  INTEGER,
  server_seq  INTEGER NOT NULL,

  PRIMARY KEY (account_id, filename)
);

CREATE INDEX idx_photos_pull ON photos (account_id, server_seq);

-- ---------------------------------------------------------------------------
-- devices
-- ---------------------------------------------------------------------------
-- Which devices have synced this account. NOT load-bearing: clients track their
-- own cursor, and sync works if this table is empty. It earns its place for
-- support ("my tablet hasn't updated since Tuesday") and for showing a device
-- list before account deletion.
CREATE TABLE devices (
  account_id    TEXT    NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  device_id     TEXT    NOT NULL,          -- client-generated, opaque
  label         TEXT,                      -- 'Pixel Tablet', 'iPhone' — display only
  platform      TEXT,                      -- 'ios' | 'android'
  last_seq      INTEGER,                   -- cursor at its last successful sync
  last_seen_at  INTEGER,

  PRIMARY KEY (account_id, device_id)
);

-- ---------------------------------------------------------------------------
-- Reference statements (the Worker will issue these; kept here as the contract)
-- ---------------------------------------------------------------------------
--
-- PUSH one record, last-write-wins, delete wins ties. Run inside a transaction
-- that has already bumped accounts.seq:
--
--   INSERT INTO records (account_id,type,id,updated_at,deleted_at,body,server_seq)
--   VALUES (?1,?2,?3,?4,?5,?6,?7)
--   ON CONFLICT (account_id,type,id) DO UPDATE SET
--     updated_at = excluded.updated_at,
--     deleted_at = excluded.deleted_at,
--     body       = excluded.body,
--     server_seq = excluded.server_seq
--   WHERE excluded.updated_at > records.updated_at
--      OR (excluded.updated_at = records.updated_at
--          AND excluded.deleted_at IS NOT NULL
--          AND records.deleted_at IS NULL);
--
--   The second clause is the tie-break: same millisecond, delete wins. Ties are
--   rare but must be DETERMINISTIC — if two devices resolved a tie differently
--   they would push conflicting states back and forth forever.
--
-- PULL everything the client hasn't seen:
--
--   SELECT type,id,updated_at,deleted_at,body,server_seq
--   FROM records WHERE account_id = ?1 AND server_seq > ?2
--   ORDER BY server_seq LIMIT ?3;
--
--   Page with LIMIT and carry the last server_seq forward. The client only
--   advances its stored cursor after the whole page is applied locally, so an
--   interrupted sync resumes rather than silently skipping.
--
-- ACCOUNT DELETION — the full checklist:
--   1. List and delete every R2 object under '{account_id}/'  (SQL can't do this)
--   2. DELETE FROM accounts WHERE id = ?1;   -- cascades to all three tables
--   3. Confirm zero rows remain, and return a receipt to the client
--   Order matters: R2 first. If step 2 ran first and step 1 failed, the orphaned
--   objects would have no account row left to find them by.
