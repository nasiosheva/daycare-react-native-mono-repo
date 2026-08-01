# Parent operating hours grouped per child across all tenants

## Context

A Parent whose children are enrolled at different tenants could previously only see operating hours for the currently active tenant (`GET /parent/operating-hours`, scoped by the `X-Organization-Id` header). Seeing another child's tenant required switching the active tenant first, one at a time — never a combined view. The user explicitly asked for a single screen showing every child's operating hours at once, clearly labeled by which child and which tenant each block belongs to.

## Changes

- `OvertimeService.kt`: new `parentHoursAllTenants(jwt)` method and `ParentChildOperatingHoursResponse` DTO. Unlike every other method in this service, it does not use the single-organization `access.require(...)` pattern (there is no one organization to scope to). Instead it calls `identityService.sync(jwt)` to resolve the user, filters their active `PARENT` memberships via `MembershipRepository.findAllByUserId`, resolves every guardian-linked child inside those tenants, and skips any tenant lacking `InstitutionCapability.DAYCARE_OPERATIONS` via `OrganizationCapabilitiesService.forOrganization`. Results are sorted by tenant name then child name.
- New endpoint `GET /parent/operating-hours/all-tenants` (`BillingController`) — deliberately has no `X-Organization-Id` header parameter, since it is cross-tenant by design.
- `packages/api-client`: `ParentChildOperatingHours` type, `parentOperatingHoursAllTenants()` method.
- `apps/mobile/app/operational-hours.tsx`: rewritten to call the all-tenants endpoint and render one card per child (child name, then `{tenant} · {branch}` subtitle, then that child's branch hours/tiers) instead of one card per branch scoped to the active tenant. The Parent-role gate now checks for *any* PARENT membership instead of the membership matching the currently active tenant.
- i18n: `overtime.childTenantLabel` (new), `overtime.parentDescription`/`overtime.noParentBranches` reworded to reflect the cross-tenant, per-child framing.

## Verification

- `gradle compileKotlin` — clean.
- `cd apps/mobile && npx tsc --noEmit -p .` — clean.
- Live: created a second throwaway tenant ("Test CrossTenant B", branch "Cabang B") alongside the existing "Test Health Feature" tenant, set operating hours on both branches, created child "Citra Wijaya" in the new tenant, bound a single new Parent test account as guardian to that child and to the existing "Budi Santoso" in "Test Health Feature". `GET /parent/operating-hours/all-tenants` for that Parent returned both children in one response, each correctly labeled with its own tenant/branch/hours/tiers, sorted by tenant name. The same request with a platform-admin token (no PARENT membership anywhere) returned `[]`, confirming no cross-tenant data leak for non-Parents.
