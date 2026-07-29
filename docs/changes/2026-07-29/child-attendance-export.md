# Rekap kehadiran anak per cabang

## Perubahan

- Menambahkan menu **Rekap kehadiran anak** pada Kelola untuk `STAFF_ADMIN`.
- Menambahkan layar laporan dengan cabang aktif wajib dan periode default dari awal bulan berjalan sampai hari ini.
- Menambahkan ekspor PDF/XLSX yang dibangun API untuk satu baris per anak aktif di cabang: total check-in, total check-out, dan check-in yang masih belum check-out.
- Menambahkan kontrak `GET /api/v1/reports/children/attendance/export` dan klien API bertipe untuk mengunduh file tersebut.
- Menjadikan aksi unduh laporan reusable dan menampilkan kegagalan unduh secara inline, termasuk untuk ekspor daftar anak yang sudah ada.

## Aturan dan dampak

- Hanya Staff Admin tenant yang dapat membuat rekap dan cabang harus milik tenant tersebut; Staff Admin tidak aktif tetap mengikuti akses baca tenant yang ada.
- Anak aktif tanpa record tetap muncul dengan semua total bernilai nol.
- Nilai nol tidak menyatakan anak absen; periode dapat memuat hari tanpa booking atau tanpa operasi.
- Laporan Staff belum termasuk dalam perubahan ini dan tetap berada di scope pekerjaan berikutnya.

## Verifikasi

- Unit test API mencakup agregasi anak dengan dan tanpa record, validasi periode, serta keluaran PDF/XLSX.
- Unit test klien API mencakup URL ekspor dengan cabang dan rentang tanggal.
- Jalankan `corepack pnpm verify` dan `./apps/api/gradlew -p apps/api test --no-daemon` dengan JDK 21.
