// data/store.js — The Filter List data layer (v2).
// Model: Category -> Asset -> Filter -> Stage(s) -> Part.
//
// MULTI-STAGE FILTERS:
//   A filter owns a `stages` array. Each stage tracks WHEN it was last
//   replaced (its own lastReplaced -> its own due date) and an OPTIONAL link
//   to a shared part (partId) for SKU / reorder / on-hand. A plain filter is
//   just one stage; a multi-stage unit (e.g. a 3-stage under-sink RO) has
//   several, each independently scheduled and independently markable.
//
//   Parts stay a SHARED catalog (the same part can be linked from stages in
//   different filters).
//
// WHERE THE INTERVAL LIVES (part-owned, with a partless fallback):
//   The replacement interval is a property of the PART (the manufacturer's
//   recommendation, user-editable on the Part screen). The same SKU therefore
//   carries the same cadence everywhere it's used. A stage's lastReplaced is
//   per-installation, so a shared part still gets independent due dates.
//
//   A stage that has NO part keeps its OWN intervalDays as a fallback, so the
//   app still works as a plain reminder tool with no parts attached.
//
//   Effective interval for a stage:
//     stage.partId ? part.intervalDays : stage.intervalDays
//   Resolved at read time via stageIntervalDays(stage, data) — the part is the
//   single source of truth; nothing is cached/duplicated onto the stage.
//
//   A filter's headline status (for Due Soon / category lists) is its
//   SOONEST-DUE stage.
//
// TRANSITIONAL MIRROR (remove later):
//   Each filter also keeps top-level `intervalDays` / `lastReplaced` / `partId`
//   mirrored from stages[0]. This keeps any not-yet-migrated screen working.
//   The mirror's intervalDays is the stage's stored fallback, NOT the resolved
//   part interval — list builders attach a resolved `intervalDays` instead.
//
// Parts can carry up to MAX_PART_PHOTOS reference photos (file URIs in app docs).
// On-device via AsyncStorage. Migrates v1 (legacy reorderUrl text field) to v2,
// normalizes pre-stages v2 filters into the stages shape, and backfills a
// per-part intervalDays from whichever stage first linked it.

import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'thefilterlist.data.v2';
const LEGACY_KEY_V1 = 'thefilterlist.data.v1';

export const MAX_PART_PHOTOS = 3;

// Default replacement interval (days) for a brand-new part or a partless stage.
export const DEFAULT_INTERVAL_DAYS = 90;

export const FILTER_TYPES = {
  water: { label: 'Water' },
  air:   { label: 'Air' },
  other: { label: 'Other' },
};

export const MAX_CATEGORIES = 8;
function defaultCategories() {
  return [
    { id: 'home', name: 'Home', order: 0 },
    { id: 'auto', name: 'Auto', order: 1 },
    { id: 'work', name: 'Work', order: 2 },
  ];
}

const MS_DAY = 86400000;
const iso = (daysAgo) => new Date(Date.now() - daysAgo * MS_DAY).toISOString();
const today = () => new Date(new Date().toDateString());

// ---------------------------------------------------------------------------
// Stage helpers
// ---------------------------------------------------------------------------

export function filterStages(filter) {
  return Array.isArray(filter && filter.stages) ? filter.stages : [];
}

// TRANSITIONAL: copy stages[0]'s schedule up to the legacy top-level fields so
// the current single-part screens keep rendering. Remove with the mirror.
function withMirror(filter) {
  const s0 = (filter.stages && filter.stages[0]) || {};
  return {
    ...filter,
    intervalDays: s0.intervalDays,
    lastReplaced: s0.lastReplaced,
    partId: s0.partId != null ? s0.partId : null,
  };
}

// Build a normalized stage with safe defaults. `intervalDays` here is the
// PARTLESS FALLBACK — when the stage links a part, the part's interval wins
// (see stageIntervalDays). We keep it so unlinking a part leaves a sane cadence.
function makeStage(filterId, index, src) {
  const s = src || {};
  return {
    id: s.id || ('s_' + filterId + '_' + index),
    intervalDays: typeof s.intervalDays === 'number' ? s.intervalDays : DEFAULT_INTERVAL_DAYS,
    lastReplaced: s.lastReplaced || today().toISOString(),
    partId: s.partId != null ? s.partId : null,
  };
}

// Ensure a filter has a stages array. If it predates stages, derive a single
// stage from its legacy intervalDays/lastReplaced/partId. Idempotent.
function normalizeFilter(f) {
  let stages;
  if (Array.isArray(f.stages) && f.stages.length > 0) {
    stages = f.stages.map((s, i) => makeStage(f.id, i, s));
  } else {
    stages = [makeStage(f.id, 0, {
      intervalDays: f.intervalDays,
      lastReplaced: f.lastReplaced,
      partId: f.partId,
    })];
  }
  // Drop the vestigial per-filter `photo` field (parts carry photos now).
  const { photo, ...rest } = f;
  return withMirror({ ...rest, stages });
}

function migrateFilterStages(data) {
  if (!data || !Array.isArray(data.filters)) return data;
  return { ...data, filters: data.filters.map(normalizeFilter) };
}

// Backfill a per-part intervalDays. For parts that predate part-owned intervals,
// inherit the interval from the first stage that links the part (that's where
// the cadence used to live); otherwise default. Idempotent — only fills gaps.
function migratePartIntervals(data) {
  if (!data || !Array.isArray(data.parts)) return data;
  const needs = data.parts.some(p => typeof p.intervalDays !== 'number');
  if (!needs) return data;

  const fromStage = {};
  (data.filters || []).forEach(f => filterStages(f).forEach(s => {
    if (s.partId && typeof s.intervalDays === 'number' && fromStage[s.partId] == null) {
      fromStage[s.partId] = s.intervalDays;
    }
  }));

  return {
    ...data,
    parts: data.parts.map(p =>
      typeof p.intervalDays === 'number'
        ? p
        : { ...p, intervalDays: fromStage[p.id] != null ? fromStage[p.id] : DEFAULT_INTERVAL_DAYS }
    ),
  };
}

function seed() {
  return {
    schemaVersion: 2,
    categories: defaultCategories(),
    assets: [
      { id: 'a_house',  name: 'Main House',  categoryId: 'home', archived: false },
      { id: 'a_civic',  name: '2019 Civic',  categoryId: 'auto', archived: false },
      { id: 'a_office', name: 'Office',      categoryId: 'work', archived: false },
    ],
    // Parts own the recommended replacement interval (intervalDays).
    parts: [
      { id: 'p_merv11', name: '20x25x1 MERV 11', sku: 'FPR1500-20251', reorderUrl: 'https://www.amazon.com/dp/B07BR9D77Q', photos: [], onHand: 2, lowStockThreshold: 1, intervalDays: 90 },
      { id: 'p_edr1',   name: 'EveryDrop EDR1RXD1', sku: 'EDR1RXD1', reorderUrl: 'https://www.amazon.com/dp/B00YQ3L0DG', photos: [], onHand: 1, lowStockThreshold: 1, intervalDays: 180 },
      { id: 'p_ro50',   name: 'RO Membrane 50 GPD', sku: 'TFC-50', reorderUrl: '', photos: [], onHand: 1, lowStockThreshold: 1, intervalDays: 730 },
      { id: 'p_ro_sed', name: 'Sediment Pre-Filter 5µ', sku: 'SED-10-5', reorderUrl: '', photos: [], onHand: 1, lowStockThreshold: 1, intervalDays: 180 },
      { id: 'p_ro_carbon', name: 'Carbon Block CTO', sku: 'CTO-10', reorderUrl: '', photos: [], onHand: 0, lowStockThreshold: 1, intervalDays: 365 },
      { id: 'p_cf10',   name: 'Cabin Air CF10285', sku: 'CF10285', reorderUrl: '', photos: [], onHand: 1, lowStockThreshold: 1, intervalDays: 365 },
      { id: 'p_ca10',   name: 'Engine Air CA10755', sku: 'CA10755', reorderUrl: '', photos: [], onHand: 1, lowStockThreshold: 1, intervalDays: 365 },
      { id: 'p_merv8',  name: '16x20x1 MERV 8', sku: 'MERV8-16201', reorderUrl: '', photos: [], onHand: 3, lowStockThreshold: 2, intervalDays: 90 },
    ],
    // Mostly single-stage filters. The Under-Sink RO (f3) is a 3-stage unit
    // demoing the feature: a sediment stage due soon, a carbon stage that's
    // out of stock, and a long-life membrane. normalizeFilter() runs on load
    // to fill in stage ids + the mirror. Each stage's intervalDays is the
    // PARTLESS FALLBACK; since these all link parts, the part's interval wins.
    filters: [
      { id: 'f1', assetId: 'a_house',  name: 'Living Room Furnace', type: 'air',   stages: [{ intervalDays: 90,  lastReplaced: iso(84),  partId: 'p_merv11' }] },
      { id: 'f2', assetId: 'a_house',  name: 'Kitchen Fridge',      type: 'water', stages: [{ intervalDays: 180, lastReplaced: iso(200), partId: 'p_edr1' }] },
      { id: 'f3', assetId: 'a_house',  name: 'Under-Sink RO',       type: 'water', stages: [
        { intervalDays: 180, lastReplaced: iso(170), partId: 'p_ro_sed' },     // ~10d left
        { intervalDays: 365, lastReplaced: iso(120), partId: 'p_ro_carbon' },  // healthy, but out of stock
        { intervalDays: 730, lastReplaced: iso(120), partId: 'p_ro50' },       // long-life membrane
      ] },
      { id: 'f4', assetId: 'a_civic',  name: 'Cabin Air Filter',    type: 'air',   stages: [{ intervalDays: 365, lastReplaced: iso(351), partId: 'p_cf10' }] },
      { id: 'f5', assetId: 'a_civic',  name: 'Engine Air Filter',   type: 'air',   stages: [{ intervalDays: 365, lastReplaced: iso(30),  partId: 'p_ca10' }] },
      { id: 'f6', assetId: 'a_office', name: 'Office HVAC',         type: 'air',   stages: [{ intervalDays: 90,  lastReplaced: iso(81),  partId: 'p_merv8' }] },
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
      // Defensive: ensure parts have photos:[] (covers users who saved before this field existed)
      if (parsed.parts) parsed.parts = parsed.parts.map(p => ({ ...p, photos: p.photos || [] }));
      return migratePartIntervals(migrateFilterStages(migrateReminders(parsed)));
    }
    const v1raw = await AsyncStorage.getItem(LEGACY_KEY_V1);
    if (v1raw) {
      const v1 = JSON.parse(v1raw);
      const migrated = migratePartIntervals(migrateFilterStages(migrateReminders(migrateV1toV2(v1))));
      await saveData(migrated);
      return migrated;
    }
  } catch (e) { console.warn('loadData failed', e); }
  const fresh = migratePartIntervals(migrateFilterStages(seed()));
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
    const { syncFilterNotifications } = await import('../lib/notifications');
    await syncFilterNotifications(data);
  } catch (e) { /* silent */ }
}

export async function resetToSeed() {
  const fresh = migratePartIntervals(migrateFilterStages(seed()));
  await saveData(fresh);
  return fresh;
}

// ---------------------------------------------------------------------------
// Status math (per-stage, with a soonest-due headline per filter)
// ---------------------------------------------------------------------------

// Effective interval (days) for a stage: the linked part's interval if linked
// (the part owns the cadence), else the stage's own fallback interval. Pass
// `data` so the part can be resolved; without it, falls back to the stage.
export function stageIntervalDays(stage, data) {
  if (stage && stage.partId && data) {
    const p = getPart(data, stage.partId);
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

// A filter's headline status = its soonest-due stage. Also reports stageCount
// (so lists can flag multi-stage filters) and stageId (which stage is driving
// the headline). Pass `data` so part-owned intervals resolve correctly.
export function statusOf(filter, data) {
  const stages = filterStages(filter);
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
// (so display reads the part-owned interval), soonest-due first.
export function stagesWithStatus(filter, data) {
  return filterStages(filter)
    .map(s => {
      const iv = stageIntervalDays(s, data);
      return { ...s, intervalDays: iv, status: stageStatus(s, iv) };
    })
    .sort((a, b) => a.status.left - b.status.left);
}

export function dueSoonList(data) {
  const liveAssetIds = new Set(data.assets.filter(a => !a.archived).map(a => a.id));
  return data.filters
    .filter(f => liveAssetIds.has(f.assetId))
    .map(f => ({
      ...f,
      status: statusOf(f, data),
      // Resolved interval of the first stage, for the single-stage meta line.
      intervalDays: stageIntervalDays(filterStages(f)[0], data),
      asset: data.assets.find(a => a.id === f.assetId),
    }))
    .sort((a, b) => a.status.left - b.status.left);
}

export function filtersForCategory(data, categoryId) {
  const ids = new Set(data.assets.filter(a => !a.archived && a.categoryId === categoryId).map(a => a.id));
  return data.filters
    .filter(f => ids.has(f.assetId))
    .map(f => ({
      ...f,
      status: statusOf(f, data),
      intervalDays: stageIntervalDays(filterStages(f)[0], data),
      asset: data.assets.find(a => a.id === f.assetId),
    }))
    .sort((a, b) => a.status.left - b.status.left);
}

export function dueCount(list) {
  return list.filter(f => f.status.key !== 'grn').length;
}

export function getPart(data, partId) {
  if (!partId) return null;
  return (data.parts || []).find(p => p.id === partId) || null;
}

export function partsList(data) {
  return (data.parts || []).slice().sort((a, b) => a.name.localeCompare(b.name));
}

export function partsLowStock(data) {
  return (data.parts || []).filter(p => p.onHand <= p.lowStockThreshold);
}

// Filters that reference a given part on ANY of their stages.
export function filtersUsingPart(data, partId) {
  return data.filters.filter(f => filterStages(f).some(s => s.partId === partId));
}

export function isPartLow(part) {
  if (!part) return false;
  return part.onHand <= part.lowStockThreshold;
}

// Mark specific stages replaced on a date, recalculating only those due dates
// and decrementing the on-hand of each replaced stage's linked part.
//   stageIds omitted/empty -> all stages (the single-tap path for a one-stage
//   filter; the sheet passes the exact ids the user checked).
export function markReplaced(data, filterId, replacedDate, stageIds) {
  const dateIso = replacedDate ? new Date(replacedDate).toISOString() : today().toISOString();
  const f = data.filters.find(x => x.id === filterId);
  if (!f) return data;

  const stages = filterStages(f);
  const targetIds = (stageIds && stageIds.length)
    ? new Set(stageIds)
    : new Set(stages.map(s => s.id));

  // Tally how many of each part were consumed (a part could sit on >1 stage).
  const consumed = {};
  stages.forEach(s => {
    if (targetIds.has(s.id) && s.partId) consumed[s.partId] = (consumed[s.partId] || 0) + 1;
  });
  const nextParts = (data.parts || []).map(p =>
    consumed[p.id] ? { ...p, onHand: Math.max(0, (p.onHand || 0) - consumed[p.id]) } : p
  );

  const nextStages = stages.map(s =>
    targetIds.has(s.id) ? { ...s, lastReplaced: dateIso } : s
  );

  return {
    ...data,
    filters: data.filters.map(x => x.id === filterId ? withMirror({ ...x, stages: nextStages }) : x),
    parts: nextParts,
  };
}

export function addFilter(data, filter) {
  const id = 'f_' + Date.now();
  // Accept either an incoming `stages` array or the legacy single-part shape
  // (intervalDays/lastReplaced/partId) and normalize to stages + mirror.
  const incomingStages = Array.isArray(filter.stages) && filter.stages.length > 0
    ? filter.stages.map((s, i) => makeStage(id, i, s))
    : [makeStage(id, 0, {
        intervalDays: filter.intervalDays,
        lastReplaced: filter.lastReplaced,
        partId: filter.partId,
      })];
  const { intervalDays, lastReplaced, partId, photo, stages, ...rest } = filter;
  const f = withMirror({ ...rest, id, stages: incomingStages });
  return { ...data, filters: [...data.filters, f] };
}

export function updateFilter(data, filterId, patch) {
  return {
    ...data,
    filters: data.filters.map(f => {
      if (f.id !== filterId) return f;
      let next = { ...f, ...patch };
      // TRANSITIONAL: if the old single-part Edit screen patched a legacy field,
      // fold it into stages[0] so stages stays the source of truth. Remove with
      // the mirror once Edit writes `stages` directly.
      if ('intervalDays' in patch || 'lastReplaced' in patch || 'partId' in patch) {
        const base = (next.stages && next.stages[0]) || {};
        const s0 = makeStage(f.id, 0, {
          ...base,
          ...('intervalDays' in patch ? { intervalDays: patch.intervalDays } : {}),
          ...('lastReplaced' in patch ? { lastReplaced: patch.lastReplaced } : {}),
          ...('partId' in patch ? { partId: patch.partId } : {}),
        });
        next = { ...next, stages: next.stages ? [s0, ...next.stages.slice(1)] : [s0] };
      } else if (Array.isArray(patch.stages)) {
        next = { ...next, stages: patch.stages.map((s, i) => makeStage(f.id, i, s)) };
      }
      return withMirror(next);
    }),
  };
}

export function deleteFilter(data, filterId) {
  return { ...data, filters: data.filters.filter(f => f.id !== filterId) };
}
export function addAsset(data, asset) {
  return { ...data, assets: [...data.assets, { ...asset, id: 'a_' + Date.now(), archived: false }] };
}
export function setAssetArchived(data, assetId, archived) {
  return { ...data, assets: data.assets.map(a => a.id === assetId ? { ...a, archived } : a) };
}
export function addPart(data, part) {
  const id = 'p_' + Date.now();
  return { ...data, parts: [...(data.parts || []), { id, name: '', sku: '', reorderUrl: '', photos: [], onHand: 0, lowStockThreshold: 1, intervalDays: DEFAULT_INTERVAL_DAYS, ...part }] };
}
export function updatePart(data, partId, patch) {
  return { ...data, parts: (data.parts || []).map(p => p.id === partId ? { ...p, ...patch } : p) };
}

// Delete a part from the catalog and unlink it from every stage that used it.
// The stages and their schedules survive; to keep their due dates from jumping,
// each unlinked stage inherits the deleted part's interval as its new fallback.
export function deletePart(data, partId) {
  const gone = getPart(data, partId);
  const fallbackIv = gone && typeof gone.intervalDays === 'number' ? gone.intervalDays : DEFAULT_INTERVAL_DAYS;
  return {
    ...data,
    parts: (data.parts || []).filter(p => p.id !== partId),
    filters: data.filters.map(f => withMirror({
      ...f,
      stages: filterStages(f).map(s =>
        s.partId === partId ? { ...s, partId: null, intervalDays: fallbackIv } : s
      ),
    })),
  };
}

// Photo helpers — pure mutations on a Part's photos array.
export function addPartPhoto(data, partId, uri) {
  return {
    ...data,
    parts: (data.parts || []).map(p => {
      if (p.id !== partId) return p;
      const next = [...(p.photos || []), uri].slice(0, MAX_PART_PHOTOS);
      return { ...p, photos: next };
    }),
  };
}
export function removePartPhoto(data, partId, index) {
  return {
    ...data,
    parts: (data.parts || []).map(p => {
      if (p.id !== partId) return p;
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
// CATEGORIES
// ============================================================================

export const PROTECTED_CATEGORY_IDS = ['home', 'auto', 'work'];
export const UNCATEGORIZED_ID = 'uncategorized';

export function canRenameCategory(id) {
  return !PROTECTED_CATEGORY_IDS.includes(id);
}

export function canDeleteCategory(id) {
  return !PROTECTED_CATEGORY_IDS.includes(id) && id !== UNCATEGORIZED_ID;
}

export function assetsInCategory(data, categoryId) {
  return (data.assets || []).filter(
    a => a.categoryId === categoryId && !a.archived
  ).length;
}

export function addCategory(data, name) {
  const trimmed = (name || '').trim();
  if (!trimmed) return data;
  const cats = data.categories || [];
  if (cats.length >= MAX_CATEGORIES) return data;
  const maxOrder = cats.reduce((m, c) => Math.max(m, c.order || 0), -1);
  const id = 'cat_' + Date.now();
  return {
    ...data,
    categories: [...cats, { id, name: trimmed, order: maxOrder + 1 }],
  };
}

export function renameCategory(data, id, name) {
  if (!canRenameCategory(id)) return data;
  const trimmed = (name || '').trim();
  if (!trimmed) return data;
  return {
    ...data,
    categories: (data.categories || []).map(c =>
      c.id === id ? { ...c, name: trimmed } : c
    ),
  };
}

export function deleteCategory(data, id) {
  if (!canDeleteCategory(id)) return data;

  let categories = data.categories || [];
  let assets = data.assets || [];

  const orphaned = assets.filter(a => a.categoryId === id);

  if (orphaned.length > 0) {
    if (!categories.some(c => c.id === UNCATEGORIZED_ID)) {
      const maxOrder = categories.reduce((m, c) => Math.max(m, c.order || 0), -1);
      categories = [
        ...categories,
        { id: UNCATEGORIZED_ID, name: 'Uncategorized', order: maxOrder + 1 },
      ];
    }
    assets = assets.map(a =>
      a.categoryId === id ? { ...a, categoryId: UNCATEGORIZED_ID } : a
    );
  }

  categories = categories.filter(c => c.id !== id);

  return { ...data, categories, assets };
}

export function reorderCategories(data, idsInOrder) {
  const cats = data.categories || [];
  const byId = Object.fromEntries(cats.map(c => [c.id, c]));
  const seen = new Set();
  const reordered = [];

  idsInOrder.forEach((id, i) => {
    if (byId[id]) {
      reordered.push({ ...byId[id], order: i });
      seen.add(id);
    }
  });

  cats.forEach(c => {
    if (!seen.has(c.id)) {
      reordered.push({ ...c, order: reordered.length });
    }
  });

  return { ...data, categories: reordered };
}

// ============================================================================
// ASSET HELPERS
// ============================================================================

export function updateAsset(data, assetId, patch) {
  return {
    ...data,
    assets: (data.assets || []).map(a =>
      a.id === assetId ? { ...a, ...patch } : a
    ),
  };
}

export function filtersForAsset(data, assetId) {
  return (data.filters || []).filter(f => f.assetId === assetId);
}

// Permanently delete an asset AND all filters that reference it. Parts are
// NOT touched (they're shared; other filters may still use them).
export function deleteAsset(data, assetId) {
  return {
    ...data,
    assets: (data.assets || []).filter(a => a.id !== assetId),
    filters: (data.filters || []).filter(f => f.assetId !== assetId),
  };
}