# Reset production database (manual — run yourself via your own SSH/DB access)

Claude Code has no SSH/VPS/production-DB credentials in this sandbox, so none of this can be executed automatically. Run each step yourself, in order, reviewing before you proceed to the next.

## What changed locally (already done, verified)

- All 20 Flyway migrations (`V1`–`V20`) were concatenated in original order into a single `apps/api/src/main/resources/db/migration/V1__initial_schema.sql`. `V2`–`V20` were deleted.
- Verified against a scratch Postgres database: the consolidated file applies with zero errors, and Hibernate's `ddl-auto: validate` passes cleanly against the resulting schema (confirms it matches every JPA entity in the app).
- Consequence: **any existing database** (production, and this machine's local dev database) that already recorded `V1`–`V20` in `flyway_schema_history` will fail Flyway checksum validation on next boot, because the on-disk `V1` file no longer matches what was recorded. This is expected — every such database must be reset to work with the squashed migration.

## Steps to run against production yourself

1. **Back up first, even though you said there's no real user data yet** — cheap insurance:
   ```bash
   pg_dump -h <prod-db-host> -U <prod-db-user> -d <prod-db-name> -F c -f prod-backup-before-reset.dump
   ```

2. **Build a fresh API jar with the squashed migration** (on a machine with this repo + Gradle):
   ```bash
   cd apps/api
   gradle bootJar --no-daemon
   # produces apps/api/build/libs/*.jar
   ```

3. **Upload the new jar to the VPS release you're activating**, replacing the preserved-artifact behavior in `scripts/production/activate-release.sh` (that script normally copies forward the *previous* `api.jar` — you specifically want a new one this time):
   ```bash
   scp apps/api/build/libs/api.jar <vps-user>@<vps-host>:/opt/umur-emas/releases/<release-id>/api.jar
   ```

4. **Wipe the production schema** (irreversible — this is the actual reset):
   ```bash
   psql -h <prod-db-host> -U <prod-db-user> -d <prod-db-name> -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
   ```

5. **Restart the API service** — Flyway runs automatically on Spring Boot startup and will apply the single `V1` migration against the now-empty schema:
   ```bash
   ssh <vps-user>@<vps-host> "sudo systemctl restart umur-emas-api"
   ```

6. **Verify** — tail the service logs for `Started DaycareApplicationKt` with no `ERROR`/`SchemaManagementException`, matching what was already verified locally:
   ```bash
   ssh <vps-user>@<vps-host> "journalctl -u umur-emas-api -n 100 --no-pager"
   ```

## Local dev database

This machine's local `daycare` database also has `V1`–`V20` recorded and will fail Flyway validation next time the API starts locally, for the same checksum-mismatch reason. Reset it the same way whenever convenient:
```bash
psql -h localhost -p 5432 -U morieshutapea -d daycare -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
```
Say the word and this can be done in this session instead of waiting.
