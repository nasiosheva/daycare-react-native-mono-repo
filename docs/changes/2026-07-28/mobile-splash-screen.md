# Mobile splash screen

## Change

- Added the Expo native splash-screen module and configured `apps/mobile/app.json` to use the existing Usia Emas logo on a white background for Android and iOS.
- The root Expo Router layout prevents the native splash from closing until the local session restore and Firebase identity observation complete, then fades it out after the first rendered frame.
- The gate is explicitly disabled on web, so the existing web startup behavior is unchanged.

## Affected behavior

- Android and iOS development or release builds show a consistent launch screen even after their generated native projects are recreated.
- A slow profile request does not keep the splash visible indefinitely; the existing Home loading or profile-error state remains responsible after bootstrap.

## Verification

- `corepack pnpm --filter @daycare/app typecheck`
- `corepack pnpm --filter @daycare/app exec expo config --type prebuild`

## Follow-up

- Any future replacement of the splash asset must update the Expo configuration and be followed by the relevant Android or iOS launcher so the ignored generated native project is synchronized.
