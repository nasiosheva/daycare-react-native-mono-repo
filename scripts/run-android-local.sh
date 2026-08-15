#!/usr/bin/env sh
# Local Android launcher. Beyond delegating to run-mobile.sh, this script:
#   1. Selects which connected/authorized adb device to target when more than
#      one is attached, exporting ANDROID_SERIAL so every bare `adb` call
#      inside run-mobile.sh (reverse, logcat, am start) automatically targets
#      the right one without needing -s everywhere.
#   2. Detects the selected device's Wi-Fi subnet and matches it against the
#      host machine's network interfaces, correcting EXPO_PUBLIC_API_URL in
#      .env when it does not match — so a stale IP from a previous network
#      never silently breaks the local API connection.
#   3. Starts the local API in the background via run-backend-local.sh when
#      it is not already responding, so this launcher works standalone
#      without a second terminal. An already-running local API is left
#      untouched (run-backend-local.sh itself would otherwise stop and
#      restart it, which is wasteful and disruptive when it is already up).
set -eu

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
repository_root=$(CDPATH= cd -- "$script_dir/.." && pwd)
environment_file="$repository_root/.env"

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
  device_list=$(adb devices -l | awk 'NR>1 && $2=="device" { print }')
  device_serials=$(printf '%s\n' "$device_list" | awk 'NF { print $1 }')

  if [ -z "$device_serials" ]; then
    echo "No authorized Android device or emulator is connected. Connect a device, accept the USB debugging prompt on it, then run this launcher again." >&2
    exit 1
  fi

  set -- $device_serials
  if [ "$#" -eq 1 ]; then
    selected_android_serial=$1
    return
  fi

  echo "Multiple Android devices are connected:" >&2
  index=1
  for serial in "$@"; do
    model=$(printf '%s\n' "$device_list" | grep "^$serial " | grep -o 'model:[^ ]*' | cut -d: -f2)
    echo "  $index) $serial${model:+ ($model)}" >&2
    index=$((index + 1))
  done

  printf 'Select a device to run [1-%d]: ' "$#" >&2
  read -r selection </dev/tty
  case "$selection" in
    ''|*[!0-9]*)
      echo "Invalid selection: $selection" >&2
      exit 1
      ;;
  esac
  if [ "$selection" -lt 1 ] || [ "$selection" -gt "$#" ]; then
    echo "Invalid selection: $selection" >&2
    exit 1
  fi

  shift $((selection - 1))
  selected_android_serial=$1
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
    return
  fi

  echo "No local API detected at http://localhost:8080/api; starting it in the background." >&2
  backend_log_file="$repository_root/daycare-api-local.log"
  nohup "$script_dir/run-backend-local.sh" >"$backend_log_file" 2>&1 &
  echo "Started local API in the background (PID $!, log: $backend_log_file). Waiting for it to become ready is handled by run-mobile.sh next." >&2
}

ensure_adb
select_android_device
export ANDROID_SERIAL="$selected_android_serial"
echo "Using Android device $ANDROID_SERIAL." >&2
sync_local_api_url
ensure_local_backend

exec "$script_dir/run-mobile.sh" android local
