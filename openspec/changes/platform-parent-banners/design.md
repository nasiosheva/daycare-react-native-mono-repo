<!-- Mories Deo Hutapea,S.E.,S.Kom -->
# Design: banner global Parent

`platform_banners` menyimpan URL gambar HTTPS wajib, judul, isi, status, waktu jadwal/publikasi/expiry/penutupan, serta metadata pengguna pembuat dan pengubah. `expires_at` opsional adalah batas akhir tampil dalam `TIMESTAMPTZ`; bila diisi harus setelah waktu publikasi. Feed Parent mengecualikan expiry berdasarkan waktu saat request, sedangkan scheduler tiap menit mengubah banner terjadwal/terbit yang kedaluwarsa menjadi `CLOSED`. `tenant_announcements` mendapat URL gambar HTTPS opsional agar pengumuman tenant dapat ditampilkan dalam popup slider tanpa memutus kompatibilitas pengumuman lama.

Migrasi `V36__platform_parent_banners.sql` mencakup tabel promosi platform dan perubahan gambar/aksi pengumuman tenant dalam satu migrasi. V36 telah diuji pada cluster PostgreSQL scratch terisolasi untuk fresh install; database lokal persisten dan production belum diubah. Jangan membuat migrasi kedua untuk bagian UI/API ini dan jangan mengubah migration `V20` yang sudah lama.

API:

- `GET/POST /api/v1/platform/banners`, `PUT /api/v1/platform/banners/{id}`, dan aksi `publish`/`close` hanya untuk Platform Admin.
- `GET /api/v1/parent/platform-banners` hanya untuk akun dengan `registrationRole=PARENT`; autentikasi tetap wajib tetapi header tenant tidak dipakai.
- Status: `DRAFT` dapat diedit; dapat dipublikasikan langsung atau menjadi `SCHEDULED`; jadwal publikasi dan expiry diproses setiap menit; `PUBLISHED`/`SCHEDULED` dapat ditutup manual atau otomatis menjadi `CLOSED`. Tidak ada delete.
- Parent feed promosi mengembalikan `PUBLISHED` saja. Tenant announcements tetap mempertahankan recipient-scope lama.

Mobile:

- Platform Admin membuka layar Banner Parent dari Home untuk CRUD lifecycle.
- Form draf menyediakan expiry opsional berupa tanggal dan waktu WIB serta preview slider non-interaktif; scheduledAt harus lebih awal daripada expiry.
- Parent Home (termasuk onboarding/tanpa tenant) menampilkan slider gambar promosi platform dan popup slider pengumuman tenant secara terpisah. Popup hanya memuat recipient announcements yang lolos scope tenant; tiap slide mempertahankan konteks tenant untuk acknowledgement atau membuka daftar pengumuman.
- Gambar promosi/pengumuman memakai placeholder berlabel aksesibel saat resource gagal dimuat. Tombol X popup menutup semua slide pada kunjungan saat ini, tanpa mencatat acknowledgement.
- Staff Admin dapat memilih `NONE` (default), `OPEN_BROWSER` dengan target HTTPS, atau `OPEN_APP_PAGE` dengan halaman dari allowlist terkontrol. CTA hanya muncul sebagai tombol eksplisit; target/path arbitrer tidak pernah diteruskan langsung ke router.
- Seluruh copy baru diterjemahkan ke tujuh locale yang didukung.
