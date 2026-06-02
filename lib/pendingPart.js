// lib/pendingPart.js
//
// Tiny shared state used by the "+ Add new part" flow inside the picker:
//
//   1. User taps "+ Add new part" inside the Part picker on Edit Filter.
//   2. Picker closes, router pushes /part/new.
//   3. User fills in and saves. New Part screen calls setPendingPart(newId)
//      then router.back().
//   4. Edit Filter regains focus, calls consumePendingPart(), and if a
//      value is returned, sets draft.partId to it (auto-selecting the
//      just-created part on the Edit Filter screen).
//
// This avoids the awkward router-param-on-back dance and avoids re-syncing
// the entire draft from data on focus (which would clobber the user's
// other in-progress edits).

let pendingPartId = null;

export function setPendingPart(id) {
  pendingPartId = id;
}

export function consumePendingPart() {
  const id = pendingPartId;
  pendingPartId = null;
  return id;
}