#!/usr/bin/env bash
set -euo pipefail

readonly app_root="${UMUR_EMAS_APP_ROOT:-/opt/umur-emas}"
readonly rollback_argument="--rollback"

activate_release() {
  local release_id="$1"
  local release_directory="$app_root/releases/$release_id"
  local current_directory=""
  local restart_api=true

  if [[ ! "$release_id" =~ ^[a-f0-9]{40}$ ]]; then
    echo "Release ID must be a 40-character Git commit SHA." >&2
    exit 1
  fi

  test -d "$release_directory/web"

  # Web-only releases keep the existing API artifact and do not restart it.
  if [[ ! -f "$release_directory/api.jar" ]]; then
    test -f "$app_root/current/api.jar"
    cp -p "$app_root/current/api.jar" "$release_directory/api.jar"
    restart_api=false
  fi

  current_directory="$(readlink -f "$app_root/current" 2>/dev/null || true)"
  if [[ -n "$current_directory" && "$current_directory" != "$release_directory" ]]; then
    test -d "$current_directory/web"
    test -f "$current_directory/api.jar"
    ln -sfn "$current_directory" "$app_root/previous.next"
    mv -Tf "$app_root/previous.next" "$app_root/previous"
  fi

  ln -sfn "$release_directory" "$app_root/current.next"
  mv -Tf "$app_root/current.next" "$app_root/current"

  if [[ "$restart_api" == true ]]; then
    systemctl restart umur-emas-api
  fi
  systemctl reload caddy
}

rollback_release() {
  local current_directory=""
  local previous_directory=""

  current_directory="$(readlink -f "$app_root/current")"
  previous_directory="$(readlink -f "$app_root/previous")"
  test -d "$current_directory/web"
  test -f "$current_directory/api.jar"
  test -d "$previous_directory/web"
  test -f "$previous_directory/api.jar"

  ln -sfn "$current_directory" "$app_root/previous.next"
  mv -Tf "$app_root/previous.next" "$app_root/previous"
  ln -sfn "$previous_directory" "$app_root/current.next"
  mv -Tf "$app_root/current.next" "$app_root/current"
  systemctl restart umur-emas-api
  systemctl reload caddy
}

if [[ "${1:-}" == "$rollback_argument" ]]; then
  rollback_release
else
  activate_release "${1:?Release ID is required}"
fi
