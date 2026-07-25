# Learning-level UI alignment

## Change

- Added an explicit display-order input to the Staff Admin level form and show that order in each level row.
- Validated the level name, non-negative whole-number age fields, minimum/maximum relationship, and display order before calling the API.
- Added loading, inline failure, and retry states for levels, institution templates, and curriculum programs.
- Added a destructive-action confirmation sheet for archiving and inline feedback when the archive request fails.

## Affected behavior

The form now mirrors the API request contract for `UpsertLearningLevelRequest`. Existing role and tenant authorization remain unchanged: only an active Staff Admin can mutate a level, while eligible read-only users can still view the list.

## Verification

- `corepack pnpm verify`
- `gradle -p apps/api test --no-daemon` with JDK 21

## Follow-up

None.
