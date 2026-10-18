# Mories Deo Hutapea,S.E.,S.Kom
# Shared, persistent local API lifecycle for the Web and Android launchers.

local_api_ready() {
  curl --silent --fail --max-time 2 http://localhost:8080/api/v3/api-docs >/dev/null 2>&1
}

local_api_port_pid() {
  lsof -ti tcp:8080 -sTCP:LISTEN 2>/dev/null | head -n 1
}

local_api_process_belongs_to_repository() {
  local_api_process_pid=$1
  local_api_process_command=$(ps -p "$local_api_process_pid" -o command= 2>/dev/null || true)
  case "$local_api_process_command" in
    *"$local_api_repository_root/apps/api"*|*com.daycare.api.DaycareApplicationKt*)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

local_api_release_start_lock() {
  [ -n "${local_api_lock_dir:-}" ] || return
  if [ "$(cat "$local_api_lock_dir/pid" 2>/dev/null || true)" = "$$" ]; then
    rm -f "$local_api_lock_dir/pid"
    rmdir "$local_api_lock_dir" 2>/dev/null || true
  fi
  local_api_lock_dir=""
}

ensure_local_api() {
  local_api_repository_root=$1
  local_api_backend_launcher=$2
  local_api_log_file=$3
  local_api_started_pid=""

  if local_api_ready; then
    echo "Reusing local API at http://localhost:8080/api." >&2
    return
  fi

  if ! command -v curl >/dev/null 2>&1 || ! command -v lsof >/dev/null 2>&1 || ! command -v ps >/dev/null 2>&1; then
    echo "curl, lsof, and ps are required to start or reuse the local API safely." >&2
    return 1
  fi

  local_api_lock_key=$(printf '%s' "$local_api_repository_root" | cksum | awk '{ print $1 }')
  local_api_lock_dir="${TMPDIR:-/tmp}/daycare-local-api-$local_api_lock_key.lock"
  local_api_waited_seconds=0
  local_api_timeout_seconds=${LOCAL_API_WAIT_TIMEOUT_SECONDS:-300}

  while ! mkdir "$local_api_lock_dir" 2>/dev/null; do
    if local_api_ready; then
      echo "Reusing local API started by another launcher." >&2
      local_api_lock_dir=""
      return
    fi

    local_api_lock_owner=$(cat "$local_api_lock_dir/pid" 2>/dev/null || true)
    case "$local_api_lock_owner" in
      '')
        if [ "$local_api_waited_seconds" -ge 2 ]; then
          rmdir "$local_api_lock_dir" 2>/dev/null || true
          continue
        fi
        ;;
      *[!0-9]*) ;;
      *)
        if ! kill -0 "$local_api_lock_owner" >/dev/null 2>&1; then
          rm -f "$local_api_lock_dir/pid"
          rmdir "$local_api_lock_dir" 2>/dev/null || true
          continue
        fi
        ;;
    esac

    if [ "$local_api_waited_seconds" -ge "$local_api_timeout_seconds" ]; then
      echo "Timed out waiting for another launcher to start the local API." >&2
      return 1
    fi
    sleep 2
    local_api_waited_seconds=$((local_api_waited_seconds + 2))
  done

  printf '%s\n' "$$" >"$local_api_lock_dir/pid"

  if local_api_ready; then
    local_api_release_start_lock
    echo "Reusing local API at http://localhost:8080/api." >&2
    return
  fi

  local_api_existing_pid=$(local_api_port_pid || true)
  if [ -n "$local_api_existing_pid" ]; then
    if ! local_api_process_belongs_to_repository "$local_api_existing_pid"; then
      echo "Port 8080 is in use by PID $local_api_existing_pid, which is not this repository's local API. Stop or repair that process first." >&2
      local_api_release_start_lock
      return 1
    fi

    echo "Local API process $local_api_existing_pid is starting; waiting for it to become ready..." >&2
    local_api_waited_seconds=0
    while [ "$local_api_waited_seconds" -lt "$local_api_timeout_seconds" ]; do
      if local_api_ready; then
        echo "Reusing the existing local API at http://localhost:8080/api." >&2
        local_api_release_start_lock
        return
      fi

      local_api_current_pid=$(local_api_port_pid || true)
      if [ -z "$local_api_current_pid" ]; then
        break
      fi
      if [ "$local_api_current_pid" != "$local_api_existing_pid" ] && ! local_api_process_belongs_to_repository "$local_api_current_pid"; then
        echo "Port 8080 changed to PID $local_api_current_pid while waiting; refusing to start another process." >&2
        local_api_release_start_lock
        return 1
      fi

      sleep 2
      local_api_waited_seconds=$((local_api_waited_seconds + 2))
    done

    if local_api_ready; then
      echo "Reusing the existing local API at http://localhost:8080/api." >&2
      local_api_release_start_lock
      return
    fi

    local_api_current_pid=$(local_api_port_pid || true)
    if [ -n "$local_api_current_pid" ]; then
      echo "The existing local API process did not become ready within ${local_api_timeout_seconds}s. Check its logs before retrying." >&2
      local_api_release_start_lock
      return 1
    fi
  fi

  if [ ! -x "$local_api_backend_launcher" ]; then
    echo "Missing executable local API launcher at $local_api_backend_launcher." >&2
    local_api_release_start_lock
    return 1
  fi

  echo "Starting shared local API in the background..." >&2
  nohup "$local_api_backend_launcher" >>"$local_api_log_file" 2>&1 </dev/null &
  local_api_started_pid=$!
  local_api_waited_seconds=0

  while [ "$local_api_waited_seconds" -lt "$local_api_timeout_seconds" ]; do
    if local_api_ready; then
      echo "Local API is ready at http://localhost:8080/api." >&2
      local_api_release_start_lock
      return
    fi

    if ! kill -0 "$local_api_started_pid" >/dev/null 2>&1; then
      echo "Local API exited before becoming ready. Check $local_api_log_file." >&2
      local_api_release_start_lock
      return 1
    fi

    sleep 2
    local_api_waited_seconds=$((local_api_waited_seconds + 2))
  done

  echo "Local API did not become ready within ${local_api_timeout_seconds}s. Check $local_api_log_file." >&2
  local_api_release_start_lock
  return 1
}
