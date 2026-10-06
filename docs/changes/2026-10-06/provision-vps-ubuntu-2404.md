# Skrip provisioning VPS production (Ubuntu 24.04)

## Latar belakang

VPS production lama (IP `103.197.188.200`) habis masa sewa sekitar akhir
Agustus 2026 dan diganti VPS baru (`139.190.100.239`, Biznet Gio) yang masih
kosong: tidak ada user deploy, `/opt/umur-emas`, skrip aktivasi, maupun
service. Diagnosis bertahap lewat step `Check SSH access`
(`deploy-ssh-preflight.md`) menunjukkan tiga lapisan masalah:
1. `VPS_HOST` masih IP lama → diperbaiki pemilik repo.
2. Host key berubah → `VPS_KNOWN_HOSTS` diperbarui.
3. Deploy key tidak terdaftar → server memang belum disiapkan.

VPS baru semula Ubuntu 20.04, yang dukungan standarnya habis Mei 2025.
Karena server masih kosong, diputuskan reinstall ke Ubuntu 24.04 LTS.
Repo sebelumnya tidak menyimpan langkah provisioning apa pun selain
`activate-release.sh`, sehingga setup server lama tidak bisa direproduksi.

## Perubahan

- `scripts/production/provision-vps.sh` (baru, idempoten, hanya Ubuntu 24.04):
  - paket: `openjdk-21-jre-headless`, `postgresql`, `caddy`, `rsync` (menerima
    upload rilis), `curl` (health check workflow), `ufw`, `openssl`;
  - user service `umur-emas` (nologin) dan user deploy `umur-emas-deploy`
    dengan public key deploy GitHub Actions di `authorized_keys`;
  - `/opt/umur-emas/releases` milik user deploy; `activate-release.sh`
    dipasang sebagai `/usr/local/sbin/umur-emas-activate-release` (root) dengan
    aturan sudoers yang hanya mengizinkan perintah itu (divalidasi `visudo -c`);
  - database `daycare` dan `/etc/umur-emas/api.env` (root:umur-emas, 640). Saat
    file belum ada, password database, `LOCAL_AUTH_JWT_SECRET`, dan
    `QR_SIGNING_SECRET` dibuat acak; file yang sudah ada tidak pernah ditimpa;
  - service account Firebase opsional disimpan sebagai file terpisah dan
    diekspor oleh skrip start, karena JSON multi-baris tidak bisa ditaruh di
    environment file systemd;
  - unit `umur-emas-api` (hardening `NoNewPrivileges`, `ProtectSystem=full`,
    `ProtectHome`, `PrivateTmp`), di-enable tetapi baru di-start oleh skrip
    aktivasi saat rilis API pertama;
  - Caddyfile: web SPA (`output: single`, fallback ke `index.html`) di domain
    web, redirect `www`, API di-reverse-proxy ke `127.0.0.1:8080` di domain API
    (atau di `/api` domain web bila `--api-domain` tidak diberikan);
  - `ufw`: OpenSSH, 80, 443.
- README bagian deploy: cara memakai skrip, dan koreksi daftar env produksi.
  Daftar lama tidak mencantumkan `LOCAL_AUTH_JWT_SECRET` (padahal
  `LocalJwtService` menolak start tanpa secret ≥32 byte) dan mewajibkan
  `FIREBASE_SERVICE_ACCOUNT_JSON`, yang menurut tabel env README sendiri tidak
  dibutuhkan alur akun/password saat ini.

## Verifikasi

- `bash -n` lolos; argumen dan guard (root, Ubuntu 24.04, keberadaan
  `activate-release.sh`, format public key dan JSON service account) dicek di
  lokal. Skrip berhenti sebelum mengubah apa pun bila guard gagal.
- `shellcheck`/`caddy validate` tidak tersedia di mesin lokal. Skrip sendiri
  menjalankan `visudo -cf` untuk sudoers dan `caddy validate` untuk Caddyfile
  di server sebelum memakainya.
- Bukti akhirnya adalah menjalankan skrip di VPS lalu run manual
  `Deploy production` dengan `force_api` sampai health check API `UP`.

## Tindak lanjut (dilakukan pemilik repo)

- Reinstall VPS ke Ubuntu 24.04, lalu perbarui `VPS_KNOWN_HOSTS` sekali lagi.
- Arahkan DNS A `umuremas.id` dan `api.umuremas.id` (`www` adalah CNAME ke apex)
  dari `103.197.188.200` ke `139.190.100.239`.
- Database lama ikut hilang bersama VPS lama kecuali ada backup; tanpa backup,
  database baru dimulai kosong (Flyway membuat skema saat API start).
- Set `VPS_USER=umur-emas-deploy`, variable `VPS_APP_DIR=/opt/umur-emas`, dan
  `VPS_SSH_PRIVATE_KEY` dari key yang cocok dengan public key deploy.
