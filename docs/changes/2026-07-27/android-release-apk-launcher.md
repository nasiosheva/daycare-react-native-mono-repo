# Signed Android release APK launcher

## Change

- Added `./build-android-release-apk.sh` as the one-command local build entry point for a signed Android release APK.
- The launcher validates production Expo configuration, JDK 21, Android SDK availability, Firebase Android configuration, generated native Android files, release-signing properties, and the release keystore before invoking Gradle.

## Behavior

- The launcher builds `:app:assembleRelease` without starting Metro, an emulator, or a development client.
- The launcher explicitly builds the Expo bundle with `NODE_ENV=production`.
- It reads signing material only from ignored local Android files and never prints passwords or key material.
- The signed artifact is emitted at `apps/mobile/android/app/build/outputs/apk/release/app-release.apk`.
- It verifies the generated APK with Android SDK `apksigner` before reporting success.
- This is an operational build helper only; it does not change any business rule, API contract, or production deployment flow.

## Documentation

- Added `docs/android-release-apk.md` with local setup, signing-key ownership, production public configuration, build, signature verification, troubleshooting, and the boundary from VPS/API deployment.

## Verification

- Ran `./build-android-release-apk.sh` with the ignored local production configuration and Android signing material; Gradle generated the signed APK successfully.
- Verified the generated APK with Android `apksigner`; it has one valid APK Signature Scheme v2 signer.
