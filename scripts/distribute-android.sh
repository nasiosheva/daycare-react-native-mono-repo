#!/usr/bin/env sh
# Builds a signed Android release APK and shares it with an existing Firebase
# App Distribution tester group.
#
# The build itself is delegated to build-android.sh (release, APK), so release
# signing, environment files, and CMake retries behave exactly as for a normal
# release build. The Firebase App ID is read from apps/mobile/google-services.json
# for the package in apps/mobile/app.json, so it is never duplicated here.
#
# Usage:
#   ./scripts/distribute-android.sh [<local|dev|prod>] [--groups <aliases>] [--release-notes-file <path>] [--skip-build]
#
# Defaults:
#   environment   asked interactively when omitted
#   --groups      $FIREBASE_APP_DISTRIBUTION_GROUPS, else "qa-tester"
#   notes         generated from the current commit and environment
#
# Authentication: an interactive `firebase login`, or a service account via
# GOOGLE_APPLICATION_CREDENTIALS (CI). Uploading notifies every tester in the
# selected groups.
set -eu

script_directory=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
repository_root=$(CDPATH= cd -- "$script_directory/.." && pwd)
mobile_root="$repository_root/apps/mobile"
artifact_path="$mobile_root/android/app/build/outputs/apk/release/app-release.apk"
default_groups="qa-tester"

usage() {
  echo "Usage: $0 [<local|dev|prod>] [--groups <aliases>] [--release-notes-file <path>] [--skip-build]" >&2
  echo "  --groups               Comma-separated existing tester group aliases (default: \${FIREBASE_APP_DISTRIBUTION_GROUPS:-$default_groups})." >&2
  echo "  --release-notes-file   Use this file as release notes instead of the generated summary." >&2
  echo "  --skip-build           Upload the existing release APK without rebuilding it." >&2
  exit 1
}

fail() {
  echo "$1" >&2
  exit 1
}

environment=""
groups="${FIREBASE_APP_DISTRIBUTION_GROUPS:-$default_groups}"
release_notes_file=""
skip_build=false

while [ "$#" -gt 0 ]; do
  case "$1" in
    local|dev|prod) environment=$1 ;;
    --groups) [ "$#" -ge 2 ] || usage; groups=$2; shift ;;
    --release-notes-file) [ "$#" -ge 2 ] || usage; release_notes_file=$2; shift ;;
    --skip-build) skip_build=true ;;
    -h|--help) usage ;;
    *) echo "Unknown argument: $1" >&2; usage ;;
  esac
  shift
done

if [ -z "$environment" ]; then
  echo "Select the API environment for this tester build:" >&2
  echo "  1) local" >&2
  echo "  2) dev" >&2
  echo "  3) prod" >&2
  printf 'Environment [1-3]: ' >&2
  read -r selection </dev/tty
  case "$selection" in
    1) environment=local ;;
    2) environment=dev ;;
    3) environment=prod ;;
    *) fail "Invalid selection: $selection" ;;
  esac
fi

[ -n "$groups" ] || fail "No tester group was given. Pass --groups or set FIREBASE_APP_DISTRIBUTION_GROUPS."
[ -z "$release_notes_file" ] || [ -s "$release_notes_file" ] || fail "Release notes file not found or empty: $release_notes_file"

command -v node >/dev/null 2>&1 || fail "Node.js is required to read the Firebase App ID."

# Listing groups needs firebase-tools 14+; fall back to a pinned npx copy when
# the installed CLI is older or missing. Both share the same login.
installed_firebase_major=$(command -v firebase >/dev/null 2>&1 && firebase --version 2>/dev/null | cut -d. -f1 || echo 0)
case "$installed_firebase_major" in ''|*[!0-9]*) installed_firebase_major=0 ;; esac
if [ "$installed_firebase_major" -ge 14 ]; then
  firebase_cli() { firebase "$@"; }
elif command -v npx >/dev/null 2>&1; then
  echo "Using npx firebase-tools@15 (the installed Firebase CLI cannot list tester groups)." >&2
  firebase_cli() { npx -y firebase-tools@15 "$@"; }
else
  fail "Firebase CLI 14+ is required. Install it with 'npm install -g firebase-tools' and run 'firebase login'."
fi

if [ -z "${GOOGLE_APPLICATION_CREDENTIALS:-}" ] && ! firebase_cli login:list 2>/dev/null | grep -q "Logged in as"; then
  fail "Firebase CLI is not authenticated. Run 'firebase login', or set GOOGLE_APPLICATION_CREDENTIALS to a service account key."
fi

# Resolve the Android Firebase App ID for the package this repository builds.
app_id=$(node -e '
  const fs = require("fs");
  const [appJsonPath, servicesPath] = process.argv.slice(1);
  const packageName = JSON.parse(fs.readFileSync(appJsonPath, "utf8")).expo.android.package;
  const client = (JSON.parse(fs.readFileSync(servicesPath, "utf8")).client || [])
    .find((entry) => entry.client_info?.android_client_info?.package_name === packageName);
  if (!client) { console.error(`No Firebase Android app for ${packageName} in google-services.json`); process.exit(1); }
  process.stdout.write(client.client_info.mobilesdk_app_id);
' "$mobile_root/app.json" "$mobile_root/google-services.json") || fail "Could not read the Firebase App ID."

# Fail before the long build when a requested tester group does not exist.
project_number=$(printf '%s' "$app_id" | cut -d: -f2)
groups_json=$(firebase_cli appdistribution:groups:list --project "$project_number" --json 2>/dev/null) || fail "Could not list Firebase App Distribution groups for project $project_number."
printf '%s' "$groups_json" | node -e '
  const requested = process.argv[1].split(",").map((alias) => alias.trim()).filter(Boolean);
  const groups = JSON.parse(require("fs").readFileSync(0, "utf8")).result?.groups ?? [];
  const existing = groups.map((group) => group.name.split("/").pop());
  const missing = requested.filter((alias) => !existing.includes(alias));
  if (missing.length) {
    console.error(`Unknown tester group(s): ${missing.join(", ")}. Existing groups: ${existing.join(", ") || "(none)"}.`);
    process.exit(1);
  }
  for (const group of groups.filter((item) => requested.includes(item.name.split("/").pop()))) {
    console.error(`Tester group ${group.name.split("/").pop()} (${group.displayName}): ${group.testerCount ?? 0} tester(s).`);
  }
' "$groups" || exit 1

commit=$(git -C "$repository_root" rev-parse --short HEAD)
branch=$(git -C "$repository_root" rev-parse --abbrev-ref HEAD)
if [ -n "$(git -C "$repository_root" status --porcelain --untracked-files=no)" ]; then
  echo "Warning: the working tree has uncommitted changes; the APK will include them but the release notes reference $commit." >&2
fi

if [ "$skip_build" = true ]; then
  [ -s "$artifact_path" ] || fail "No release APK at $artifact_path. Run without --skip-build first."
  echo "Reusing the existing release APK (--skip-build)." >&2
else
  "$script_directory/build-android.sh" release apk "$environment"
fi
[ -s "$artifact_path" ] || fail "Release APK not found at $artifact_path."

generated_notes=""
if [ -z "$release_notes_file" ]; then
  generated_notes=$(mktemp "${TMPDIR:-/tmp}/usia-emas-release-notes.XXXXXX")
  trap 'rm -f "$generated_notes"' EXIT INT TERM
  version=$(node -e 'process.stdout.write(require(process.argv[1]).expo.version || "")' "$mobile_root/app.json")
  {
    echo "Usia Emas ${version:+$version }($environment)"
    echo "Build $commit on $branch"
    echo
    git -C "$repository_root" log -1 --format=%s
  } >"$generated_notes"
  release_notes_file=$generated_notes
fi

echo "Distributing $artifact_path to Firebase App Distribution group(s): $groups" >&2
firebase_cli appdistribution:distribute "$artifact_path" \
  --app "$app_id" \
  --groups "$groups" \
  --release-notes-file "$release_notes_file"
echo "Shared the $environment release APK ($commit) with: $groups"
