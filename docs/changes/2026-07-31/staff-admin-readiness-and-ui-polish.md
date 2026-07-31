# Kesiapan tenant Staff Admin dan penyempurnaan UI

## Perubahan

- Menambahkan `GET /api/v1/tenant-readiness` untuk Staff Admin membaca kesiapan tenant aktif menggunakan evaluasi yang sama dengan dashboard Platform Admin dan otorisasi tenant Staff Admin read-only.
- Home Staff Admin menampilkan kartu perhatian bila konfigurasi tenant belum lengkap, beserta daftar masalah dan pintasan ke hub Kelola.
- Menambahkan ikon serta state terpilih yang lebih jelas pada navigasi bawah, ikon sistem pada close Bottom Sheet dan chevron Navigation Card, serta token radius dan bayangan yang konsisten pada elemen UI terkait.

## Verifikasi

- Lulus `corepack pnpm verify`: lint, typecheck, dan 72 test TypeScript/mobile.
- Lulus `JAVA_HOME=$(/usr/libexec/java_home -v 21) gradle -p apps/api test --no-daemon`.
