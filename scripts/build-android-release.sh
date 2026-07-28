#!/usr/bin/env sh

set -eu

if [ "$#" -ne 1 ]; then
  echo "Usage: $0 <apk|aab>" >&2
  echo "Use a launcher instead, for example: ./build-android-release-apk.sh" >&2
  exit 1
fi

format=$1
case "$format" in
  apk|aab) ;;
  *) echo "Unsupported release format: $format" >&2; exit 1 ;;
esac

repository_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
mobile_root="$repository_root/apps/mobile"
android_root="$mobile_root/android"
environment_file="$repository_root/.env.prod"
environment_template="$repository_root/.env.prod.example"
gradle_properties="$android_root/gradle.properties"

if [ "$format" = "apk" ]; then
  release_architectures=${ANDROID_RELEASE_ARCHITECTURES:-arm64-v8a}
  gradle_task=":app:assembleRelease"
  artifact_path="$android_root/app/build/outputs/apk/release/app-release.apk"
  artifact_label="APK"
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
  [ "$java_version" = "21" ] || fail "JDK 21 is required to build the Android release $artifact_label."
}

ensure_environment() {
  if [ ! -f "$environment_file" ]; then
    [ -f "$environment_template" ] || fail "Missing $environment_file and its template $environment_template."
    cp "$environment_template" "$environment_file"
    fail "Created $environment_file. Fill its production values, then run this script again."
  fi

  set -a
  # shellcheck disable=SC1090
  . "$environment_file"
  set +a

  [ "${EXPO_PUBLIC_APP_ENV:-}" = "production" ] || fail "EXPO_PUBLIC_APP_ENV must be production in $environment_file."

  for variable in EXPO_PUBLIC_API_URL EXPO_PUBLIC_FIREBASE_API_KEY EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN EXPO_PUBLIC_FIREBASE_PROJECT_ID EXPO_PUBLIC_FIREBASE_APP_ID; do
    eval "value=\${$variable-}"
    case "$value" in
      ""|*example.com*|*your-*|replace-this-*) fail "Missing or placeholder production value: $variable in $environment_file." ;;
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

[ -d "$android_root" ] || fail "Missing generated Android project at $android_root. Run ./run-android-local.sh once after cloning or after native configuration changes, then configure release signing again."
[ -x "$android_root/gradlew" ] || fail "Missing executable Gradle wrapper at $android_root/gradlew."
[ -f "$android_root/app/build.gradle" ] || fail "Missing Android app Gradle configuration at $android_root/app/build.gradle."
[ -f "$mobile_root/google-services.json" ] || fail "Missing $mobile_root/google-services.json."
ensure_java_21
ensure_environment
ensure_android_sdk
require_release_signing
require_release_architectures
create_release_signing_init_script

if [ ! -f "$repository_root/node_modules/.modules.yaml" ]; then
  echo "Installing locked workspace dependencies..."
  (cd "$repository_root" && corepack pnpm install --frozen-lockfile)
fi

echo "Building signed Android release $artifact_label for: $release_architectures"
(
  cd "$android_root"
  export NODE_ENV=production
  ./gradlew "$gradle_task" --no-daemon \
    --init-script "$release_signing_init_script" \
    "-PreactNativeArchitectures=$release_architectures" \
    -Pandroid.enableProguardInReleaseBuilds=true \
    -Pandroid.enableShrinkResourcesInReleaseBuilds=true
)

[ -s "$artifact_path" ] || fail "Gradle completed without producing $artifact_path."
verify_release_signature
echo "Signed release $artifact_label: $artifact_path"
