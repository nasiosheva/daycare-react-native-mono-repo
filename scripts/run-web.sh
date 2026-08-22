#!/usr/bin/env sh
# Interactive Web launcher, replacing the old run-web-dev.sh / run-web-local.sh
# / run-web-prod.sh / run-web-local-stack.sh quartet. Asks which environment
# to run instead of requiring a different file per environment. For the local
# environment, it reuses an already-running local API if one is responding,
# or starts one in the background otherwise — and if this launcher was the
# one that started it, stops it again when the Web session exits, mirroring
# the combined local-stack launcher this replaces.
set -eu

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
repository_root=$(CDPATH= cd -- "$script_dir/.." && pwd)
mobile_launcher="$script_dir/run-mobile.sh"
backend_launcher="$script_dir/run-backend-local.sh"
backend_pid=""
started_backend=false

prompt_environment() {
  echo "Select an environment:" >&2
  echo "  1) local" >&2
  echo "  2) dev" >&2
  echo "  3) prod" >&2
  printf 'Environment [1-3]: ' >&2
  read -r selection </dev/tty
  case "$selection" in
    1) selected_environment=local ;;
    2) selected_environment=dev ;;
    3) selected_environment=prod ;;
    *)
      echo "Invalid selection: $selection" >&2
      exit 1
      ;;
  esac
}

local_api_ready() {
  curl --silent --fail --max-time 2 http://localhost:8080/api/v3/api-docs >/dev/null 2>&1
}

local_api_port_pid() {
  lsof -ti tcp:8080 -sTCP:LISTEN 2>/dev/null | head -n 1
}

stop_started_backend() {
  if [ "$started_backend" != "true" ] || [ -z "$backend_pid" ]; then
    return
  fi

  if ! kill -0 "$backend_pid" >/dev/null 2>&1; then
    return
  fi

  echo "Stopping local API started by this launcher (PID $backend_pid)..." >&2
  kill "$backend_pid" >/dev/null 2>&1 || true
  wait "$backend_pid" >/dev/null 2>&1 || true
}

cleanup() {
  trap - EXIT INT TERM HUP
  stop_started_backend
}

wait_for_started_backend() {
  local_api_waited_seconds=0
  local_api_timeout_seconds=${LOCAL_API_WAIT_TIMEOUT_SECONDS:-300}

  echo "Waiting for local API at http://localhost:8080/api..." >&2
  while [ "$local_api_waited_seconds" -lt "$local_api_timeout_seconds" ]; do
    if local_api_ready; then
      echo "Local API is ready at http://localhost:8080/api." >&2
      return
    fi

    if ! kill -0 "$backend_pid" >/dev/null 2>&1; then
      wait "$backend_pid" >/dev/null 2>&1 || true
      echo "Local API exited before becoming ready." >&2
      exit 1
    fi

    sleep 2
    local_api_waited_seconds=$((local_api_waited_seconds + 2))
  done

  echo "Local API did not become ready at http://localhost:8080/api within ${local_api_timeout_seconds}s." >&2
  exit 1
}

ensure_local_backend() {
  if ! command -v curl >/dev/null 2>&1; then
    echo "curl is required to verify the local API. Install curl, then run this launcher again." >&2
    exit 1
  fi

  if [ ! -x "$backend_launcher" ]; then
    echo "Missing executable launcher at $backend_launcher." >&2
    exit 1
  fi

  trap cleanup EXIT
  trap 'exit 130' INT TERM HUP

  if local_api_ready; then
    echo "Reusing the local API already running at http://localhost:8080/api." >&2
    return
  fi

  existing_api_pid=$(local_api_port_pid || true)
  if [ -n "$existing_api_pid" ]; then
    echo "Port 8080 is in use by PID $existing_api_pid, but the local API is not ready." >&2
    echo "Stop or repair that process before running this launcher." >&2
    exit 1
  fi

  echo "Starting local API in the background..." >&2
  "$backend_launcher" &
  backend_pid=$!
  started_backend=true
  wait_for_started_backend
}

prompt_environment

if [ "$selected_environment" = "local" ]; then
  ensure_local_backend
fi

"$mobile_launcher" web "$selected_environment"
