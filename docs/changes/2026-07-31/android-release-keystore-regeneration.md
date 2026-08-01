# Android release keystore regeneration

## Change

Generated a new ignored local Android release keystore at
`apps/mobile/android/app/release.keystore` and configured the matching ignored
`MYAPP_RELEASE_*` values in `apps/mobile/android/gradle.properties`.

No password, private key, or environment value is recorded in this repository.

## Behavior and compatibility

The generated key signs future local release APKs. It is a new signing identity,
so Android cannot install its APK as an update over an installation signed with
the unavailable previous key. Existing installs must be uninstalled before this
APK is installed, unless the previous key is restored instead.

Back up the new keystore and its ignored signing properties in an approved secret
manager before running any Android clean prebuild or distributing another build.

## Verification

On 2026-07-31, `./build-android-release-apk.sh` completed successfully and
`apksigner` verified the generated ARM64 APK with APK Signature Scheme v2.

