<!-- Mories Deo Hutapea,S.E.,S.Kom -->

# Kebijakan test-first

## Perubahan

- Menambahkan aturan di `CLAUDE.md` bahwa test otomatis harus dibuat atau
  diperbarui sebelum kode produksi untuk setiap feature atau bug fix.
- Alur wajib: jalankan test terarah dan buktikan gagal karena perilaku yang
  belum tersedia (red), implementasikan perubahan, lalu jalankan ulang hingga
  lulus (green) dan lanjutkan ke suite relevan.
- Jika otomatisasi memang tidak memungkinkan, alasan teknis dan metode
  verifikasi alternatif harus ditentukan sebelum implementasi serta dicatat di
  checklist branch/MR.
- Menambahkan butir test-first pada template checklist MR dan ringkasan aturan
  pada README.

## Verifikasi

- `git diff --check` — lulus.
- Perubahan ini hanya dokumentasi/proses; test aplikasi tidak dijalankan.
