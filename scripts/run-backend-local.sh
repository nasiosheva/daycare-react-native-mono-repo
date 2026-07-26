#!/usr/bin/env sh

set -eu

repository_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
environment_file="$repository_root/.env"
environment_template="$repository_root/.env.example"
gradle_user_home="$repository_root/.gradle-local"
api_gradle="$repository_root/apps/api/gradlew"

ensure_java_21() {
  if command -v /usr/libexec/java_home >/dev/null 2>&1; then
    java_21_home=$(/usr/libexec/java_home -v 21 2>/dev/null || true)
    if [ -n "$java_21_home" ]; then
      export JAVA_HOME="$java_21_home"
      export PATH="$JAVA_HOME/bin:$PATH"
      return
    fi
  fi

  if command -v java >/dev/null 2>&1; then
    java_major=$(java -XshowSettings:properties -version 2>&1 | awk -F'= ' '/java.version =/ { print $2; exit }' | awk -F. '{ print $1 }')
    if [ "${java_major:-0}" -ge 21 ]; then
      return
    fi
  fi

  echo "JDK 21 is required for the local API. Install JDK 21, then run this launcher again." >&2
  exit 1
}

ensure_environment_file() {
  if [ -f "$environment_file" ]; then
    return
  fi

  if [ ! -f "$environment_template" ]; then
    echo "Missing $environment_file and its template $environment_template." >&2
    exit 1
  fi

  cp "$environment_template" "$environment_file"
  echo "Created $environment_file from $environment_template. Fill its required values, then run this launcher again." >&2
  exit 1
}

require_local_backend_values() {
  if [ "${LOCAL_AUTH_ENABLED:-false}" = "true" ]; then
    return
  fi

  case "${FIREBASE_ISSUER_URI:-}" in
    ""|*your-project-id*)
      echo "Missing or placeholder value: FIREBASE_ISSUER_URI in $environment_file" >&2
      exit 1
      ;;
  esac
}

ensure_local_backend_tools() {
  for command in curl pg_isready; do
    if ! command -v "$command" >/dev/null 2>&1; then
      echo "$command is required to run the local API. Install it, then run this launcher again." >&2
      exit 1
    fi
  done

  if [ ! -x "$api_gradle" ]; then
    echo "Missing local Gradle Wrapper at $api_gradle." >&2
    echo "Generate it with: gradle -p apps/api wrapper --gradle-version 8.14.2" >&2
    echo "Then run this launcher again." >&2
    exit 1
  fi
}

local_postgres_ready() {
  postgres_host=${POSTGRES_HOST:-localhost}
  postgres_port=${POSTGRES_PORT:-5432}
  pg_isready -h "$postgres_host" -p "$postgres_port" >/dev/null 2>&1
}

local_api_ready() {
  curl --silent --fail --max-time 2 http://localhost:8080/api/v3/api-docs >/dev/null 2>&1
}

local_api_port_pid() {
  lsof -ti tcp:8080 -sTCP:LISTEN 2>/dev/null | head -n 1
}

ensure_local_postgres() {
  if local_postgres_ready; then
    echo "Using existing local PostgreSQL at ${POSTGRES_HOST:-localhost}:${POSTGRES_PORT:-5432}."
    return
  fi

  if ! command -v docker >/dev/null 2>&1 || ! docker compose version >/dev/null 2>&1; then
    echo "No PostgreSQL service is available for the local stack." >&2
    echo "Start PostgreSQL locally on ${POSTGRES_HOST:-localhost}:${POSTGRES_PORT:-5432} or install Docker Desktop, then run this launcher again." >&2
    exit 1
  fi

  echo "Starting local PostgreSQL container..."
  (
    cd "$repository_root"
    docker compose up -d postgres
  )

  attempts=0
  while [ "$attempts" -lt 30 ]; do
    if local_postgres_ready; then
      return
    fi
    attempts=$((attempts + 1))
    sleep 1
  done

  echo "Timed out waiting for local PostgreSQL." >&2
  exit 1
}

ensure_api_port_available() {
  existing_api_pid=$(local_api_port_pid || true)
  if [ -z "$existing_api_pid" ]; then
    return
  fi

  echo "Port 8080 is already in use by PID $existing_api_pid and is not the ready local API." >&2
  exit 1
}

ensure_java_21
ensure_environment_file

set -a
. "$environment_file"
set +a

ensure_local_backend_tools
require_local_backend_values
if local_api_ready; then
  echo "Local API is already ready at http://localhost:8080/api."
  exit 0
fi
ensure_api_port_available
ensure_local_postgres

echo "Starting local API at http://localhost:8080/api. Press Ctrl+C to stop it."
cd "$repository_root"
export SPRING_PROFILES_ACTIVE=local
export GRADLE_USER_HOME="$gradle_user_home"
exec "$api_gradle" --no-daemon -p "$repository_root/apps/api" bootRun --stacktrace
