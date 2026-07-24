#!/usr/bin/env sh

set -eu

if [ "$#" -ne 2 ]; then
  echo "Usage: $0 <android|ios|web> <local|dev|prod|simulation>" >&2
  echo "Use a launcher instead, for example: ./run-ios-dev.sh" >&2
  exit 1
fi

platform=$1
environment=$2
repository_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
started_api_pid=""
started_android_log_pid=""
started_metro_pid=""
android_local_uses_reverse=false
api_log_file="$repository_root/daycare-api-local.log"
gradle_user_home="$repository_root/.gradle-local"
native_project_was_synchronized=false

case "$environment" in
  local)
    environment_file="$repository_root/.env"
    environment_template="$repository_root/.env.example"
    ;;
  dev|prod|simulation)
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

ensure_java_21() {
  if command -v /usr/libexec/java_home >/dev/null 2>&1; then
    java_21_home=$(/usr/libexec/java_home -v 21 2>/dev/null || true)
    if [ -n "$java_21_home" ]; then
      export JAVA_HOME="$java_21_home"
      export PATH="$JAVA_HOME/bin:$PATH"
      return
    fi
  fi

  if command -v java >/dev/null 2>&1; then
    java_major=$(java -XshowSettings:properties -version 2>&1 | awk -F'= ' '/java.version =/ { print $2; exit }' | awk -F. '{ print $1 }')
    if [ "${java_major:-0}" -ge 21 ]; then
      return
    fi
  fi

  echo "JDK 21 is required for the local API. Install JDK 21, then run this launcher again." >&2
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

require_local_backend_values() {
  if [ "${LOCAL_AUTH_ENABLED:-false}" = "true" ]; then
    return
  fi

  missing=0
  for variable in FIREBASE_ISSUER_URI; do
    eval "value=\${$variable-}"
    case "$value" in
      ""|*your-project-id*)
        echo "Missing or placeholder value: $variable in $environment_file" >&2
        missing=1
        ;;
    esac
  done

  if [ "$missing" -ne 0 ]; then
    echo "Update $environment_file with the local backend values, then run this launcher again." >&2
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
      if ! command -v adb >/dev/null 2>&1; then
        echo "Android SDK platform tools are required. Install Android Studio and add adb to PATH, then run this launcher again." >&2
        exit 1
      fi

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
    const { readFileSync } = require("node:fs");
    const fingerprint = createHash("sha256");

    for (const configFile of process.argv.slice(1)) {
      try {
        fingerprint.update(readFileSync(configFile));
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
    }

    process.stdout.write(fingerprint.digest("hex"));
  ' \
    "$repository_root/apps/mobile/app.json" \
    "$repository_root/apps/mobile/package.json" \
    "$repository_root/pnpm-lock.yaml"
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
  (
    cd "$repository_root"
    corepack pnpm --filter @daycare/app exec expo prebuild --platform "$platform" --clean --no-install
  )
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
    android_sdk_directory=${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}
    if [ -z "$android_sdk_directory" ] && [ -d "$HOME/Library/Android/sdk" ]; then
      android_sdk_directory="$HOME/Library/Android/sdk"
    fi

    if [ -z "$android_sdk_directory" ] || [ ! -d "$android_sdk_directory" ]; then
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

ensure_local_backend_tools() {
  if ! command -v gradle >/dev/null 2>&1; then
    echo "Gradle is required to run the local API. Install Gradle, then run this launcher again." >&2
    exit 1
  fi

  if ! command -v curl >/dev/null 2>&1; then
    echo "curl is required to verify the local API startup. Install curl, then run this launcher again." >&2
    exit 1
  fi

  if ! command -v pg_isready >/dev/null 2>&1; then
    echo "pg_isready is required to detect a local PostgreSQL instance when Docker is unavailable. Install PostgreSQL client tools, then run this launcher again." >&2
    exit 1
  fi
}

local_api_ready() {
  curl --silent --fail --max-time 2 http://localhost:8080/api/v3/api-docs >/dev/null 2>&1
}

local_postgres_ready() {
  postgres_host=${POSTGRES_HOST:-localhost}
  postgres_port=${POSTGRES_PORT:-5432}
  pg_isready -h "$postgres_host" -p "$postgres_port" >/dev/null 2>&1
}

local_api_port_pid() {
  lsof -ti tcp:8080 -sTCP:LISTEN 2>/dev/null | head -n 1
}

repo_owned_api_pid() {
  existing_api_pid=$(local_api_port_pid || true)
  if [ -z "$existing_api_pid" ]; then
    return 1
  fi

  existing_api_command=$(ps -p "$existing_api_pid" -o command= 2>/dev/null || true)
  case "$existing_api_command" in
    *"$repository_root/apps/api/build/"*com.daycare.api.DaycareApplicationKt*)
      printf '%s\n' "$existing_api_pid"
      return 0
      ;;
    *)
      return 1
      ;;
  esac
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
  if [ -n "$started_api_pid" ]; then
    kill "$started_api_pid" >/dev/null 2>&1 || true
    wait "$started_api_pid" >/dev/null 2>&1 || true
  fi
}

start_android_local_logs() {
  if [ "$platform" != "android" ] || [ "$environment" != "local" ]; then
    return
  fi

  echo "Streaming Android and React Native logs. Press Ctrl+C to stop the launcher."
  adb logcat -v time ReactNative:V ReactNativeJS:V AndroidRuntime:E '*:S' &
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

ensure_local_backend() {
  ensure_local_backend_tools
  require_local_backend_values

  if local_postgres_ready; then
    echo "Using existing local PostgreSQL at ${POSTGRES_HOST:-localhost}:${POSTGRES_PORT:-5432}."
  elif command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
    echo "Starting local PostgreSQL container..."
    (
      cd "$repository_root"
      docker compose up -d postgres
    )
  else
    echo "No PostgreSQL service is available for the local stack." >&2
    echo "Start PostgreSQL locally on ${POSTGRES_HOST:-localhost}:${POSTGRES_PORT:-5432} or install Docker Desktop, then run this launcher again." >&2
    exit 1
  fi

  existing_api_pid=$(local_api_port_pid || true)
  if [ -n "$existing_api_pid" ]; then
    owned_api_pid=$(repo_owned_api_pid || true)
    if [ -n "$owned_api_pid" ]; then
      echo "Stopping existing local API owned by this repo (PID $owned_api_pid)..."
      kill "$owned_api_pid" >/dev/null 2>&1 || true
      wait "$owned_api_pid" >/dev/null 2>&1 || true
    elif local_api_ready; then
      echo "Port 8080 is already used by a running API process (PID $existing_api_pid)." >&2
      echo "run-android-local.sh can only replace the Java API process owned by this repo. Stop the existing process, then run this launcher again." >&2
      exit 1
    else
      echo "Port 8080 is already in use by PID $existing_api_pid, so the local API cannot be started by this launcher." >&2
      echo "Free port 8080, then run this launcher again." >&2
      exit 1
    fi
  fi

  echo "Starting local API in the background..."
  (
    cd "$repository_root"
    set -a
    . "$environment_file"
    set +a
    export GRADLE_USER_HOME="$gradle_user_home"
    gradle --no-daemon -p apps/api bootRun --stacktrace >"$api_log_file" 2>&1
  ) &
  started_api_pid=$!
  trap cleanup EXIT INT TERM

  attempts=0
  while [ "$attempts" -lt 60 ]; do
    if local_api_ready; then
      echo "Local API is ready at http://localhost:8080/api."
      echo "API logs: $api_log_file"
      return
    fi

    if ! kill -0 "$started_api_pid" >/dev/null 2>&1; then
      echo "Local API exited before becoming ready. Check $api_log_file for details." >&2
      exit 1
    fi

    attempts=$((attempts + 1))
    sleep 1
  done

  echo "Timed out waiting for the local API. Check $api_log_file for details." >&2
  exit 1
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
ensure_java_21
ensure_corepack
ensure_workspace_dependencies
ensure_environment_file

set -a
. "$environment_file"
set +a

require_environment_values
ensure_platform_tools
ensure_native_project_sync
ensure_android_development_build

if [ "$environment" = "local" ]; then
  ensure_local_backend
fi

cd "$repository_root"

configure_android_local_reverse
start_android_local_logs
run_client
