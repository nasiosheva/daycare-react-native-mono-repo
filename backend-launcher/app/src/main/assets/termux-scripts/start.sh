#!/data/data/com.termux/files/usr/bin/bash
# Starts Postgres (if not already up) and the backend jar in the background.
set -eu

BASE="$HOME/backend-launcher"
PG_DATA="$PREFIX/var/lib/postgresql"

[ -f "$BASE/api.jar" ] || { echo "Missing $BASE/api.jar. Copy the backend jar there first."; exit 1; }

if ! pg_ctl -D "$PG_DATA" status >/dev/null 2>&1; then
  pg_ctl -D "$PG_DATA" -l "$BASE/postgres.log" start
  sleep 2
fi

if [ -f "$BASE/api.pid" ] && kill -0 "$(cat "$BASE/api.pid")" 2>/dev/null; then
  echo "API already running (pid $(cat "$BASE/api.pid"))"
  exit 0
fi

cd "$BASE"
export POSTGRES_HOST=127.0.0.1
export SPRING_PROFILES_ACTIVE=local
nohup java -jar api.jar >"$BASE/api.log" 2>&1 &
echo $! > "$BASE/api.pid"
echo "API started (pid $!)"
