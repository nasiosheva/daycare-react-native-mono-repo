#!/usr/bin/env sh

set -eu

if [ "$#" -ne 2 ]; then
  echo "Usage: $0 <android|ios|web> <local|dev|prod>" >&2
  echo "Use a launcher instead, for example: ./run-ios-dev.sh" >&2
  exit 1
fi

platform=$1
environment=$2
repository_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
started_android_log_pid=""
started_metro_pid=""
android_local_uses_reverse=false
native_project_was_synchronized=false

case "$environment" in
  local)
    environment_file="$repository_root/.env"
    environment_template="$repository_root/.env.example"
    ;;
  dev|prod)
    environment_file="$repository_root/.env.$environment"
    environment_template="$repository_root/.env.$environment.example"
    ;;
  *)
    echo "Unsupported environment: $environment" >&2
    exit 1
    ;;
esac

ensure_node() {
  if ! command -v node >/dev/null 2>&1; then
    echo "Node.js 20 or newer is required. Install it, then run this launcher again." >&2
    exit 1
  fi

  node_major=$(node -p "process.versions.node.split('.')[0]")
  if [ "$node_major" -lt 20 ]; then
    echo "Node.js 20 or newer is required; found $(node --version)." >&2
    exit 1
  fi
}

ensure_android_java_21() {
  if [ "$platform" != "android" ]; then
    return
  fi

  if command -v /usr/libexec/java_home >/dev/null 2>&1; then
    java_21_home=$(/usr/libexec/java_home -v 21 2>/dev/null || true)
    if [ -n "$java_21_home" ]; then
      export JAVA_HOME="$java_21_home"
      export PATH="$JAVA_HOME/bin:$PATH"
      return
    fi
  fi

  echo "JDK 21 is required for the Android development build. Install JDK 21, then run this launcher again." >&2
  exit 1
}

resolve_android_sdk_directory() {
  android_sdk_directory=${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}
  if [ -z "$android_sdk_directory" ] && [ -d "$HOME/Library/Android/sdk" ]; then
    android_sdk_directory="$HOME/Library/Android/sdk"
  fi

  if [ -n "$android_sdk_directory" ] && [ -d "$android_sdk_directory" ]; then
    printf '%s\n' "$android_sdk_directory"
  fi
}

ensure_android_platform_tools() {
  if command -v adb >/dev/null 2>&1; then
    return
  fi

  android_sdk_directory=$(resolve_android_sdk_directory || true)
  if [ -n "$android_sdk_directory" ] && [ -x "$android_sdk_directory/platform-tools/adb" ]; then
    export PATH="$android_sdk_directory/platform-tools:$PATH"
    return
  fi

  echo "Android SDK platform tools are required. Install Android Studio and set ANDROID_HOME or ANDROID_SDK_ROOT when the SDK is not at the standard macOS location, then run this launcher again." >&2
  exit 1
}

ensure_corepack() {
  if ! command -v corepack >/dev/null 2>&1; then
    if ! command -v npm >/dev/null 2>&1; then
      echo "Corepack is missing and npm is unavailable. Install Node.js 20 or newer, then run this launcher again." >&2
      exit 1
    fi

    echo "Corepack is missing; installing it globally..."
    npm install --global corepack
  fi
}

ensure_workspace_dependencies() {
  dependency_stamp="$repository_root/node_modules/.daycare-lockfile.sha256"
  dependency_fingerprint=$(shasum -a 256 "$repository_root/pnpm-lock.yaml" | awk '{ print $1 }')
  recorded_dependency_fingerprint=$(cat "$dependency_stamp" 2>/dev/null || true)

  if [ -f "$repository_root/node_modules/.modules.yaml" ] && [ "$dependency_fingerprint" = "$recorded_dependency_fingerprint" ]; then
    return
  fi

  echo "Synchronizing workspace dependencies from pnpm-lock.yaml..."
  (
    cd "$repository_root"
    corepack pnpm install --frozen-lockfile --force
  )
  printf '%s\n' "$dependency_fingerprint" >"$dependency_stamp"
}

ensure_environment_file() {
  if [ -f "$environment_file" ]; then
    return
  fi

  if [ ! -f "$environment_template" ]; then
    echo "Missing $environment_file and its template $environment_template." >&2
    exit 1
  fi

  cp "$environment_template" "$environment_file"
  echo "Created $environment_file from $environment_template. Fill its required values, then run this launcher again." >&2
}

require_environment_values() {
  missing=0
  required_variables="EXPO_PUBLIC_API_URL"
  if [ "${EXPO_PUBLIC_LOCAL_AUTH_ENABLED:-false}" != "true" ]; then
    required_variables="$required_variables EXPO_PUBLIC_FIREBASE_API_KEY EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN EXPO_PUBLIC_FIREBASE_PROJECT_ID EXPO_PUBLIC_FIREBASE_APP_ID"
  fi

  for variable in $required_variables; do
    eval "value=\${$variable-}"
    case "$value" in
      ""|*example.com*|*your-*|replace-this-*)
        echo "Missing or placeholder value: $variable in $environment_file" >&2
        missing=1
        ;;
    esac
  done

  if [ "$missing" -ne 0 ]; then
    echo "Update $environment_file with the selected environment's Firebase and API values, then run this launcher again." >&2
    exit 1
  fi
}

require_ios_physical_device() {
  eval "ios_device_udid=\${IOS_DEVICE_UDID-}"
  if [ -z "$ios_device_udid" ]; then
    echo "IOS_DEVICE_UDID is required in $environment_file. Connect an iPhone, then set its UDID before running this launcher." >&2
    exit 1
  fi

  if [ ! -f "$repository_root/apps/mobile/GoogleService-Info.plist" ]; then
    echo "Missing apps/mobile/GoogleService-Info.plist. Add the Firebase iOS configuration before building on a physical device." >&2
    exit 1
  fi

  device_line=$(xcrun xctrace list devices 2>/dev/null | awk -v udid="$ios_device_udid" 'index($0, "(" udid ")") && $0 !~ /Simulator/ { print; exit }')
  if [ -z "$device_line" ]; then
    echo "No connected physical iPhone found with IOS_DEVICE_UDID=$ios_device_udid. Connect and trust the device; simulators are not supported by this launcher." >&2
    exit 1
  fi
}

ensure_platform_tools() {
  case "$platform" in
    android)
      ensure_android_platform_tools

      if [ ! -f "$repository_root/apps/mobile/google-services.json" ]; then
        echo "Missing apps/mobile/google-services.json. Add the Firebase Android configuration before building." >&2
        exit 1
      fi
      ;;
    ios)
      if ! command -v xcodebuild >/dev/null 2>&1; then
        echo "Xcode command-line tools are required for iOS. Install Xcode, run xcode-select --install, then run this launcher again." >&2
        exit 1
      fi
      require_ios_physical_device
      ;;
  esac
}

native_config_fingerprint() {
  node -e '
    const { createHash } = require("node:crypto");
    const { readFileSync, readdirSync, statSync } = require("node:fs");
    const { resolve } = require("node:path");
    const fingerprint = createHash("sha256");

    const updateFile = (file) => {
      fingerprint.update(file);
      fingerprint.update(readFileSync(file));
    };

    const updateDirectory = (directory) => {
      for (const entry of readdirSync(directory, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name))) {
        const path = resolve(directory, entry.name);
        if (entry.isDirectory()) updateDirectory(path);
        else if (entry.isFile()) updateFile(path);
      }
    };

    for (const configFile of process.argv.slice(1)) {
      try {
        if (statSync(configFile).isDirectory()) updateDirectory(configFile);
        else updateFile(configFile);
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
    }

    process.stdout.write(fingerprint.digest("hex"));
  ' \
    "$repository_root/apps/mobile/app.json" \
    "$repository_root/apps/mobile/package.json" \
    "$repository_root/pnpm-lock.yaml" \
    "$repository_root/apps/mobile/assets"
}

backup_android_release_signing() {
  native_signing_backup=""
  [ "$platform" = "android" ] || return

  android_root="$repository_root/apps/mobile/android"
  gradle_properties="$android_root/gradle.properties"
  [ -f "$gradle_properties" ] || return

  signing_properties=$(grep -E '^MYAPP_RELEASE_(STORE_FILE|STORE_PASSWORD|KEY_ALIAS|KEY_PASSWORD)=' "$gradle_properties" || true)
  [ -n "$signing_properties" ] || return

  native_signing_backup=$(umask 077; mktemp -d "${TMPDIR:-/tmp}/daycare-android-signing.XXXXXX")
  trap 'discard_android_release_signing_backup' EXIT HUP INT TERM
  printf '%s\n' "$signing_properties" >"$native_signing_backup/gradle.properties"

  release_store_file=$(printf '%s\n' "$signing_properties" | sed -n 's/^MYAPP_RELEASE_STORE_FILE=//p' | head -n 1)
  case "$release_store_file" in
    ""|/*|..|../*|*/../*) return ;;
  esac

  release_store_path="$android_root/app/$release_store_file"
  [ -f "$release_store_path" ] || return
  mkdir -p "$native_signing_backup/keystore/$(dirname "$release_store_file")"
  cp "$release_store_path" "$native_signing_backup/keystore/$release_store_file"
}

restore_android_release_signing() {
  [ -n "$native_signing_backup" ] || return
  [ -f "$native_signing_backup/gradle.properties" ] || return

  android_root="$repository_root/apps/mobile/android"
  mkdir -p "$android_root/app"
  filtered_gradle_properties=$(umask 077; mktemp "$android_root/gradle.properties.XXXXXX")
  if [ -f "$android_root/gradle.properties" ]; then
    grep -v -E '^MYAPP_RELEASE_(STORE_FILE|STORE_PASSWORD|KEY_ALIAS|KEY_PASSWORD)=' "$android_root/gradle.properties" >"$filtered_gradle_properties" || true
  fi
  cat "$native_signing_backup/gradle.properties" >>"$filtered_gradle_properties"
  mv "$filtered_gradle_properties" "$android_root/gradle.properties"

  if [ -d "$native_signing_backup/keystore" ]; then
    (
      cd "$native_signing_backup/keystore"
      find . -type f -print
    ) | while IFS= read -r keystore_file; do
      relative_keystore_path=${keystore_file#./}
      mkdir -p "$android_root/app/$(dirname "$relative_keystore_path")"
      cp "$native_signing_backup/keystore/$relative_keystore_path" "$android_root/app/$relative_keystore_path"
    done
  fi
}

discard_android_release_signing_backup() {
  [ -n "$native_signing_backup" ] || return
  rm -rf "$native_signing_backup"
  native_signing_backup=""
}

ensure_native_project_sync() {
  case "$platform" in
    android|ios)
      ;;
    *)
      return
      ;;
  esac

  native_config_directory="$repository_root/apps/mobile/.expo"
  native_config_stamp="$native_config_directory/native-$platform-config.sha256"
  current_native_config_fingerprint=$(native_config_fingerprint)
  recorded_native_config_fingerprint=$(cat "$native_config_stamp" 2>/dev/null || true)

  if [ "$current_native_config_fingerprint" = "$recorded_native_config_fingerprint" ]; then
    return
  fi

  echo "Synchronizing the generated $platform project with the Expo native configuration..."
  backup_android_release_signing
  if ! (
    cd "$repository_root"
    corepack pnpm --filter @daycare/app exec expo prebuild --platform "$platform" --clean --no-install
  ); then
    restore_android_release_signing
    discard_android_release_signing_backup
    return 1
  fi
  restore_android_release_signing
  discard_android_release_signing_backup
  native_project_was_synchronized=true
  mkdir -p "$native_config_directory"
  printf '%s\n' "$current_native_config_fingerprint" >"$native_config_stamp"
}

ensure_android_development_build() {
  if [ "$platform" != "android" ]; then
    return
  fi

  if [ "$environment" != "local" ] && [ "$native_project_was_synchronized" != "true" ]; then
    return
  fi

  android_local_properties="$repository_root/apps/mobile/android/local.properties"
  if [ ! -f "$android_local_properties" ]; then
    android_sdk_directory=$(resolve_android_sdk_directory || true)

    if [ -z "$android_sdk_directory" ]; then
      echo "Android SDK location is unavailable. Set ANDROID_HOME or ANDROID_SDK_ROOT, then run this launcher again." >&2
      exit 1
    fi

    printf 'sdk.dir=%s\n' "$android_sdk_directory" >"$android_local_properties"
  fi

  echo "Preparing and installing the Android development build..."
  if [ "$environment" = "local" ]; then
    # expo run:android launches the development client even with --no-bundler.
    # Install through Gradle here so Metro is ready before the local client opens.
    (
      cd "$repository_root/apps/mobile/android"
      export NODE_ENV=development
      ./gradlew app:installDebug
    )
    return
  fi

  (
    cd "$repository_root"
    corepack pnpm --filter @daycare/app exec expo run:android --no-bundler
  )
}

local_api_ready() {
  curl --silent --fail --max-time 2 http://localhost:8080/api/v3/api-docs >/dev/null 2>&1
}

require_local_api() {
  if ! command -v curl >/dev/null 2>&1; then
    echo "curl is required to verify the local API. Install curl, then run this launcher again." >&2
    exit 1
  fi

  if local_api_ready; then
    echo "Using local API at http://localhost:8080/api."
    return
  fi

  echo "Local API is not ready at http://localhost:8080/api yet." >&2
  echo "Start it in another terminal with ./scripts/run-backend-local.sh if it is not already running." >&2
  echo "Waiting for it to come up (retrying every 2s, up to ${LOCAL_API_WAIT_TIMEOUT_SECONDS:-300}s)..." >&2

  local_api_waited_seconds=0
  local_api_timeout_seconds=${LOCAL_API_WAIT_TIMEOUT_SECONDS:-300}
  while [ "$local_api_waited_seconds" -lt "$local_api_timeout_seconds" ]; do
    sleep 2
    local_api_waited_seconds=$((local_api_waited_seconds + 2))
    if local_api_ready; then
      echo "Local API is ready at http://localhost:8080/api."
      return
    fi
  done

  echo "Local API did not become ready at http://localhost:8080/api within ${local_api_timeout_seconds}s." >&2
  echo "Start it in another terminal with ./scripts/run-backend-local.sh, then run this launcher again." >&2
  exit 1
}

cleanup() {
  if [ -n "$started_metro_pid" ]; then
    kill "$started_metro_pid" >/dev/null 2>&1 || true
    wait "$started_metro_pid" >/dev/null 2>&1 || true
  fi
  if [ -n "$started_android_log_pid" ]; then
    kill "$started_android_log_pid" >/dev/null 2>&1 || true
    wait "$started_android_log_pid" >/dev/null 2>&1 || true
  fi
}

start_android_local_logs() {
  if [ "$platform" != "android" ] || [ "$environment" != "local" ]; then
    return
  fi

  echo "Showing recent API request/response and Android runtime error logs, then streaming live logs. Press Ctrl+C to stop the launcher."
  adb logcat -T 200 -v time ReactNativeJS:V AndroidRuntime:E System.err:W '*:S' &
  started_android_log_pid=$!
}

configure_android_local_reverse() {
  if [ "$platform" != "android" ] || [ "$environment" != "local" ]; then
    return
  fi

  if adb reverse tcp:8080 tcp:8080 >/dev/null 2>&1 && adb reverse tcp:8081 tcp:8081 >/dev/null 2>&1; then
    android_local_uses_reverse=true
    echo "Using ADB reverse for local API and Metro."
  else
    echo "ADB reverse is unavailable; using the local network for the API and Metro." >&2
  fi
}

local_metro_ready() {
  /usr/bin/curl -fsS http://localhost:8081/status 2>/dev/null | grep -q "packager-status:running"
}

run_android_local_client_through_adb() {
  # The API server is mounted at /api and all mobile routes are versioned under /v1.
  export EXPO_PUBLIC_API_URL="http://localhost:8080/api/v1"
  corepack pnpm --filter @daycare/app exec expo start --dev-client --clear --localhost &
  started_metro_pid=$!

  attempts=0
  while [ "$attempts" -lt 60 ]; do
    if local_metro_ready; then
      adb shell am start -W -a android.intent.action.VIEW -d "exp+children-platform://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081" >/dev/null
      wait "$started_metro_pid"
      return
    fi

    if ! kill -0 "$started_metro_pid" >/dev/null 2>&1; then
      echo "Metro exited before becoming ready." >&2
      exit 1
    fi

    attempts=$((attempts + 1))
    sleep 1
  done

  echo "Timed out waiting for Metro on localhost:8081." >&2
  exit 1
}

run_web_local_client() {
  export EXPO_PUBLIC_API_URL="http://localhost:8080/api/v1"
  corepack pnpm --filter @daycare/app exec expo start --web --clear
}

run_client() {
  case "$platform" in
    android)
      if [ "$environment" = "local" ]; then
        if [ "$android_local_uses_reverse" = "true" ]; then
          run_android_local_client_through_adb
        else
          corepack pnpm --filter @daycare/app exec expo start --dev-client --android --clear
        fi
      else
        corepack pnpm --filter @daycare/app exec expo start --dev-client --android
      fi
      ;;
    ios)
      corepack pnpm --filter @daycare/app exec expo run:ios --device "$ios_device_udid"
      ;;
    web)
      if [ "$environment" = "local" ]; then
        run_web_local_client
      else
        corepack pnpm --filter @daycare/app exec expo start --web
      fi
      ;;
    *)
      echo "Unsupported platform: $platform" >&2
      exit 1
      ;;
  esac
}

ensure_node
ensure_corepack
ensure_workspace_dependencies
ensure_environment_file

set -a
. "$environment_file"
set +a

require_environment_values

if [ "$environment" = "local" ]; then
  require_local_api
fi

ensure_android_java_21
ensure_platform_tools
ensure_native_project_sync
ensure_android_development_build

cd "$repository_root"

trap cleanup EXIT INT TERM
configure_android_local_reverse
start_android_local_logs
run_client
