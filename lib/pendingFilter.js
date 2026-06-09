// lib/pendingFilter.js
//
// Tiny shared state used by the "+ Add new filter" flow inside the picker:
//
//   1. User taps "+ Add new filter" inside the Filter picker on Edit Device.
//   2. Picker closes, router pushes /filter/new.
//   3. User fills in and saves. New Filter screen calls setPendingFilter(newId)
//      then router.back().
//   4. Edit Device regains focus, calls consumePendingFilter(), and if a
//      value is returned, sets draft.filterId to it (auto-selecting the
//      just-created filter on the Edit Device screen).
//
// This avoids the awkward router-param-on-back dance and avoids re-syncing
// the entire draft from data on focus (which would clobber the user's
// other in-progress edits).

let pendingFilterId = null;

export function setPendingFilter(id) {
  pendingFilterId = id;
}

export function consumePendingFilter() {
  const id = pendingFilterId;
  pendingFilterId = null;
  return id;
}