# Goal template age feedback

## Change

- The assign-Goal sheet now distinguishes template loading and request failures from a valid empty result.
- When every available template is excluded by the selected child's age, the sheet explains that the child is outside the available age range.
- Removed the separate Goal-template list from the Goals screen. Templates are selected only from the **Tetapkan Goal** BottomSheet; Staff Admin retains the floating action to create a tenant-scoped template.
- Added a debounced, server-side Goal-template search by name or description to that BottomSheet. The returned templates still pass the existing client and backend child-scope checks before assignment.

## Affected behavior

Global Goal templates remain restricted to their configured age range. This does not bypass the backend's assignment validation; it makes the resulting empty state understandable to Staff Admin and Staff users.

`GET /api/v1/goal-templates` now accepts an optional `search` query parameter. It only searches templates visible to the requesting tenant (global and that tenant's own templates); it does not expand tenant visibility.

## Verification

- Checked the local database for the referenced child and global templates: the child is 72 months old while all 138 templates cover 12–60 months.
- Typecheck the mobile application after the UI change.
- Compile and run the focused API test suite after the optional search contract change.

## Follow-up

Create age-appropriate global templates before assigning a Goal to children outside the current 1–5 year master-data range.
