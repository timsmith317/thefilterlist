// lib/interval.js — translate between a human interval (a value + a unit) and
// the canonical day count the scheduler stores, and format a day count for
// display.
//
// Months and years are approximated as fixed day counts — a replacement
// schedule doesn't need calendar-accurate months: 1 month = 30 days,
// 1 year = 365 days. The stored value stays a plain day count (intervalDays),
// so all due-date math and existing data are unchanged; units are purely an
// input/display convenience layered on top.

export const INTERVAL_UNITS = [
  { key: 'days',   label: 'Days',   days: 1,   suffix: 'd' },
  { key: 'months', label: 'Months', days: 30,  suffix: 'm' },
  { key: 'years',  label: 'Years',  days: 365, suffix: 'y' },
];

const byKey = INTERVAL_UNITS.reduce((m, u) => { m[u.key] = u; return m; }, {});

// value + unit -> day count (>= 1).
export function intervalToDays(value, unit) {
  const n = parseInt(value, 10) || 0;
  const u = byKey[unit] || byKey.days;
  return Math.max(1, n * u.days);
}

// day count -> { value, unit }, picking the LARGEST unit that divides evenly
// (years, then months, then days): 365 -> {1,'years'}, 180 -> {6,'months'},
// 45 -> {45,'days'}. So a value the user entered as "6 months" round-trips
// back to "6 Months" in the editor.
export function daysToInterval(days) {
  const d = Math.max(1, parseInt(days, 10) || 1);
  if (d % 365 === 0) return { value: d / 365, unit: 'years' };
  if (d % 30 === 0)  return { value: d / 30,  unit: 'months' };
  return { value: d, unit: 'days' };
}

// Compact display string: "1y" / "6m" / "30d".
export function formatInterval(days) {
  const { value, unit } = daysToInterval(days);
  return value + byKey[unit].suffix;
}