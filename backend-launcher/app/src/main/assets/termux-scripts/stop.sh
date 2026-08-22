#!/data/data/com.termux/files/usr/bin/bash
set -eu

BASE="$HOME/backend-launcher"

if [ -f "$BASE/api.pid" ] && kill -0 "$(cat "$BASE/api.pid")" 2>/dev/null; then
  kill "$(cat "$BASE/api.pid")"
  rm -f "$BASE/api.pid"
  echo "API stopped"
else
  echo "API was not running"
fi
