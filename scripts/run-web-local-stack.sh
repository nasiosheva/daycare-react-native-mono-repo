#!/usr/bin/env sh

set -eu

repository_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
backend_launcher="$repository_root/scripts/run-backend-local.sh"
web_launcher="$repository_root/scripts/run-web-local.sh"
backend_pid=""
started_backend=false

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

  echo "Stopping local API started by this launcher (PID $backend_pid)..."
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

  echo "Waiting for local API at http://localhost:8080/api..."
  while [ "$local_api_waited_seconds" -lt "$local_api_timeout_seconds" ]; do
    if local_api_ready; then
      echo "Local API is ready at http://localhost:8080/api."
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

if ! command -v curl >/dev/null 2>&1; then
  echo "curl is required to verify the local API. Install curl, then run this launcher again." >&2
  exit 1
fi

if [ ! -x "$backend_launcher" ] || [ ! -x "$web_launcher" ]; then
  echo "Missing executable local launchers in $repository_root/scripts." >&2
  exit 1
fi

trap cleanup EXIT
trap 'exit 130' INT TERM HUP

if local_api_ready; then
  echo "Reusing local API at http://localhost:8080/api."
else
  existing_api_pid=$(local_api_port_pid || true)
  if [ -n "$existing_api_pid" ]; then
    echo "Port 8080 is in use by PID $existing_api_pid, but the local API is not ready." >&2
    echo "Stop or repair that process before running this combined launcher." >&2
    exit 1
  fi

  echo "Starting local API in the background..."
  "$backend_launcher" &
  backend_pid=$!
  started_backend=true
  wait_for_started_backend
fi

echo "Starting local Expo Web. Press Ctrl+C to stop the Web launcher."
"$web_launcher"
