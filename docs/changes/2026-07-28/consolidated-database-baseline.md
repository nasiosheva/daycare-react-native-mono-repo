# Consolidated database baseline

## Change

- Combined the current Flyway schema sequence into `V1__initial_schema.sql`.
- Removed `V2` through `V12`; a clean database now records one successful Flyway migration.
- Documented that this baseline is destructive and is not an in-place upgrade path.

## Affected behavior

- Local and production databases must be recreated before they use this revision.
- A reset creates schema and Flyway-owned master data only. It does not recreate tenant, staff, Parent, or application-password Platform Admin accounts.
- Firebase bootstrap access continues to create the Platform Admin record only when the configured Firebase identity first uses a Platform Admin endpoint.
- The production API requires a dedicated `LOCAL_AUTH_JWT_SECRET` of at least 32 random bytes even when Firebase sign-in remains enabled, because API-issued application-password tokens and Firebase tokens are both accepted.
- Added Spring Actuator and permits its `/actuator/health` mapping. With the application context path, the public health URL is `/api/actuator/health`; reset and deployment verification therefore do not require an access token.

## Verification

- Applied the consolidated baseline to an empty temporary PostgreSQL database.
- Flyway reported one successful `V1` migration and Hibernate validated the resulting schema.
- The temporary API completed startup and exposed its health endpoint.

## Follow-up

- Keep future schema changes in new incrementing migrations after this baseline. Do not edit `V1` once it has been adopted by a non-reset environment.
