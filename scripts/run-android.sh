#!/usr/bin/env sh
# Interactive Android launcher, replacing the old run-android-dev.sh /
# run-android-local.sh / run-android-prod.sh trio. Beyond delegating to
# run-mobile.sh, this script:
#   1. Asks whether to run a Debug dev-client build (Metro-connected, live
#      reload) or install a real signed Release build, then which
#      environment (local/dev/prod) to use — independent choices, since a
#      Debug build can target the prod API and a Release build can target
#      the local API, whatever combination is actually useful to test.
#   2. Selects which connected/authorized physical device to target when more
#      than one is attached, exporting ANDROID_SERIAL so every bare `adb`
#      call inside run-mobile.sh (reverse, logcat, am start) automatically
#      targets the right one without needing -s everywhere. Emulators are
#      intentionally excluded; only physical devices are supported.
#   3. For the local environment: detects the selected device's Wi-Fi subnet
#      and matches it against the host machine's network interfaces,
#      correcting EXPO_PUBLIC_API_URL in .env when it does not match; and
#      starts the local API in the background via run-backend-local.sh when
#      it is not already responding, so this launcher works standalone
#      without a second terminal. An already-running local API is left
#      untouched and is not stopped when this launcher exits.
#   4. Uses arrow-key menus instead of numeric input, and asks whether to
#      uninstall the existing app from the selected device first. The clean
#      install choice defaults to Yes after five seconds without input.
#   5. Keeps the session controllable from the same terminal: s stops the
#      launcher, r restarts the Android client, and b restarts the local API.
#
# Debug delegates the actual run to run-mobile.sh (dev-client + Metro, as
# before). Release instead builds a signed APK via build-android.sh, then
# installs and launches it directly with adb — no Metro, no dev-client.
set -eu

application_id="com.children.platform"
script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
repository_root=$(CDPATH= cd -- "$script_dir/.." && pwd)
. "$script_dir/lib/session-log.sh"
. "$script_dir/lib/interactive-menu.sh"
environment_file="$repository_root/.env"
run_mobile_pid=""
backend_pid=""
backend_log_file=""

stop_mobile_session() {
  if [ -n "$run_mobile_pid" ] && kill -0 "$run_mobile_pid" >/dev/null 2>&1; then
    kill -INT "$run_mobile_pid" >/dev/null 2>&1 || true
    # A background shell can inherit an ignored SIGINT disposition. Fall back
    # to TERM so the child runner's shutdown trap still gets a chance to clean
    # up Metro and logcat before we wait for it.
    if kill -0 "$run_mobile_pid" >/dev/null 2>&1; then
      kill -TERM "$run_mobile_pid" >/dev/null 2>&1 || true
    fi
    wait "$run_mobile_pid" >/dev/null 2>&1 || true
  fi
  run_mobile_pid=""
}

cleanup_launcher() {
  interactive_menu_restore
  stop_mobile_session
}

trap cleanup_launcher EXIT

restore_terminal() { interactive_menu_restore; }
begin_key_mode() { interactive_menu_begin; }
read_key() { interactive_menu_read_key; menu_key=$interactive_menu_key; }
read_timed_key() { interactive_menu_read_timed_key; menu_key=$interactive_menu_key; }

render_build_type_menu() {
  printf '\033[2J\033[H' >&2
  echo "Select a build type (↑/↓, Enter):" >&2
  if [ "$menu_index" -eq 1 ]; then echo "  > Debug (dev-client, Metro-connected)" >&2; else echo "    Debug (dev-client, Metro-connected)" >&2; fi
  if [ "$menu_index" -eq 2 ]; then echo "  > Release (install a signed build, no Metro)" >&2; else echo "    Release (install a signed build, no Metro)" >&2; fi
  echo "  q/Ctrl+C: cancel" >&2
}

render_environment_menu() {
  printf '\033[2J\033[H' >&2
  echo "Select an environment (↑/↓, Enter):" >&2
  if [ "$menu_index" -eq 1 ]; then echo "  > local" >&2; else echo "    local" >&2; fi
  if [ "$menu_index" -eq 2 ]; then echo "  > dev" >&2; else echo "    dev" >&2; fi
  if [ "$menu_index" -eq 3 ]; then echo "  > prod" >&2; else echo "    prod" >&2; fi
  echo "  q/Ctrl+C: cancel" >&2
}

finish_menu_or_exit() {
  case "$menu_key" in
    cancel)
      restore_terminal
      exit 130
      ;;
  esac
}

prompt_build_type() {
  menu_index=1
  begin_key_mode
  while :; do
    render_build_type_menu
    read_key
    finish_menu_or_exit
    case "$menu_key" in
      up|down)
        if [ "$menu_index" -eq 1 ]; then menu_index=2; else menu_index=1; fi
        ;;
      enter) break ;;
    esac
  done
  restore_terminal
  if [ "$menu_index" -eq 1 ]; then selected_build_type=debug; else selected_build_type=release; fi
}

prompt_environment() {
  menu_index=1
  begin_key_mode
  while :; do
    render_environment_menu
    read_key
    finish_menu_or_exit
    case "$menu_key" in
      up)
        if [ "$menu_index" -eq 1 ]; then menu_index=3; else menu_index=$((menu_index - 1)); fi
        ;;
      down)
        if [ "$menu_index" -eq 3 ]; then menu_index=1; else menu_index=$((menu_index + 1)); fi
        ;;
      enter) break ;;
    esac
  done
  restore_terminal
  case "$menu_index" in
    1) selected_environment=local ;;
    2) selected_environment=dev ;;
    3) selected_environment=prod ;;
  esac
}

ensure_adb() {
  if command -v adb >/dev/null 2>&1; then
    return
  fi

  android_sdk_directory=${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}
  if [ -z "$android_sdk_directory" ] && [ -d "$HOME/Library/Android/sdk" ]; then
    android_sdk_directory="$HOME/Library/Android/sdk"
  fi

  if [ -n "$android_sdk_directory" ] && [ -x "$android_sdk_directory/platform-tools/adb" ]; then
    export PATH="$android_sdk_directory/platform-tools:$PATH"
    return
  fi

  echo "Android SDK platform tools are required. Install Android Studio and set ANDROID_HOME or ANDROID_SDK_ROOT when the SDK is not at the standard macOS location, then run this launcher again." >&2
  exit 1
}

select_android_device() {
  # Emulator serials always follow the "emulator-<port>" pattern; excluding
  # them keeps this launcher targeting physical devices only.
  device_list=$(adb devices -l | awk 'NR>1 && $2=="device" && $1 !~ /^emulator-/ { print }')
  device_serials=$(printf '%s\n' "$device_list" | awk 'NF { print $1 }')

  if [ -z "$device_serials" ]; then
    echo "No authorized physical Android device is connected. Connect a device, accept the USB debugging prompt on it, then run this launcher again." >&2
    exit 1
  fi

  set -- $device_serials
  if [ "$#" -eq 1 ]; then
    selected_android_serial=$1
    return
  fi

  device_count=$#
  menu_index=1
  begin_key_mode
  while :; do
    printf '\033[2J\033[H' >&2
    echo "Select an Android device (↑/↓, Enter):" >&2
    index=1
    for serial in "$@"; do
      model=$(printf '%s\n' "$device_list" | grep "^$serial " | grep -o 'model:[^ ]*' | cut -d: -f2)
      if [ "$index" -eq "$menu_index" ]; then
        echo "  > $serial${model:+ ($model)}" >&2
      else
        echo "    $serial${model:+ ($model)}" >&2
      fi
      index=$((index + 1))
    done
    echo "  q/Ctrl+C: cancel" >&2

    read_key
    finish_menu_or_exit
    case "$menu_key" in
      up)
        if [ "$menu_index" -eq 1 ]; then menu_index=$device_count; else menu_index=$((menu_index - 1)); fi
        ;;
      down)
        if [ "$menu_index" -eq "$device_count" ]; then menu_index=1; else menu_index=$((menu_index + 1)); fi
        ;;
      enter) break ;;
    esac
  done
  restore_terminal
  selected_android_serial=$(printf '%s\n' "$device_serials" | sed -n "${menu_index}p")
}

detect_device_host_ip() {
  device_ip=$(adb -s "$selected_android_serial" shell ip -4 -o addr show wlan0 2>/dev/null | tr -d '\r' | awk '{ print $4 }' | cut -d/ -f1)
  if [ -z "$device_ip" ]; then
    return 1
  fi

  device_subnet=$(printf '%s\n' "$device_ip" | cut -d. -f1-3)

  for host_ip in $(ifconfig | awk '/inet /{ print $2 }'); do
    case "$host_ip" in
      127.*|169.254.*) continue ;;
    esac
    host_subnet=$(printf '%s\n' "$host_ip" | cut -d. -f1-3)
    if [ "$host_subnet" = "$device_subnet" ]; then
      printf '%s\n' "$host_ip"
      return 0
    fi
  done

  return 1
}

sync_local_api_url() {
  [ -f "$environment_file" ] || return

  detected_host_ip=$(detect_device_host_ip) || {
    echo "Could not detect a host network address matching the device's Wi-Fi subnet; leaving EXPO_PUBLIC_API_URL in .env as-is." >&2
    return
  }

  current_api_url=$(sed -n 's/^EXPO_PUBLIC_API_URL=//p' "$environment_file" | tail -n 1)
  detected_api_url="http://$detected_host_ip:8080/api/v1"

  if [ "$current_api_url" = "$detected_api_url" ]; then
    return
  fi

  echo "Device Wi-Fi subnet matches host address $detected_host_ip; updating EXPO_PUBLIC_API_URL in .env (was: ${current_api_url:-unset})." >&2
  tmp_env_file=$(mktemp "$repository_root/.env.XXXXXX")
  awk -v url="$detected_api_url" '
    /^EXPO_PUBLIC_API_URL=/ { print "EXPO_PUBLIC_API_URL=" url; done=1; next }
    { print }
    END { if (!done) print "EXPO_PUBLIC_API_URL=" url }
  ' "$environment_file" >"$tmp_env_file"
  mv "$tmp_env_file" "$environment_file"
}

local_api_ready() {
  curl --silent --fail --max-time 2 http://localhost:8080/api/v3/api-docs >/dev/null 2>&1
}

ensure_local_backend() {
  if ! command -v curl >/dev/null 2>&1; then
    return
  fi

  if local_api_ready; then
    echo "Reusing the local API already running at http://localhost:8080/api." >&2
    return
  fi

  echo "No local API detected at http://localhost:8080/api; starting it in the background." >&2
  backend_log_file="$repository_root/daycare-api-local.log"
  nohup "$script_dir/run-backend-local.sh" >"$backend_log_file" 2>&1 &
  backend_pid=$!
  echo "Started local API in the background (PID $backend_pid, log: $backend_log_file). Waiting for it to become ready is handled by run-mobile.sh next." >&2
}

prompt_uninstall_choice() {
  if ! adb -s "$selected_android_serial" shell pm list packages "$application_id" 2>/dev/null | grep -q "$application_id"; then
    return
  fi

  uninstall_confirmed=false
  menu_index=1
  remaining_seconds=5
  begin_key_mode
  while [ "$remaining_seconds" -gt 0 ]; do
    printf '\033[2J\033[H' >&2
    echo "$application_id is already installed on $selected_android_serial." >&2
    echo "Uninstall before launch? (↑/↓, Enter) — timeout: ${remaining_seconds}s; default: Yes" >&2
    if [ "$menu_index" -eq 1 ]; then echo "  > Yes, uninstall first" >&2; else echo "    Yes, uninstall first" >&2; fi
    if [ "$menu_index" -eq 2 ]; then echo "  > No, install/update existing app" >&2; else echo "    No, install/update existing app" >&2; fi
    echo "  s/Ctrl+C: stop" >&2

    read_timed_key
    case "$menu_key" in
      up|down)
        if [ "$menu_index" -eq 1 ]; then menu_index=2; else menu_index=1; fi
        ;;
      enter)
        uninstall_confirmed=true
        break
        ;;
      cancel|stop)
        restore_terminal
        exit 130
        ;;
      none)
        remaining_seconds=$((remaining_seconds - 1))
        ;;
    esac
  done
  restore_terminal

  if [ "$uninstall_confirmed" != "true" ]; then
    menu_index=1
    echo "No choice received in 5 seconds; defaulting to Yes and uninstalling first." >&2
  fi

  if [ "$menu_index" -eq 1 ]; then
    echo "Uninstalling $application_id from $selected_android_serial..." >&2
    adb -s "$selected_android_serial" uninstall "$application_id" || true
  else
    echo "Keeping the existing $application_id installation." >&2
  fi
}

install_and_launch_release() {
  release_apk_path="$repository_root/apps/mobile/android/app/build/outputs/apk/release/app-release.apk"
  "$script_dir/build-android.sh" release apk "$selected_environment"

  prompt_uninstall_choice

  echo "Installing the release build on $selected_android_serial..." >&2
  adb -s "$selected_android_serial" install -r "$release_apk_path"
  adb -s "$selected_android_serial" shell monkey -p "$application_id" -c android.intent.category.LAUNCHER 1 >/dev/null
}

reload_frontend() {
  if ! adb -s "$selected_android_serial" shell pm list packages "$application_id" 2>/dev/null | grep -q "$application_id"; then
    echo "Cannot reload the frontend because $application_id is not installed." >&2
    return
  fi

  if [ -n "$run_mobile_pid" ]; then
    echo "Restarting the Android frontend and Metro bundle..." >&2
    stop_mobile_session
    start_debug_mobile_session
    return
  fi

  echo "Reloading the Android frontend..." >&2
  adb -s "$selected_android_serial" shell am force-stop "$application_id" >/dev/null 2>&1 || true
  adb -s "$selected_android_serial" shell monkey -p "$application_id" -c android.intent.category.LAUNCHER 1 >/dev/null
}

stop_project_metro() {
  metro_pids=$(lsof -t -iTCP:8081 -sTCP:LISTEN 2>/dev/null || true)
  for metro_pid in $metro_pids; do
    metro_cwd=$(lsof -a -p "$metro_pid" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p' || true)
    case "$metro_cwd" in
      "$repository_root/apps/mobile"|"$repository_root/apps/mobile"/*)
        kill "$metro_pid" >/dev/null 2>&1 || true
        ;;
    esac
  done
}

reload_backend() {
  if [ "$selected_environment" != "local" ]; then
    echo "Backend reload is available only for the local environment." >&2
    return
  fi

  echo "Reloading the local backend..." >&2
  if [ -n "$backend_pid" ] && kill -0 "$backend_pid" >/dev/null 2>&1; then
    kill "$backend_pid" >/dev/null 2>&1 || true
    wait "$backend_pid" >/dev/null 2>&1 || true
  fi

  backend_log_file="$repository_root/daycare-api-local.log"
  nohup "$script_dir/run-backend-local.sh" >"$backend_log_file" 2>&1 &
  backend_pid=$!
  echo "Started the local backend again (PID $backend_pid, log: $backend_log_file)." >&2
}

run_hotkey_session() {
  if [ -n "$run_mobile_pid" ]; then
    echo "Controls: s stop, r reload frontend, b reload local backend." >&2
  else
    echo "Release app launched. Controls: s stop launcher, r restart frontend, b reload local backend." >&2
  fi

  begin_key_mode
  while :; do
    if [ -n "$run_mobile_pid" ] && ! kill -0 "$run_mobile_pid" >/dev/null 2>&1; then
      break
    fi

    read_timed_key
    case "$menu_key" in
      stop)
        echo "Stopping Android launcher..." >&2
        stop_mobile_session
        restore_terminal
        return 0
        ;;
      reload_frontend) reload_frontend ;;
      reload_backend) reload_backend ;;
    esac
  done
  restore_terminal

  if [ -n "$run_mobile_pid" ]; then
    mobile_exit_status=0
    wait "$run_mobile_pid" || mobile_exit_status=$?
    run_mobile_pid=""
    return "$mobile_exit_status"
  fi
}

start_debug_mobile_session() {
  # A reused Metro process keeps the environment that existed when it was
  # started. Restart this repository's own server before every debug session
  # so new public configuration (for example EXPO_PUBLIC_EXPO_PROJECT_ID) is
  # actually present in the bundle sent to the device. Processes belonging to
  # another checkout are left untouched by stop_project_metro().
  stop_project_metro
  "$script_dir/run-mobile.sh" android "$selected_environment" </dev/null &
  run_mobile_pid=$!
}

run_debug_session() {
  start_debug_mobile_session
  run_hotkey_session
}

prompt_build_type
prompt_environment
ensure_adb
select_android_device
export ANDROID_SERIAL="$selected_android_serial"
echo "Using Android device $ANDROID_SERIAL." >&2
android_session_label=$(printf '%s' "$selected_android_serial" | tr -c 'A-Za-z0-9' '-')
start_session_log "$repository_root" "android-${android_session_label}-${selected_build_type}-${selected_environment}"

if [ "$selected_environment" = "local" ]; then
  sync_local_api_url
  ensure_local_backend
fi

if [ "$selected_build_type" = "release" ]; then
  install_and_launch_release
  run_hotkey_session
else
  prompt_uninstall_choice
  run_debug_session
fi
