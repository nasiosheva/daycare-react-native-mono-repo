# Daycare Backend Launcher (standalone, not wired to `apps/` yet)

A native Android app (Kotlin + Compose) that gives a friendly start/stop/status
UI for running this repo's `apps/api` backend directly on an Android device,
via Termux — for offline demos where a real server isn't available.

This lives outside `apps/` intentionally and is **not** referenced by the root
`pnpm-workspace.yaml`, `apps/mobile`, or `apps/api`. It has its own Gradle
build and is meant to be opened as its own project in Android Studio.

## Why Termux

A normal Android app process runs on ART, not a JVM, and cannot directly
execute a Spring Boot jar. Termux provides a genuine Linux userland (real
OpenJDK binaries) on-device without root. This app never asks the user to
open a Termux terminal — it drives Termux entirely through its documented
[RUN_COMMAND Intent API](https://github.com/termux/termux-app/wiki/RUN_COMMAND-Intent).

## What's implemented

- `TermuxAvailability` / `TermuxCommandExecutor` — detect Termux + the
  `RUN_COMMAND` permission, and fire scripts into Termux via `bash -c` (so no
  file needs to already exist inside Termux's sandboxed home directory).
- Four scripts bundled as assets, run inline in Termux:
  - `setup.sh` — installs `openjdk-21` + `postgresql`, initializes the data
    directory, creates a `daycare`/`daycare` role and database (matching
    `apps/api`'s own fallback defaults, so the jar needs no extra env vars).
  - `start.sh` / `stop.sh` / `status.sh` — start/stop Postgres + the jar,
    tracked via a PID file.
- `BackendStatusChecker` — polls `http://127.0.0.1:8080/api/v1/actuator/health`
  directly from the app; this, not Termux's own process state, is what the UI
  trusts.
- `MainActivity` — a linear setup checklist (install Termux → grant
  `RUN_COMMAND` → one manual toggle inside Termux itself → run setup) followed
  by Start / Stop and a live-ish status line.

## What's deliberately NOT done yet

- **No automatic jar delivery.** `apps/api`'s build output is not copied into
  this app or pushed to the device automatically. Build it yourself
  (`./gradlew bootJar` in `apps/api`) and manually place the jar at
  `/data/data/com.termux/files/home/backend-launcher/api.jar` inside Termux
  (`adb push` to shared storage, then move it in Termux, or use
  `termux-setup-storage` + `cp`). Wiring this into the monorepo's build
  (turbo/pnpm scripts, or bundling the jar as an asset) is a separate,
  deliberate follow-up once this is confirmed to actually work end to end.
- **No live log viewer.** Termux's RUN_COMMAND API can return stdout/stderr
  for short synchronous commands via a `PendingIntent`, but `start.sh` is a
  long-running background command, so this app doesn't attempt to tail logs.
  Use the "Buka Termux" button to inspect `~/backend-launcher/api.log` /
  `postgres.log` manually if something looks wrong.
- **Not built or run yet.** This was scaffolded without an Android SDK /
  device available in this environment. There is no `gradlew` binary
  checked in either — open this folder in Android Studio once (it will
  regenerate the wrapper jar) or run `gradle wrapper --gradle-version 8.13`
  manually before building from the command line.
- **Not verified against Termux's exact current RUN_COMMAND extras.** The
  Intent extra keys used here (`RUN_COMMAND_PATH`, `RUN_COMMAND_ARGUMENTS`,
  `RUN_COMMAND_BACKGROUND`, `RUN_COMMAND_COMMAND_LABEL`) match Termux's
  documented plugin API, but Termux is a third-party app whose installed
  version on your test device may differ — verify against the wiki linked
  above if RUN_COMMAND calls silently do nothing.

## One-time manual setup on the device

1. Install Termux from **F-Droid** (not Play Store — that build is outdated
   and can't run RUN_COMMAND from other apps reliably).
2. Open Termux once, run `termux-setup-storage`, accept the permission.
3. Edit `~/.termux/termux.properties`, add `allow-external-apps=true`, then
   run `termux-reload-settings`. This is the one step no external app can do
   for you — Termux requires it be set from inside Termux itself.
4. Install this launcher APK, grant it the `RUN_COMMAND` permission when
   prompted, tap "Jalankan setup", then place `api.jar` and tap "Start
   backend".
