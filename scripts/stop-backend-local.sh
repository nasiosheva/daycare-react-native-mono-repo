#!/usr/bin/env sh
# Mories Deo Hutapea,S.E.,S.Kom
set -eu

repository_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)

if ! command -v lsof >/dev/null 2>&1 || ! command -v ps >/dev/null 2>&1; then
  echo "lsof and ps are required to safely identify the local API process." >&2
  exit 1
fi

api_pids=$(lsof -ti tcp:8080 -sTCP:LISTEN 2>/dev/null || true)
if [ -z "$api_pids" ]; then
  echo "No process is listening on local API port 8080."
  exit 0
fi

for api_pid in $api_pids; do
  api_command=$(ps -p "$api_pid" -o command= 2>/dev/null || true)
  case "$api_command" in
    *"$repository_root/apps/api"*|*com.daycare.api.DaycareApplicationKt*)
      echo "Stopping this repository's local API (PID $api_pid)..."
      kill "$api_pid"
      ;;
    *)
      echo "Refusing to stop PID $api_pid on port 8080; it does not look like this repository's API." >&2
      exit 1
      ;;
  esac
done

attempt=0
while [ "$attempt" -lt 15 ]; do
  if [ -z "$(lsof -ti tcp:8080 -sTCP:LISTEN 2>/dev/null || true)" ]; then
    echo "Local API stopped."
    exit 0
  fi
  sleep 1
  attempt=$((attempt + 1))
done

echo "Local API is still listening on port 8080; inspect its process before retrying." >&2
exit 1
