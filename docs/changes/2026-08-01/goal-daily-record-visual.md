# Visual Rekam Hasil Harian Goal

## Perubahan

- Grafik garis progres Goal diganti dengan **Rekam Hasil Harian Goal**.
- Setiap tanggal yang memiliki hasil tersimpan menampilkan semua indikator aktif sebagai Ya, Tidak, atau Belum dicatat, serta jumlah indikator yang sudah tercatat.
- Bila belum ada hasil tersimpan, visual tetap menampilkan seluruh indikator aktif sebagai **Belum dicatat**, tanpa menciptakan tanggal penilaian fiktif.
- Hari parsial terlihat sebagai data parsial; tidak dipaksa menjadi hari lengkap atau nilai persentase Goal.
- Bila belum ada hari lengkap, ringkasan tidak lagi menampilkan `Ya 0/0 · 0%`. Kesimpulan terminal kini dilabeli **Kesimpulan Staff** agar berbeda dari status target sistem.

## Verifikasi

- `corepack pnpm verify`.
- `git diff --check`.

## Tindak lanjut

- Perhitungan API tidak berubah: persentase Yes dan streak tetap menggunakan hanya tanggal dengan hasil semua indikator aktif.
