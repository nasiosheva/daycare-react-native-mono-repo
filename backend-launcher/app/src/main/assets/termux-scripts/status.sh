#!/data/data/com.termux/files/usr/bin/bash
set -eu

BASE="$HOME/backend-launcher"

if [ -f "$BASE/api.pid" ] && kill -0 "$(cat "$BASE/api.pid")" 2>/dev/null; then
  echo "RUNNING pid=$(cat "$BASE/api.pid")"
else
  echo "STOPPED"
fi
