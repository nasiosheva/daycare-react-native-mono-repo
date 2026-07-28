# Android release APK and AAB

This guide describes how to create a locally signed Android APK for direct distribution or Android App Bundle (AAB) for Google Play. Both are separate from `run-android-prod.sh`, which starts an Expo development client against production services and does not create a distributable artifact.

## Scope and output

- APK entry point: `./build-android-release-apk.sh`; Gradle task: `:app:assembleRelease`; output: `apps/mobile/android/app/build/outputs/apk/release/app-release.apk`.
- AAB entry point: `./build-android-release-aab.sh`; Gradle task: `:app:bundleRelease`; output: `apps/mobile/android/app/build/outputs/bundle/release/app-release.aab`.
- Both formats use `NODE_ENV=production`, R8 minification, and Android resource shrinking.
- The direct-distribution APK targets `arm64-v8a` by default, so it does not package emulator libraries or 32-bit libraries that most current Android devices do not use.
- The AAB includes the configured native ABI variants by default; Google Play uses it to serve device-specific splits.
- The launcher does not start Metro, an emulator, a device, the local API, or any production service.
- The APK launcher validates the final APK with Android SDK `apksigner`; the AAB launcher validates the bundle with JDK `jarsigner`.

## One-time local setup

Install Node.js 20 or newer, Android Studio with Android SDK Build Tools, and JDK 21. The launcher chooses JDK 21 automatically on macOS when it is installed through the standard Java home registry.

Create or update the ignored `.env.prod` file from `.env.prod.example`. It must contain production values for:

```dotenv
EXPO_PUBLIC_APP_ENV=production
EXPO_PUBLIC_API_URL=https://<api-domain>/api/v1
EXPO_PUBLIC_FIREBASE_API_KEY=<firebase-public-api-key>
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=<firebase-auth-domain>
EXPO_PUBLIC_FIREBASE_PROJECT_ID=<firebase-project-id>
EXPO_PUBLIC_FIREBASE_APP_ID=<firebase-app-id>
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=<google-oauth-client-id>
```

`EXPO_PUBLIC_REALTIME_URL` is optional; when absent, the client derives it from `EXPO_PUBLIC_API_URL`. `EXPO_PUBLIC_*` values are bundled into the app and therefore must never contain a password, private key, signing secret, or server credential.

Place the Firebase Android configuration at `apps/mobile/google-services.json`. Its package name must match the Android application ID.

### Release signing

The Android Gradle project expects its ignored local signing configuration in `apps/mobile/android/gradle.properties`:

```properties
MYAPP_RELEASE_STORE_FILE=release.keystore
MYAPP_RELEASE_STORE_PASSWORD=<keystore-password>
MYAPP_RELEASE_KEY_ALIAS=<key-alias>
MYAPP_RELEASE_KEY_PASSWORD=<key-password>
```

`MYAPP_RELEASE_STORE_FILE` is resolved relative to `apps/mobile/android/app/`; for the example above, the keystore must be at `apps/mobile/android/app/release.keystore`.

If no release keystore exists yet, create it once on the secure developer machine:

```sh
keytool -genkeypair \
  -keystore apps/mobile/android/app/release.keystore \
  -alias umur-emas-release \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000
```

Store the keystore and its passwords securely. Use the same keystore for every future update of the same Android application; losing it prevents publishing compatible updates. Do not commit, upload to GitHub, or paste a keystore or its passwords into chat, issue trackers, or environment files tracked by Git.

## Build

From the repository root, run:

```sh
./build-android-release-apk.sh
```

The launcher checks the environment configuration, Android SDK, Firebase file, Gradle wrapper, signing properties, and keystore before invoking Gradle. It applies the ignored signing properties to the generated Android release variant only for that build, so a release APK never falls back to the debug keystore. If workspace dependencies are absent, it performs a locked `pnpm install` first.

On success, the terminal prints the absolute APK path. Install it on a connected device manually, or upload that APK to the intended internal distribution channel. The APK and all local signing/configuration files remain ignored by Git.

To produce a compatibility APK that also supports 32-bit Android devices, opt in explicitly:

```sh
ANDROID_RELEASE_ARCHITECTURES=armeabi-v7a,arm64-v8a ./build-android-release-apk.sh
```

The supported values are `arm64-v8a`, `armeabi-v7a`, `x86`, and `x86_64`. Do not include emulator ABIs (`x86`, `x86_64`) in a direct-production APK unless that APK is specifically for an emulator or test device; every selected ABI adds native libraries to the download.

For Google Play, create an AAB instead:

```sh
./build-android-release-aab.sh
```

The AAB is not directly installable on a device. Upload it to Google Play Console, which generates optimized APK splits for each device architecture.

## Verification

The launcher runs `apksigner verify --verbose` automatically. To inspect the generated artifact afterward:

```sh
ls -lh apps/mobile/android/app/build/outputs/apk/release/app-release.apk
shasum -a 256 apps/mobile/android/app/build/outputs/apk/release/app-release.apk
```

The project has minimum Android SDK 24, so a valid APK Signature Scheme v2 signature is sufficient for its supported Android versions. The absence of v1 signing is expected and does not make the APK invalid for this application.

The AAB launcher runs `jarsigner` verification automatically and prints its detailed output only when verification fails. To inspect it afterward:

```sh
ls -lh apps/mobile/android/app/build/outputs/bundle/release/app-release.aab
jarsigner -verify -verbose -certs apps/mobile/android/app/build/outputs/bundle/release/app-release.aab
```

When run manually, `jarsigner` can warn about an AAB's ZIP structure and self-signed local certificate even when it reports `jar verified.`. Those warnings do not replace Google Play Console's upload validation.

## Troubleshooting

| Message or symptom | Resolution |
| --- | --- |
| `JDK 21 is required` | Install JDK 21 and ensure macOS can find it through `/usr/libexec/java_home -v 21`. |
| Android SDK not found | Install Android Studio SDK components, then set `ANDROID_HOME` or `ANDROID_SDK_ROOT` if the SDK is not at `~/Library/Android/sdk`. |
| Missing `google-services.json` | Download the Android configuration for the correct Firebase project/application ID and place it at `apps/mobile/google-services.json`. |
| Missing production value | Fill the indicated `EXPO_PUBLIC_*` field in the ignored `.env.prod`; do not copy secrets into an `EXPO_PUBLIC_*` variable. |
| Missing release signing property or keystore | Add the four `MYAPP_RELEASE_*` properties to ignored `android/gradle.properties` and ensure the referenced keystore exists under `android/app/`. |
| APK will not install on a 32-bit device | Rebuild with `ANDROID_RELEASE_ARCHITECTURES=armeabi-v7a,arm64-v8a`; the default release APK is ARM64-only to reduce download size. |
| AAB will not install through `adb install` | This is expected. Upload the AAB to Google Play or use the APK launcher for direct device installation. |
| Release build breaks after R8 shrinking | Keep the failure output, add the smallest necessary rule to `android/app/proguard-rules.pro`, then rebuild and exercise the affected native flow. Do not disable shrinking globally as a first response. |
| `apksigner` is not found | Install Android SDK Build Tools through Android Studio, then repeat the build. |
| A native package or application ID changed | Synchronize the generated Android project, then restore/confirm the ignored local signing configuration before running the release launcher. |

## Security boundary

This local build flow does not deploy the web app or API, run database migrations, access the production database, or activate a VPS release. Its only output is the locally signed APK or AAB. GitHub Actions deployment remains web-only as documented in the README.
