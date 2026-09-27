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
. "$script_dir/lib/session-log.sh"
. "$script_dir/lib/interactive-menu.sh"
mobile_launcher="$script_dir/run-mobile.sh"
backend_launcher="$script_dir/run-backend-local.sh"
backend_pid=""
web_pid=""
started_backend=false

prompt_environment() {
  interactive_menu_select "Select an environment" local dev prod
  case "$interactive_menu_selected_index" in
    1) selected_environment=local ;;
    2) selected_environment=dev ;;
    3) selected_environment=prod ;;
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

stop_web_session() {
  if [ -z "$web_pid" ] || ! kill -0 "$web_pid" >/dev/null 2>&1; then
    web_pid=""
    return
  fi

  echo "Stopping Web session (PID $web_pid)..." >&2
  kill -INT "$web_pid" >/dev/null 2>&1 || true
  wait "$web_pid" >/dev/null 2>&1 || true
  web_pid=""
}

cleanup() {
  trap - EXIT INT TERM HUP
  interactive_menu_restore
  stop_web_session
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

start_web_session() {
  if [ "${rebuild_web_session:-false}" = "true" ]; then
    DAYCARE_WEB_CLEAR_CACHE=true "$mobile_launcher" web "$selected_environment" </dev/null &
    rebuild_web_session=false
  else
    "$mobile_launcher" web "$selected_environment" </dev/null &
  fi
  web_pid=$!
}

run_web_session() {
  echo "Controls: s stop, r rebuild Web frontend." >&2
  interactive_menu_begin
  while :; do
    if [ -z "$web_pid" ] || ! kill -0 "$web_pid" >/dev/null 2>&1; then
      interactive_menu_restore
      web_exit_status=0
      if [ -n "$web_pid" ]; then
        wait "$web_pid" || web_exit_status=$?
        web_pid=""
      fi
      return "$web_exit_status"
    fi

    interactive_menu_read_timed_key
    case "$interactive_menu_key" in
      stop)
        interactive_menu_restore
        stop_web_session
        return 0
        ;;
      reload_frontend)
        interactive_menu_restore
        echo "Rebuilding Web frontend..." >&2
        stop_web_session
        rebuild_web_session=true
        start_web_session
        interactive_menu_begin
        ;;
    esac
  done
}

prompt_environment
start_session_log "$repository_root" "web-$selected_environment"

if [ "$selected_environment" = "local" ]; then
  ensure_local_backend
fi

start_web_session
run_web_session
