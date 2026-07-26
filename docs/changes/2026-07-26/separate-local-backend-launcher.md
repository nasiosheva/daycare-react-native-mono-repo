# Separate local backend launcher

## Change

- Added `./scripts/run-backend-local.sh` as the dedicated local Spring API launcher.
- Moved local PostgreSQL readiness, optional Docker Compose startup, API-port protection, Spring `local` profile setup, and backend tool checks into that script.
- Updated the Web, Android, and iOS local launchers so they only verify that the API is ready; they no longer own, stop, or restart it.

## Usage

Run `./scripts/run-backend-local.sh` in one terminal and keep it open. In a second terminal, run the desired client launcher such as `./run-web-local.sh` or `./run-android-local.sh`.

## Verification

- `sh -n scripts/run-mobile.sh scripts/run-backend-local.sh`

## Consolidation

- Removed the root `run-backend-local.sh` forwarding alias. The implementation in `scripts/run-backend-local.sh` is now the only supported local backend command.
- Confirmed launcher scripts have executable permissions.

## Documentation alignment

- README, troubleshooting, and repository-local project memory now agree that the backend runs in its own terminal; the local client launchers only perform a readiness check.
- The optional local Platform Admin seeder is the sole account exception: with both `LOCAL_AUTH_ENABLED=true` and `LOCAL_SEED_ENABLED=true`, it creates or updates one configured local administrator and resets that password. No tenant, membership, transactional, or demo data is seeded.
- The Gradle Wrapper is intentionally ignored. When missing on a fresh clone, the launcher now gives the documented `gradle -p apps/api wrapper --gradle-version 8.14.2` recovery command.
- The launcher was exercised on 2026-07-26. It correctly stopped before startup because neither PostgreSQL at `localhost:5432` nor Docker Compose was available; no API process was left running.
