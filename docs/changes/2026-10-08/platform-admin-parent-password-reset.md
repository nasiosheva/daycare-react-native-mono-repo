# Reset password Parent oleh Platform Admin

## Perubahan

- Menambahkan `GET /api/v1/platform/parents` untuk mencari akun dengan `registrationRole=PARENT`.
- Menambahkan `POST /api/v1/platform/parents/{userId}/password` untuk menetapkan password aplikasi baru.
- Reset hanya menyimpan BCrypt hash, mencabut semua sesi pengguna, dan tidak mengubah binding tenant, profil, anak, langganan, atau membership.
- Menambahkan menu **Kelola akun Parent** di Home Platform Admin. Setiap kartu Parent membuka Bottom Sheet untuk password baru dan konfirmasi password.
- Daftar Parent hanya menampilkan metadata aman: identitas, status binding, jumlah tenant aktif, dan apakah password aplikasi tersedia. Password lama maupun hash tidak pernah dikembalikan API.

## Verifikasi

- Unit test service Platform Admin mencakup otorisasi dan reset password Parent.
- Typecheck aplikasi mobile dan test backend dijalankan setelah perubahan.
