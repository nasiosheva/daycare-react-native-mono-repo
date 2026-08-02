# Cross-platform current-location module (ready-wire, not yet used by any screen)

## Context

User request: a reusable module to fetch the device's current GPS location — foreground-only, one-shot on demand (not continuous/background tracking) — ready for any future screen to import, but not wired into any screen in this change.

## Changes

- New `apps/mobile/src/location/` module, mirroring the existing `image-picker`/`audio` cross-platform hook pattern exactly: `types.ts` (framework-free shared types/factories, unit-testable in plain Node), `useCurrentLocation.native.ts` (`expo-location`), `useCurrentLocation.web.ts` (`navigator.geolocation` + Google Geocoding API), and `index.ts`/`index.native.ts`/`index.web.ts` barrels resolved automatically by Metro's platform-extension convention.
- `useCurrentLocation()` returns `{ status, location, error, getCurrentLocation(), clear() }`, matching the `{status, data, error, actions}` shape used by every sibling hook in this codebase. `getCurrentLocation()` does nothing until called — no passive/mount-time permission requests or fetches.
- Native: `Location.requestForegroundPermissionsAsync()` + one-shot `Location.getCurrentPositionAsync()` (never `watchPositionAsync`, never background permissions), then best-effort `Location.reverseGeocodeAsync()` for the address.
- Web: one-shot `navigator.geolocation.getCurrentPosition()` (never `watchPosition`), with an `"unsupported"` status for browsers/contexts without the API, then best-effort reverse geocoding via the Google Maps Geocoding API.
- Reverse geocoding is best-effort on both platforms: if it fails (no network, no API key configured, quota exceeded, etc.), the call still succeeds with `location.address: null` — the primary ask (coordinates) isn't blocked by the address enrichment step.
- New optional env var `EXPO_PUBLIC_GOOGLE_MAPS_GEOCODING_API_KEY` (added to `env.ts`, `.env.example`, `.env`, `.env.dev`), documented in `README.md`. Native reverse geocoding needs no key. Requires enabling the Geocoding API (with billing) on the same Google Cloud project as Firebase, then restricting the key to that API/the app's domain.
- `apps/mobile/app.json`: new `expo-location` plugin entry with `locationWhenInUsePermission` only — deliberately no background/`Always` permission string, so the declared capability stays honestly foreground-only.
- `apps/mobile/package.json`: added `expo-location` via `npx expo install expo-location` (resolves the SDK-53-compatible version automatically).
- `docs/business-rules.md` not updated — this module has no business rule yet since nothing consumes it.

## Verification

- `cd apps/mobile && npx tsc --noEmit -p .` — clean; also confirms every `expo-location` API call used (`requestForegroundPermissionsAsync`, `getCurrentPositionAsync`, `Accuracy.Balanced`, `reverseGeocodeAsync`) matches the installed package's real types.
- `pnpm typecheck` and `pnpm test` from the repo root — clean, including a new `apps/mobile/src/location/types.test.ts` (4 tests: `createCurrentLocation` shape incl. null accuracy/address, `mapWebGeolocationErrorCode` table-driven for codes 1/2/3/unrecognized).
- Per an explicit decision with the user, no dev-only or demo screen was created to manually exercise real GPS/geocoding — that live verification is deferred to whichever screen adopts this module first.
- No `apps/mobile/app/*.tsx` file was touched in this change.
