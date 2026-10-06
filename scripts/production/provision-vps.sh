#!/usr/bin/env bash
# Prepares a fresh Ubuntu 24.04 VPS for the release flow in .github/workflows/deploy-production.yml:
# Java 21, PostgreSQL, Caddy, a restricted deployment user, the release root, the activation script,
# the umur-emas-api service, and its environment file. Safe to re-run: existing users, the database,
# and an existing environment file (with its secrets) are kept as they are.
set -euo pipefail

readonly app_root=/opt/umur-emas
readonly config_dir=/etc/umur-emas
readonly env_file=$config_dir/api.env
readonly firebase_file=$config_dir/firebase-service-account.json
readonly start_script=/usr/local/libexec/umur-emas-api-start
readonly unit_file=/etc/systemd/system/umur-emas-api.service
readonly activation_script=/usr/local/sbin/umur-emas-activate-release
readonly sudoers_file=/etc/sudoers.d/umur-emas-deploy
readonly service_user=umur-emas
readonly deploy_user=umur-emas-deploy
readonly database_name=daycare
readonly database_user=daycare
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly script_dir

usage() {
  cat <<'EOF'
Usage: sudo ./provision-vps.sh \
  --web-domain umuremas.id \
  --api-domain api.umuremas.id \
  --firebase-project-id <firebase-project-id> \
  --platform-admin-emails admin@example.com[,other@example.com] \
  --deploy-public-key <path to the GitHub Actions deploy public key (.pub)> \
  [--firebase-service-account <path to the Firebase service-account JSON>]

Run from a copy of scripts/production/ (activate-release.sh must sit next to this script).
Omit --api-domain to serve the API under https://<web-domain>/api instead of its own host.
EOF
}

web_domain=""
api_domain=""
firebase_project_id=""
platform_admin_emails=""
deploy_public_key=""
firebase_service_account=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --web-domain) web_domain="${2:?}"; shift 2 ;;
    --api-domain) api_domain="${2:?}"; shift 2 ;;
    --firebase-project-id) firebase_project_id="${2:?}"; shift 2 ;;
    --platform-admin-emails) platform_admin_emails="${2:?}"; shift 2 ;;
    --deploy-public-key) deploy_public_key="${2:?}"; shift 2 ;;
    --firebase-service-account) firebase_service_account="${2:?}"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage >&2; exit 1 ;;
  esac
done

fail() { echo "provision-vps: $*" >&2; exit 1; }
step() { printf '\n==> %s\n' "$*"; }

[[ $EUID -eq 0 ]] || fail "run with sudo."
[[ -n "$web_domain" && -n "$firebase_project_id" && -n "$platform_admin_emails" && -n "$deploy_public_key" ]] || { usage >&2; exit 1; }
# shellcheck disable=SC1091
source /etc/os-release
[[ "${ID:-}" == "ubuntu" && "${VERSION_ID:-}" == "24.04" ]] || fail "expected Ubuntu 24.04, found ${PRETTY_NAME:-unknown}."
[[ -f "$script_dir/activate-release.sh" ]] || fail "activate-release.sh must be next to this script."
grep -qE '^(ssh-ed25519|ssh-rsa|ecdsa-sha2-[a-z0-9-]+) ' "$deploy_public_key" || fail "$deploy_public_key is not an SSH public key (.pub)."
if [[ -n "$firebase_service_account" ]]; then
  grep -q '"type": *"service_account"' "$firebase_service_account" || fail "$firebase_service_account is not a service-account JSON file."
fi

step "Installing Java 21, PostgreSQL, Caddy, rsync, curl, and the firewall"
export DEBIAN_FRONTEND=noninteractive
apt-get update -q
# rsync receives release uploads and curl serves the workflow's API health check.
apt-get install -y -q openjdk-21-jre-headless postgresql caddy rsync curl ufw openssl

step "Creating the service user ($service_user) and the deployment user ($deploy_user)"
id "$service_user" &>/dev/null || useradd --system --home-dir "$app_root" --no-create-home --shell /usr/sbin/nologin "$service_user"
id "$deploy_user" &>/dev/null || useradd --create-home --shell /bin/bash "$deploy_user"
deploy_home="$(getent passwd "$deploy_user" | cut -d: -f6)"
install -d -m 700 -o "$deploy_user" -g "$deploy_user" "$deploy_home/.ssh"
authorized_keys="$deploy_home/.ssh/authorized_keys"
touch "$authorized_keys"
public_key_line="$(grep -m1 -E '^(ssh-ed25519|ssh-rsa|ecdsa-sha2-)' "$deploy_public_key")"
grep -qxF "$public_key_line" "$authorized_keys" || printf '%s\n' "$public_key_line" >> "$authorized_keys"
chown "$deploy_user:$deploy_user" "$authorized_keys"
chmod 600 "$authorized_keys"

step "Preparing $app_root and the release activation script"
install -d -m 755 -o root -g root "$app_root"
install -d -m 755 -o "$deploy_user" -g "$deploy_user" "$app_root/releases"
install -m 755 -o root -g root "$script_dir/activate-release.sh" "$activation_script"
sudoers_draft="$(mktemp)"
printf '%s ALL=(root) NOPASSWD: %s\n' "$deploy_user" "$activation_script" > "$sudoers_draft"
visudo -cf "$sudoers_draft" >/dev/null
install -m 440 -o root -g root "$sudoers_draft" "$sudoers_file"
rm -f "$sudoers_draft"

step "Preparing the $database_name database and the API environment file"
systemctl enable --now postgresql
install -d -m 750 -o root -g "$service_user" "$config_dir"
if [[ -f "$env_file" ]]; then
  echo "Keeping the existing $env_file and its secrets."
else
  database_password="$(openssl rand -hex 24)"
  if sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname = '$database_user'" | grep -q 1; then
    sudo -u postgres psql -v ON_ERROR_STOP=1 -q <<SQL
ALTER ROLE $database_user WITH LOGIN PASSWORD '$database_password';
SQL
  else
    sudo -u postgres psql -v ON_ERROR_STOP=1 -q <<SQL
CREATE ROLE $database_user WITH LOGIN PASSWORD '$database_password';
SQL
  fi
  env_draft="$(mktemp)"
  cat > "$env_draft" <<EOF
DATABASE_URL=jdbc:postgresql://127.0.0.1:5432/$database_name
POSTGRES_USER=$database_user
POSTGRES_PASSWORD=$database_password
FIREBASE_ISSUER_URI=https://securetoken.google.com/$firebase_project_id
LOCAL_AUTH_JWT_SECRET=$(openssl rand -hex 32)
QR_SIGNING_SECRET=$(openssl rand -hex 32)
CORS_ALLOWED_ORIGINS=https://$web_domain,https://www.$web_domain
PLATFORM_ADMIN_EMAILS=$platform_admin_emails
EOF
  install -m 640 -o root -g "$service_user" "$env_draft" "$env_file"
  rm -f "$env_draft"
  echo "Wrote $env_file with generated database, local-auth JWT, and QR signing secrets."
fi
sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname = '$database_name'" | grep -q 1 || sudo -u postgres createdb -O "$database_user" "$database_name"
if [[ -n "$firebase_service_account" ]]; then
  install -m 640 -o root -g "$service_user" "$firebase_service_account" "$firebase_file"
  echo "Installed the Firebase service account at $firebase_file."
fi

step "Installing the umur-emas-api service"
install -d -m 755 /usr/local/libexec
cat > "$start_script" <<EOF
#!/bin/sh
# The Firebase service account is a multi-line JSON document, so it is read from its own file
# instead of the systemd environment file.
set -eu
if [ -f $firebase_file ]; then
  FIREBASE_SERVICE_ACCOUNT_JSON="\$(cat $firebase_file)"
  export FIREBASE_SERVICE_ACCOUNT_JSON
fi
exec /usr/bin/java -XX:MaxRAMPercentage=60 -jar $app_root/current/api.jar
EOF
chmod 755 "$start_script"
cat > "$unit_file" <<EOF
[Unit]
Description=Umur Emas API
Requires=postgresql.service
After=network-online.target postgresql.service
Wants=network-online.target

[Service]
User=$service_user
Group=$service_user
EnvironmentFile=$env_file
WorkingDirectory=$app_root
ExecStart=$start_script
Restart=on-failure
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full
ProtectHome=true

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
# Started by the activation script once the first API release is uploaded.
systemctl enable umur-emas-api

step "Configuring Caddy"
caddyfile=/etc/caddy/Caddyfile
if [[ -f "$caddyfile" && ! -f "$caddyfile.orig" ]] && ! grep -q 'umur-emas' "$caddyfile"; then
  cp -p "$caddyfile" "$caddyfile.orig"
fi
web_site_block="	root * $app_root/current/web
	encode zstd gzip
	try_files {path} /index.html
	file_server"
if [[ -n "$api_domain" ]]; then
  cat > "$caddyfile" <<EOF
# umur-emas: managed by scripts/production/provision-vps.sh
$web_domain {
$web_site_block
}

www.$web_domain {
	redir https://$web_domain{uri} permanent
}

$api_domain {
	reverse_proxy 127.0.0.1:8080
}
EOF
else
  cat > "$caddyfile" <<EOF
# umur-emas: managed by scripts/production/provision-vps.sh
$web_domain {
	handle /api/* {
		reverse_proxy 127.0.0.1:8080
	}
	handle {
$web_site_block
	}
}

www.$web_domain {
	redir https://$web_domain{uri} permanent
}
EOF
fi
caddy validate --config "$caddyfile" --adapter caddyfile >/dev/null
systemctl enable caddy
systemctl reload-or-restart caddy

step "Opening SSH, HTTP, and HTTPS in the firewall"
ufw allow OpenSSH >/dev/null
ufw allow 80/tcp >/dev/null
ufw allow 443/tcp >/dev/null
ufw --force enable >/dev/null

cat <<EOF

Provisioning finished.
Next steps:
  1. Point the DNS A records of $web_domain${api_domain:+ and $api_domain} to this server. Caddy issues
     HTTPS certificates once they resolve here.
  2. In GitHub Actions settings set VPS_USER=$deploy_user and the variable VPS_APP_DIR=$app_root,
     and make VPS_SSH_PRIVATE_KEY the private key that matches $deploy_public_key.
  3. Run "Deploy production" manually with force_api checked: the first release must include the
     API, because there is no previous release to reuse it from.
EOF
