# Firebase native configuration replacement

## Context

The Android and iOS Firebase configurations were replaced with files supplied for the new Usia Emas Firebase project. The Android client configuration is version-controlled so every developer and CI build uses the registered Firebase project; the iOS client configuration and all Firebase service-account credentials remain excluded.

## Changed behavior

- `apps/mobile/google-services.json` is now registered for the existing Android application ID, `com.children.platform`, in the new Firebase project.
- `apps/mobile/google-services.json` is no longer ignored and will be included in the next repository change set.
- The generated native copy at `apps/mobile/android/app/google-services.json` was updated too, so an immediate local native Gradle build uses the same project.
- The Expo configuration remains the durable source reference; regenerating Android native files must recreate its copy from `apps/mobile/google-services.json`.
- `apps/mobile/GoogleService-Info.plist` is now registered for the existing iOS bundle ID, `com.children.platform`, in the new Firebase project.
- The generated native copy at `apps/mobile/ios/UmurEmas/GoogleService-Info.plist` was updated too, so an immediate local Xcode build uses the same project.

## Verification

- Compared the supplied configuration's registered Android package with both Expo and Gradle application IDs.
- Confirmed all three use `com.children.platform`.
- Confirmed the local source and native copies match the supplied file byte-for-byte.
- Confirmed the new iOS configuration has the expected bundle ID and Firebase iOS App ID, and that its source and native copies match the supplied file byte-for-byte.

## Follow-up

- Add the release signing certificate SHA-1 and SHA-256 to the same Firebase Android application once the release keystore configuration is final.
- Provide the ignored iOS Firebase configuration to CI before an iOS native build.
