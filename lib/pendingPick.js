// lib/pendingPick.js
//
// Tiny shared-state bridge for handing a picker selection back to the screen
// that opened it. The picker is its own route now (so New Filter can stack on
// top of it), which means it can't set the opener's local draft state
// directly. Instead it stashes the choice here, then pops; the opener reads
// it on focus.
//
// Shape: { field: 'asset' | 'filter', value: <id> | null }
//   - value === null is meaningful for 'filter' (the "None" selection).

let pending = null;

export function setPendingPick(pick) {
  pending = pick;
}

// Returns the pending pick once, then clears it. Returns null if nothing
// is pending.
export function consumePendingPick() {
  const p = pending;
  pending = null;
  return p;
}