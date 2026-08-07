# Consent V1 information screen

## Change

- Added a read-only information action to the **Definisi persetujuan** toolbar for active Daycare Staff Admins.
- The new page explains, in simple language, Consent V1's current purpose, Parent decisions, revisions, purpose selection, safe authoring practice, and its non-authorization boundary.
- Added complete Indonesian, English, Chinese, French, Portuguese, Spanish, and Russian translations, with a test that confirms the safety-boundary explanation exists in every supported locale.

## Safety and access

- The page is available only to an active `STAFF_ADMIN` with `DAYCARE_OPERATIONS`, matching the definition-management screen.
- It is read-only and does not load or expose consent decisions, child data, or guardian identity.
- The copy explicitly states that Consent V1 does not authorize medication, medical treatment, pickup, checkout, outings, or media use.

## Verification

- Passed `corepack pnpm typecheck` and `corepack pnpm test` from the repository root.
- Passed `apps/api/gradlew -p apps/api test --no-daemon` with JDK 21 and `git diff --check`.
