# Tenant access log noise and startup redirect guard

## Change

- Included each tenant membership's subscription status in the authenticated `/me` response so the mobile app can distinguish operational (`ACTIVE`/`TRIAL`) tenants from billing-blocked tenants before starting tenant-scoped queries.
- Disabled tenant-scoped Home, notification, realtime-access, and native-device registration queries for non-operational subscriptions; the API remains fail-closed and still rejects direct requests.
- Prevented cached tenant data from being rendered on Home after a subscription becomes non-operational.
- Disabled automatic React Query retries for HTTP 4xx responses so authorization and validation failures are not repeatedly emitted in local logs.
- Delayed `SafeRedirect` until the root navigation state has a key, preventing the startup `REPLACE /home` action from being dispatched before the navigator is ready.

## Verification

- `pnpm --filter @daycare/core typecheck`
- `pnpm --filter @daycare/app typecheck`
- Targeted ESLint for the changed mobile files (passes; the full app lint still reports pre-existing unresolved `@/notify`, `@/date-picker`, and related baseline errors in other files).
- `pnpm --filter @daycare/app test -- --run` (35 files, 98 tests)
- `GRADLE_USER_HOME="$PWD/.gradle-local" ./apps/api/gradlew -p apps/api compileKotlin --no-daemon`
- `GRADLE_USER_HOME="$PWD/.gradle-local" ./apps/api/gradlew -p apps/api test --no-daemon`

## Follow-up

- A tenant with an expired or otherwise inactive subscription must still be renewed/reactivated by the authorized Platform Admin; this change only prevents the mobile client from repeatedly requesting blocked tenant data.
