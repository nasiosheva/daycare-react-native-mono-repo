# Parent Home usability: fix wrong-child program link, surface "add tenant/child"

## Context

User asked to make `apps/mobile/app/home.tsx`'s Parent Home more user-friendly. Investigation surfaced a real routing bug alongside the requested addition.

## Changes

### Fixed: "Program Anak" card linked to the wrong child

`ParentHome`'s Program Anak card linked to `summary.children[0].child.id` — always the first child in the list, regardless of which child actually had an active program. The root cause: `GET /parent/children/programs-summary` only ever returned an aggregate `{activePrograms, feedbackCount}` with no indication of which child(ren) the count belongs to, so the client had no way to link correctly — picking the first child was a guess, not a bug in the linking logic itself.

- `ChildProgramRepository`: added `findAllByOrganizationIdAndChildIdInAndStatusAndParentVisibleTrue(...)` returning entities (previously only a `count...` variant existed).
- `ChildManagementService.ChildProgramSummaryResponse`: added `childIds: List<UUID> = emptyList()` (defaulted so the existing Staff Admin-facing `programsSummary()` doesn't need to populate it).
- `ChildManagementService.parentProgramsSummary()`: now returns the actual distinct child IDs that have an active, parent-visible program.
- `packages/api-client`: `ChildProgramSummary.childIds: string[]`.
- `apps/mobile/app/home.tsx`: the card now links to `programsSummary.data.childIds[0]` — a child that genuinely has an active program, instead of an arbitrary guess.

### Added: "Apply to a new tenant" entry point on Parent Home

Previously this flow (`/parent-enrollment-form`, reused from Profile's "Kelola tenant" sheet and the zero-membership onboarding home) was not directly reachable from the main Parent Home once a Parent already has an active tenant — a Parent wanting to enroll another child, or the same child at a different tenant, had to know to go through Profile first. Added a `NavigationCard` on `ParentHome` right after the children list, reusing the exact same `parentEnrollment.newTenant`/`parentEnrollment.startDescription` copy and route already used elsewhere — no new screen, no new i18n keys.

## Verification

- `gradle compileKotlin` — clean.
- `pnpm typecheck` and `pnpm test` from the repo root — clean (84 tests in `apps/mobile`, no new tests added since both changes reuse existing, already-tested data flows/routes).
- Not live-tested against a running app in this change (no dev server session was started); verified via type-safety and reading the actual query/response wiring end to end instead.
