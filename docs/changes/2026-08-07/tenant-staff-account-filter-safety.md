# Tenant staff account filter and creation safety

## Change

- Replaced the immediate branch tabs on **Kelola → Akun tenant** with the shared Bottom Sheet filter flow. Selecting a branch is draft-only; the tenant-user query changes only after **OK**. Closing or cancelling discards the draft.
- When creating a `STAFF`, the form now clearly reports the absence of an active branch and disables the submit action. Creating a tenant-wide `STAFF_ADMIN` remains available without a branch.
- Added service tests that assert tenant-wide Staff Admin membership ignores a supplied branch and permissions, while a Staff membership requires an active same-tenant branch and persists only its requested permissions. An unavailable branch fails before credentials or a membership are created.

## Contract and documentation review

- No API, database, authorization, or migration contract changed. The existing server remains authoritative for Staff Admin access, permitted roles, active same-tenant branches, identity uniqueness, password hashing, and membership permissions.
- `docs/business-rules.md` already requires draft-and-OK filtering for Staff accounts, so its rule did not change. `README.md` and `docs/tenant-staff-accounts.md` now describe the implemented flow.

## Verification

- Passed `apps/api/gradlew -p apps/api test --tests com.daycare.api.service.TenantAccountProvisioningTest --no-daemon` with JDK 21.
- Passed `corepack pnpm typecheck` and `corepack pnpm test` from the repository root.
- Passed `apps/api/gradlew -p apps/api test --no-daemon` with JDK 21 and `git diff --check`.
