#!/usr/bin/env bash
set -euo pipefail

readonly app_root="${UMUR_EMAS_APP_ROOT:-/opt/umur-emas}"
readonly release_id="${1:?Release ID is required}"
readonly release_directory="$app_root/releases/$release_id"

if [[ ! "$release_id" =~ ^[a-f0-9]{40}$ ]]; then
  echo "Release ID must be a 40-character Git commit SHA." >&2
  exit 1
fi

test -d "$release_directory/web"

# Web-only CI releases preserve the currently deployed API artifact. API builds
# and migrations are intentionally not performed by GitHub Actions.
restart_api=true
if [[ ! -f "$release_directory/api.jar" ]]; then
  test -f "$app_root/current/api.jar"
  cp -p "$app_root/current/api.jar" "$release_directory/api.jar"
  restart_api=false
fi

ln -sfn "$release_directory" "$app_root/current.next"
mv -Tf "$app_root/current.next" "$app_root/current"

if [[ "$restart_api" == true ]]; then
  systemctl restart umur-emas-api
fi
systemctl reload caddy
