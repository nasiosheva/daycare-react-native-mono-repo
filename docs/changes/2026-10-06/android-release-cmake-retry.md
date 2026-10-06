# Android release CMake retry

## Perubahan

- `scripts/build-android.sh` sekarang mengulang build Release satu kali jika Gradle gagal.
- Sebelum retry, script hanya menghapus cache CMake native yang dihasilkan di Android app dan `expo-modules-core`.
- Signing, source code, dependencies, dan konfigurasi environment tidak dihapus atau diubah.

## Alasan

- Build Release sebelumnya gagal saat linker mencari `src/fabric/libfabric.a` pada task `expo-modules-core`.
- Build yang sama berhasil ketika dijalankan ulang, sehingga gejalanya konsisten dengan cache/intermediate CMake yang tidak sinkron.

## Verifikasi

- `sh -n scripts/build-android.sh` lulus.
- Build `./scripts/build-android.sh release apk prod` berhasil setelah kegagalan sebelumnya.
