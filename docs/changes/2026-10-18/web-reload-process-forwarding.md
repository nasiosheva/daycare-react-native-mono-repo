# Perbaikan reload Web melalui process forwarding

## Masalah

Tombol `r` pada `scripts/run-web.sh` menghentikan wrapper `run-mobile.sh`, tetapi proses Expo/Metro masih menjadi child process. Pada beberapa kondisi child tersebut tetap hidup sebagai orphan dan mempertahankan port `8081`, sehingga sesi Web berikutnya tidak benar-benar dimulai ulang.

## Perubahan

Untuk semua environment Web, `run-mobile.sh` sekarang memakai `exec` saat memulai Expo. Dengan begitu PID yang disimpan `run-web.sh` adalah proses Expo yang sebenarnya dan `SIGINT` dari kontrol `r` atau `s` diterima langsung oleh Expo.

Cleanup Metro stale untuk local environment tetap dipertahankan sebagai guard tambahan.

## Verifikasi

- `sh -n scripts/run-web.sh scripts/run-mobile.sh scripts/lib/interactive-menu.sh`
- `git diff --check`
