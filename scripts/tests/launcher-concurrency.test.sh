#!/usr/bin/env sh
# Mories Deo Hutapea,S.E.,S.Kom
set -eu

repository_root=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
fail() { echo "FAIL: $1" >&2; exit 1; }
assert_contains() {
  file=$1
  text=$2
  grep -Fq "$text" "$repository_root/$file" || fail "$file must contain: $text"
}
assert_not_contains() {
  file=$1
  text=$2
  if grep -Fq "$text" "$repository_root/$file"; then fail "$file must not contain: $text"; fi
}

if [ "${1:-}" = "--api-start-child" ]; then
  . "$repository_root/scripts/lib/local-api.sh"
  local_api_ready() { [ -f "$LOCAL_API_TEST_READY" ]; }
  local_api_port_pid() { return 1; }
  ensure_local_api "$repository_root" "$repository_root/scripts/tests/fixtures/fake-local-api.sh" "$LOCAL_API_TEST_LOG"
  exit $?
fi

if [ "${1:-}" = "--api-reuse-child" ]; then
  . "$repository_root/scripts/lib/local-api.sh"
  local_api_ready() { return 0; }
  ensure_local_api "$repository_root" "$repository_root/scripts/tests/fixtures/does-not-exist.sh" "$LOCAL_API_TEST_LOG"
  exit $?
fi

if [ "${1:-}" = "--api-existing-starting-child" ]; then
  . "$repository_root/scripts/lib/local-api.sh"
  local_api_ready() {
    api_ready_checks=$(cat "$LOCAL_API_TEST_READY_CHECKS" 2>/dev/null || printf '0')
    api_ready_checks=$((api_ready_checks + 1))
    printf '%s\n' "$api_ready_checks" >"$LOCAL_API_TEST_READY_CHECKS"
    [ "$api_ready_checks" -ge 4 ]
  }
  local_api_port_pid() { printf '4242\n'; }
  local_api_process_belongs_to_repository() { return 0; }
  ensure_local_api "$repository_root" "$repository_root/scripts/tests/fixtures/does-not-exist.sh" "$LOCAL_API_TEST_LOG"
  exit $?
fi

assert_contains scripts/lib/metro-ports.sh 'WEB_METRO_PORT=8081'
assert_contains scripts/lib/metro-ports.sh 'ANDROID_METRO_PORT=8082'
assert_contains scripts/run-mobile.sh 'expo start --dev-client --clear --localhost --port "$metro_port"'
assert_contains scripts/run-mobile.sh 'adb reverse "tcp:$metro_port" "tcp:$metro_port"'
assert_contains scripts/run-android.sh 'stop_project_metro "$ANDROID_METRO_PORT"'
assert_contains scripts/run-android.sh 'ensure_local_api "$repository_root" "$backend_launcher" "$backend_log_file"'
assert_contains scripts/run-android.sh '"$script_dir/stop-backend-local.sh"'
assert_contains scripts/run-web.sh 'ensure_local_api "$repository_root" "$backend_launcher" "$backend_log_file"'
assert_not_contains scripts/run-web.sh 'stop_started_backend'
assert_contains scripts/stop-backend-local.sh 'Refusing to stop PID'
assert_contains README.md 'Web memakai Metro `8081` dan Android Debug `8082`'

test_tmpdir=$(mktemp -d "${TMPDIR:-/tmp}/daycare-launcher-test.XXXXXX")
cleanup() {
  if [ -f "$test_tmpdir/api.pid" ]; then kill "$(cat "$test_tmpdir/api.pid")" >/dev/null 2>&1 || true; fi
  rm -rf "$test_tmpdir"
}
trap cleanup EXIT HUP INT TERM
mkdir "$test_tmpdir/bin"
ln -s "$(command -v lsof)" "$test_tmpdir/bin/lsof"
chmod +x "$repository_root/scripts/tests/fixtures/fake-local-api.sh"
export TMPDIR="$test_tmpdir"
export LOCAL_API_TEST_READY="$test_tmpdir/ready"
export LOCAL_API_TEST_STARTS="$test_tmpdir/starts"
export LOCAL_API_TEST_PID="$test_tmpdir/api.pid"
export LOCAL_API_TEST_LOG="$test_tmpdir/api.log"
export LOCAL_API_TEST_READY_CHECKS="$test_tmpdir/ready-checks"
sh "$0" --api-reuse-child || fail "launcher did not reuse an already-ready API"
[ ! -f "$LOCAL_API_TEST_STARTS" ] || fail "launcher started a duplicate API instead of reusing the ready API"
sh "$0" --api-existing-starting-child || fail "launcher did not wait for an existing API to become ready"
[ ! -f "$LOCAL_API_TEST_STARTS" ] || fail "launcher started a duplicate API while the existing API was booting"
PATH="$test_tmpdir/bin:$PATH" sh "$0" --api-start-child & first_launcher_pid=$!
PATH="$test_tmpdir/bin:$PATH" sh "$0" --api-start-child & second_launcher_pid=$!
wait "$first_launcher_pid" || fail "first launcher failed during concurrent API startup"
wait "$second_launcher_pid" || fail "second launcher failed during concurrent API startup"
start_count=$(wc -l <"$LOCAL_API_TEST_STARTS" | tr -d '[:space:]')
[ "$start_count" = "1" ] || fail "concurrent launchers started $start_count APIs instead of one"

echo "PASS: concurrent launchers share one API startup and use isolated Metro ports."
