# Local database reset for consolidated Flyway baseline

## Change

- Reset the local `daycare` PostgreSQL `public` schema after consolidating all schema migrations into `V1__initial_schema.sql`.
- The local API is restarted through `scripts/run-backend-local.sh`, which applies the baseline and creates only the configured local Platform Admin when local seeding is enabled.

## Scope and safety

- This is intentionally destructive for local application data only: all local tenants, accounts, memberships, transactions, and Flyway history in the `public` schema are removed.
- The target is the `.env` local PostgreSQL connection. No production connection is used.

## Verification

- Confirm the local API health endpoint is `UP`.
- Confirm `flyway_schema_history` has exactly one successful `V1` entry after startup.
- Confirm the local Platform Admin can be recreated by the normal local seeder when enabled.

## Follow-up

- Future schema changes need an explicit migration-baseline policy before they are introduced.
