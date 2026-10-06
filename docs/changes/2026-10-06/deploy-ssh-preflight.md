# Deploy production: preflight SSH, pemicu manual, runner terkunci

## Latar belakang

`Deploy production` gagal di setiap push sejak 2026-08-31, sebanyak 16 run
(terakhir `a9543a2`, PR #59). Semuanya gagal di step "Upload immutable
release" dengan `exit code 255`, yaitu exit code dari `ssh` sendiri:
runner GitHub tidak bisa tersambung atau login ke VPS. Build web selalu
lulus, dan file workflow tidak berubah sejak 2026-07-28. Production masih
menjalankan rilis 2026-08-23 (PR #44).

Pesan error SSH yang persis hanya ada di log job, yang membutuhkan hak admin
repo (API publik menolak `403`), sehingga penyebabnya tidak bisa dipastikan
dari luar. Perbaikan akarnya (pairing ulang deploy key, `VPS_KNOWN_HOSTS`,
`VPS_HOST`/`VPS_USER`) dilakukan di VPS dan GitHub Secrets oleh pemilik repo,
di luar perubahan kode ini.

## Perubahan

- **Step `Check SSH access`** (sebelum upload): menjalankan
  `ssh -o BatchMode=yes -o ConnectTimeout=20 … true`. Bila gagal, step ini
  menulis anotasi `::error` dengan alasan tetap: host key mismatch, key
  ditolak, host tidak terjangkau, koneksi ditolak, host tak ter-resolve, atau
  tidak dikenali. Anotasi terbaca lewat API publik tanpa akses log, dan hanya
  memuat teks tetap tersebut; output ssh mentah tetap di log (secret di-mask
  GitHub). Tidak ada `ssh-keyscan` di CI, sesuai aturan README untuk
  `VPS_KNOWN_HOSTS`.
- **Pemicu manual `workflow_dispatch`** dengan input boolean `force_api`. Run
  manual tidak punya rentang commit untuk di-diff, jadi API hanya dikirim bila
  `force_api` dicentang; web selalu dideploy. Ini menggantikan urutan re-run
  (#56 untuk API lalu #58 untuk web) saat merilis ulang setelah SSH diperbaiki.
  `activate-release.sh` aman untuk SHA yang sama: bila `current` sudah
  menunjuk rilis itu, `previous` tidak disentuh, dan API di-restart hanya bila
  ada `api.jar` baru.
- **`runs-on: ubuntu-24.04`** pada `deploy-production.yml` dan
  `pull-request-tests.yml`, karena label `ubuntu-latest` akan pindah ke Ubuntu
  26 mulai 2026-10-19 (anotasi notice pada run deploy).
- README bagian deploy diperbarui (pemicu manual, preflight, runner).

## Verifikasi

- YAML diparse (js-yaml): trigger `push` + `workflow_dispatch`, input
  `force_api` boolean default `false`, kedua job `ubuntu-24.04`, urutan step
  `Configure deploy SSH identity → Check SSH access → Upload immutable release`.
- Logika klasifikasi diuji dengan enam contoh output ssh nyata, dan masing-masing
  terpetakan ke alasan yang benar.
- Logika step `detect-api-changes` diuji untuk `workflow_dispatch`
  (`force_api` true/false) dan `push` (jalur diff lama tidak berubah).
- `actionlint` tidak tersedia di mesin lokal. Bukti akhirnya adalah run
  pertama setelah merge: yang diharapkan tetap gagal di `Check SSH access`
  (SSH belum dipairing ulang), tetapi kini dengan alasan yang terbaca.

## Tindak lanjut

- Pairing ulang deploy key dan perbarui secrets `VPS_*`, lalu jalankan manual
  `Deploy production` dengan `force_api` dicentang (backup database dulu:
  migrasi Flyway sejak 2026-08-23 akan berjalan sekaligus saat API baru start).
