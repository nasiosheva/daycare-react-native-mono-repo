# Inline list + FAB/BottomSheet form UI pattern

## Change

UI-only cleanup, no business-rule or API change. Applied a consistent shape to several Staff Admin/Platform Admin screens that previously hid a plain list behind a `NavigationCard` → `BottomSheet` tap-to-reveal:

- `institution-types.tsx`: list, create, edit, and delete are all inline (no `BottomSheet` at all) — an explicit one-off for this screen. Edit/delete render in place of the affected row.
- `curriculum-activities.tsx`, `classrooms.tsx`: the list renders directly on the page; the create/edit form stays in a `BottomSheet`, opened by a `FloatingActionButton` instead of a `NavigationCard`.
- `development-categories.tsx`: the existing inline list is unchanged; its plain "Tambah kategori" button was replaced with a `FloatingActionButton` for consistency with the other screens above.
- `parent-enrollment-form.tsx`: tenant selection stays inline; branch/children/plan selection and submit moved into a `BottomSheet` keyed to the selected tenant, closing (and resetting all wizard state) when dismissed.

## Behavior

The established default going forward: a list that only navigates elsewhere or displays read-only info can be inline with no `BottomSheet`. A create/edit form — especially one opened from a `FloatingActionButton` — stays in a `BottomSheet`. `institution-types.tsx` is the one confirmed exception where the form itself is inline too, per an explicit request scoped to that screen.

## Verification

- `pnpm --filter @daycare/app` typecheck/test clean after each screen change.
