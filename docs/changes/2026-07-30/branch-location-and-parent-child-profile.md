# Lokasi cabang dan Profil Anak Parent

## Perubahan

- Menambahkan alamat lengkap free text dan tautan Google Maps opsional pada setiap cabang melalui migrasi Flyway `V4`.
- Staff Admin mengisi lokasi dari form Cabang yang ada; alamat wajib pada setiap create/update, sedangkan link hanya menerima URL HTTPS Google Maps yang valid.
- Parent mendapat layar **Profil Anak** read-only dari kartu anak di Home. Layar menampilkan data dasar anak, cabang/alamat, tombol Maps, kelas dan Tingkatan aktif, Program Anak, serta nama/peran Staff tanpa email atau kontak.
- Menambahkan kontrak `GET /api/v1/parent/children/{childId}/profile` yang secara khusus memverifikasi relasi wali-anak dan tidak menggunakan respons profil operasional Staff.

## Verifikasi

- Unit test backend mencakup penyimpanan alamat/link Maps dan penolakan link bukan Google Maps.
- Unit test API client mencakup payload lokasi cabang dan endpoint Profil Anak Parent.
- Lulus `corepack pnpm verify`: lint, typecheck, dan seluruh 67 test TypeScript/mobile berhasil.
- Lulus `JAVA_HOME=$(/usr/libexec/java_home -v 21) gradle -p apps/api test --no-daemon`: seluruh test Spring berhasil.
