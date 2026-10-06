# Single Platform Admin invariant

## Change

- Documented that each deployment allows at most one Platform Admin, with controlled provisioning used when an account is required.
- Added a database-level unique expression index so concurrent and out-of-band writes cannot create a second `platform_administrators` row.
- Restricted configured-email and local-admin bootstrap to an empty administrator table, removed the second-admin Profile flow, and kept the legacy API/client contract as a compatibility path that always rejects without mutation.
- Bootstrap inserts use PostgreSQL `ON CONFLICT DO NOTHING` so concurrent first-start requests converge safely on the one record.
- Kept tenant Staff Admin provisioning unchanged; the singleton rule applies only to the global Platform Admin role.

## Verification

- Static references were checked across API, client, and mobile sources; the Profile action is removed and only the compatibility endpoint/client contract remains.
- `./apps/api/gradlew -p apps/api test --no-daemon` passed.
- `corepack pnpm typecheck`, `corepack pnpm lint`, and `corepack pnpm test` passed.

## Follow-up

- The new Flyway migration must be applied by the normal reviewed deployment before the database constraint is active in a deployed environment.
- The migration intentionally does not delete or choose between pre-existing duplicate administrator rows; if such rows exist, deployment stops for an explicit data cleanup instead of silently changing ownership.
