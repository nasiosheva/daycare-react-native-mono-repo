#!/usr/bin/env sh

set -eu

if [ "$#" -ne 2 ]; then
  echo "Usage: $0 <android|ios|web> <dev|prod|simulation>" >&2
  echo "Use a launcher instead, for example: ./run-ios-dev.sh" >&2
  exit 1
fi

platform=$1
environment=$2
repository_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
environment_file="$repository_root/.env.$environment"
environment_template="$repository_root/.env.$environment.example"

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
  if [ -f "$repository_root/node_modules/.modules.yaml" ]; then
    return
  fi

  echo "Workspace dependencies are missing; installing from pnpm-lock.yaml..."
  (
    cd "$repository_root"
    corepack pnpm install --frozen-lockfile
  )
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
  for variable in EXPO_PUBLIC_API_URL EXPO_PUBLIC_FIREBASE_API_KEY EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN EXPO_PUBLIC_FIREBASE_PROJECT_ID EXPO_PUBLIC_FIREBASE_APP_ID; do
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
      if ! command -v adb >/dev/null 2>&1; then
        echo "Android SDK platform tools are required. Install Android Studio and add adb to PATH, then run this launcher again." >&2
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

ensure_node
ensure_corepack
ensure_workspace_dependencies
ensure_environment_file

set -a
. "$environment_file"
set +a

require_environment_values
ensure_platform_tools

cd "$repository_root"

case "$platform" in
  android)
    exec corepack pnpm --filter @daycare/app exec expo start --dev-client --android
    ;;
  ios)
    exec corepack pnpm --filter @daycare/app exec expo run:ios --device "$ios_device_udid"
    ;;
  web)
    exec corepack pnpm --filter @daycare/app exec expo start --web
    ;;
  *)
    echo "Unsupported platform: $platform" >&2
    exit 1
    ;;
esac
