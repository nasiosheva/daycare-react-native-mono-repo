# Rename production infrastructure to Usia Emas

## Scope

The new VPS uses the `usia-emas` infrastructure identifier consistently. This is
separate from the public Firebase project configuration, which already uses
`usia-emas-app`.

## Updated identifiers

- Release root: `/opt/usia-emas`
- Runtime configuration: `/etc/usia-emas`
- Firebase service-account file: `/etc/usia-emas/firebase-service-account.json`
- API environment file: `/etc/usia-emas/api.env`
- API service: `usia-emas-api`
- Runtime user/group: `usia-emas`
- Deployment user: `usia-emas-deploy`
- Activation command: `/usr/local/sbin/usia-emas-activate-release`
- API start helper: `/usr/local/libexec/usia-emas-api-start`
- Activation environment override: `USIA_EMAS_APP_ROOT`

The database name remains `daycare`; it is a data contract and is not a filesystem
or product-brand path.

## VPS transition

The VPS was new and did not contain the previous `umur-emas` service or release
directory. The validated Firebase service-account JSON was staged at the new
configuration path with mode `600` and owner `root`. Full provisioning supports
Ubuntu 20.04 and 24.04 and must be run with `scripts/production/provision-vps.sh`.
The script adds the official Caddy repository when the base image does not
provide a Caddy package.
