<!-- Mories Deo Hutapea,S.E.,S.Kom -->
# Browser internal aplikasi

## Perubahan

- CTA HTTPS dari banner promosi dan popup pengumuman kini membuka screen browser internal, bukan berpindah ke browser eksternal.
- Screen memiliki kolom alamat URL, tombol buka, navigasi kembali/maju, muat ulang, indikator pemuatan, dan pesan error.
- Alamat tanpa skema otomatis memakai HTTPS. URL HTTP, skema non-web, URL kredensial, dan URL tidak valid ditolak.
- Android/iOS menggunakan `react-native-webview` dan memeriksa setiap navigasi. Web menggunakan iframe terisolasi (tanpa akses origin/cookie aplikasi), hanya dirender dari origin HTTPS (loopback localhost diizinkan untuk development); browser memblokir frame HTTP sebagai mixed content. Batasan same-origin berarti URL akhir dan riwayat SPA situs tidak dapat dikendalikan seperti pada WebView native. Situs yang menolak iframe atau memerlukan akses cookie dapat tidak tampil/berfungsi di web.
- CTA halaman internal tetap mengikuti allowlist yang sudah ada. Link Google Maps, enrollment, dan link lain di luar CTA banner/pengumuman tidak berubah.

## Verifikasi

- Unit test normalisasi URL mencakup HTTPS, alamat tanpa skema, URL HTTP, skema berbahaya, kredensial, dan input invalid.
- UI test mencakup pemuatan URL awal, submit alamat, serta penolakan URL non-HTTPS.
- UI test banner/popup memastikan CTA HTTPS masuk ke route browser internal.
- Unit test origin browser memastikan HTTPS dan loopback lokal diizinkan, sementara origin HTTP non-loopback ditolak.
- Test origin ditulis lebih dahulu dan gagal karena modul belum ada; setelah helper/guard diterapkan, 3 test origin lulus.
- `pnpm verify` — lint, typecheck, dan seluruh test workspace lulus; aplikasi 72 file / 284 test.
- Coverage helper browser, filter, branch mapping, dan metadata download: statements/lines/functions 100%, branches 98.36%.
- `pnpm --filter @daycare/app test:ui` — 14 suite / 65 test lulus.
- `pnpm --filter @daycare/app exec expo export --platform web` dan `apps/mobile/android/gradlew :app:assembleDebug` — keduanya berhasil.

## Batas verifikasi

- Belum ada uji manual pada device iOS/Android. Navigasi web lintas-origin dibatasi sandbox, origin HTTPS, dan kebijakan mixed-content browser; situs dapat membatasi embed atau riwayat SPA.
