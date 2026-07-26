# Child-detail placement scope

## Change

- Added a tenant-scoped placement-options endpoint for the child-detail flow.
- The endpoint and placement mutation now enforce the same active, same-branch target rules for Staff Admin, directly assigned Staff, and classroom-scoped Staff.
- The child-detail screen uses the authorized endpoint instead of the general class-group list, shows reusable shimmer loading states, provides retry states, and reports mutations through the shared notification adapter.
- The new backend placement-scope rejection is mapped through the API localization catalog for Indonesian and English responses.

## Behavior

- A Staff Admin may select any active same-branch class group.
- A directly assigned Staff member may select any active same-branch class group for that child.
- A Staff member who reaches the child only through the current class group may select only another same-branch class group to which they are also assigned.
- The API repeats the check on submission, so a manually constructed request cannot bypass the UI.

## Verification

- Added ChildScopeService unit coverage for the three placement scopes.
- Added LearningStructureService coverage for filtered placement options and mutation-time scope enforcement.
- Added an API client contract test for the placement-options endpoint.
- `corepack pnpm verify` passed: lint, TypeScript checks, and 50 Vitest tests across the workspace.
- With JDK 21 selected, `gradle -p apps/api test --no-daemon` passed.
