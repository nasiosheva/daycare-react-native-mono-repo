# Perlindungan signing Android saat prebuild

## Perubahan

- Android launcher kini menyalin sementara empat nilai `MYAPP_RELEASE_*` dan keystore release app-relative yang dirujuk sebelum menjalankan `expo prebuild --clean`.
- Setelah prebuild berhasil maupun gagal, launcher memulihkan material tersebut ke direktori Android lokal yang dibuat ulang dan menghapus salinan sementara yang berizin terbatas.

## Batasan

- Perlindungan ini hanya mencegah kehilangan pada prebuild berikutnya. Keystore yang telah terhapus sebelum perubahan ini tetap harus dipulihkan dari backup aman.
- Launcher tidak mencetak password atau lokasi salinan sementara ke output.

## Verifikasi

- Validasi sintaks shell untuk `scripts/run-mobile.sh`.
- Release launcher tetap mengharuskan empat properti dan file keystore tersedia sebelum membuat APK/AAB bertanda tangan.
