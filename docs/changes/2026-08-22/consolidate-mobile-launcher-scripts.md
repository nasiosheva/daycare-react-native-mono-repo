# Consolidate per-environment launcher scripts into one file per platform

## Behavior change

Replaced the per-environment/per-purpose launcher scripts with one
interactive script per concern:

- `run-android-dev.sh` / `run-android-local.sh` / `run-android-prod.sh` →
  **`run-android.sh`**
- `run-ios-dev.sh` / `run-ios-local.sh` / `run-ios-prod.sh` → **`run-ios.sh`**
- `run-web-dev.sh` / `run-web-local.sh` / `run-web-prod.sh` /
  `run-web-local-stack.sh` → **`run-web.sh`**
- `build-android-release-apk.sh` / `build-android-release-aab.sh` →
  **`build-android.sh`** (also gained a Debug build type; see below)
- `clean-android-build.sh` / `clean-ios-build.sh` → **`clean-mobile-build.sh`**
  (asks Android only / iOS only / both)

Every unified script always prompts interactively; none accept a CLI
argument to skip the prompt for direct use (`build-android.sh` additionally
accepts positional arguments, but only as an internal, undocumented-for-users
mechanism so `run-android.sh` can drive a Release build without
re-prompting — see below).

## New behavior, on top of consolidation

- **`run-android.sh`** targets **physical devices only** — emulators are
  intentionally excluded (filtered out by the `emulator-*` serial naming
  convention adb itself uses, since this project has no use for one). It
  lists every connected/authorized physical device and asks which one to
  target whenever more than one is available, for every environment
  (previously this selection only existed in the old
  `run-android-local.sh`; `dev`/`prod` had no selection and would simply fail
  with adb's own "more than one device" error).
- **`run-ios.sh`** is a full pivot: physical iPhones are no longer supported.
  It lists every currently **booted Simulator** and asks which one to target
  when more than one is booted. Previously this launcher family required a
  pre-configured `IOS_DEVICE_UDID` for a physical iPhone in the environment
  file and explicitly rejected simulators.
- **`run-android.sh`** now asks, up front, whether to run a **Debug**
  dev-client build (Metro-connected, as before) or install a **Release**
  build — independent of the environment (local/dev/prod) chosen next, so a
  Debug build can target the prod API and a Release build can target the
  local API. `run-ios.sh` keeps a single (Debug, dev-client) path; it did
  not gain a Release-install option in this change.
- **`run-android.sh`**'s Release path builds a signed APK via
  `build-android.sh` (calling it non-interactively with the resolved build
  type/format/environment as positional arguments), then `adb install -r`s
  and launches it directly — no Metro, no dev-client. Its Debug path is
  unchanged: delegates to `run-mobile.sh` as before.
- Both `run-android.sh` and `run-ios.sh` ask, after target selection,
  whether to uninstall the existing app first or install/update over it —
  for every environment and (for Android) every build type. This did not
  exist before in any form.
- **`build-android.sh`** gained a **Debug** build type alongside the
  existing Release APK/AAB flow. Debug requires no release signing setup and
  produces `apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk`,
  signed with the ordinary auto-generated debug keystore (the same
  `signingConfigs.debug` block `apps/mobile/android/app/build.gradle`
  already had) — useful for handing someone an installable build without a
  full dev-client session. Build type and environment are fully independent:
  `EXPO_PUBLIC_APP_ENV=production` is now only required when the **prod**
  environment specifically is selected, regardless of build type — a Release
  build against `local`/`dev` is now possible, and so is a Debug build
  against `prod`.
- For the local environment, `run-android.sh`, `run-ios.sh`, and `run-web.sh`
  all start the local API in the background via `run-backend-local.sh` when
  it is not already responding, reusing an already-running one untouched.
  `run-web.sh` also stops the backend on exit if it was the one that started
  it (carried over from the old `run-web-local-stack.sh`);
  `run-android.sh`/`run-ios.sh` leave a backend they started running after
  exit (carried over from the old `run-android-local.sh`'s existing
  reasoning — a mobile dev session ending via Ctrl+C should not tear down
  the API out from under a still-installed app).

## Why

The old file-per-environment layout meant device/target selection and the
uninstall/install question would have needed to be duplicated (or newly
added) across every environment variant per platform. Consolidating first,
then adding the new interactive steps once per platform, avoided that
duplication and matches how `run-android-local.sh` already handled device
selection and backend auto-start before this change — that script's approach
was generalized to all three platforms and every environment instead of only
`local`. Decoupling build type from environment (both for `build-android.sh`
and `run-android.sh`) removes an arbitrary restriction: nothing about
Android's Debug/Release build types is actually tied to which backend a
build talks to.

## Mechanics

- `run-mobile.sh` remains the shared execution engine for the Debug/dev-client
  path (env file loading, workspace dependency sync, native config
  fingerprinting, Android signing backup/restore, `adb reverse`, log
  streaming, the actual `expo`/`gradlew` invocations). The new per-platform
  scripts do interactive setup, then `exec` into it with the resolved
  environment for Debug, or call `build-android.sh` + `adb install` directly
  for Android Release.
- `run-mobile.sh` preserves an already-exported `IOS_DEVICE_UDID` across
  sourcing the environment file, instead of letting a stale/blank line in
  `.env.dev`/`.env.prod` silently override the interactively-selected
  simulator. Its iOS device check now only accepts a booted Simulator's
  UDID (`xcrun simctl list devices booted`), not a physical device's.
- For iOS local runs, `run-mobile.sh` overrides `EXPO_PUBLIC_API_URL` to
  `http://localhost:8080/api/v1` (a Simulator shares the host Mac's network
  stack) — the iOS equivalent of Android's `adb reverse` convenience, which
  has no direct counterpart for a physical device (out of scope here anyway,
  since physical iPhones are no longer supported by `run-ios.sh`).
- Booted Simulators are enumerated via `xcrun simctl list devices booted -j`,
  parsed with a small inline `node -e` script (JSON, more robust than parsing
  `simctl`'s human-readable text output).
- Android's physical-device filter: `adb devices -l` excluding serials
  matching `emulator-*`. Android's uninstall check: `adb shell pm list
  packages <applicationId>`. iOS's: `xcrun simctl get_app_container <udid>
  <bundleId>`.
- `build-android.sh` accepts optional positional arguments
  (`<debug|release> [apk|aab] <local|dev|prod>`, format required only for
  release) purely so `run-android.sh` can drive a non-interactive Release
  build; with zero arguments it prompts for all three in order (build type →
  format if release → environment).

## Verification

- `sh -n` syntax-checked on every changed/new script:
  `run-android.sh`, `run-web.sh`, `run-ios.sh`, `run-mobile.sh`,
  `build-android.sh`, `clean-mobile-build.sh`.
- The booted-Simulator JSON parsing, the interactive list/select/cut-by-tab
  logic, and `build-android.sh`'s positional-argument parsing were each
  exercised in isolation against synthetic input (fake `simctl -j` JSON,
  fake device lists, fake CLI args) to confirm correct parsing and
  selection, since these are genuinely new logic rather than code moved
  unchanged from an existing script.
- Confirmed `apps/mobile/android/app/build.gradle`'s `debug` build type uses
  its own pre-existing `signingConfigs.debug` block, untouched by
  `build-android.sh`'s release-signing init script (which only ever patches
  the `release` signing config), so Debug builds need no new signing setup.
- **Not run end-to-end** against a real device, emulator, or Simulator, and
  no build (`build-android.sh` in either build type) was run to produce a
  real artifact — no Android/iOS SDK or connected hardware was available in
  this environment. Exercise the full flow (build type → environment →
  device/simulator list → backend check → uninstall/install prompt → actual
  build/run) on a real machine before relying on this for anything beyond
  local development.

## Follow-up

- `README.md` and `docs/android-release-apk.md` were updated to the new
  script names and behavior. `docs/changes/*` entries dated before this one
  that mention the old script names are left as historical record, per this
  repo's existing convention (e.g. `docs/changes/2026-07-26/*`,
  `docs/changes/2026-07-27/*` already do the same for earlier renames).
- `.claude/settings.local.json` still has a few stale Bash-permission
  allowlist entries referencing the deleted file names; harmless (they will
  simply never match again) and left alone as local session config outside
  this change's scope.
