# Children floating add action

## Change

- Moved the active Staff Admin's add-child entry action from the Children header row to the shared floating action button pattern.
- The existing add-child `BottomSheet`, validation, role check, and create mutation remain unchanged.
- Replaced the Children screen's filter BottomSheet entry with inline cascading branch, learning-level, and classroom tabs. The shared tab control also keeps the existing BottomSheet filter consumers on the same cascade rules.
- Replaced the collapsed Children-list BottomSheet with an inline list and inline retry action.
- Made each Staff Admin/Staff child card the direct entry point to the child-detail screen, removing the duplicate action button from the item.

## Affected behavior

Only an active `STAFF_ADMIN` sees the floating `+ Tambah Anak` action and inline branch/learning-level/classroom filter tabs. Selecting a branch clears learning-level and classroom; selecting a learning level clears classroom. The Children list now remains visible in the screen and opens a child detail directly. Other existing screens retain their explicit-apply BottomSheet behavior while sharing the same cascade rules.

## Verification

- Typecheck the mobile application after the screen change.

## Follow-up

None.
