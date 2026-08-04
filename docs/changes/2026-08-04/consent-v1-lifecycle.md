# Consent V1 lifecycle

## Change

- Completed the Daycare-only Consent V1 flow described in `docs/business-rules.md`.
- Staff Admin can create, revise, activate, and deactivate tenant-scoped consent definitions.
- Linked Parents manage only their own current decision for a selected child: grant, decline, or withdraw.
- A definition revision or active-state change increments its revision. Consent records are now unique per child, definition, guardian, and revision, preserving prior text snapshots.
- Added audit events for definition changes and Parent decisions, plus typed API client and mobile screens.

## Safety boundary

Consent V1 is record collection only. It cannot authorize medication, medical/emergency action, pickup, checkout, outings, media use, or any other sensitive operation. Those endpoint rules remain independent until the fuller consent model is explicitly implemented.

## Verification

- `pnpm typecheck` passed.
- `pnpm test` passed.
- `JAVA_HOME=$(/usr/libexec/java_home -v 21) apps/api/gradlew -p apps/api test --no-daemon` passed.
