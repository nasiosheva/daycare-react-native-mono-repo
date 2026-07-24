#!/usr/bin/env bash
set -euo pipefail

readonly app_root="${UMUR_EMAS_APP_ROOT:-/opt/umur-emas}"
readonly release_id="${1:?Release ID is required}"
readonly release_directory="$app_root/releases/$release_id"

if [[ ! "$release_id" =~ ^[a-f0-9]{40}$ ]]; then
  echo "Release ID must be a 40-character Git commit SHA." >&2
  exit 1
fi

test -f "$release_directory/api.jar"
test -d "$release_directory/web"

ln -sfn "$release_directory" "$app_root/current.next"
mv -Tf "$app_root/current.next" "$app_root/current"

systemctl restart umur-emas-api
systemctl reload caddy
