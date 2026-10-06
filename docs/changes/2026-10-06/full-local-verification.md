# Full local verification launcher

## Perubahan

- Menambahkan `scripts/run_full_suite_and_compile_check.sh` sebagai satu perintah verifikasi lokal.
- Script memeriksa sintaks launcher, menjalankan `corepack pnpm verify`, menjalankan test lengkap Spring API dengan Gradle Wrapper, dan memeriksa whitespace Git.
- Test Gradle dijalankan dengan `--rerun-tasks` agar suite benar-benar dieksekusi, bukan hanya dinyatakan `UP-TO-DATE` oleh cache lokal.
- Script tidak menjalankan backend, Metro, emulator, atau perangkat sehingga aman dijalankan tanpa mengubah runtime lokal.

## Verifikasi

- Script dijalankan setelah dibuat; hasil setiap tahap dicatat pada handoff.
