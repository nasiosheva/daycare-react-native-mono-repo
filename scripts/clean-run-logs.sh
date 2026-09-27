#!/usr/bin/env sh

set -eu

repository_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
run_logs_directory="$repository_root/run-logs"

if [ ! -d "$run_logs_directory" ]; then
  echo "No run-logs directory found; nothing to remove."
  exit 0
fi

log_count=$(find "$run_logs_directory" -type f -name '*.txt' -print | wc -l | tr -d ' ')
if [ "$log_count" -eq 0 ]; then
  echo "No .txt run logs found; nothing to remove."
  exit 0
fi

echo "Removing .txt session logs under $run_logs_directory..."
find "$run_logs_directory" -type f -name '*.txt' -print -delete
echo "Removed $log_count run log file(s)."
