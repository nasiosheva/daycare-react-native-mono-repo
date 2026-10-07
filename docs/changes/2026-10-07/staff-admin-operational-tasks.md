# Staff Admin operational task center

## Scope

- Added a read-only operational task section to the Staff Admin management hub.
- It counts only existing, successfully loaded server records requiring action:
  payment-proof review, booking approval, Parent-enrollment approval, Staff leave,
  Parent feedback, and capability-gated private-tutoring requests.
- Each task opens an existing guarded operational screen. No API contract, database
  schema, permission, status transition, or mutation behavior changed.

## Failure and access behavior

- An unavailable or loading source never becomes a zero count. The hub shows loading
  feedback or a retryable partial-load notice instead.
- Daycare-only queues are requested only with `DAYCARE_OPERATIONS`; private tutoring
  is requested only with `ACADEMIC_CURRICULUM`.
- The destination screen and API remain the final authorization boundary, including
  read-only inactive memberships.

## Verification

- Added unit coverage for the typed task-state mapper.
- `corepack pnpm --filter @daycare/app typecheck` passed.
- `corepack pnpm --filter @daycare/app test` passed: 42 files, 132 tests.
- `corepack pnpm --filter @daycare/app lint` completed with no errors. It still
  reports 10 existing warnings in unrelated files.
- `git diff --check` passed.
