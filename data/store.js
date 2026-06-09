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

const KEY = 'thefilterlist.data.v5';
const LEGACY_KEY_V1 = 'thefilterlist.data.v1';

export const MAX_FILTER_PHOTOS = 3;

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
    // renamed/archived/deleted, but CAN be reordered. They sort first; user
    // assets (Main House, 2019 Civic below — both fully editable) follow.
    assets: [
      { id: 'a_home', name: 'Home', archived: false, order: 0 },
      { id: 'a_auto', name: 'Auto', archived: false, order: 1 },
      { id: 'a_work', name: 'Work', archived: false, order: 2 },
      { id: 'a_house', name: 'Main House', archived: false, order: 3 },
      { id: 'a_civic', name: '2019 Civic', archived: false, order: 4 },
    ],
    // Filters own the recommended replacement interval (intervalDays).
    filters: [
      { id: 'f_merv11', name: '20x25x1 MERV 11', type: 'air', sku: 'FPR1500-20251', reorderUrl: 'https://www.amazon.com/dp/B07BR9D77Q', photos: [], onHand: 2, lowStockThreshold: 1, intervalDays: 90 },
      { id: 'f_edr1',   name: 'EveryDrop EDR1RXD1', type: 'water', sku: 'EDR1RXD1', reorderUrl: 'https://www.amazon.com/dp/B00YQ3L0DG', photos: [], onHand: 1, lowStockThreshold: 1, intervalDays: 180 },
      { id: 'f_ro50',   name: 'RO Membrane 50 GPD', type: 'water', sku: 'TFC-50', reorderUrl: '', photos: [], onHand: 1, lowStockThreshold: 1, intervalDays: 730 },
      { id: 'f_ro_sed', name: 'Sediment Pre-Filter 5µ', type: 'water', sku: 'SED-10-5', reorderUrl: '', photos: [], onHand: 1, lowStockThreshold: 1, intervalDays: 180 },
      { id: 'f_ro_carbon', name: 'Carbon Block CTO', type: 'water', sku: 'CTO-10', reorderUrl: '', photos: [], onHand: 0, lowStockThreshold: 1, intervalDays: 365 },
      { id: 'f_cf10',   name: 'Cabin Air CF10285', type: 'air', sku: 'CF10285', reorderUrl: '', photos: [], onHand: 1, lowStockThreshold: 1, intervalDays: 365 },
      { id: 'f_ca10',   name: 'Engine Air CA10755', type: 'air', sku: 'CA10755', reorderUrl: '', photos: [], onHand: 1, lowStockThreshold: 1, intervalDays: 365 },
      { id: 'f_merv8',  name: '16x20x1 MERV 8', type: 'air', sku: 'MERV8-16201', reorderUrl: '', photos: [], onHand: 3, lowStockThreshold: 2, intervalDays: 90 },
    ],
    // The Under-Sink RO (f3) is a 3-stage unit demoing multi-filter devices.
    // normalizeDevice() runs on load to fill in stage ids + the mirror. Each
    // stage's intervalDays is the filterless fallback; the linked filter's wins.
    devices: [
      { id: 'd1', assetId: 'a_house', name: 'Living Room Furnace', stages: [{ intervalDays: 90,  lastReplaced: iso(84),  filterId: 'f_merv11' }] },
      { id: 'd2', assetId: 'a_house', name: 'Kitchen Fridge', model: 'WRX735SDHZ', serial: 'HRA0412345', productUrl: 'https://www.whirlpool.com/refrigerators.html', manualUrl: 'https://www.whirlpool.com/owners.html', stages: [{ intervalDays: 180, lastReplaced: iso(200), filterId: 'f_edr1' }] },
      { id: 'd3', assetId: 'a_house', name: 'Under-Sink RO',       stages: [
        { intervalDays: 180, lastReplaced: iso(170), filterId: 'f_ro_sed' },     // ~10d left
        { intervalDays: 365, lastReplaced: iso(120), filterId: 'f_ro_carbon' },  // healthy, but out of stock
        { intervalDays: 730, lastReplaced: iso(120), filterId: 'f_ro50' },       // long-life membrane
      ] },
      { id: 'd4', assetId: 'a_civic', name: 'Cabin Air Filter',  stages: [{ intervalDays: 365, lastReplaced: iso(351), filterId: 'f_cf10' }] },
      { id: 'd5', assetId: 'a_civic', name: 'Engine Air Filter', stages: [{ intervalDays: 365, lastReplaced: iso(30),  filterId: 'f_ca10' }] },
      { id: 'd6', assetId: 'a_work', name: 'Office HVAC',       stages: [{ intervalDays: 90,  lastReplaced: iso(81),  filterId: 'f_merv8' }] },
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

export async function loadData() {
  try {
    const v2 = await AsyncStorage.getItem(KEY);
    if (v2) {
      const parsed = JSON.parse(v2);
      // Defensive: ensure filters have photos:[] (covers users who saved before this field existed)
      if (parsed.filters) parsed.filters = parsed.filters.map(p => ({ ...p, photos: p.photos || [] }));
      return ensureDefaultAssets(migratePhotoPaths(migrateDeviceManual(migrateFilterTypes(migrateFilterIntervals(migrateDeviceStages(migrateReminders(migrateIdPrefixes(migrateDeviceFilterRename(parsed)))))))));
    }
    const v1raw = await AsyncStorage.getItem(LEGACY_KEY_V1);
    if (v1raw) {
      const v1 = JSON.parse(v1raw);
      const migrated = ensureDefaultAssets(migratePhotoPaths(migrateDeviceManual(migrateFilterTypes(migrateFilterIntervals(migrateDeviceStages(migrateReminders(migrateIdPrefixes(migrateDeviceFilterRename(migrateV1toV2(v1))))))))));
      await saveData(migrated);
      return migrated;
    }
  } catch (e) { console.warn('loadData failed', e); }
  const fresh = ensureDefaultAssets(migrateDeviceManual(migrateFilterTypes(migrateFilterIntervals(migrateDeviceStages(seed())))));
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
}

export async function resetToSeed() {
  const fresh = ensureDefaultAssets(migrateDeviceManual(migrateFilterTypes(migrateFilterIntervals(migrateDeviceStages(seed())))));
  await saveData(fresh);
  return fresh;
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
    consumed[p.id] ? { ...p, onHand: Math.max(0, (p.onHand || 0) - consumed[p.id]) } : p
  );

  const nextStages = stages.map(s =>
    targetIds.has(s.id) ? { ...s, lastReplaced: dateIso } : s
  );

  return {
    ...data,
    devices: data.devices.map(x => x.id === deviceId ? withMirror({ ...x, stages: nextStages }) : x),
    filters: nextFilters,
  };
}

export function addDevice(data, device) {
  const id = 'd_' + Date.now();
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
  const f = withMirror({ ...rest, id, stages: incomingStages });
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
      return withMirror(next);
    }),
  };
}

export function deleteDevice(data, deviceId) {
  return { ...data, devices: data.devices.filter(f => f.id !== deviceId) };
}
export function addAsset(data, asset) {
  const maxOrder = (data.assets || []).reduce((m, a) => Math.max(m, a.order || 0), -1);
  return { ...data, assets: [...data.assets, { archived: false, order: maxOrder + 1, ...asset, id: 'a_' + Date.now() }] };
}
export function setAssetArchived(data, assetId, archived) {
  return { ...data, assets: data.assets.map(a => a.id === assetId ? { ...a, archived } : a) };
}
export function addFilter(data, filter) {
  const id = 'f_' + Date.now();
  return { ...data, filters: [...(data.filters || []), { id, name: '', type: 'other', sku: '', reorderUrl: '', photos: [], onHand: 0, lowStockThreshold: 1, intervalDays: DEFAULT_INTERVAL_DAYS, ...filter }] };
}
export function updateFilter(data, filterId, patch) {
  return { ...data, filters: (data.filters || []).map(p => p.id === filterId ? { ...p, ...patch } : p) };
}

// Delete a filter from the catalog and unlink it from every stage that used it.
// The stages and their schedules survive; to keep their due dates from jumping,
// each unlinked stage inherits the deleted filter's interval as its new fallback.
export function deleteFilter(data, filterId) {
  const gone = getFilter(data, filterId);
  const fallbackIv = gone && typeof gone.intervalDays === 'number' ? gone.intervalDays : DEFAULT_INTERVAL_DAYS;
  return {
    ...data,
    filters: (data.filters || []).filter(p => p.id !== filterId),
    devices: data.devices.map(f => withMirror({
      ...f,
      stages: deviceStages(f).map(s =>
        s.filterId === filterId ? { ...s, filterId: null, intervalDays: fallbackIv } : s
      ),
    })),
  };
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
      return { ...p, photos: next };
    }),
  };
}
export function removeFilterPhoto(data, filterId, index) {
  return {
    ...data,
    filters: (data.filters || []).map(p => {
      if (p.id !== filterId) return p;
      const next = (p.photos || []).filter((_, i) => i !== index);
      return { ...p, photos: next };
    }),
  };
}

// Settings helpers — shallow merge into settings or settings.reminders.
export function updateSettings(data, patch) {
  return { ...data, settings: { ...(data.settings || {}), ...patch } };
}
export function updateReminders(data, patch) {
  return {
    ...data,
    settings: {
      ...(data.settings || {}),
      reminders: { ...((data.settings || {}).reminders || {}), ...patch },
    },
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
      a.id === assetId ? { ...a, ...patch } : a
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
    if (byId[id]) { reordered.push({ ...byId[id], order: i }); seen.add(id); }
  });
  assets
    .filter(a => !seen.has(a.id))
    .sort((a, b) => (a.order || 0) - (b.order || 0))
    .forEach(a => reordered.push({ ...a, order: reordered.length }));
  return { ...data, assets: reordered };
}

// Permanently delete an asset AND all devices that reference it. The three
// protected defaults can't be deleted. Filters are NOT touched (shared catalog).
export function deleteAsset(data, assetId) {
  if (!canDeleteAsset(assetId)) return data;
  return {
    ...data,
    assets: (data.assets || []).filter(a => a.id !== assetId),
    devices: (data.devices || []).filter(f => f.assetId !== assetId),
  };
}
