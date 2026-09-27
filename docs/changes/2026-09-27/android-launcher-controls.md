# Android launcher arrow menus and runtime controls

## Change

Updated the local launchers so build type, environment, device/Simulator, and
install-mode selections use arrow-key menus with Enter instead of numeric
input. `scripts/run-android.sh` keeps the uninstall-before-launch choice at
**Yes** and defaults to uninstalling after five seconds without a confirmed
choice. The shared terminal reader handles one-byte arrow sequences and
timed input consistently across the launchers.

The launcher now keeps a controllable Android session in the same terminal:

- `s` stops the launcher and its debug/dev-client session like Ctrl+C.
- `r` restarts the installed Android frontend.
- `b` restarts the local backend when the selected environment is `local`.

The launcher keeps the existing behavior of leaving a backend running after
the Android session ends; backend reload is explicit and only available for
the local environment.

`scripts/run-backend-local.sh` intentionally remains non-interactive because
it is also started automatically as a child process by the Web and mobile
launchers. It has no selection to convert to an arrow menu.

## Verification

- `sh -n scripts/run-android.sh`
- `sh -n scripts/lib/interactive-menu.sh scripts/run-ios.sh scripts/run-web.sh scripts/run-backend-local.sh`
- `git diff --check`

## Follow-up

Interactive device/Android runtime verification should be performed with a
connected authorized physical device because this launcher intentionally does
not target emulators.
