# Android production-service launcher preflight

## Perubahan

- Android launcher kini menemukan dan memakai `adb` dari `ANDROID_HOME`, `ANDROID_SDK_ROOT`, atau lokasi SDK macOS standar tanpa mengharuskan developer menambahkannya ke `PATH` terlebih dahulu.
- Resolusi lokasi SDK dipakai ulang saat launcher membuat `android/local.properties`, sehingga pemeriksaan dan konfigurasi Android memakai sumber yang sama.

## Perilaku dan batasan

- `./run-android-prod.sh` tetap membuka Expo development client dengan konfigurasi layanan produksi; script ini bukan pembuat APK rilis bertanda tangan.
- Jika SDK tidak berada pada lokasi standar, developer tetap perlu mengatur `ANDROID_HOME` atau `ANDROID_SDK_ROOT`.

## Verifikasi

- `sh -n run-android-prod.sh scripts/run-mobile.sh` berhasil.
- `.env.prod`, konfigurasi Firebase Android, JDK 21, SDK Android, dan perangkat `94GAY0NRYY` terdeteksi pada mesin pengembangan.
- Launcher tidak dibuka dalam pemeriksaan ini, sehingga Metro dan aplikasi di perangkat tidak diubah.
