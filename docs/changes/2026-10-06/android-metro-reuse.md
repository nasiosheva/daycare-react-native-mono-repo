# Android launcher Metro reuse

## Perubahan

- `scripts/run-mobile.sh` sekarang memeriksa status Metro di `localhost:8081` sebelum memulai Expo untuk Android lokal.
- Jika Metro yang sehat sudah berjalan, launcher langsung menggunakannya sehingga tidak memicu prompt port `8082` dalam mode non-interaktif.
- Launcher tetap memulai Metro baru ketika port `8081` belum memiliki packager yang sehat.

## Verifikasi

- `sh -n scripts/run-mobile.sh` lulus.
- `git diff --check` lulus.
- Validasi perangkat Android penuh belum dijalankan pada patch ini; verifikasi runtime memerlukan launcher dan perangkat yang terhubung.
