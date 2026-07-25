# Local master-data-only seeding

## Change

- Removed automatic local demo and platform-admin seeders, along with the on-demand account seeder.
- Removed `LOCAL_SEED_*` and `SEED_RUN` application configuration so no seed path creates credentials, users, memberships, tenants, or transactional data.
- Added a Flyway migration that makes global development-category provenance optional and inserts the four built-in global categories without requiring a user record.

## Resulting local database behavior

After a reset, Flyway creates the schema and only versioned master data: institution types, global development categories, and global Goal templates. The database has no account or tenant demo data. Authentication accounts must be created through their normal provisioning flow.

## Verification

- Source search confirms no automatic or on-demand account seeder remains in the API application.
- The local PostgreSQL `daycare` schema was reset before this change; migrations will apply on the next API startup.

## Follow-up

- Start the local API once the local Gradle installation is healthy to apply and verify Flyway migration `V20` against the fresh database.
