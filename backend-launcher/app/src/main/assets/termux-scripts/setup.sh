#!/data/data/com.termux/files/usr/bin/bash
# One-time setup: installs the JDK and Postgres this backend needs, and
# initializes a fresh Postgres data directory. Safe to run more than once.
set -eu

pkg install -y openjdk-21 postgresql

BASE="$HOME/backend-launcher"
mkdir -p "$BASE"

PG_DATA="$PREFIX/var/lib/postgresql"
if [ ! -d "$PG_DATA" ]; then
  initdb "$PG_DATA"
fi

if ! pg_ctl -D "$PG_DATA" status >/dev/null 2>&1; then
  pg_ctl -D "$PG_DATA" -l "$BASE/postgres.log" start
  sleep 2
fi

# Matches the fallback defaults in apps/api's application.yml
# (POSTGRES_DB/POSTGRES_USER/POSTGRES_PASSWORD = daycare) so the backend
# jar needs no extra environment variables to connect.
psql -U "$(whoami)" -d postgres -tc "SELECT 1 FROM pg_roles WHERE rolname = 'daycare'" | grep -q 1 \
  || psql -U "$(whoami)" -d postgres -c "CREATE ROLE daycare WITH LOGIN PASSWORD 'daycare' SUPERUSER;"
psql -U "$(whoami)" -d postgres -tc "SELECT 1 FROM pg_database WHERE datname = 'daycare'" | grep -q 1 \
  || psql -U "$(whoami)" -d postgres -c "CREATE DATABASE daycare OWNER daycare;"

echo "Setup complete. Place the backend jar at $BASE/api.jar, then use Start."
