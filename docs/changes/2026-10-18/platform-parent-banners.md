<!-- Mories Deo Hutapea,S.E.,S.Kom -->
# Banner global untuk Parent

## Perubahan

- Komponen `TextField` mendukung aksi X opsional (`clearable`) untuk mengosongkan nilai terkontrol, dengan label aksesibilitas yang diterjemahkan di seluruh locale. Form banner mengaktifkannya pada judul, URL gambar, dan URL browser; field lain tidak berubah.
- Galeri `/component-preview` menampilkan slider promosi tiga slide khusus preview menggunakan URL `https://picsum.photos/seed/picsum/200/300`; data contoh ini tidak dikirim ke API atau dipakai sebagai banner tenant/platform sungguhan.
- Carousel promosi dan popup hanya menggunakan swipe kiri/kanan untuk navigasi manual, tetap dengan dot dan auto-slide; timer dijeda selama drag dan dimulai ulang setelah drag berakhir, tanpa tombol next/previous.
- Dot indikator ditampilkan sebagai overlay di bagian bawah gambar, dengan latar gelap transparan agar terbaca dan tidak menangkap gesture swipe.
- Lebar slide diukur dari viewport carousel yang benar-benar dirender, lalu diatur 88% dari lebar tersebut; ini menjaga sebagian slide berikutnya tetap terlihat di preview desktop yang dibatasi `maxWidth` maupun layar mobile. Test memakai lebar viewport terukur, bukan lebar perangkat.
- Rasio gambar carousel dipadatkan dari 16:9 ke 2.4:1 agar tinggi banner lebih ringkas tanpa mengubah navigasi swipe atau auto-slide.

- Menambahkan `PlatformBanner` dan migrasi Flyway `V36`; data global dipisahkan dari pengumuman tenant.
- V36 menjadi satu migrasi untuk tabel promosi platform beserta target aksi `action_type`/`action_target`, kolom gambar dan aksi pengumuman tenant. Migrasi diuji pada cluster PostgreSQL scratch terisolasi untuk fresh install; database lokal persisten dan production tidak diubah.
- Platform Admin dapat menyimpan draf, mengubah draf, menerbitkan langsung, menjadwalkan waktu WIB, dan menutup promosi. Setiap promosi wajib menggunakan URL gambar HTTPS; riwayat tidak dihapus.
- Pengumuman tenant baru wajib memiliki URL gambar HTTPS dan tidak meminta pesan pada form; judul/label dipakai untuk administrasi dan aksesibilitas. Kolom `body` tetap kompatibel untuk data lama, boleh kosong, dan notifikasi memakai label gambar sebagai fallback jika body kosong.
- Staff Admin dapat menonaktifkan aksi (default) atau mengonfigurasi satu aksi browser HTTPS/halaman aplikasi allowlist. Target route arbitrer/parameter bebas ditolak; aksi aktif menjadikan gambar terkait sebagai target klik.
- Platform Admin dapat menonaktifkan aksi banner (default) atau mengatur klik banner untuk membuka browser HTTPS atau halaman aplikasi dari allowlist. Tanpa aksi yang valid, slide promosi tidak dapat diklik.
- Platform Admin dapat meninjau preview slider yang sama dengan Parent sebelum menyimpan; aksi navigasi pada preview selalu nonaktif.
- Expiry banner opsional menggunakan waktu WIB. Banner tidak dapat dijadwalkan setelah expiry, feed Parent segera menyembunyikan banner expired, dan scheduler menutup banner terjadwal/terbit tiap menit. Tanpa expiry, banner tetap tayang sampai ditutup manual.
- Review menemukan jadwal publikasi lampau sebelumnya berubah diam-diam menjadi publikasi langsung; API banner dan pengumuman kini menolak timestamp jadwal lampau agar tidak salah terbit.
- Review juga menemukan penutupan banner terjadwal menyisakan `scheduledAt`, yang melanggar constraint V36. Penutupan manual/otomatis kini mengosongkan timestamp jadwal.
- Parent terautentikasi dapat melihat promosi terbit melalui endpoint global, termasuk Parent yang belum memiliki tenant atau anak terhubung.
- Home Parent menampilkan promosi dan pengumuman sebagai dua carousel gambar terpisah dengan auto-slide dan dot indikator. Popup pengumuman hanya menampilkan gambar, memiliki tombol X untuk menutup seluruh slide pada kunjungan Home saat ini, serta acknowledgement terpisah hanya jika diwajibkan record. Gambar gagal dimuat menampilkan placeholder aksesibel; data lama tanpa gambar tidak dimasukkan ke popup.
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

## Klarifikasi UI dan follow-up review

- Promosi platform dan pengumuman tenant adalah dua sumber data/fitur berbeda; keduanya tampil sebagai carousel URL gambar yang auto-slide dan memiliki indikator dot. Tidak ada judul/isi pesan yang dirender sebagai caption.
- Form pengumuman tenant tidak meminta pesan. Field judul/label tetap metadata admin dan aksesibilitas; API/DB mempertahankan `body` lama untuk kompatibilitas, mengizinkan nilai kosong, dan memakai judul sebagai fallback notifikasi.
- Item popup hanya menampilkan gambar sebagai konten, kontrol X untuk menutup, dan kontrol acknowledgement hanya bila kebijakan record mewajibkannya. Record lama tanpa gambar tersimpan namun tidak ditampilkan di popup.
- Aksi klik dihitung per gambar agar menekan slide tertentu tidak menjalankan tujuan aksi dari slide lain. Auto-slide memakai hook bersama dan aman ketika daftar kosong berubah menjadi berisi.
- Test regresi mencakup carousel, auto-advance, popup tanpa gambar legacy, konten image-only, serta aksi pada slide yang benar.

## Perbaikan hub pengelolaan konten

- Home Platform Admin dan menu Staff Admin mengarah ke satu hub dengan bagian dan aksi buat/kelola yang terpisah sesuai izin role.
- Aksi Buat meneruskan parameter route yang membuka form terkait secara langsung; parameter dibersihkan setelah dipakai dan hanya diproses oleh role yang berwenang.
- Hub memiliki terjemahan lengkap untuk 7 locale aplikasi.
- Carousel banner untuk semua audience tetap image-only; metadata judul/isi tidak ditampilkan sebagai caption.
- Banner mendukung audience global Parent, semua Staff Admin aktif, atau Staff Admin aktif dari satu tenant terpilih. Audience tenant wajib mempunyai target organisasi valid; feed Staff Admin menggabungkan audience global dan tenant aktif saja, termasuk saat subscription tenant dibatasi. Endpoint feed memvalidasi membership Staff Admin aktif berdasarkan `X-Organization-Id`.
- CTA banner divalidasi berdasarkan audience: Parent memakai allowlist halaman Parent; Staff Admin memakai allowlist halaman tenant. URL browser tetap HTTPS. Target tenant tidak dapat digunakan untuk audience global, dan route lintas-role ditolak.
- Feed Staff Admin memerlukan organisasi aktif dan memvalidasi membership aktif `STAFF_ADMIN` di backend. Feed menggabungkan banner Staff Admin global dengan banner target tenant yang sama; banner Parent dan tenant lain tidak ikut. Feed tetap dapat dibaca saat subscription tenant dibatasi agar informasi platform tetap terlihat.
- Kontrak audience disimpan pada `platform_banners.audience_type` dan `target_organization_id`; constraint DB menjaga konsistensi audience/target. Migrasi `V37__platform_banner_audiences.sql` disiapkan, tetapi belum dijalankan.
- Verifikasi akhir: backend Gradle penuh lulus; API client 68/68; Vitest aplikasi 64 file/252 test; route destination 2/2; UI Jest slider dan hub 10/10; UI package 7 suite/30 test; TypeScript aplikasi dan `git diff --check` lulus. Jest hub masih menampilkan warning React `act(...)` dari ikon Expo tanpa kegagalan test.
- Belum ada bukti uji visual di device/browser atau penerapan migrasi ke database persisten.
- Koreksi form banner: pesan/isi bukan bagian dari konten banner dan dihapus dari UI serta payload baru. Judul tetap sebagai metadata administrasi/aksesibilitas; kontrak `body` lama bersifat opsional dan kolom database dipertahankan tanpa migrasi. Daftar admin dan preview tidak merender body.
- Verifikasi koreksi pesan (test-first): test `PlatformBannerServiceTest` mula-mula gagal compile karena `body` wajib; setelah kontrak diperbaiki test fokus dan suite backend penuh lulus. Vitest aplikasi 64 file/252 test, API client 68/68, TypeScript mobile, dan `git diff --check` lulus.

## Ringkasan antrean review langganan di Home Platform Admin

- Menambahkan `GET /api/v1/platform/tenant-subscription/review-summary` yang mengembalikan hitungan server untuk bukti `SUBMITTED` dan koreksi `PENDING`; masing-masing hitungan nol bila feature flag antreannya nonaktif.
- Kedua count endpoint tetap mensyaratkan Platform Admin. Repository menghitung seluruh antrean, tidak memakai jumlah item halaman pertama.
- Home Platform Admin menampilkan kartu dengan jumlah kedua jenis antrean, empty state, loading, dan error, lalu membuka halaman tinjauan pembayaran langganan. Pull-to-refresh juga memperbarui count.
- Seluruh locale aplikasi mendapat teks kartu; aturan ringkasan ditambahkan pada `docs/business-rules.md`.
- Verifikasi: dua suite service backend untuk proof/correction lulus; seluruh 68 test API client lulus; typecheck aplikasi lulus.
