# Android launcher session lifetime

## Change

When `run-android.sh` reused a healthy Metro server, `run-mobile.sh` opened the
development client and returned immediately. The parent launcher interpreted
that normal child exit as the end of the session, so the terminal returned to
the shell even though the app had launched successfully.

The local Android runner now keeps its child process alive after opening the
development client against an existing Metro instance. The parent launcher can
therefore continue handling `s`/Ctrl+C, `r`, and `b` and streaming Android logs.
The stop path also falls back to `TERM` when a background shell ignores
`SIGINT`, so cleanup is not left waiting indefinitely.

Before starting a debug session, the launcher now stops only a Metro listener
whose working directory belongs to this repository. This prevents an old
bundle from retaining stale environment values such as
`EXPO_PUBLIC_EXPO_PROJECT_ID`; Metro is then started again with the selected
`.env` file.

## Verification

- `sh -n scripts/run-mobile.sh`
- `sh -n scripts/run-android.sh`
- `git diff --check`

The reported run already showed a successful APK install and `/me` response
`200`; this change addresses only the launcher lifetime after that successful
startup.
