// data/store.js — The Filter List data layer (v2).
// Model: Category -> Asset -> Filter -> Part (shared, many filters can use one part).
// On-device via AsyncStorage. Migrates v1 (legacy reorderUrl text field) to v2 (partId).

import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'thefilterlist.data.v2';
const LEGACY_KEY_V1 = 'thefilterlist.data.v1';

// ----- Filter type icons (water / air / other) -----
export const FILTER_TYPES = {
  water: { label: 'Water' },
  air:   { label: 'Air' },
  other: { label: 'Other' },
};

// ----- Categories (renameable, soft cap) -----
export const MAX_CATEGORIES = 8;
function defaultCategories() {
  return [
    { id: 'home', name: 'Home', order: 0 },
    { id: 'auto', name: 'Auto', order: 1 },
    { id: 'work', name: 'Work', order: 2 },
  ];
}

// ----- Seed -----
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
      { id: 'p_merv11', name: '20x25x1 MERV 11', sku: 'FPR1500-20251', reorderUrl: 'https://www.amazon.com/dp/B07BR9D77Q', photo: null, onHand: 2, lowStockThreshold: 1 },
      { id: 'p_edr1',   name: 'EveryDrop EDR1RXD1', sku: 'EDR1RXD1', reorderUrl: 'https://www.amazon.com/dp/B00YQ3L0DG', photo: null, onHand: 1, lowStockThreshold: 1 },
      { id: 'p_ro50',   name: 'RO Membrane 50 GPD', sku: 'TFC-50', reorderUrl: '', photo: null, onHand: 0, lowStockThreshold: 1 },
      { id: 'p_cf10',   name: 'Cabin Air CF10285', sku: 'CF10285', reorderUrl: '', photo: null, onHand: 1, lowStockThreshold: 1 },
      { id: 'p_ca10',   name: 'Engine Air CA10755', sku: 'CA10755', reorderUrl: '', photo: null, onHand: 1, lowStockThreshold: 1 },
      { id: 'p_merv8',  name: '16x20x1 MERV 8', sku: 'MERV8-16201', reorderUrl: '', photo: null, onHand: 3, lowStockThreshold: 2 },
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
      reminders: { leadDays: 7, channels: { push: true, sms: false, email: false } },
      lowStockAlerts: true,
    },
  };
}

// ----- Migration v1 -> v2 -----
// v1 filters had a `reorderUrl` text field. v2 has shared Parts and a partId on each filter.
// For each filter with a non-empty reorderUrl, create a minimal Part and link it.
function migrateV1toV2(v1) {
  const next = { ...v1, schemaVersion: 2, parts: [] };
  const seenUrl = new Map(); // dedupe identical URLs into one Part
  next.filters = (v1.filters || []).map(f => {
    const url = (f.reorderUrl || '').trim();
    if (!url) return { ...f, partId: null, photo: f.photo || null };
    let partId = seenUrl.get(url);
    if (!partId) {
      partId = 'p_mig_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      next.parts.push({
        id: partId,
        name: f.name + ' part', // best guess; user can rename
        sku: '',
        reorderUrl: url,
        photo: null,
        onHand: 0,
        lowStockThreshold: 1,
      });
      seenUrl.set(url, partId);
    }
    // drop legacy reorderUrl from the filter; keep partId
    const { reorderUrl, ...rest } = f;
    return { ...rest, partId, photo: f.photo || null };
  });
  if (!next.settings) next.settings = seed().settings;
  if (next.settings.lowStockAlerts === undefined) next.settings.lowStockAlerts = true;
  return next;
}

// ----- Persistence -----
export async function loadData() {
  try {
    // Try v2 first
    const v2 = await AsyncStorage.getItem(KEY);
    if (v2) return JSON.parse(v2);
    // Migrate v1 if present
    const v1raw = await AsyncStorage.getItem(LEGACY_KEY_V1);
    if (v1raw) {
      const v1 = JSON.parse(v1raw);
      const migrated = migrateV1toV2(v1);
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
}

export async function resetToSeed() {
  const fresh = seed();
  await saveData(fresh);
  return fresh;
}

// ----- Urgency / status -----
const today = () => new Date(new Date().toDateString());
export function statusOf(filter) {
  const due = new Date(new Date(filter.lastReplaced).getTime() + filter.intervalDays * MS_DAY);
  const left = Math.round((due.getTime() - today().getTime()) / MS_DAY);
  if (left < 0)   return { key: 'red', left, due, label: `${Math.abs(left)}d overdue` };
  if (left <= 14) return { key: 'amb', left, due, label: `Due in ${left}d` };
  return { key: 'grn', left, due, label: `${left}d left` };
}

// ----- Derived views -----
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

// ----- Parts -----
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

// ----- Mutations (pure: return new data; caller saves) -----
// Mark replaced supports an optional custom date (ISO string). Defaults to today.
// Also decrements the linked part's onHand (floor 0) since you used one when replacing.
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
  return { ...data, parts: [...(data.parts || []), { id, name: '', sku: '', reorderUrl: '', photo: null, onHand: 0, lowStockThreshold: 1, ...part }] };
}
export function updatePart(data, partId, patch) {
  return { ...data, parts: (data.parts || []).map(p => p.id === partId ? { ...p, ...patch } : p) };
}
export function deletePart(data, partId) {
  // Unlink any filters that reference this part
  return {
    ...data,
    parts: (data.parts || []).filter(p => p.id !== partId),
    filters: data.filters.map(f => f.partId === partId ? { ...f, partId: null } : f),
  };
}
