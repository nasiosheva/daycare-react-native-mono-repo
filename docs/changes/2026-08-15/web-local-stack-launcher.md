# Local Web stack launcher

## Change

- Added `scripts/run-web-local-stack.sh` for starting the local API and Expo Web from one terminal.
- The launcher reuses a healthy API. When the API is unavailable and port 8080 is free, it starts the existing backend launcher in the background and waits for the OpenAPI readiness endpoint before starting Web.
- If port 8080 is occupied but its local OpenAPI endpoint is unhealthy, the launcher fails without stopping or replacing that process.
- Cleanup stops only the backend process started by the combined launcher.

## Affected behavior

- `scripts/run-web-local.sh` remains an independent Web-only launcher and does not manage the API process.
- Developers can use `./scripts/run-web-local-stack.sh` when one terminal is preferred.

## Verification

- Shell syntax is checked with `sh -n`.
- Ran the launcher while port 8080 was occupied and the local OpenAPI endpoint was unhealthy; it exited with the documented error without replacing that process.
- The healthy-API reuse and fresh-backend paths remain exercised through the existing launchers' readiness checks during normal local use.

## Follow-up

- The combined launcher intentionally keeps the existing backend and Web launchers as its single sources of environment and runtime validation.
