#!/usr/bin/env sh
# Run the repository's complete local verification in one command.
#
# This intentionally does not start the API, Metro, a device, or a simulator;
# it is a deterministic source/test check that is safe to run from CI or a
# developer terminal.
set -eu

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
repository_root=$(CDPATH= cd -- "$script_dir/.." && pwd)
cd "$repository_root"

echo "[1/4] Checking launcher shell syntax..."
for launcher in \
  scripts/run-android.sh \
  scripts/run-ios.sh \
  scripts/run-web.sh \
  scripts/run-mobile.sh \
  scripts/run-backend-local.sh \
  scripts/run_full_suite_and_compile_check.sh
do
  sh -n "$launcher"
done

echo "[2/4] Running TypeScript lint, typecheck, and tests..."
corepack pnpm verify

echo "[3/4] Running the complete Spring API test suite..."
"$repository_root/apps/api/gradlew" -p "$repository_root/apps/api" test --no-daemon --rerun-tasks

echo "[4/4] Checking patch whitespace..."
git diff --check

echo "Full local verification passed."
