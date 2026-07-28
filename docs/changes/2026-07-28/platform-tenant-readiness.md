# Platform tenant readiness

## Change

- Added the Platform Admin-only `GET /platform/tenant-readiness` summary and the **Tenant readiness** Home card.
- The child screen groups ready tenants and tenants needing attention. Each whole tenant card opens the existing Tenant Detail flow.
- Readiness checks subscription, active Staff Admin, active branch, and active classroom. Daycare tenants additionally require an active service plan, a capacity value for every active branch, and an active payment instruction.

## Behavior and scope

- The dashboard is read-only and does not expose child or Parent data.
- It does not change a tenant's subscription status or Parent-catalog visibility. This preserves the existing rule that an otherwise eligible Daycare tenant can remain visible while its Staff Admin completes operational configuration.
- No database migration is needed because the summary uses existing tenant configuration records.

## Verification

- API client test covers the protected readiness route.
- Spring unit tests cover a complete Daycare tenant, missing configuration, a non-Daycare tenant, and multi-branch Daycare capacity.
- Run `corepack pnpm verify` and `gradle -p apps/api test --no-daemon` before merge.
