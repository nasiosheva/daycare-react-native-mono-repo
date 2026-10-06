# Production PostgreSQL UUID prerequisite

## Problem

The first production API deployment reached the VPS but failed while Flyway
applied `V1__initial_schema.sql`. The baseline seeds records with
`gen_random_uuid()`, which PostgreSQL provides through the `pgcrypto` extension;
the fresh Ubuntu PostgreSQL database did not have that extension enabled.

## Change

`scripts/production/provision-vps.sh` now enables `pgcrypto` after creating the
`daycare` database. The operation is idempotent, so re-running provisioning does
not alter existing data or extension state. The deployment README documents the
prerequisite as part of provisioning.

## Production verification

On 2026-10-06, `pgcrypto` was enabled on the new production `daycare` database.
The API then applied Flyway migrations V1 through V15 and reported
`/api/actuator/health` as `{"status":"UP"}`. GitHub Actions deployment run
`37408742315` completed successfully end to end.
