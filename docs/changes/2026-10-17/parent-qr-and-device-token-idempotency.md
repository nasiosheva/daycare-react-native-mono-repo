# Parent QR Eligibility and Push Device Registration

<!-- Mories Deo Hutapea,S.E.,S.Kom -->

## Changes

- Parent QR keeps the existing eligibility rule: only children in operational tenants with an active service entitlement can receive an attendance QR. When a linked child exists but cannot receive a QR, the page now explains whether a service entitlement or operational tenant subscription is missing. Eligible tenants get a direct link to Booking; no linked children still uses the existing no-children state.
- Native push registration can be requested by both the app layout and Notifications settings. Concurrent calls for the same API context and installation now share one in-flight registration.
- Backend registration reuses an existing row for the push token. If the same installation has a stale token row, it deletes that row before assigning the existing token row to the current installation, preserving the current installation's mute preference.

## Test-first evidence

- Red: `pnpm --filter @daycare/app exec vitest run src/notifications/nativePush.test.ts` — the concurrent-registration test failed because the API was called twice.
- Red: `pnpm --filter @daycare/app exec jest --config jest.ui.config.cjs --runInBand src/ui/parent-qr.ui.test.tsx` — the test found the old generic no-children message instead of the entitlement explanation.
- Red: `apps/api/gradlew --no-daemon -p apps/api test --tests com.daycare.api.service.AdministrationServiceTest` — the stale-installation merge test failed because the old row was not removed and the existing token row was not reused.

## Verification

- `pnpm --filter @daycare/app exec vitest run src/notifications/nativePush.test.ts` — 8 tests passed.
- `pnpm --filter @daycare/app exec jest --config jest.ui.config.cjs --runInBand src/ui/parent-qr.ui.test.tsx` — 1 test passed.
- `pnpm --filter @daycare/app exec vitest run src/i18n/translations.test.ts` — 14 tests passed; new QR eligibility copy exists in all 7 supported locales.
- `pnpm --filter @daycare/app test` — final batch: 58 files / 235 tests passed.
- `pnpm --filter @daycare/app exec jest --config jest.ui.config.cjs --runInBand` — final batch: 7 suites / 27 tests passed. Existing `OfflineProvider` UI test emits a React `act(...)` warning.
- `pnpm --filter @daycare/app typecheck` — passed.
- Targeted ESLint on changed mobile files — final batch has 0 errors and 0 warnings after moving the test import to the module header.
- `apps/api/gradlew --no-daemon -p apps/api test --tests com.daycare.api.service.AdministrationServiceTest` — passed.
- Full backend suite in the final batch: 94 suites / 909 tests passed.

## Database diagnosis

- The local `parent` account has 3 active linked children, active Parent memberships, operational tenant subscriptions, and published `DAYCARE_OPERATIONS` offerings.
- None of those children has an active, unexpired service entitlement owned by this Parent. Therefore the QR list is correctly ineligible under the existing rule; no local data was changed.
- The web session log also showed a duplicate Expo device-token registration returning HTTP 500. The logged failure was not related to QR issuance.

## Follow-up

- No change to the business eligibility rule or database schema. The device-token database uniqueness constraints remain in place.
