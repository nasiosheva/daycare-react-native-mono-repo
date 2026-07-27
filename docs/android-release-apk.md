# Android release APK

This guide describes how to create a locally signed Android APK for direct distribution. It is separate from `run-android-prod.sh`, which starts an Expo development client against production services and does not create a distributable APK.

## Scope and output

- Entry point: `./build-android-release-apk.sh` from the repository root.
- Gradle task: `:app:assembleRelease` with `NODE_ENV=production`.
- Output: `apps/mobile/android/app/build/outputs/apk/release/app-release.apk`.
- The launcher does not start Metro, an emulator, a device, the local API, or any production service.
- The launcher validates the final APK with the Android SDK `apksigner` before reporting success.

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

The launcher checks the environment configuration, Android SDK, Firebase file, Gradle wrapper, signing properties, keystore, and Gradle release signing configuration before invoking Gradle. If workspace dependencies are absent, it performs a locked `pnpm install` first.

On success, the terminal prints the absolute APK path. Install it on a connected device manually, or upload that APK to the intended internal distribution channel. The APK and all local signing/configuration files remain ignored by Git.

## Verification

The launcher runs `apksigner verify --verbose` automatically. To inspect the generated artifact afterward:

```sh
ls -lh apps/mobile/android/app/build/outputs/apk/release/app-release.apk
shasum -a 256 apps/mobile/android/app/build/outputs/apk/release/app-release.apk
```

The project has minimum Android SDK 24, so a valid APK Signature Scheme v2 signature is sufficient for its supported Android versions. The absence of v1 signing is expected and does not make the APK invalid for this application.

## Troubleshooting

| Message or symptom | Resolution |
| --- | --- |
| `JDK 21 is required` | Install JDK 21 and ensure macOS can find it through `/usr/libexec/java_home -v 21`. |
| Android SDK not found | Install Android Studio SDK components, then set `ANDROID_HOME` or `ANDROID_SDK_ROOT` if the SDK is not at `~/Library/Android/sdk`. |
| Missing `google-services.json` | Download the Android configuration for the correct Firebase project/application ID and place it at `apps/mobile/google-services.json`. |
| Missing production value | Fill the indicated `EXPO_PUBLIC_*` field in the ignored `.env.prod`; do not copy secrets into an `EXPO_PUBLIC_*` variable. |
| Missing release signing property or keystore | Add the four `MYAPP_RELEASE_*` properties to ignored `android/gradle.properties` and ensure the referenced keystore exists under `android/app/`. |
| `apksigner` is not found | Install Android SDK Build Tools through Android Studio, then repeat the build. |
| A native package or application ID changed | Synchronize the generated Android project, then restore/confirm the ignored local signing configuration before running the release launcher. |

## Security boundary

This local build flow does not deploy the web app or API, run database migrations, access the production database, or activate a VPS release. Its only output is the locally signed APK. GitHub Actions deployment remains web-only as documented in the README.
