#!/usr/bin/env sh
# Interactive Web launcher, replacing the old run-web-dev.sh / run-web-local.sh
# / run-web-prod.sh / run-web-local-stack.sh quartet. Asks which environment
# to run instead of requiring a different file per environment. For the local
# environment, it reuses an already-running local API if one is responding,
# or starts a shared background API otherwise. The API remains available to
# other local clients when the Web session exits.
# Mories Deo Hutapea,S.E.,S.Kom
set -eu

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
repository_root=$(CDPATH= cd -- "$script_dir/.." && pwd)
. "$script_dir/lib/session-log.sh"
. "$script_dir/lib/interactive-menu.sh"
. "$script_dir/lib/local-api.sh"
mobile_launcher="$script_dir/run-mobile.sh"
backend_launcher="$script_dir/run-backend-local.sh"
backend_log_file="$repository_root/daycare-api-local.log"
web_pid=""

prompt_environment() {
  interactive_menu_select "Select an environment" local dev prod
  case "$interactive_menu_selected_index" in
    1) selected_environment=local ;;
    2) selected_environment=dev ;;
    3) selected_environment=prod ;;
  esac
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
}

ensure_local_backend() {
  trap cleanup EXIT
  trap 'exit 130' INT TERM HUP
  ensure_local_api "$repository_root" "$backend_launcher" "$backend_log_file"
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
