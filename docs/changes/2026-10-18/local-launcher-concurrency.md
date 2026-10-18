<!-- Mories Deo Hutapea,S.E.,S.Kom -->
# Local Web and Android launcher concurrency

## Change

- Web Metro keeps its default port `8081`; Android Debug uses `8082` and maps that port through ADB reverse. The Android launcher only clears a stale project Metro on its own port, so starting either client no longer terminates the other client's Metro process.
- Web and Android use one shared local API startup helper. Each launcher first reuses a healthy API; if this checkout's API is already listening but still booting, it waits for readiness and reuses that process. A per-checkout atomic lock prevents both launchers from racing to boot duplicate APIs. API startup is detached and remains available when either client launcher exits; `scripts/stop-backend-local.sh` stops it only after confirming the listener belongs to this checkout.
- README local launcher guidance now documents the shared API lifecycle and dedicated Metro ports.

## Verification

- Test-first: `sh scripts/tests/launcher-concurrency.test.sh` failed before implementation because the shared Metro-port configuration did not exist.
- Green: `sh scripts/tests/launcher-concurrency.test.sh` verifies reuse of a ready API, waiting/reuse of an API that is still booting, and two concurrent launchers starting exactly one mock API process.
- Green: `sh -n scripts/run-web.sh scripts/run-android.sh scripts/run-mobile.sh scripts/lib/local-api.sh scripts/lib/metro-ports.sh scripts/stop-backend-local.sh scripts/tests/launcher-concurrency.test.sh` passed.
- Green: `corepack pnpm --filter @daycare/app exec expo start --help` confirmed Expo CLI supports `--port` for Android (and states it does not apply to Web, which keeps its default port `8081`).
- Device/browser concurrent launch was not run in this change; Android concurrency still needs a connected device smoke test.
