# Distribusi APK ke tester lewat Firebase App Distribution

## Perubahan

- Script baru `scripts/distribute-android.sh [<local|dev|prod>] [--groups] [--release-notes-file] [--skip-build]`:
  1. memilih environment (argumen atau menu interaktif);
  2. memastikan Firebase CLI terautentikasi (`firebase login` atau `GOOGLE_APPLICATION_CREDENTIALS`);
  3. membaca App ID Android dari `google-services.json` berdasarkan package di `app.json`;
  4. memeriksa bahwa setiap grup tester yang diminta sudah ada, **sebelum** build;
  5. memanggil `build-android.sh release apk <env>`;
  6. mengunggah APK dengan catatan rilis otomatis (versi, environment, commit, branch, subjek commit) atau file catatan sendiri.
- Grup default `qa-tester` adalah grup yang sudah ada di project `usia-emas-app` (display name "QA Tester", 3 tester saat skrip dibuat). `FIREBASE_APP_DISTRIBUTION_GROUPS` atau `--groups` dapat memilih grup lain.
- Daftar grup membutuhkan firebase-tools 14+. Firebase CLI lokal 13.24 tidak mendukungnya, sehingga skrip memakai `npx firebase-tools@15` dengan login yang sama. Deteksi memakai versi mayor, karena `firebase help <perintah-tak-dikenal>` di v13 tetap mengembalikan exit 0.
- `docs/android-release-apk.md` (bagian baru dan troubleshooting) serta `README.md` diperbarui.

## Verifikasi

- `sh -n` lulus; `--help` dan argumen tidak dikenal ditangani.
- App ID terbaca: `com.children.platform` → `1:858262261520:android:5244ee3e6a7b3bd5ba9f95`.
- Grup tidak ada (`--groups bukan-grup`) berhenti sebelum build dengan daftar grup yang tersedia.
- Grup `qa-tester` lolos pemeriksaan; `--skip-build` tanpa APK berhenti sebelum upload.
- Belum ada upload nyata. Upload langsung mengirim email ke seluruh tester grup, jadi baru dijalankan atas persetujuan pemilik rilis.
