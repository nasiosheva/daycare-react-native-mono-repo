# Android signing alias migration

## Context

The release signing alias was renamed from the legacy product identifier to `usia-emas-release` without changing the private-key entry or certificate.

## Changed behavior

- The local Android release-signing configuration now references `usia-emas-release`.
- The keystore entry was renamed in place; Android application identity and signing-certificate continuity are preserved.
- A restricted local backup was made before the alias migration. It is ignored by Git with all other keystores.
- The obsolete ignored `LocalDemoDataSeeder` build artifact was removed. The active backend source only has the local Platform Admin seeder and contains no legacy seeder namespace.

## Verification

- The renamed keystore entry remains a `PrivateKeyEntry`.
- SHA-1 and SHA-256 fingerprints before and after the alias migration are identical.
- The release APK build was attempted with the repository launcher. It reached native compilation but stopped at the unrelated existing Expo error `package expo.modules.fetch does not exist` in generated `ExpoModulesPackageList.java`; no APK was produced. Resolve that dependency/build issue before distribution, then rerun the launcher to verify the signed APK artifact.
