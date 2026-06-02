// data/store.js — The Filter List data layer (v2).
// Model: Category -> Asset -> Filter -> Part (shared, many filters can use one part).
// Parts can carry up to MAX_PART_PHOTOS reference photos (file URIs in app docs).
// On-device via AsyncStorage. Migrates v1 (legacy reorderUrl text field) to v2.

import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'thefilterlist.data.v2';
const LEGACY_KEY_V1 = 'thefilterlist.data.v1';

export const MAX_PART_PHOTOS = 3;

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

function seed() {
  return {
    schemaVersion: 2,
    categories: defaultCategories(),
    assets: [
      { id: 'a_house',  name: 'Main House',  categoryId: 'home', archived: false },
      { id: 'a_civic',  name: '2019 Civic',  categoryId: 'auto', archived: false },
      { id: 'a_office', name: 'Office',      categoryId: 'work', archived: false },
    ],
    parts: [
      { id: 'p_merv11', name: '20x25x1 MERV 11', sku: 'FPR1500-20251', reorderUrl: 'https://www.amazon.com/dp/B07BR9D77Q', photos: [], onHand: 2, lowStockThreshold: 1 },
      { id: 'p_edr1',   name: 'EveryDrop EDR1RXD1', sku: 'EDR1RXD1', reorderUrl: 'https://www.amazon.com/dp/B00YQ3L0DG', photos: [], onHand: 1, lowStockThreshold: 1 },
      { id: 'p_ro50',   name: 'RO Membrane 50 GPD', sku: 'TFC-50', reorderUrl: '', photos: [], onHand: 0, lowStockThreshold: 1 },
      { id: 'p_cf10',   name: 'Cabin Air CF10285', sku: 'CF10285', reorderUrl: '', photos: [], onHand: 1, lowStockThreshold: 1 },
      { id: 'p_ca10',   name: 'Engine Air CA10755', sku: 'CA10755', reorderUrl: '', photos: [], onHand: 1, lowStockThreshold: 1 },
      { id: 'p_merv8',  name: '16x20x1 MERV 8', sku: 'MERV8-16201', reorderUrl: '', photos: [], onHand: 3, lowStockThreshold: 2 },
    ],
    filters: [
      { id: 'f1', assetId: 'a_house',  name: 'Living Room Furnace', type: 'air',   intervalDays: 90,  lastReplaced: iso(84),  partId: 'p_merv11', photo: null },
      { id: 'f2', assetId: 'a_house',  name: 'Kitchen Fridge',      type: 'water', intervalDays: 180, lastReplaced: iso(200), partId: 'p_edr1',   photo: null },
      { id: 'f3', assetId: 'a_house',  name: 'Under-Sink RO',       type: 'water', intervalDays: 365, lastReplaced: iso(120), partId: 'p_ro50',   photo: null },
      { id: 'f4', assetId: 'a_civic',  name: 'Cabin Air Filter',    type: 'air',   intervalDays: 365, lastReplaced: iso(351), partId: 'p_cf10',   photo: null },
      { id: 'f5', assetId: 'a_civic',  name: 'Engine Air Filter',   type: 'air',   intervalDays: 365, lastReplaced: iso(30),  partId: 'p_ca10',   photo: null },
      { id: 'f6', assetId: 'a_office', name: 'Office HVAC',         type: 'air',   intervalDays: 90,  lastReplaced: iso(81),  partId: 'p_merv8',  photo: null },
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
      return migrateReminders(parsed);
    }
    const v1raw = await AsyncStorage.getItem(LEGACY_KEY_V1);
    if (v1raw) {
      const v1 = JSON.parse(v1raw);
      const migrated = migrateReminders(migrateV1toV2(v1));
      await saveData(migrated);
      return migrated;
    }
  } catch (e) { console.warn('loadData failed', e); }
  const fresh = seed();
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
  const fresh = seed();
  await saveData(fresh);
  return fresh;
}

const today = () => new Date(new Date().toDateString());
export function statusOf(filter) {
  const due = new Date(new Date(filter.lastReplaced).getTime() + filter.intervalDays * MS_DAY);
  const left = Math.round((due.getTime() - today().getTime()) / MS_DAY);
  if (left < 0)   return { key: 'red', left, due, label: `${Math.abs(left)}d overdue` };
  if (left <= 14) return { key: 'amb', left, due, label: `Due in ${left}d` };
  return { key: 'grn', left, due, label: `${left}d left` };
}

export function dueSoonList(data) {
  const liveAssetIds = new Set(data.assets.filter(a => !a.archived).map(a => a.id));
  return data.filters
    .filter(f => liveAssetIds.has(f.assetId))
    .map(f => ({ ...f, status: statusOf(f), asset: data.assets.find(a => a.id === f.assetId) }))
    .sort((a, b) => a.status.left - b.status.left);
}

export function filtersForCategory(data, categoryId) {
  const ids = new Set(data.assets.filter(a => !a.archived && a.categoryId === categoryId).map(a => a.id));
  return data.filters
    .filter(f => ids.has(f.assetId))
    .map(f => ({ ...f, status: statusOf(f), asset: data.assets.find(a => a.id === f.assetId) }))
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

export function filtersUsingPart(data, partId) {
  return data.filters.filter(f => f.partId === partId);
}

export function isPartLow(part) {
  if (!part) return false;
  return part.onHand <= part.lowStockThreshold;
}

export function markReplaced(data, filterId, replacedDate) {
  const dateIso = replacedDate ? new Date(replacedDate).toISOString() : today().toISOString();
  let nextParts = data.parts || [];
  const f = data.filters.find(x => x.id === filterId);
  if (f && f.partId) {
    nextParts = nextParts.map(p =>
      p.id === f.partId ? { ...p, onHand: Math.max(0, (p.onHand || 0) - 1) } : p
    );
  }
  return {
    ...data,
    filters: data.filters.map(f => f.id === filterId ? { ...f, lastReplaced: dateIso } : f),
    parts: nextParts,
  };
}

export function addFilter(data, filter) {
  return { ...data, filters: [...data.filters, { ...filter, id: 'f_' + Date.now(), photo: filter.photo || null, partId: filter.partId || null }] };
}
export function updateFilter(data, filterId, patch) {
  return { ...data, filters: data.filters.map(f => f.id === filterId ? { ...f, ...patch } : f) };
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
  return { ...data, parts: [...(data.parts || []), { id, name: '', sku: '', reorderUrl: '', photos: [], onHand: 0, lowStockThreshold: 1, ...part }] };
}
export function updatePart(data, partId, patch) {
  return { ...data, parts: (data.parts || []).map(p => p.id === partId ? { ...p, ...patch } : p) };
}
export function deletePart(data, partId) {
  return {
    ...data,
    parts: (data.parts || []).filter(p => p.id !== partId),
    filters: data.filters.map(f => f.partId === partId ? { ...f, partId: null } : f),
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
// Used by Settings screens that need to update specific sub-fields without
// re-passing the whole settings object.
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
// CATEGORIES — paste this block at the END of data/store.js, after the existing
// updateReminders() function. These are new helpers; nothing above changes.
// ============================================================================

// Hardcoded protected ids: the seeded categories. Users cannot rename or
// delete these. Adding/removing categories changes data.categories but never
// touches these three.
export const PROTECTED_CATEGORY_IDS = ['home', 'auto', 'work'];

// Reserved id for the auto-created fallback category when a deleted category
// has assets. Not in PROTECTED_CATEGORY_IDS because it's renameable — but it's
// non-deletable since it's the orphan destination.
export const UNCATEGORIZED_ID = 'uncategorized';

export function canRenameCategory(id) {
  return !PROTECTED_CATEGORY_IDS.includes(id);
}

export function canDeleteCategory(id) {
  return !PROTECTED_CATEGORY_IDS.includes(id) && id !== UNCATEGORIZED_ID;
}

// Number of LIVE (non-archived) assets currently referencing a category.
export function assetsInCategory(data, categoryId) {
  return (data.assets || []).filter(
    a => a.categoryId === categoryId && !a.archived
  ).length;
}

// Add a new category. Trims and ignores empty names. Caps at MAX_CATEGORIES.
// Returns unchanged data if the cap is reached so callers don't need to
// re-check.
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

// Rename a category. Blocks rename of protected (Home/Auto/Work). Returns
// unchanged data on no-op / invalid input rather than throwing.
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

// Delete a category. If any assets reference it, those assets are moved to
// the Uncategorized fallback (auto-created if it doesn't yet exist). Blocks
// delete of protected and of Uncategorized itself.
export function deleteCategory(data, id) {
  if (!canDeleteCategory(id)) return data;

  let categories = data.categories || [];
  let assets = data.assets || [];

  // Are any assets (live OR archived) referencing this category? We move
  // archived ones too so nothing ends up pointing at a deleted category id.
  const orphaned = assets.filter(a => a.categoryId === id);

  if (orphaned.length > 0) {
    // Ensure the Uncategorized category exists. If the user previously
    // renamed it, that's preserved.
    if (!categories.some(c => c.id === UNCATEGORIZED_ID)) {
      const maxOrder = categories.reduce((m, c) => Math.max(m, c.order || 0), -1);
      categories = [
        ...categories,
        { id: UNCATEGORIZED_ID, name: 'Uncategorized', order: maxOrder + 1 },
      ];
    }
    // Move orphans
    assets = assets.map(a =>
      a.categoryId === id ? { ...a, categoryId: UNCATEGORIZED_ID } : a
    );
  }

  // Remove the deleted category
  categories = categories.filter(c => c.id !== id);

  return { ...data, categories, assets };
}

// Apply a new ordering. idsInOrder is an array of category ids in the new
// desired sequence. Categories not in idsInOrder are appended at the end
// preserving their relative order (defensive against partial reorderings).
export function reorderCategories(data, idsInOrder) {
  const cats = data.categories || [];
  const byId = Object.fromEntries(cats.map(c => [c.id, c]));
  const seen = new Set();
  const reordered = [];

  // First, items from idsInOrder that exist
  idsInOrder.forEach((id, i) => {
    if (byId[id]) {
      reordered.push({ ...byId[id], order: i });
      seen.add(id);
    }
  });

  // Then, any remaining categories not in the new sequence
  cats.forEach(c => {
    if (!seen.has(c.id)) {
      reordered.push({ ...c, order: reordered.length });
    }
  });

  return { ...data, categories: reordered };
}
// ============================================================================
// ASSET HELPERS — paste at the END of data/store.js, after reorderCategories().
// ============================================================================

// Generic asset patch — used by Settings → Assets to rename or recategorize.
// Patch is shallow-merged onto the matched asset.
export function updateAsset(data, assetId, patch) {
  return {
    ...data,
    assets: (data.assets || []).map(a =>
      a.id === assetId ? { ...a, ...patch } : a
    ),
  };
}

// All filters that reference a given asset (regardless of asset archive
// state — the filters themselves remain in data when an asset is archived,
// they just stop appearing in dueSoonList / filtersForCategory).
export function filtersForAsset(data, assetId) {
  return (data.filters || []).filter(f => f.assetId === assetId);
}
// ============================================================================
// Append this at the END of data/store.js (after filtersForAsset).
// ============================================================================

// Permanently delete an asset AND all filters that reference it. Parts are
// NOT touched here — they're shared across filters, so other filters may
// still reference them. Any genuinely orphaned parts can be cleaned up
// separately from Parts Inventory.
//
// Notifications scheduled for the asset's filters are auto-cancelled the
// next time saveData() runs (which is the standard pattern after every
// mutation in this app — saveData invokes syncFilterNotifications).
export function deleteAsset(data, assetId) {
  return {
    ...data,
    assets: (data.assets || []).filter(a => a.id !== assetId),
    filters: (data.filters || []).filter(f => f.assetId !== assetId),
  };
}