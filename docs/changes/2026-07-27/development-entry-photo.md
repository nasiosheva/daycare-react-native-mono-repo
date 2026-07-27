# Foto per Catatan Perkembangan

## Perubahan

- Menambahkan satu foto opsional pada setiap catatan perkembangan, sehingga setiap kategori yang dicatat dapat menyertakan foto dari galeri atau kamera.
- Menambahkan `hasPhoto` pada respons catatan dan endpoint baca foto terpisah agar daftar riwayat tidak membawa Base64 gambar.
- Menambahkan migrasi Flyway `V6__development_entry_photos.sql` untuk menyimpan content type serta bytes foto.
- Memakai image picker reusable pada Android, iOS, dan browser; preview, error picker, dan error simpan tampil inline pada form.
- Setelah upload sukses dan riwayat diperbarui, setiap catatan yang memiliki foto memuat thumbnail yang dapat diketuk untuk membuka viewer ukuran penuh.

## Aturan dan keamanan

- Hanya JPEG/PNG sampai 5 MB yang diterima; server memvalidasi Base64 dan signature file.
- Foto mengikuti otorisasi catatan perkembangan: Staff Admin, Staff dalam scope anak, atau Parent yang terhubung saja.
- Foto bersifat tambahan; catatan tanpa foto tetap dapat dibuat seperti sebelumnya.

## Verifikasi

- Typecheck aplikasi mobile dan test API client memeriksa kontrak klien.
- Test Gradle API menerapkan migrasi dan memverifikasi kompilasi backend.

## Tindak lanjut

- Edit/ganti/hapus foto dan object storage belum termasuk scope perubahan ini.
