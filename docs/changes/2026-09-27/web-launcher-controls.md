# Web launcher runtime controls

## Change

- `scripts/run-web.sh` now keeps the Expo Web process under the launcher and reads runtime controls from the same terminal.
- Press `s` to stop the Web session like Ctrl+C.
- Press `r` to stop the current Web process and start it again with a cleared Metro cache, providing a predictable frontend rebuild for local, development, and production environment runs.
- Existing local-backend ownership behavior is preserved: only an API process started by this launcher is stopped during cleanup.

## Verification

- `sh -n scripts/run-web.sh scripts/run-mobile.sh scripts/lib/interactive-menu.sh`
- `git diff --check`

## Follow-up

- A live Web session should be exercised locally to confirm the terminal hotkeys against the installed Expo CLI version.
