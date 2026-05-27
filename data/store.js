// data/store.js — The Filter List data layer.
// Model: Category -> Asset -> Filter. All on-device via AsyncStorage.
// Exposes a simple store with load/save and helpers; screens read derived views.

import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'thefilterlist.data.v1';

// ----- Filter type icons (water / air / other) -----
export const FILTER_TYPES = {
  water: { label: 'Water', icon: '◎' },
  air:   { label: 'Air',   icon: '▦' },
  other: { label: 'Other', icon: '⊟' },
};

// ----- Default categories (renameable; users may add up to the cap) -----
export const MAX_CATEGORIES = 8;
function defaultCategories() {
  return [
    { id: 'home', name: 'Home',  order: 0 },
    { id: 'auto', name: 'Auto',  order: 1 },
    { id: 'work', name: 'Work',  order: 2 },
  ];
}

// ----- Seed data so a fresh install isn't empty (demo-able) -----
const MS_DAY = 86400000;
const iso = (daysAgo) => new Date(Date.now() - daysAgo * MS_DAY).toISOString();

function seed() {
  return {
    categories: defaultCategories(),
    assets: [
      { id: 'a_house',  name: 'Main House',  categoryId: 'home', archived: false },
      { id: 'a_civic',  name: '2019 Civic',  categoryId: 'auto', archived: false },
      { id: 'a_office', name: 'Office',      categoryId: 'work', archived: false },
    ],
    filters: [
      { id: 'f1', assetId: 'a_house',  name: 'Living Room Furnace', type: 'air',   intervalDays: 90,  lastReplaced: iso(84),  reorderUrl: '', photo: null },
      { id: 'f2', assetId: 'a_house',  name: 'Kitchen Fridge',      type: 'water', intervalDays: 180, lastReplaced: iso(200), reorderUrl: '', photo: null },
      { id: 'f3', assetId: 'a_house',  name: 'Under-Sink RO',       type: 'water', intervalDays: 365, lastReplaced: iso(120), reorderUrl: '', photo: null },
      { id: 'f4', assetId: 'a_civic',  name: 'Cabin Air Filter',    type: 'air',   intervalDays: 365, lastReplaced: iso(351), reorderUrl: '', photo: null },
      { id: 'f5', assetId: 'a_civic',  name: 'Engine Air Filter',   type: 'air',   intervalDays: 365, lastReplaced: iso(30),  reorderUrl: '', photo: null },
      { id: 'f6', assetId: 'a_office', name: 'Office HVAC',         type: 'air',   intervalDays: 90,  lastReplaced: iso(81),  reorderUrl: '', photo: null },
    ],
    settings: {
      reminders: { leadDays: 7, channels: { push: true, sms: false, email: false } },
    },
  };
}

// ----- Persistence -----
export async function loadData() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { console.warn('loadData failed', e); }
  const fresh = seed();
  await saveData(fresh);
  return fresh;
}

export async function saveData(data) {
  try { await AsyncStorage.setItem(KEY, JSON.stringify(data)); }
  catch (e) { console.warn('saveData failed', e); }
}

// ----- Urgency / status -----
const today = () => new Date(new Date().toDateString());
export function statusOf(filter) {
  const due = new Date(new Date(filter.lastReplaced).getTime() + filter.intervalDays * MS_DAY);
  const left = Math.round((due.getTime() - today().getTime()) / MS_DAY);
  if (left < 0)  return { key: 'red', left, due, label: `${Math.abs(left)}d overdue` };
  if (left <= 14) return { key: 'amb', left, due, label: `Due in ${left}d` };
  return { key: 'grn', left, due, label: `${left}d left` };
}

// ----- Derived views -----
// Due Soon: flat list across all NON-archived assets, urgency-sorted.
export function dueSoonList(data) {
  const liveAssetIds = new Set(data.assets.filter(a => !a.archived).map(a => a.id));
  return data.filters
    .filter(f => liveAssetIds.has(f.assetId))
    .map(f => ({ ...f, status: statusOf(f), asset: data.assets.find(a => a.id === f.assetId) }))
    .sort((a, b) => a.status.left - b.status.left);
}

// Filter list for one category (non-archived assets), urgency-sorted.
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

// ----- Mutations (return a new data object; caller saves + sets state) -----
export function markReplaced(data, filterId) {
  return { ...data, filters: data.filters.map(f => f.id === filterId ? { ...f, lastReplaced: today().toISOString() } : f) };
}
export function addFilter(data, filter) {
  return { ...data, filters: [...data.filters, { ...filter, id: 'f_' + Date.now() }] };
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
