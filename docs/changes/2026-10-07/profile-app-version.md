# Profile app version

## Scope

- Profile now shows the version and native build/version code of the currently running application binary for every role as one centered, muted text line; it does not create a separate card. A second centered line shows a localized Usia Emas copyright with the current year.
- The values are informational only. They do not alter authentication, authorization, tenant selection, or any business workflow.

## Source of truth

- Android reads `versionName` and `versionCode` from the installed native binary.
- iOS reads `CFBundleShortVersionString` and `CFBundleVersion` from the installed native binary.
- Web has no native build code. It displays the configured app version when available and uses the normal no-data label for version code.

## Implementation and validation

- `expo-application` is a direct mobile dependency so version metadata is not duplicated in the Profile UI.
- The version resolver is unit-tested independently of Expo native modules; labels resolve for every supported locale.
- Rebuild an Android or iOS development/release binary after adding this native dependency before validating the values on a device.
