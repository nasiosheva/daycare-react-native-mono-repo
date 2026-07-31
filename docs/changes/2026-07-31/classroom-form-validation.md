# Classroom form validation

## Change

The Staff Admin class-group form now labels its branch, level, and optional learning-period selectors. A **Tanpa periode** action clears an existing period during editing. Creating a new form resets its branch selection before the default active branch is restored.

Client-side validation now reports the missing class-group name, branch, or level independently and rejects a supplied capacity unless it is a positive whole number.

The form selects the first active level automatically. If the tenant has no active level, it explains the prerequisite and opens the existing level-creation flow instead of leaving the Staff Admin with a generic level-selection error.

The prerequisite action closes the class-group Bottom Sheet before navigation so the modal does not remain above the level-creation screen.

## Affected behavior

The existing `POST` and `PATCH /classrooms` payload and backend validation remain unchanged. A learning level and active branch remain required by the current API contract; the learning period and capacity remain optional.

## Verification

- `corepack pnpm verify`
- Manual: create a class group with an empty period and positive capacity; edit it, select a period, then choose **Tanpa periode** and save; verify name, branch, level, and invalid-capacity feedback separately.
