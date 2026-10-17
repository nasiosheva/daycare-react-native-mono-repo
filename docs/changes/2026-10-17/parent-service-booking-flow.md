# Parent service booking flow fixes

<!-- Mories Deo Hutapea,S.E.,S.Kom -->

## Changes

- The Parent booking screen now lists children only when that child's tenant publishes `DAYCARE_OPERATIONS`. Capability lookup failures name the affected tenant and can be retried; they are not presented as an empty eligibility result. Tenants with restricted subscriptions still allow the existing invoice-read/payment path, but cannot load operational plans, entitlements, or bookings.
- Plan, entitlement, invoice, and booking query failures now show an explicit retry state; a failed request is not presented as an empty result.
- Booking existing service credits now carries a persisted `Idempotency-Key` from the client through the API to the backend. A retry with the same key and normalized date set returns the original booking batch without reserving credits or capacity again. This implements the existing policy in `docs/business-rules.md` §13.2; the policy itself did not change.
- README billing summary was updated to include service-credit bookings.

## Test-first evidence

- Red: the Parent booking UI tests showed non-Daycare children, missing retry states for failed plan/invoice queries, empty-state confusion for failed booking data, and no explanation when a tenant capability lookup failed.
- Red: `pnpm --filter @daycare/api-client exec vitest run src/index.wrappers.test.ts` failed because `bookEntitlement` did not send `Idempotency-Key`.
- Red: the backend replay test did not compile because the booking command had no idempotency-key contract or replay path.

## Verification

- `pnpm --filter @daycare/app exec jest --config jest.ui.config.cjs --runInBand src/ui/booking.ui.test.tsx` — 6 tests passed.
- `pnpm --filter @daycare/app exec vitest run src/i18n/translations.test.ts` — 14 tests passed.
- `pnpm --filter @daycare/api-client exec vitest run src/index.wrappers.test.ts` — 13 tests passed.
- `pnpm --filter @daycare/app typecheck` — passed after applying the explicit mutation input type.
- `apps/api/gradlew --no-daemon -p apps/api test --tests com.daycare.api.service.BillingServiceCoverageTest` — passed.
- Final batch before commit: app unit tests 58 files / 235 tests; UI tests 7 suites / 27 tests; API client 2 files / 66 tests; full backend suite 94 suites / 909 tests; typecheck and targeted ESLint passed.

## Scope and follow-up

- Server still enforces tenant capability, Parent role, child/entitlement ownership, entitlement status, duplicate dates, remaining credits, and capacity; UI filtering is not an authorization boundary.
- No migration or database reset was required. Implementation and documentation are committed locally; these follow-up commits have not been pushed.
