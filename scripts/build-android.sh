#!/usr/bin/env sh
# Interactive Android build launcher, covering both build types:
#   - Debug: no release signing required, produces an installable APK signed
#     with the auto-generated debug keystore. Intended for sharing a quick
#     installable build with someone who cannot run a full dev-client
#     session, not for distribution.
#   - Release: requires local release signing (see docs/android-release-apk.md),
#     produces a signed APK (direct distribution) or AAB (Google Play).
#
# Build type and environment are independent choices — a debug build can
# target the prod environment's API, and a release build can target the
# local or dev environment's API, for whatever combination is actually
# useful to test. EXPO_PUBLIC_APP_ENV=production is only required when the
# selected environment is prod (i.e. .env.prod itself), regardless of build
# type.
#
# Runs fully interactively with no arguments. Also accepts positional
# arguments (<debug|release> [apk|aab] <local|dev|prod>) so run-android.sh
# can drive a release build without re-prompting; the format argument is
# required only when the build type is release.
set -eu

usage() {
  echo "Usage: $0 [<debug|release> [apk|aab] <local|dev|prod>]" >&2
  echo "With no arguments, the build type, format, and environment are selected interactively." >&2
  exit 1
}

prompt_build_type() {
  echo "Select a build type:" >&2
  echo "  1) Debug" >&2
  echo "  2) Release" >&2
  printf 'Build type [1-2]: ' >&2
  read -r selection </dev/tty
  case "$selection" in
    1) build_type=debug ;;
    2) build_type=release ;;
    *)
      echo "Invalid selection: $selection" >&2
      exit 1
      ;;
  esac
}

prompt_format() {
  echo "Select a release format:" >&2
  echo "  1) APK" >&2
  echo "  2) AAB" >&2
  printf 'Format [1-2]: ' >&2
  read -r selection </dev/tty
  case "$selection" in
    1) format=apk ;;
    2) format=aab ;;
    *)
      echo "Invalid selection: $selection" >&2
      exit 1
      ;;
  esac
}

prompt_environment() {
  echo "Select an environment:" >&2
  echo "  1) local" >&2
  echo "  2) dev" >&2
  echo "  3) prod" >&2
  printf 'Environment [1-3]: ' >&2
  read -r selection </dev/tty
  case "$selection" in
    1) chosen_environment=local ;;
    2) chosen_environment=dev ;;
    3) chosen_environment=prod ;;
    *)
      echo "Invalid selection: $selection" >&2
      exit 1
      ;;
  esac
}

case "$#" in
  0)
    prompt_build_type
    if [ "$build_type" = "release" ]; then prompt_format; else format=apk; fi
    prompt_environment
    ;;
  2)
    [ "$1" = "debug" ] || usage
    build_type=$1
    format=apk
    case "$2" in local|dev|prod) chosen_environment=$2 ;; *) usage ;; esac
    ;;
  3)
    case "$1" in debug|release) build_type=$1 ;; *) usage ;; esac
    case "$2" in apk|aab) format=$2 ;; *) usage ;; esac
    case "$3" in local|dev|prod) chosen_environment=$3 ;; *) usage ;; esac
    [ "$build_type" = "debug" ] && [ "$format" = "aab" ] && usage
    ;;
  *)
    usage
    ;;
esac

repository_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
mobile_root="$repository_root/apps/mobile"
android_root="$mobile_root/android"
gradle_properties="$android_root/gradle.properties"

case "$chosen_environment" in
  local)
    environment_file="$repository_root/.env"
    environment_template="$repository_root/.env.example"
    ;;
  dev|prod)
    environment_file="$repository_root/.env.$chosen_environment"
    environment_template="$repository_root/.env.$chosen_environment.example"
    ;;
esac

if [ "$format" = "apk" ]; then
  release_architectures=${ANDROID_RELEASE_ARCHITECTURES:-arm64-v8a}
  artifact_label="APK"
  if [ "$build_type" = "release" ]; then
    gradle_task=":app:assembleRelease"
    artifact_path="$android_root/app/build/outputs/apk/release/app-release.apk"
  else
    gradle_task=":app:assembleDebug"
    artifact_path="$android_root/app/build/outputs/apk/debug/app-debug.apk"
  fi
else
  release_architectures=${ANDROID_RELEASE_ARCHITECTURES:-armeabi-v7a,arm64-v8a,x86,x86_64}
  gradle_task=":app:bundleRelease"
  artifact_path="$android_root/app/build/outputs/bundle/release/app-release.aab"
  artifact_label="AAB"
fi

fail() {
  echo "$1" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "Missing required command: $1"
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

  java_version=$(java -version 2>&1 | awk -F '"' '/version/ { print $2; exit }' | cut -d. -f1)
  [ "$java_version" = "21" ] || fail "JDK 21 is required to build the Android $artifact_label."
}

ensure_environment() {
  if [ ! -f "$environment_file" ]; then
    [ -f "$environment_template" ] || fail "Missing $environment_file and its template $environment_template."
    cp "$environment_template" "$environment_file"
    fail "Created $environment_file. Fill its values, then run this script again."
  fi

  set -a
  # shellcheck disable=SC1090
  . "$environment_file"
  set +a

  if [ "$chosen_environment" = "prod" ]; then
    [ "${EXPO_PUBLIC_APP_ENV:-}" = "production" ] || fail "EXPO_PUBLIC_APP_ENV must be production in $environment_file."
  fi

  for variable in EXPO_PUBLIC_API_URL EXPO_PUBLIC_FIREBASE_API_KEY EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN EXPO_PUBLIC_FIREBASE_PROJECT_ID EXPO_PUBLIC_FIREBASE_APP_ID; do
    eval "value=\${$variable-}"
    case "$value" in
      ""|*example.com*|*your-*|replace-this-*) fail "Missing or placeholder value: $variable in $environment_file." ;;
    esac
  done
}

ensure_android_sdk() {
  android_sdk_root=${ANDROID_HOME:-${ANDROID_SDK_ROOT:-"$HOME/Library/Android/sdk"}}
  [ -d "$android_sdk_root" ] || fail "Android SDK was not found. Set ANDROID_HOME or ANDROID_SDK_ROOT."
  [ -x "$android_sdk_root/platform-tools/adb" ] || fail "Android SDK platform tools are missing from $android_sdk_root."

  if [ ! -f "$android_root/local.properties" ] || ! grep -Fqx "sdk.dir=$android_sdk_root" "$android_root/local.properties"; then
    printf 'sdk.dir=%s\n' "$android_sdk_root" >"$android_root/local.properties"
  fi
}

require_release_signing() {
  [ -f "$gradle_properties" ] || fail "Missing $gradle_properties. Configure local Android release signing before building."

  for variable in MYAPP_RELEASE_STORE_FILE MYAPP_RELEASE_STORE_PASSWORD MYAPP_RELEASE_KEY_ALIAS MYAPP_RELEASE_KEY_PASSWORD; do
    value=$(sed -n "s/^$variable=//p" "$gradle_properties" | head -n 1)
    [ -n "$value" ] || fail "Missing $variable in $gradle_properties."
    if [ "$variable" = "MYAPP_RELEASE_STORE_FILE" ]; then
      release_store_file="$value"
    fi
  done

  [ -f "$android_root/app/$release_store_file" ] || fail "Release keystore was not found at $android_root/app/$release_store_file."
}

require_release_architectures() {
  [ -n "$release_architectures" ] || fail "ANDROID_RELEASE_ARCHITECTURES must contain at least one supported ABI."
  previous_ifs=$IFS
  IFS=,
  for architecture in $release_architectures; do
    case "$architecture" in
      armeabi-v7a|arm64-v8a|x86|x86_64) ;;
      *) fail "Unsupported Android release ABI: $architecture" ;;
    esac
  done
  IFS=$previous_ifs
}

verify_release_signature() {
  if [ "$format" = "apk" ]; then
    apksigner_path=$(find "$android_sdk_root/build-tools" -type f -name apksigner -print -quit)
    [ -n "$apksigner_path" ] && [ -x "$apksigner_path" ] || fail "Android SDK Build Tools apksigner was not found under $android_sdk_root/build-tools."
    "$apksigner_path" verify --verbose "$artifact_path"
  else
    require_command jarsigner
    aab_verification_log=$(mktemp "${TMPDIR:-/tmp}/umur-emas-aab-verification.XXXXXX")
    if ! jarsigner -verify -certs "$artifact_path" >"$aab_verification_log" 2>&1 || ! grep -Fq 'jar verified.' "$aab_verification_log"; then
      cat "$aab_verification_log" >&2
      rm -f "$aab_verification_log"
      fail "AAB signature verification failed."
    fi
    rm -f "$aab_verification_log"
    echo "Verified AAB JAR signature."
  fi
}

create_release_signing_init_script() {
  release_signing_init_script=$(mktemp "${TMPDIR:-/tmp}/umur-emas-release-signing.XXXXXX")
  trap 'rm -f "$release_signing_init_script"' EXIT HUP INT TERM

  cat >"$release_signing_init_script" <<'EOF'
gradle.beforeProject { project ->
    if (project.path == ":app") {
        project.afterEvaluate {
            def android = project.extensions.getByName("android")
            def releaseSigning = android.signingConfigs.findByName("release") ?: android.signingConfigs.create("release")
            releaseSigning.storeFile = project.file(project.findProperty("MYAPP_RELEASE_STORE_FILE"))
            releaseSigning.storePassword = project.findProperty("MYAPP_RELEASE_STORE_PASSWORD")
            releaseSigning.keyAlias = project.findProperty("MYAPP_RELEASE_KEY_ALIAS")
            releaseSigning.keyPassword = project.findProperty("MYAPP_RELEASE_KEY_PASSWORD")
            android.buildTypes.getByName("release").signingConfig = releaseSigning
        }
    }
}
EOF
}

require_command node
require_command corepack
require_command java

[ -d "$android_root" ] || fail "Missing generated Android project at $android_root. Run ./run-android.sh once after cloning or after native configuration changes, then run this build again."
[ -x "$android_root/gradlew" ] || fail "Missing executable Gradle wrapper at $android_root/gradlew."
[ -f "$android_root/app/build.gradle" ] || fail "Missing Android app Gradle configuration at $android_root/app/build.gradle."
[ -f "$mobile_root/google-services.json" ] || fail "Missing $mobile_root/google-services.json."
ensure_java_21
ensure_environment
ensure_android_sdk

if [ "$build_type" = "release" ]; then
  require_release_signing
  require_release_architectures
  create_release_signing_init_script
fi

if [ ! -f "$repository_root/node_modules/.modules.yaml" ]; then
  echo "Installing locked workspace dependencies..."
  (cd "$repository_root" && corepack pnpm install --frozen-lockfile)
fi

echo "Building $build_type Android $artifact_label against the $chosen_environment environment${release_architectures:+ for: $release_architectures}"
(
  cd "$android_root"
  if [ "$build_type" = "release" ]; then
    export NODE_ENV=production
    ./gradlew "$gradle_task" --no-daemon \
      --init-script "$release_signing_init_script" \
      "-PreactNativeArchitectures=$release_architectures" \
      -Pandroid.enableProguardInReleaseBuilds=true \
      -Pandroid.enableShrinkResourcesInReleaseBuilds=true
  else
    export NODE_ENV=development
    ./gradlew "$gradle_task" --no-daemon
  fi
)

[ -s "$artifact_path" ] || fail "Gradle completed without producing $artifact_path."
if [ "$build_type" = "release" ]; then
  verify_release_signature
fi
echo "$build_type Android $artifact_label: $artifact_path"
