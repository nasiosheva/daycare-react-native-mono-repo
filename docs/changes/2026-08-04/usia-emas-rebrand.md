# Rebrand Usia Emas

## Change

- Renamed the previous user-visible application name to **Usia Emas** across Expo, Android, iOS, sign-in, sign-up, app-bar fallback, splash copy, and native permission prompts.
- Updated active and historical prose documentation plus test fixtures to use the new brand.
- Added shared UI brand constants so React Native screens and the splash use one display-name source.

## Compatibility boundary

The rebrand intentionally does not change legacy technical identifiers: Android/iOS package identity, Expo slug and deep-link scheme, Firebase project, API/domain, VPS paths and service, keystore alias, or persisted local-storage keys. Existing installs, Google/Firebase configuration, and production automation remain compatible.

## Verification

- `pnpm typecheck` passed.
- `pnpm test` passed.
- `JAVA_HOME=$(/usr/libexec/java_home -v 21) apps/api/gradlew -p apps/api test --no-daemon` passed.
