# Android release APK size optimization

## Change

- `build-android-release-apk.sh` now builds the direct-distribution release APK for `arm64-v8a` by default instead of the development project's four Android ABIs.
- The launcher enables R8 minification and Android resource shrinking only for that release invocation.
- The launcher supplies the four ignored `MYAPP_RELEASE_*` Gradle properties to the generated Android release variant through a temporary Gradle init script, so the tracked launcher does not depend on an ignored native-file edit and no longer falls back to the debug keystore.
- The shared APK/AAB launcher now creates its temporary Gradle init file with a macOS-compatible `mktemp` template. The AAB wrapper can therefore reach Gradle instead of failing before the build begins.

## Behavior

- The default APK excludes `armeabi-v7a`, `x86`, and `x86_64` native libraries, which reduces the download for modern physical Android devices.
- A maintainer can explicitly request a multi-ABI compatibility APK with `ANDROID_RELEASE_ARCHITECTURES=armeabi-v7a,arm64-v8a`.
- `./build-android-release-aab.sh` produces the signed AAB for Google Play and verifies it with `jarsigner`; Google Play generates device-specific APK splits from the bundle.
- R8/resource shrinking can reveal a missing keep rule. Such a failure must be fixed with the smallest targeted rule in `android/app/proguard-rules.pro`; it must not be solved by disabling release shrinking globally.

## Verification

- `./build-android-release-apk.sh` completed successfully with the default `arm64-v8a` ABI, R8/resource shrinking, and APK Signature Scheme v2 verification. The resulting APK is 34 MB and contains only `arm64-v8a` native libraries.
- The temporary Android debug-keystore check was removed from the ignored Gradle properties. The final APK and AAB verification used the local release keystore configured through the four ignored `MYAPP_RELEASE_*` values.
- `./build-android-release-aab.sh` completed successfully after the macOS temporary-file repair. It produced a 61 MB signed AAB and `jarsigner` reported `jar verified.`. The launcher suppresses normal AAB ZIP-structure warnings unless signature verification fails.
- A release build must be installed and smoke-tested on an ARM64 physical device after the first R8-enabled build.

## Follow-up

- Upload the verified AAB to the intended Google Play track and complete a physical-device smoke test before publishing.
