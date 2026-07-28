# Android local runtime logs

## Change

- Extended `./run-android-local.sh` device-log streaming through the shared mobile launcher.
- The launcher now focuses on `ReactNativeJS`, `AndroidRuntime`, and `System.err`, and prints the latest 200 matching records before following new entries.
- The API client emits structured Android-local request lifecycle logs: method, full URL, HTTP status or network/timeout outcome, and duration.

## Affected behavior

- API request and response outcomes, including a missing request during logout, appear immediately from recent device history and continue in the same terminal that runs Metro for the local Android development client.
- Tokens, request bodies, passwords, OTPs, and uploaded media are intentionally omitted from diagnostic logs.
- The logger remains local-Android-only and is stopped automatically when the launcher exits.

## Verification

- `sh -n scripts/run-mobile.sh`
- Confirm the resulting `adb logcat` filter contains `ReactNativeJS`, `AndroidRuntime`, and `System.err`.
