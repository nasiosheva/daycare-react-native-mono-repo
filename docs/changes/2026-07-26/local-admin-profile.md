# Local admin profile activation

Date: 2026-07-26

## Change

- The local mobile launcher now exports `SPRING_PROFILES_ACTIVE=local` before starting the API.

## Affected behavior

`LocalPlatformAdminSeeder` is scoped to Spring's `local` profile. Local Android and web launchers now reliably create the configured local Platform Admin when local authentication and local seeding are enabled. Previously, `.env` supplied those flags but did not activate the required profile, causing local login to return 401 when no account already existed. The seeder now also resets an existing local-admin password to the configured local value, preventing a stale development database from retaining an unknown password hash.

## Verification

- Reviewed the launcher path and the seeder's `@Profile("local")` requirement.
- Ran shell syntax validation for `scripts/run-mobile.sh`.
- Verified the local-only seeder resets only its configured Platform Admin password.

## Follow-up

The configured local password is development-only. Do not enable the local seeder outside a disposable local environment.
