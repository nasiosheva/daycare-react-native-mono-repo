# Foto Catatan Perkembangan

Setiap catatan perkembangan adalah satu observasi pada satu kategori perkembangan. Catatan dapat memiliki nol atau satu foto opsional sebagai bukti visual; fitur ini tidak mengubah kategori, judul, isi catatan, atau lifecycle catatan.

## Pengguna dan alur

1. Staff Admin atau Staff yang berada dalam scope anak membuka **Catat perkembangan**.
2. Setelah memilih kategori, mereka dapat memilih **Upload gambar** untuk galeri atau **Ambil foto** untuk kamera. Foto tidak wajib.
3. Saat catatan dibagikan, foto tersimpan bersama catatan tersebut. Setelah daftar riwayat diperbarui, catatan itu menampilkan thumbnail yang dapat diketuk; riwayat tetap dikelompokkan berdasarkan kategori.
4. Staff Admin, Staff dalam scope anak, dan Parent yang terhubung dapat membuka foto dari riwayat. Platform Admin tidak memiliki akses tenant-operasional ini.

## Kontrak dan batasan

- `POST /api/v1/children/{childId}/development-entries` menerima `photo` opsional: `{ contentType, dataBase64 }`.
- Hanya `image/jpeg` dan `image/png` diterima. Server mendekode Base64, memeriksa signature gambar, dan menolak data kosong atau lebih dari 5 MB.
- Respons daftar dan respons create hanya mengembalikan `hasPhoto`; bytes gambar tidak dikirim bersama daftar riwayat. Klien lalu mengambil foto hanya untuk record yang memiliki foto dan menampilkannya sebagai thumbnail.
- `GET /api/v1/children/{childId}/development-entries/{entryId}/photo` mengembalikan `{ contentType, dataBase64 }` setelah memvalidasi tenant, child ID, role, dan scope anak yang sama dengan riwayat perkembangan.
- Foto disimpan di PostgreSQL pada record `development_entries`. Belum ada edit, ganti, hapus foto, atau penyimpanan objek eksternal pada flow ini.

## Klien lintas platform

Modul image picker bersama menangani galeri dan kamera pada Android/iOS. Di web, tombol memakai pemilih berkas browser; tindakan kamera meminta capture environment bila browser mendukungnya. Error pemilih dan kegagalan simpan ditampilkan inline pada form.
