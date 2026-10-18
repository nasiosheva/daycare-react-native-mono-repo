<!-- Mories Deo Hutapea,S.E.,S.Kom -->
# Popup pengumuman Parent tanpa bezel

## Perubahan

- Popup pengumuman hanya menampilkan gambar, tanpa header atau frame/bezel.
- Gambar mengisi area slide tanpa bezel; ikon X saja berada sebagai overlay di pojok kanan atas gambar aktif, tanpa latar/elevasi visual, dan indikator dot berada di atas gambar. Gambar dapat ter-crop mengikuti rasio area slide.
- Aksi acknowledgement yang memang diwajibkan tetap berada di luar gambar.

## Test-first dan verifikasi

- Test UI memeriksa tombol X di dalam slide aktif, posisi absolut pada pojok kanan atas, dan gambar mengisi slide (`cover`).
- Setiap popup memiliki aksi **Unduh** dan **Bagikan** sejajar di bawah slide. Unduh menyimpan gambar ke galeri di Android/iOS (izin simpan foto diminta saat aksi dipakai) dan mengunduh file melalui browser di web. Bagikan memakai share sheet native; web memakai Web Share API atau menyalin URL gambar ke clipboard sebagai fallback. Nama file unduhan mempertahankan format gambar dari URL atau MIME type respons.
- Test UI untuk aksi unduh/bagikan dijalankan merah sebelum implementasi tombol Bagikan, lalu hijau setelah perubahan. Verifikasi terbaru:
  - `pnpm --filter @daycare/app test:ui` — 14 suite, 65 test lulus.
  - `pnpm verify` — lint, typecheck, dan seluruh test workspace lulus; aplikasi 72 file / 284 test.
  - Coverage helper download, browser, filter, dan branch mapping: statements/lines/functions 100%, branches 98.36%.
  - Tes spesifik aksi native memeriksa izin simpan, kegagalan izin, penyimpanan galeri, dan share sheet; tes web memeriksa Web Share, clipboard fallback, dan validasi HTTPS.
  - `corepack pnpm --filter @daycare/app lint` — 0 error; 15 warning yang sudah ada di file lain.
  - `corepack pnpm --filter @daycare/app typecheck` dan `corepack pnpm --filter @daycare/app exec expo config --type public` — lulus.
  - `git diff --check` — lulus setelah perubahan akhir.
  - `pnpm --filter @daycare/app exec expo export --platform web` — berhasil.
  - `apps/mobile/android/gradlew :app:assembleDebug` — berhasil; belum diuji instalasi/manual pada device.

## Batas verifikasi

- Verifikasi ini menggunakan test UI lokal; belum dilakukan pemeriksaan visual pada perangkat Android/iOS.

## Unduh dan bagikan gambar

- Native memerlukan `expo-media-library` untuk menyimpan file ke galeri; konfigurasi hanya meminta izin tambah/simpan foto, bukan akses baca seluruh galeri.
- Test UI memastikan aksi Unduh dan Bagikan tampil berdampingan dan Bagikan memakai gambar slide aktif.

## Temuan review: ukuran halaman carousel

- `pagingEnabled` menggunakan lebar viewport ScrollView sebagai jarak antar-halaman, sedangkan komponen sebelumnya menghitung scroll dan indeks aktif dengan lebar slide yang lebih kecil. Pada viewport lebar, auto-advance dapat berhenti di antara halaman dan dot aktif tidak cocok dengan gambar.
- Test geometri ditambahkan lebih dahulu dan gagal (`Expected: 600, Received: 560`). Lebar dialog dan slide lalu diselaraskan pada maksimum 560 dp serta memakai lebar viewport setelah padding modal.
- `corepack pnpm --filter @daycare/app exec jest --config jest.ui.config.cjs --runInBand src/home/ParentAnnouncementPopup.ui.test.tsx` — 12/12 lulus setelah perbaikan.
- Verifikasi ulang setelah perbaikan: `corepack pnpm verify` lulus (72 file/284 test aplikasi), UI Jest penuh 14 suite/66 test lulus, backend suite penuh `BUILD SUCCESSFUL`, dan `git diff --check` lulus.
