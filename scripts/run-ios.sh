#!/usr/bin/env sh
# Interactive iOS Simulator launcher, replacing the old run-ios-dev.sh /
# run-ios-local.sh / run-ios-prod.sh trio. Physical iPhones are out of scope
# for this launcher — only Simulators are supported. Beyond delegating to
# run-mobile.sh, this script:
#   1. Asks which environment (local/dev/prod) to run, instead of requiring a
#      different file per environment.
#   2. Lists every currently booted Simulator and asks which one to target
#      when more than one is booted — exporting IOS_DEVICE_UDID and
#      IOS_TARGET_IS_SIMULATOR so run-mobile.sh never needs it pre-set in an
#      environment file.
#   3. For the local environment: starts the local API in the background via
#      run-backend-local.sh when it is not already responding. An
#      already-running local API is left untouched and is not stopped when
#      this launcher exits. A Simulator shares the host Mac's network stack,
#      so it always reaches http://localhost:8080 directly.
#   4. Asks whether to uninstall the existing app from the selected Simulator
#      first, or install/update over whatever is already there.
set -eu

bundle_id="com.children.platform"
script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
repository_root=$(CDPATH= cd -- "$script_dir/.." && pwd)
. "$script_dir/lib/session-log.sh"
. "$script_dir/lib/interactive-menu.sh"

prompt_environment() {
  interactive_menu_select "Select an environment" local dev prod
  case "$interactive_menu_selected_index" in
    1) selected_environment=local ;;
    2) selected_environment=dev ;;
    3) selected_environment=prod ;;
  esac
}

ensure_xcode_tools() {
  if ! command -v xcrun >/dev/null 2>&1; then
    echo "Xcode command-line tools are required for iOS. Install Xcode, run xcode-select --install, then run this launcher again." >&2
    exit 1
  fi
}

# Prints "<name>\t<udid>" for every currently booted Simulator.
list_booted_simulators() {
  xcrun simctl list devices booted -j 2>/dev/null | node -e '
    let raw = "";
    process.stdin.on("data", (chunk) => { raw += chunk; });
    process.stdin.on("end", () => {
      let data;
      try { data = JSON.parse(raw); } catch { process.exit(0); }
      for (const runtimeDevices of Object.values(data.devices || {})) {
        for (const device of runtimeDevices) {
          if (device.state === "Booted") console.log(`${device.name}\t${device.udid}`);
        }
      }
    });
  '
}

select_ios_simulator() {
  simulators=$(list_booted_simulators)

  if [ -z "$simulators" ]; then
    echo "No booted Simulator was found. Boot one from Xcode (Xcode > Open Developer Tool > Simulator), then run this launcher again." >&2
    exit 1
  fi

  simulator_count=$(printf '%s\n' "$simulators" | grep -c .)
  if [ "$simulator_count" -eq 1 ]; then
    selected_simulator_line=$simulators
  else
    interactive_menu_begin
    interactive_menu_index=1
    while :; do
      printf '\033[2J\033[H' >&2
      echo "Select a Simulator (↑/↓, Enter):" >&2
      index=1
      printf '%s\n' "$simulators" | while IFS='	' read -r name udid; do
        if [ "$index" -eq "$interactive_menu_index" ]; then
          echo "  > $name" >&2
        else
          echo "    $name" >&2
        fi
        index=$((index + 1))
      done
      echo "  q/Ctrl+C: cancel" >&2

      interactive_menu_read_key
      case "$interactive_menu_key" in
        up)
          if [ "$interactive_menu_index" -eq 1 ]; then interactive_menu_index=$simulator_count; else interactive_menu_index=$((interactive_menu_index - 1)); fi
          ;;
        down)
          if [ "$interactive_menu_index" -eq "$simulator_count" ]; then interactive_menu_index=1; else interactive_menu_index=$((interactive_menu_index + 1)); fi
          ;;
        enter) break ;;
        cancel)
          interactive_menu_restore
          exit 130
          ;;
      esac
    done
    interactive_menu_restore
    selected_simulator_line=$(printf '%s\n' "$simulators" | sed -n "${interactive_menu_index}p")
  fi

  selected_ios_name=$(printf '%s' "$selected_simulator_line" | cut -f1)
  selected_ios_udid=$(printf '%s' "$selected_simulator_line" | cut -f2)
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
  echo "Started local API in the background (PID $!, log: $backend_log_file). Waiting for it to become ready is handled by run-mobile.sh next." >&2
}

prompt_uninstall_choice() {
  if ! xcrun simctl get_app_container "$selected_ios_udid" "$bundle_id" >/dev/null 2>&1; then
    return
  fi

  interactive_menu_select "The app is already installed. Choose install mode" "Install/update existing app" "Uninstall first, then clean install"
  if [ "$interactive_menu_selected_index" -eq 2 ]; then
    echo "Uninstalling $bundle_id from $selected_ios_name..." >&2
    xcrun simctl uninstall "$selected_ios_udid" "$bundle_id" || true
  else
    echo "Keeping the existing $bundle_id installation." >&2
  fi
}

prompt_environment
ensure_xcode_tools
select_ios_simulator
export IOS_DEVICE_UDID="$selected_ios_udid"
export IOS_TARGET_IS_SIMULATOR=true
echo "Using iOS Simulator $selected_ios_name ($selected_ios_udid)." >&2
ios_session_label=$(printf '%s' "$selected_ios_name" | tr -c 'A-Za-z0-9' '-')
start_session_log "$repository_root" "ios-${ios_session_label}-${selected_environment}"

if [ "$selected_environment" = "local" ]; then
  ensure_local_backend
fi

prompt_uninstall_choice

exec "$script_dir/run-mobile.sh" ios "$selected_environment"
