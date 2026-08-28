// data/store.js — The Filter List data layer (v2).
// Model: Asset -> Device -> Stage(s) -> Filter. (Assets are the one org dimension.)
//
// MULTI-STAGE FILTERS:
//   A device owns a `stages` array. Each stage tracks WHEN it was last
//   replaced (its own lastReplaced -> its own due date) and an OPTIONAL link
//   to a shared filter (filterId) for SKU / reorder / on-hand. A plain device is
//   just one stage; a multi-stage unit (e.g. a 3-stage under-sink RO) has
//   several, each independently scheduled and independently markable.
//
//   Filters stay a SHARED catalog (the same filter can be linked from stages in
//   different devices).
//
// WHERE THE INTERVAL LIVES (filter-owned, with a filterless fallback):
//   The replacement interval is a property of the FILTER (the manufacturer's
//   recommendation, user-editable on the Filter screen). The same SKU therefore
//   carries the same cadence everywhere it's used. A stage's lastReplaced is
//   per-installation, so a shared filter still gets independent due dates.
//
//   A stage that has NO filter keeps its OWN intervalDays as a fallback, so the
//   app still works as a plain reminder tool with no filters attached.
//
//   Effective interval for a stage:
//     stage.filterId ? filter.intervalDays : stage.intervalDays
//   Resolved at read time via stageIntervalDays(stage, data) — the filter is the
//   single source of truth; nothing is cached/duplicated onto the stage.
//
//   A device's headline status (for Due Soon / asset lists) is its
//   SOONEST-DUE stage.
//
// TRANSITIONAL MIRROR (remove later):
//   Each device also keeps top-level `intervalDays` / `lastReplaced` / `filterId`
//   mirrored from stages[0]. This keeps any not-yet-migrated screen working.
//   The mirror's intervalDays is the stage's stored fallback, NOT the resolved
//   filter interval — list builders attach a resolved `intervalDays` instead.
//
// Filters can carry up to MAX_FILTER_PHOTOS reference photos (file URIs in app docs).
// On-device via AsyncStorage. Migrates v1 (legacy reorderUrl text field) to v2,
// normalizes pre-stages v2 devices into the stages shape, and backfills a
// per-filter intervalDays from whichever stage first linked it.

import AsyncStorage from '@react-native-async-storage/async-storage';

// Exported so lib/backup.js reads/writes the exact same key (single source of
// truth). Without `export` here, backup.js's `import { KEY }` resolves to
// undefined and backups silently capture nothing.
export const KEY = 'thefilterlist.data.v5';
const LEGACY_KEY_V1 = 'thefilterlist.data.v1';

export const MAX_FILTER_PHOTOS = 3;

// ===========================================================================
// SYNC FOUNDATION (schemaVersion 4)
// ===========================================================================
// Everything here exists so a future sync engine can answer two questions about
// any record: "when did this last change?" and "was this deleted?". No network
// code depends on it yet, and none of it changes app behaviour.
//
// WHY updatedAt: merging two devices means picking a winner per record. Without
// a per-record timestamp the only options are "whole document wins" (which
// silently discards the loser's unrelated edits) or asking the user, which is
// unusable. Last-write-wins per record needs exactly one number per record.
//
// WHY A TOMBSTONE ARRAY, not a deletedAt flag on the record: a flag would mean
// every read path in this file had to filter deleted records out, and missing
// one resurrects deleted filters on the Due Soon screen. The array keeps deletes
// as real removals, so every read helper is untouched. The cost is that
// tombstones accumulate — see pruneTombstones.
//
// A delete that never produces a tombstone is a delete that will come BACK from
// the other device on the next sync, because the other device still has the
// record and this one has no evidence it was removed. That is why
// clearStarterData tombstones too, even though it feels like a local cleanup.
export const SCHEMA_VERSION = 4;

// How long tombstones are kept. Must comfortably exceed the longest plausible
// gap between a device's syncs — a device offline longer than this would
// resurrect records it deleted. A year is generous for an app people open a few
// times a year.
export const TOMBSTONE_TTL_MS = 365 * 24 * 60 * 60 * 1000;

function nowMs() { return Date.now(); }

// Record IDs. Previously bare `Date.now()`, which two offline devices could
// collide on in the same millisecond — the merge would then treat two different
// records as one. The random suffix makes that vanishingly unlikely. Existing
// IDs keep working untouched; only newly created records get the suffix.
function newId(prefix) {
  return prefix + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
}

// Mark a record as changed now. Applied to the record being mutated, never to
// its siblings — stamping untouched records would make them win merges they
// should lose.
function stamp(record) {
  return { ...record, updatedAt: nowMs() };
}

// Record a deletion so it can propagate. Replaces any prior tombstone for the
// same record so re-deleting refreshes the timestamp rather than duplicating.
function addTombstone(data, type, id) {
  if (!id) return data;
  const rest = (data.tombstones || []).filter(t => !(t.type === type && t.id === id));
  return { ...data, tombstones: [...rest, { type, id, deletedAt: nowMs() }] };
}

function addTombstones(data, type, ids) {
  return (ids || []).reduce((d, id) => addTombstone(d, type, id), data);
}

// Drop tombstones older than the TTL. Called on load, so it costs nothing at
// mutation time.
export function pruneTombstones(data) {
  const list = data && data.tombstones;
  if (!Array.isArray(list) || list.length === 0) return data;
  const cutoff = nowMs() - TOMBSTONE_TTL_MS;
  const kept = list.filter(t => t && typeof t.deletedAt === 'number' && t.deletedAt >= cutoff);
  return kept.length === list.length ? data : { ...data, tombstones: kept };
}

// v3 -> v4. Stamps every existing record and adds the tombstone array. Existing
// records all get the SAME timestamp, which is correct: before this migration we
// genuinely don't know when any of them last changed, and the first device to
// sync should simply seed the server.
function migrateSyncFields(data) {
  if (!data) return data;
  if (data.schemaVersion >= SCHEMA_VERSION && Array.isArray(data.tombstones)) return data;
  const t = nowMs();
  const stampAll = (list) => (Array.isArray(list) ? list : []).map(
    r => (r && typeof r.updatedAt === 'number') ? r : { ...r, updatedAt: t }
  );
  const settings = { ...(data.settings || {}) };
  if (typeof settings.updatedAt !== 'number') settings.updatedAt = t;
  return {
    ...data,
    schemaVersion: SCHEMA_VERSION,
    assets: stampAll(data.assets),
    filters: stampAll(data.filters),
    devices: stampAll(data.devices),
    settings,
    tombstones: Array.isArray(data.tombstones) ? data.tombstones : [],
  };
}

// Default replacement interval (days) for a brand-new filter or a filterless stage.
export const DEFAULT_INTERVAL_DAYS = 90;

// Filter types. The FILTER carries the type now (water / air / other) — a device is
// a container that can hold filters of different types (e.g. a fridge with both a
// water device and an air device), so a single per-device type was inaccurate.
export const FILTER_TYPES = {
  water: { label: 'Water' },
  air:   { label: 'Air' },
  other: { label: 'Other' },
};
const FILTER_TYPE_ORDER = ['water', 'air', 'other'];
function normFilterType(ty) {
  return FILTER_TYPES[ty] ? ty : 'other';
}

// The three default assets seeded for a fresh install. They can be renamed,
// reordered, and archived, but never deleted — they're the baseline "places".
export const PROTECTED_ASSET_IDS = ['a_home', 'a_auto', 'a_work'];
export function canDeleteAsset(id) {
  return !PROTECTED_ASSET_IDS.includes(id);
}

const MS_DAY = 86400000;
const iso = (daysAgo) => new Date(Date.now() - daysAgo * MS_DAY).toISOString();
const today = () => new Date(new Date().toDateString());

// ---------------------------------------------------------------------------
// Stage helpers
// ---------------------------------------------------------------------------

export function deviceStages(device) {
  return Array.isArray(device && device.stages) ? device.stages : [];
}

// TRANSITIONAL: copy stages[0]'s schedule up to the legacy top-level fields so
// the current single-filter screens keep rendering. Remove with the mirror.
function withMirror(device) {
  const s0 = (device.stages && device.stages[0]) || {};
  return {
    ...device,
    intervalDays: s0.intervalDays,
    lastReplaced: s0.lastReplaced,
    filterId: s0.filterId != null ? s0.filterId : null,
  };
}

// Build a normalized stage with safe defaults. `intervalDays` here is the
// FILTERLESS FALLBACK — when the stage links a filter, the filter's interval wins
// (see stageIntervalDays). We keep it so unlinking a filter leaves a sane cadence.
function makeStage(deviceId, index, src) {
  const s = src || {};
  const filterId = s.filterId != null ? s.filterId : null;
  return {
    id: s.id || ('s_' + deviceId + '_' + index),
    intervalDays: typeof s.intervalDays === 'number' ? s.intervalDays : DEFAULT_INTERVAL_DAYS,
    // Filtered stages need a start date to compute a due date (default today when
    // freshly attached). Filter-less stages only record a date once the user
    // marks the device replaced, so they stay null (= never replaced) until then.
    lastReplaced: s.lastReplaced || (filterId ? today().toISOString() : null),
    filterId,
  };
}

// Ensure a device has a stages array. If it predates stages, derive a single
// stage from its legacy intervalDays/lastReplaced/filterId. Idempotent.
function normalizeDevice(f) {
  let stages;
  if (Array.isArray(f.stages) && f.stages.length > 0) {
    stages = f.stages.map((s, i) => makeStage(f.id, i, s));
  } else {
    stages = [makeStage(f.id, 0, {
      intervalDays: f.intervalDays,
      lastReplaced: f.lastReplaced,
      filterId: f.filterId,
    })];
  }
  // Drop the vestigial per-device `photo` field (filters carry photos now).
  const { photo, ...rest } = f;
  return withMirror({ ...rest, stages });
}

function migrateDeviceStages(data) {
  if (!data || !Array.isArray(data.devices)) return data;
  return { ...data, devices: data.devices.map(normalizeDevice) };
}

// Backfill a per-filter intervalDays. For filters that predate filter-owned intervals,
// inherit the interval from the first stage that links the filter (that's where
// the cadence used to live); otherwise default. Idempotent — only fills gaps.
// Guarantee the three protected default assets always exist. If any is missing
// (e.g. older data, or somehow removed), re-add it at the end of the order.
// Idempotent — a normal install already has all three from the seed.
function ensureDefaultAssets(data) {
  if (!data || !Array.isArray(data.assets)) return data;
  const have = new Set(data.assets.map(a => a.id));
  const defaults = [
    { id: 'a_home', name: 'Home' },
    { id: 'a_auto', name: 'Auto' },
    { id: 'a_work', name: 'Work' },
  ];
  const missing = defaults.filter(d => !have.has(d.id));
  if (missing.length === 0) return data;
  const maxOrder = data.assets.reduce((m, a) => Math.max(m, a.order || 0), -1);
  const added = missing.map((d, i) => ({ ...d, archived: false, order: maxOrder + 1 + i }));
  return { ...data, assets: [...data.assets, ...added] };
}

function migrateFilterIntervals(data) {
  if (!data || !Array.isArray(data.filters)) return data;
  const needs = data.filters.some(p => typeof p.intervalDays !== 'number');
  if (!needs) return data;

  const fromStage = {};
  (data.devices || []).forEach(f => deviceStages(f).forEach(s => {
    if (s.filterId && typeof s.intervalDays === 'number' && fromStage[s.filterId] == null) {
      fromStage[s.filterId] = s.intervalDays;
    }
  }));

  return {
    ...data,
    filters: data.filters.map(p =>
      typeof p.intervalDays === 'number'
        ? p
        : { ...p, intervalDays: fromStage[p.id] != null ? fromStage[p.id] : DEFAULT_INTERVAL_DAYS }
    ),
  };
}

// Ensure every filter has a valid `type`. Filters that predate filter-owned types
// (or any with a stray value) default to 'other'. Non-destructive and
// idempotent — runs on every load so older data picks up the field silently.
function migrateFilterTypes(data) {
  if (!data || !Array.isArray(data.filters)) return data;
  const needs = data.filters.some(p => !FILTER_TYPES[p.type]);
  if (!needs) return data;
  return { ...data, filters: data.filters.map(p => FILTER_TYPES[p.type] ? p : { ...p, type: 'other' }) };
}

// A device's owner's manual is now TWO independent fields: `manualUrl` (a web
// link string) and `manualFile` ({ uri, name }). Earlier shapes are converted:
//   - the interim single object  manual:{type:'url',url}     -> manualUrl
//                                manual:{type:'file',uri,name}-> manualFile
//   - a very old legacy string   manualUrl:'...'              -> kept as-is
// Empty links are dropped (so no empty "Open" box renders). The `manual` object
// key is removed. Triggers only when a legacy `manual` object is present, so it
// no-ops once converted.
function migrateDeviceManual(data) {
  if (!data || !Array.isArray(data.devices)) return data;
  const needs = data.devices.some(f => 'manual' in f);
  if (!needs) return data;
  return {
    ...data,
    devices: data.devices.map(f => {
      if (!('manual' in f)) return f;
      const { manual, manualUrl: legacyUrl, ...rest } = f;
      let url = '';
      let file = null;
      if (manual && manual.type === 'url' && typeof manual.url === 'string') url = manual.url;
      else if (manual && manual.type === 'file' && typeof manual.uri === 'string') {
        file = { uri: manual.uri, name: manual.name || 'Owner\u2019s manual' };
      }
      if (!url && typeof legacyUrl === 'string') url = legacyUrl;
      url = (url || '').trim();
      const next = { ...rest };
      if (url) next.manualUrl = url;
      if (file) next.manualFile = file;
      return next;
    }),
  };
}

// ---------------------------------------------------------------------------
// Photo path normalization (filter reference photos)
// ---------------------------------------------------------------------------
// Photos are COPIED into <documentDirectory>/part-photos/ by lib/filterPhotos.
// We persist only the RELATIVE filename here, never the absolute URI: the
// document directory's absolute path contains the app's data-container UUID,
// which iOS does not guarantee to keep stable across reinstalls/updates. The
// absolute URI is rebuilt at render time (lib/filterPhotos.photoUri) against the
// CURRENT document directory, so a file stays reachable even if the container
// moves. See lib/filterPhotos for the read-side resolver.

// Reduce a stored photo value to its relative filename. A documents copy
// (file://.../part-photos/<name>) becomes <name>; an already-relative name is
// left alone; any other absolute URI (e.g. a copy-failure cache fallback) is
// left as-is so it still renders this session (it just won't survive a move).
function toRelativePhoto(value) {
  if (!value || typeof value !== 'string') return value;
  if (value.startsWith('file:') || value.startsWith('/')) {
    const rest = value.split('/part-photos/')[1];
    if (rest) return rest.split('?')[0];
    return value;
  }
  return value;
}

// One-time, idempotent migration of already-stored photo references:
//   absolute documents URI  -> relative filename (now move-proof)
//   dead cache/library URI  -> DROPPED (the bytes were evicted long ago; keeping
//                              it only yields a permanent blank thumbnail)
//   already-relative name   -> kept unchanged
// Runs on every load; once all photos are bare filenames it's a no-op.
function migratePhotoPaths(data) {
  if (!data || !Array.isArray(data.filters)) return data;
  let any = false;
  const filters = data.filters.map(p => {
    if (!Array.isArray(p.photos) || p.photos.length === 0) return p;
    let touched = false;
    const next = [];
    for (const ph of p.photos) {
      if (typeof ph !== 'string') { touched = true; continue; }
      if (ph.startsWith('file:') || ph.startsWith('/')) {
        const rest = ph.split('/part-photos/')[1];
        if (rest) { next.push(rest.split('?')[0]); touched = true; } // doc copy -> relative
        else { touched = true; }                                     // drop dead cache ref
      } else {
        next.push(ph);                                               // already relative
      }
    }
    if (!touched) return p;
    any = true;
    return { ...p, photos: next };
  });
  return any ? { ...data, filters } : data;
}

function seed() {
  return {
    schemaVersion: 3,
    // Assets are the single organizing dimension (no categories). `order`
    // drives the tab order on the home screen. Home/Auto/Work are the three
    // LOCKED defaults (see PROTECTED_ASSET_IDS) — always present, can't be
    // renamed/archived/deleted, but CAN be reordered. ensureDefaultAssets()
    // guarantees them on every load, so the seed only needs to list them.
    assets: [
      { id: 'a_home', name: 'Home', archived: false, order: 0 },
      { id: 'a_auto', name: 'Auto', archived: false, order: 1 },
      { id: 'a_work', name: 'Work', archived: false, order: 2 },
    ],
    // Filters own the recommended replacement interval (intervalDays).
    filters: [
      { id: 'f_merv11',    name: '20x25x1 MERV 11',        type: 'air',   sku: 'FPR1500-20251', reorderUrl: 'https://www.amazon.com/dp/B07BR9D77Q', photos: [], onHand: 2, lowStockThreshold: 1, intervalDays: 90 },
      { id: 'f_ro50',      name: 'RO Membrane 50 GPD',     type: 'water', sku: 'TFC-50',        reorderUrl: '', photos: [], onHand: 1, lowStockThreshold: 1, intervalDays: 730 },
      { id: 'f_ro_sed',    name: 'Sediment Pre-Filter 5µ', type: 'water', sku: 'SED-10-5',      reorderUrl: '', photos: [], onHand: 1, lowStockThreshold: 1, intervalDays: 180 },
      { id: 'f_ro_carbon', name: 'Carbon Block CTO',       type: 'water', sku: 'CTO-10',        reorderUrl: '', photos: [], onHand: 0, lowStockThreshold: 1, intervalDays: 365 },
      { id: 'f_cf10',      name: 'Malibu Cabin Air',       type: 'air',   sku: 'CF10285',       reorderUrl: '', photos: [], onHand: 1, lowStockThreshold: 1, intervalDays: 365 },
      { id: 'f_merv8',     name: '16x20x1 MERV 8',         type: 'air',   sku: 'MERV8-16201',   reorderUrl: '', photos: [], onHand: 3, lowStockThreshold: 2, intervalDays: 90 },
    ],
    // The Under-Sink RO (d3) is a 3-stage unit demoing multi-filter devices.
    // normalizeDevice() runs on load to fill in stage ids + the device mirror,
    // so the seed omits both. Each stage's intervalDays is the filterless
    // fallback; the linked filter's interval wins when present.
    devices: [
      { id: 'd1', assetId: 'a_home', name: 'Living Room Furnace', stages: [{ intervalDays: 90, lastReplaced: iso(84), filterId: 'f_merv11' }] },
      { id: 'd2', assetId: 'a_home', name: 'Kitchen Fridge', model: 'WRX735SDHZ', serial: 'HRA0412345', productUrl: 'https://www.whirlpool.com/refrigerators.html', manualUrl: 'https://www.whirlpool.com/owners.html', icon: 'refrigerator.fill', stages: [{ intervalDays: 180, lastReplaced: iso(0), filterId: 'f_ro_sed' }] },
      { id: 'd3', assetId: 'a_home', name: 'Under-Sink RO', stages: [
        { intervalDays: 180, lastReplaced: iso(170), filterId: 'f_ro_sed' },     // ~10d left
        { intervalDays: 365, lastReplaced: iso(120), filterId: 'f_ro_carbon' },  // healthy, but out of stock
        { intervalDays: 730, lastReplaced: iso(120), filterId: 'f_ro50' },       // long-life membrane
      ] },
      { id: 'd4', assetId: 'a_auto', name: 'Chevrolet Malibu', icon: 'car.fill', stages: [{ intervalDays: 365, lastReplaced: iso(351), filterId: 'f_cf10' }] },
      { id: 'd6', assetId: 'a_work', name: 'Office HVAC', stages: [{ intervalDays: 90, lastReplaced: iso(81), filterId: 'f_merv8' }] },
    ],
    settings: {
      reminders: {
        enabled: false,
        leadDays: 30,
        extraReminders: [7],
        timeOfDay: '09:00',
        channels: { push: true, sms: false, email: false },
      },
      lowStockAlerts: true,
    },
  };
}

// One-time Filter->Device / Part->Filter data rename. Older stored data keyed
// the appliance container under `filters` and the replaceable item under
// `parts`, with each container stage linking a `partId`. We now call the
// container a DEVICE and the item a FILTER. Convert in place (no key bump):
//   old `filters` (containers) -> `devices`  (each stage's partId -> filterId)
//   old `parts`   (items)      -> `filters`
// Idempotent: only fires while a legacy top-level `parts` key is present, so it
// runs exactly once and is a no-op on already-renamed (or freshly seeded) data.
function migrateDeviceFilterRename(data) {
  if (!data || typeof data !== 'object' || !('parts' in data)) return data;
  const oldContainers = Array.isArray(data.filters) ? data.filters : [];
  const oldItems = Array.isArray(data.parts) ? data.parts : [];
  const devices = oldContainers.map(c => {
    if (!Array.isArray(c.stages)) return c;
    const stages = c.stages.map(s => {
      if (!s || s.partId === undefined) return s;
      const { partId, ...rest } = s;
      return { ...rest, filterId: partId };
    });
    return { ...c, stages };
  });
  const { parts, filters, ...rest } = data;
  return { ...rest, devices, filters: oldItems };
}

// Reprefix internal ids to match the vocabulary: devices d_, filters f_ (the
// old container minted f_/f1.., the old item minted p_). Runs after the rename
// so it sees devices/filters arrays. Item ids are remapped first and every
// stage.filterId is rewritten through that map, so links never orphan.
// Idempotent: devices already starting d_ and items already starting f_ are
// left alone, so it settles after one pass.
function migrateIdPrefixes(data) {
  if (!data || typeof data !== 'object') return data;
  const devices = Array.isArray(data.devices) ? data.devices : [];
  const items = Array.isArray(data.filters) ? data.filters : [];

  // Items: p* -> f*  (record the remap so stage links can follow)
  const itemUsed = new Set(items.map(it => it && it.id).filter(Boolean));
  const itemMap = {};
  for (const it of items) {
    if (it && typeof it.id === 'string' && it.id[0] === 'p') {
      let nid = 'f' + it.id.slice(1);
      while (itemUsed.has(nid)) nid += '_x';
      itemMap[it.id] = nid;
      itemUsed.add(nid);
    }
  }
  const newItems = items.map(it => (it && itemMap[it.id]) ? { ...it, id: itemMap[it.id] } : it);

  // Devices: f* -> d*, and remap each stage's filterId through itemMap
  const devUsed = new Set(devices.map(d => d && d.id).filter(Boolean));
  const newDevices = devices.map(d => {
    if (!d) return d;
    const nd = { ...d };
    if (typeof d.id === 'string' && d.id[0] === 'f') {
      let nid = 'd' + d.id.slice(1);
      while (devUsed.has(nid)) nid += '_x';
      nd.id = nid;
      devUsed.add(nid);
    }
    if (Array.isArray(d.stages)) {
      nd.stages = d.stages.map(s =>
        (s && typeof s.filterId === 'string' && itemMap[s.filterId])
          ? { ...s, filterId: itemMap[s.filterId] }
          : s
      );
    }
    return nd;
  });

  return { ...data, devices: newDevices, filters: newItems };
}

// LEGACY v1 -> v2. Reads ancient v1 data by its real key names and emits the
// pre-rename ("old v2") shape: `filters` are containers, `parts` are items,
// each container linking a `partId`. migrateDeviceFilterRename (run immediately
// after this in the v1 load chain) then converts that forward to the current
// devices/filters/filterId vocabulary. Left in legacy vocab on purpose.
function migrateV1toV2(v1) {
  const next = { ...v1, schemaVersion: 2, parts: [] };
  const seenUrl = new Map();
  next.filters = (v1.filters || []).map(f => {
    const url = (f.reorderUrl || '').trim();
    if (!url) return { ...f, partId: null, photo: f.photo || null };
    let partId = seenUrl.get(url);
    if (!partId) {
      partId = 'p_mig_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      next.parts.push({ id: partId, name: f.name + ' part', sku: '', reorderUrl: url, photos: [], onHand: 0, lowStockThreshold: 1 });
      seenUrl.set(url, partId);
    }
    const { reorderUrl, ...rest } = f;
    return { ...rest, partId, photo: f.photo || null };
  });
  if (!next.settings) next.settings = seed().settings;
  if (next.settings.lowStockAlerts === undefined) next.settings.lowStockAlerts = true;
  return next;
}

// Fill in any missing reminder sub-fields with defaults. Runs on every load
// so users with older data (no `enabled`, no `extraReminders`, etc.) get the
// new fields silently, preserving any values they had set.
function migrateReminders(data) {
  if (!data) return data;
  const r = (data.settings && data.settings.reminders) || {};
  const reminders = {
    enabled: typeof r.enabled === 'boolean' ? r.enabled : false,
    leadDays: typeof r.leadDays === 'number' ? r.leadDays : 30,
    extraReminders: Array.isArray(r.extraReminders) ? r.extraReminders.slice(0, 1) : [7],
    timeOfDay: typeof r.timeOfDay === 'string' && /^\d{1,2}:\d{2}$/.test(r.timeOfDay) ? r.timeOfDay : '09:00',
    channels: r.channels || { push: true, sms: false, email: false },
  };
  return {
    ...data,
    settings: { ...(data.settings || {}), reminders },
  };
}

// The migration pipeline, in order. Previously this was a single deeply nested
// call repeated in three places — easy to get out of step, and impossible to
// read. Same functions, same order, one definition.
function runMigrations(raw) {
  let d = raw;
  d = migrateDeviceFilterRename(d);
  d = migrateIdPrefixes(d);
  d = migrateReminders(d);
  d = migrateDeviceStages(d);
  d = migrateFilterIntervals(d);
  d = migrateFilterTypes(d);
  d = migrateDeviceManual(d);
  d = migratePhotoPaths(d);
  d = ensureDefaultAssets(d);
  d = migrateSyncFields(d);   // schemaVersion 4: updatedAt + tombstones
  return d;
}

// Seeded data is already in the current shape, so it skips the legacy steps.
function runSeedMigrations(raw) {
  let d = raw;
  d = migrateDeviceStages(d);
  d = migrateFilterIntervals(d);
  d = migrateFilterTypes(d);
  d = migrateDeviceManual(d);
  d = ensureDefaultAssets(d);
  d = migrateSyncFields(d);
  return d;
}

export async function loadData() {
  try {
    const v2 = await AsyncStorage.getItem(KEY);
    if (v2) {
      const parsed = JSON.parse(v2);
      // Defensive: ensure filters have photos:[] (covers users who saved before this field existed)
      if (parsed.filters) parsed.filters = parsed.filters.map(p => ({ ...p, photos: p.photos || [] }));
      const starter = parsed.__starter; // preserve the sample-data marker across migrations
      const out = pruneTombstones(runMigrations(parsed));
      if (starter) out.__starter = starter;
      return out;
    }
    const v1raw = await AsyncStorage.getItem(LEGACY_KEY_V1);
    if (v1raw) {
      const v1 = JSON.parse(v1raw);
      const migrated = runMigrations(migrateV1toV2(v1));

      await saveData(migrated);
      return migrated;
    }
  } catch (e) { console.warn('loadData failed', e); }
  const fresh = runSeedMigrations(seed());
  fresh.__starter = buildStarterMarker(fresh); // arm "Delete Sample Data" — fresh install only
  await saveData(fresh);
  return fresh;
}

export async function saveData(data) {
  try { await AsyncStorage.setItem(KEY, JSON.stringify(data)); }
  catch (e) { console.warn('saveData failed', e); }
  // Auto-resync local notifications after every save. Dynamic import so the
  // notifications module loads lazily and any failure (missing native module,
  // permission revoked, etc.) is silent so it can't break a normal save.
  try {
    const { syncDeviceNotifications } = await import('../lib/notifications');
    await syncDeviceNotifications(data);
  } catch (e) { /* silent */ }

  // Nudge cloud sync after a local change. Dynamic import for the same reason
  // notifications uses one: it breaks the module cycle (syncClient imports this
  // file) and keeps any failure from touching a normal save.
  //
  // scheduleSync is debounced AND declines to queue while a sync is running —
  // which matters because runSync calls saveData itself. Without that guard,
  // every sync would schedule the next one indefinitely.
  try {
    const { scheduleSync } = await import('../lib/syncClient');
    scheduleSync();
  } catch (e) { /* silent — sync is optional, saving is not */ }
}

export async function resetToSeed() {
  const fresh = runSeedMigrations(seed());
  fresh.__starter = buildStarterMarker(fresh);
  await saveData(fresh);
  return fresh;
}

// ---------------------------------------------------------------------------
// Starter (sample) data marker + clear
// ---------------------------------------------------------------------------
// A fresh install seeds demo data and stamps `data.__starter` — a snapshot of
// each seeded device/filter's content signature. This powers a "Delete Sample
// Data" action that removes ONLY items the user never touched: an entity is
// cleared only if it still matches its seeded signature, so anything edited,
// restocked, marked-replaced, or newly added is kept.
//
// The marker is deliberately scoped to the original install:
//   • It is NEVER written to a backup (lib/backup.js strips it on export), so
//     restoring a backup — even of pristine seed — lands as the user's own
//     data and is never re-deletable as "sample".
//   • It is removed once sample data is cleared.
//   • Only a true fresh install (empty storage -> seed()) re-arms it.
//
// The signature ignores derived/volatile fields normalizeDevice() fills in
// (stage ids, the device-level mirror), so it stays valid across reloads.

function starterDeviceSig(d) {
  return JSON.stringify({
    name: d.name || '',
    assetId: d.assetId || '',
    model: d.model || '',
    serial: d.serial || '',
    productUrl: d.productUrl || '',
    manualUrl: d.manualUrl || '',
    icon: d.icon || null,
    notes: d.notes || '',
    stages: (d.stages || []).map(s => ({
      intervalDays: s.intervalDays ?? null,
      lastReplaced: s.lastReplaced ?? null,
      filterId: s.filterId ?? null,
    })),
  });
}

function starterFilterSig(f) {
  return JSON.stringify({
    name: f.name || '',
    type: f.type || '',
    sku: f.sku || '',
    reorderUrl: f.reorderUrl || '',
    onHand: f.onHand ?? 0,
    lowStockThreshold: f.lowStockThreshold ?? 0,
    intervalDays: f.intervalDays ?? null,
    photos: f.photos || [],
  });
}

function buildStarterMarker(data) {
  const devices = {};
  for (const d of data.devices || []) devices[d.id] = starterDeviceSig(d);
  const filters = {};
  for (const f of data.filters || []) filters[f.id] = starterFilterSig(f);
  return { v: 1, devices, filters };
}

// Seeded ids that are still pristine (present AND unchanged) in `data`.
function pristineStarterIds(data) {
  const mark = data && data.__starter;
  if (!mark) return { devices: [], filters: [] };
  const devices = (data.devices || [])
    .filter(d => mark.devices && mark.devices[d.id] === starterDeviceSig(d))
    .map(d => d.id);
  const filters = (data.filters || [])
    .filter(f => mark.filters && mark.filters[f.id] === starterFilterSig(f))
    .map(f => f.id);
  return { devices, filters };
}

// True while "Delete Sample Data" should show: the marker exists and at least
// one seeded device or filter is still untouched. Manual deletion of the seed
// items naturally drives this to false (nothing left to match).
export function hasStarterData(data) {
  const { devices, filters } = pristineStarterIds(data);
  return devices.length > 0 || filters.length > 0;
}

// Remove ONLY untouched seeded items, persist an "owned" dataset (marker gone),
// and return it. Edited/added items are kept. A pristine seeded filter is kept
// if any surviving device still uses it, so we never orphan a user's device.
export async function clearStarterData() {
  const data = await loadData();
  if (!data.__starter) return data; // not armed — nothing to do
  const { devices: pd, filters: pf } = pristineStarterIds(data);
  const removeDevices = new Set(pd);
  const keptDevices = (data.devices || []).filter(d => !removeDevices.has(d.id));
  const usedByKept = new Set();
  for (const d of keptDevices) for (const s of (d.stages || [])) if (s.filterId) usedByKept.add(s.filterId);
  const removeFilters = new Set(pf.filter(id => !usedByKept.has(id)));
  const keptFilters = (data.filters || []).filter(f => !removeFilters.has(f.id));
  // Tombstone the cleared seed items. Without this, a second device that still
  // has the sample data would push it back on the next sync and "Delete Sample
  // Data" would appear not to have worked.
  let next = { ...data, devices: keptDevices, filters: keptFilters };
  next = addTombstones(next, 'device', Array.from(removeDevices));
  next = addTombstones(next, 'filter', Array.from(removeFilters));
  delete next.__starter;
  await saveData(next);
  return next;
}

// ---------------------------------------------------------------------------
// Status math (per-stage, with a soonest-due headline per device)
// ---------------------------------------------------------------------------

// Effective interval (days) for a stage: the linked filter's interval if linked
// (the filter owns the cadence), else the stage's own fallback interval. Pass
// `data` so the filter can be resolved; without it, falls back to the stage.
export function stageIntervalDays(stage, data) {
  if (stage && stage.filterId && data) {
    const p = getFilter(data, stage.filterId);
    if (p && typeof p.intervalDays === 'number') return p.intervalDays;
  }
  return (stage && typeof stage.intervalDays === 'number') ? stage.intervalDays : DEFAULT_INTERVAL_DAYS;
}

// Status of a single stage. `intervalDays` is the resolved effective interval;
// when omitted, falls back to the stage's own stored interval.
export function stageStatus(stage, intervalDays) {
  const iv = typeof intervalDays === 'number'
    ? intervalDays
    : (typeof stage.intervalDays === 'number' ? stage.intervalDays : DEFAULT_INTERVAL_DAYS);
  const due = new Date(new Date(stage.lastReplaced).getTime() + iv * MS_DAY);
  const left = Math.round((due.getTime() - today().getTime()) / MS_DAY);
  if (left < 0)   return { key: 'red', left, due, label: `${Math.abs(left)}d overdue` };
  if (left <= 14) return { key: 'amb', left, due, label: `Due in ${left}d` };
  return { key: 'grn', left, due, label: `${left}d left` };
}

// A device's headline status = its soonest-due stage. Also reports stageCount
// (so lists can flag multi-stage devices) and stageId (which stage is driving
// the headline). Pass `data` so filter-owned intervals resolve correctly.
export function statusOf(device, data) {
  // Only filtered stages contribute to the schedule. A device whose stages are
  // all filterless (old reminder model) is treated identically to a zero-stage
  // device — it has no tracked schedule under the new model.
  const stages = deviceStages(device).filter(s => !!s.filterId);
  if (stages.length === 0) {
    return { key: 'grn', left: Number.POSITIVE_INFINITY, due: today(), label: '—', stageCount: 0, stageId: null };
  }
  let soonest = null;
  for (const s of stages) {
    const st = stageStatus(s, stageIntervalDays(s, data));
    if (!soonest || st.left < soonest.left) soonest = { ...st, stageId: s.id };
  }
  return { ...soonest, stageCount: stages.length };
}

// Each stage with its computed status AND its resolved effective intervalDays
// (so display reads the filter-owned interval), soonest-due first.
export function stagesWithStatus(device, data) {
  return deviceStages(device)
    .filter(s => !!s.filterId)           // filterless stages have no schedule
    .map(s => {
      const iv = stageIntervalDays(s, data);
      return { ...s, intervalDays: iv, status: stageStatus(s, iv) };
    })
    .sort(byDueThenName);
}

// Sort by soonest due. Filter-less devices carry left = +Infinity, so they fall
// below every device with a real due date; ties (including the whole filter-less
// group) break alphabetically so the order is stable.
function byDueThenName(a, b) {
  if (a.status.left === b.status.left) return (a.name || '').localeCompare(b.name || '');
  return a.status.left - b.status.left;
}

export function dueSoonList(data) {
  const liveAssetIds = new Set(data.assets.filter(a => !a.archived).map(a => a.id));
  return data.devices
    .filter(f => liveAssetIds.has(f.assetId))
    .map(f => ({
      ...f,
      displayType: deviceDisplayType(f, data),
      status: statusOf(f, data),
      // Resolved interval of the first stage, for the single-stage meta line.
      intervalDays: stageIntervalDays(deviceStages(f)[0], data),
      asset: data.assets.find(a => a.id === f.assetId),
    }))
    .sort(byDueThenName);
}

// Devices belonging to one asset, decorated like dueSoonList (status + asset),
// soonest-due first. Powers the per-asset tab on the home screen.
export function devicesForAssetId(data, assetId) {
  return data.devices
    .filter(f => f.assetId === assetId)
    .map(f => ({
      ...f,
      displayType: deviceDisplayType(f, data),
      status: statusOf(f, data),
      intervalDays: stageIntervalDays(deviceStages(f)[0], data),
      asset: data.assets.find(a => a.id === f.assetId),
    }))
    .sort(byDueThenName);
}

export function dueCount(list) {
  return list.filter(f => f.status.key !== 'grn').length;
}

export function getFilter(data, filterId) {
  if (!filterId) return null;
  return (data.filters || []).find(p => p.id === filterId) || null;
}

export function filtersList(data) {
  return (data.filters || []).slice().sort((a, b) => a.name.localeCompare(b.name));
}

// ---------------------------------------------------------------------------
// Device type, derived from its filters
// ---------------------------------------------------------------------------
// A device no longer has its own type — it inherits from the filter(s) it holds.
// These read the linked filters' types and summarize them for display.

// Unique filter types present on a device's linked stages, in a stable order
// (water, air, other). Empty when the device has no linked filters.
export function deviceFilterTypes(device, data) {
  const seen = new Set();
  deviceStages(device).forEach(s => {
    if (!s.filterId) return;
    const p = getFilter(data, s.filterId);
    if (p) seen.add(normFilterType(p.type));
  });
  return FILTER_TYPE_ORDER.filter(k => seen.has(k));
}

// One representative type for the device's ICON: the lone type when all its
// filters agree, otherwise 'other' (a mixed-type device — e.g. fridge with air +
// water — or a device with no filters gets the generic icon).
export function deviceDisplayType(device, data) {
  const types = deviceFilterTypes(device, data);
  return types.length === 1 ? types[0] : 'other';
}

// Human label for the device's type(s): "Air", "Water", "Air & Water", or '—'
// when there are no linked filters.
export function deviceTypeLabel(device, data) {
  const types = deviceFilterTypes(device, data);
  if (types.length === 0) return '—';
  return types.map(k => FILTER_TYPES[k].label).join(' & ');
}

export function filtersLowStock(data) {
  return (data.filters || []).filter(p => p.onHand <= p.lowStockThreshold);
}

// Devices that reference a given filter on ANY of their stages.
export function devicesUsingFilter(data, filterId) {
  return data.devices.filter(f => deviceStages(f).some(s => s.filterId === filterId));
}

export function isFilterLow(filter) {
  if (!filter) return false;
  return filter.onHand <= filter.lowStockThreshold;
}

// Mark specific stages replaced on a date, recalculating only those due dates
// and decrementing the on-hand of each replaced stage's linked filter.
//   stageIds omitted/empty -> all stages (the single-tap path for a one-stage
//   device; the sheet passes the exact ids the user checked).
export function markReplaced(data, deviceId, replacedDate, stageIds) {
  const dateIso = replacedDate ? new Date(replacedDate).toISOString() : today().toISOString();
  const f = data.devices.find(x => x.id === deviceId);
  if (!f) return data;

  const stages = deviceStages(f);
  const targetIds = (stageIds && stageIds.length)
    ? new Set(stageIds)
    : new Set(stages.map(s => s.id));

  // Tally how many of each filter were consumed (a filter could sit on >1 stage).
  const consumed = {};
  stages.forEach(s => {
    if (targetIds.has(s.id) && s.filterId) consumed[s.filterId] = (consumed[s.filterId] || 0) + 1;
  });
  const nextFilters = (data.filters || []).map(p =>
    consumed[p.id] ? stamp({ ...p, onHand: Math.max(0, (p.onHand || 0) - consumed[p.id]) }) : p
  );

  const nextStages = stages.map(s =>
    targetIds.has(s.id) ? { ...s, lastReplaced: dateIso } : s
  );

  return {
    ...data,
    devices: data.devices.map(x => x.id === deviceId ? stamp(withMirror({ ...x, stages: nextStages })) : x),
    filters: nextFilters,
  };
}

export function addDevice(data, device) {
  const id = newId('d_');
  // Accept either an incoming `stages` array or the legacy single-filter shape
  // (intervalDays/lastReplaced/filterId) and normalize to stages + mirror.
  const incomingStages = Array.isArray(device.stages) && device.stages.length > 0
    ? device.stages.map((s, i) => makeStage(id, i, s))
    : [makeStage(id, 0, {
        intervalDays: device.intervalDays,
        lastReplaced: device.lastReplaced,
        filterId: device.filterId,
      })];
  const { intervalDays, lastReplaced, filterId, photo, stages, ...rest } = device;
  const f = stamp(withMirror({ ...rest, id, stages: incomingStages }));
  return { ...data, devices: [...data.devices, f] };
}

export function updateDevice(data, deviceId, patch) {
  return {
    ...data,
    devices: data.devices.map(f => {
      if (f.id !== deviceId) return f;
      let next = { ...f, ...patch };
      // TRANSITIONAL: if the old single-filter Edit screen patched a legacy field,
      // fold it into stages[0] so stages stays the source of truth. Remove with
      // the mirror once Edit writes `stages` directly.
      if ('intervalDays' in patch || 'lastReplaced' in patch || 'filterId' in patch) {
        const base = (next.stages && next.stages[0]) || {};
        const s0 = makeStage(f.id, 0, {
          ...base,
          ...('intervalDays' in patch ? { intervalDays: patch.intervalDays } : {}),
          ...('lastReplaced' in patch ? { lastReplaced: patch.lastReplaced } : {}),
          ...('filterId' in patch ? { filterId: patch.filterId } : {}),
        });
        next = { ...next, stages: next.stages ? [s0, ...next.stages.slice(1)] : [s0] };
      } else if (Array.isArray(patch.stages)) {
        next = { ...next, stages: patch.stages.map((s, i) => makeStage(f.id, i, s)) };
      }
      return stamp(withMirror(next));
    }),
  };
}

export function deleteDevice(data, deviceId) {
  const next = { ...data, devices: data.devices.filter(f => f.id !== deviceId) };
  return addTombstone(next, 'device', deviceId);
}
export function addAsset(data, asset) {
  const maxOrder = (data.assets || []).reduce((m, a) => Math.max(m, a.order || 0), -1);
  return { ...data, assets: [...data.assets, stamp({ archived: false, order: maxOrder + 1, ...asset, id: newId('a_') })] };
}
export function setAssetArchived(data, assetId, archived) {
  return { ...data, assets: data.assets.map(a => a.id === assetId ? stamp({ ...a, archived }) : a) };
}
export function addFilter(data, filter) {
  const id = newId('f_');
  return { ...data, filters: [...(data.filters || []), stamp({ id, name: '', type: 'other', sku: '', reorderUrl: '', photos: [], onHand: 0, lowStockThreshold: 1, intervalDays: DEFAULT_INTERVAL_DAYS, ...filter })] };
}
export function updateFilter(data, filterId, patch) {
  return { ...data, filters: (data.filters || []).map(p => p.id === filterId ? stamp({ ...p, ...patch }) : p) };
}

// Delete a filter from the catalog and unlink it from every stage that used it.
// The stages and their schedules survive; to keep their due dates from jumping,
// each unlinked stage inherits the deleted filter's interval as its new fallback.
export function deleteFilter(data, filterId) {
  const gone = getFilter(data, filterId);
  const fallbackIv = gone && typeof gone.intervalDays === 'number' ? gone.intervalDays : DEFAULT_INTERVAL_DAYS;
  // Only devices that actually referenced this filter are modified, so only
  // those get stamped. Stamping untouched devices would make them win merges
  // against edits made on another device that this one never saw.
  const next = {
    ...data,
    filters: (data.filters || []).filter(p => p.id !== filterId),
    devices: data.devices.map(f => {
      const stages = deviceStages(f);
      if (!stages.some(st => st.filterId === filterId)) return f;
      return stamp(withMirror({
        ...f,
        stages: stages.map(st =>
          st.filterId === filterId ? { ...st, filterId: null, intervalDays: fallbackIv } : st
        ),
      }));
    }),
  };
  return addTombstone(next, 'filter', filterId);
}

// Photo helpers — pure mutations on a Filter's photos array. Stored values are
// RELATIVE filenames (resolved to absolute at render time); normalize on the way
// in so the data layer never holds a container-specific absolute path.
export function addFilterPhoto(data, filterId, uri) {
  const rel = toRelativePhoto(uri);
  return {
    ...data,
    filters: (data.filters || []).map(p => {
      if (p.id !== filterId) return p;
      const next = [...(p.photos || []), rel].slice(0, MAX_FILTER_PHOTOS);
      return stamp({ ...p, photos: next });
    }),
  };
}
export function removeFilterPhoto(data, filterId, index) {
  return {
    ...data,
    filters: (data.filters || []).map(p => {
      if (p.id !== filterId) return p;
      const next = (p.photos || []).filter((_, i) => i !== index);
      return stamp({ ...p, photos: next });
    }),
  };
}

// Settings helpers — shallow merge into settings or settings.reminders.
export function updateSettings(data, patch) {
  return { ...data, settings: stamp({ ...(data.settings || {}), ...patch }) };
}
export function updateReminders(data, patch) {
  return {
    ...data,
    settings: stamp({
      ...(data.settings || {}),
      reminders: { ...((data.settings || {}).reminders || {}), ...patch },
    }),
  };
}

// ============================================================================
// ASSET HELPERS
// ============================================================================

// Live assets in display order (drives the home-screen tabs). Pass
// includeArchived to get everything (the Assets settings screen).
export function assetsList(data, includeArchived = false) {
  return (data.assets || [])
    .filter(a => includeArchived || !a.archived)
    .slice()
    .sort((a, b) => (a.order || 0) - (b.order || 0));
}

export function updateAsset(data, assetId, patch) {
  return {
    ...data,
    assets: (data.assets || []).map(a =>
      a.id === assetId ? stamp({ ...a, ...patch }) : a
    ),
  };
}

export function devicesForAsset(data, assetId) {
  return (data.devices || []).filter(f => f.assetId === assetId);
}

// Reorder assets to match idsInOrder; any assets not listed keep their
// relative order after the listed ones.
export function reorderAssets(data, idsInOrder) {
  const assets = data.assets || [];
  const byId = Object.fromEntries(assets.map(a => [a.id, a]));
  const seen = new Set();
  const reordered = [];
  idsInOrder.forEach((id, i) => {
    if (byId[id]) { reordered.push(stamp({ ...byId[id], order: i })); seen.add(id); }
  });
  assets
    .filter(a => !seen.has(a.id))
    .sort((a, b) => (a.order || 0) - (b.order || 0))
    .forEach(a => reordered.push(stamp({ ...a, order: reordered.length })));
  return { ...data, assets: reordered };
}

// Permanently delete an asset AND all devices that reference it. The three
// protected defaults can't be deleted. Filters are NOT touched (shared catalog).
export function deleteAsset(data, assetId) {
  if (!canDeleteAsset(assetId)) return data;
  // Cascading device deletes need their OWN tombstones — the other device has
  // no way to infer them from the asset's tombstone alone.
  const removedDeviceIds = (data.devices || []).filter(f => f.assetId === assetId).map(f => f.id);
  const next = {
    ...data,
    assets: (data.assets || []).filter(a => a.id !== assetId),
    devices: (data.devices || []).filter(f => f.assetId !== assetId),
  };
  return addTombstones(addTombstone(next, 'asset', assetId), 'device', removedDeviceIds);
}