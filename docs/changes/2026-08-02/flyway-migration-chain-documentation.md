# Consolidated Flyway baseline and local reset

## Change

- Squashed all tracked Flyway SQL (`V1` through `V19`) into one current baseline: `V1__initial_schema.sql`.
- Removed `V2` through `V19`; a clean database now records exactly one successful Flyway migration.
- Updated the README and repository-local project memory: this baseline is for an empty schema, and an existing incompatible Flyway history must be reset rather than repaired.

## Affected behavior

- The resulting schema and Flyway-owned master data are equivalent to applying the former sequence in order.
- Every pre-existing local or production database has an incompatible Flyway checksum/history after this squash and must be intentionally reset before it can start this revision.
- No UI flow, API route, authorization rule, or business rule changed.

## Verification

- Confirmed the migration directory contains only `V1__initial_schema.sql`.
- Reset the local `daycare` `public` schema and restarted the API through `scripts/run-backend-local.sh`.
- Flyway validated and applied one migration (`V1`) successfully; `flyway_schema_history` now has one successful `V1` row.
- Hibernate completed schema validation, `/api/actuator/health` returned `UP`, and the baseline seeded 15 described institution types plus the one configured local Platform Admin.

## Follow-up

- Any future schema change must either be incorporated into the baseline before use outside this reset-only workflow, or start a new forward migration only after the team intentionally adopts a non-squashed migration policy.
