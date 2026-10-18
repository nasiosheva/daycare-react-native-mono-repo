<!-- Mories Deo Hutapea,S.E.,S.Kom -->
# Banner global untuk Parent

## Perubahan

- Menambahkan `PlatformBanner` dan migrasi Flyway `V36`; data global dipisahkan dari pengumuman tenant.
- V36 menjadi satu migrasi untuk tabel promosi platform beserta target aksi `action_type`/`action_target`, kolom gambar dan aksi pengumuman tenant. Migrasi diuji pada cluster PostgreSQL scratch terisolasi untuk fresh install; database lokal persisten dan production tidak diubah.
- Platform Admin dapat menyimpan draf, mengubah draf, menerbitkan langsung, menjadwalkan waktu WIB, dan menutup promosi. Setiap promosi wajib menggunakan URL gambar HTTPS; riwayat tidak dihapus.
- Pengumuman tenant mendukung URL gambar HTTPS opsional agar pengumuman teks lama tetap kompatibel.
- Staff Admin dapat menonaktifkan CTA (default) atau mengonfigurasi satu CTA untuk browser HTTPS atau halaman aplikasi dari allowlist. Target route arbitrer/parameter bebas ditolak; CTA ditampilkan sebagai tombol eksplisit dan bukan membuat seluruh popup dapat diklik.
- Platform Admin dapat menonaktifkan aksi banner (default) atau mengatur klik banner untuk membuka browser HTTPS atau halaman aplikasi dari allowlist. Tanpa aksi yang valid, slide promosi tidak dapat diklik.
- Platform Admin dapat meninjau preview slider yang sama dengan Parent sebelum menyimpan; aksi navigasi pada preview selalu nonaktif.
- Expiry banner opsional menggunakan waktu WIB. Banner tidak dapat dijadwalkan setelah expiry, feed Parent segera menyembunyikan banner expired, dan scheduler menutup banner terjadwal/terbit tiap menit. Tanpa expiry, banner tetap tayang sampai ditutup manual.
- Review menemukan jadwal publikasi lampau sebelumnya berubah diam-diam menjadi publikasi langsung; API banner dan pengumuman kini menolak timestamp jadwal lampau agar tidak salah terbit.
- Review juga menemukan penutupan banner terjadwal menyisakan `scheduledAt`, yang melanggar constraint V36. Penutupan manual/otomatis kini mengosongkan timestamp jadwal.
- Parent terautentikasi dapat melihat promosi terbit melalui endpoint global, termasuk Parent yang belum memiliki tenant atau anak terhubung.
- Home Parent menampilkan promosi sebagai slider gambar tersendiri dan pengumuman tenant sebagai popup slider terpisah. Gambar yang gagal dimuat menampilkan placeholder aksesibel; tombol X popup menutup seluruh slide untuk kunjungan Home saat ini tanpa acknowledgement.
- Empty state tanpa hasil pada katalog program perkembangan menyediakan aksi untuk menghapus pencarian dan seluruh filter aktif.
- Menambahkan aturan bisnis, ringkasan README, dan proposal OpenSpec.

## Verifikasi

- Test backend `PlatformBannerServiceTest`, `TenantAnnouncementServiceTest`, `ImageUrlValidationTest`, dan `TenantAnnouncementActionValidationTest`.
- Test wrapper API client untuk payload gambar promosi dan gambar pengumuman.
- Test helper agregasi promosi/pengumuman Home Parent, pemetaan route allowlist, serta validasi URL gambar/aksi.
- Test UI popup pengumuman dan slider promosi.
- Mobile TypeScript check.
- Semua 63 file suite Vitest aplikasi lulus (250 test), semua 11 suite UI Jest lulus (44 test), dan TypeScript check lulus.
- Backend test terarah untuk validasi CTA, service pengumuman/banner, dan URL HTTPS lulus.
- Test regresi jadwal lampau dan penutupan banner terjadwal ditulis lebih dahulu, teramati gagal, lalu lulus setelah kedua temuan diperbaiki.
- Suite backend penuh `./apps/api/gradlew -p apps/api test --no-daemon` lulus setelah patch review.
- Semua 68 test API client lulus; lint lulus tanpa error dan melaporkan 14 warning pada file lain yang tidak terkait perubahan ini.
- UI tests: 3 suite, 12 tests lulus; UI Jest penuh: 11 suite, 44 tests lulus. Vitest aplikasi penuh: 63 file, 250 tests lulus. TypeScript check lulus.

## Batas verifikasi

- Migrasi belum dijalankan terhadap database lokal persisten/production; verifikasi scratch hanya membuktikan migrasi fresh-install pada cluster sementara.
- Belum dilakukan uji visual di device/browser; verifikasi UI dilakukan melalui test komponen.
