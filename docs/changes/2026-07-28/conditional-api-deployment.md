# Conditional API deployment

## Change

- The production deployment workflow now detects changes under `apps/api/`.
- An API change restores the Gradle cache, runs the Spring API test suite, builds the Spring Boot JAR using the tracked Gradle 8.14.2 wrapper and Temurin JDK 21, uploads it with the immutable web release, activates the release, and waits for the API health endpoint.
- A web-only change preserves the current API artifact and does not restart `umur-emas-api`.
- The API Gradle Wrapper is now tracked so GitHub-hosted runners can perform the same deterministic API build without depending on a preinstalled Gradle version.
- A failed API activation or health check invokes the activation script's `--rollback` mode, restores the immediately preceding web/API release, and verifies that API health before marking the workflow failed.

## Affected behavior

- A merge to `production` that changes `apps/api/**` deploys the backend automatically.
- A merge that does not change `apps/api/**` keeps the existing web-only activation behavior.
- Database migrations are still not applied by a standalone CI step. Flyway remains responsible during the API process startup; migrations must be backward-compatible because artifact rollback does not reverse schema changes.

## Verification

- Reviewed workflow conditions and release activation behavior: API JAR upload controls whether the activation script restarts `umur-emas-api`, and the previous release is retained for rollback.
- Verified the tracked wrapper points to Gradle 8.14.2.

## Follow-up

- The first production merge containing this workflow should be monitored in GitHub Actions to confirm cache restore, test execution, health check, and VPS rollback permissions.
