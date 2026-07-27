# Local backend restart launcher

## Change

- `./scripts/run-backend-local.sh` now replaces a running local API owned by this checkout instead of exiting merely because its health endpoint is ready.
- The launcher verifies the process command before sending a normal termination signal. A different service on port 8080 is left untouched and reported as a blocking conflict.

## Behavior

- Re-running the command starts the current backend source after the previous repository-owned API releases port 8080.
- The API remains foreground-owned by the launcher terminal and still stops with `Ctrl+C`.

## Verification

- Shell syntax check covers the modified launcher.
- A local restart verifies that the previous repository-owned listener is stopped before the replacement API becomes ready.
