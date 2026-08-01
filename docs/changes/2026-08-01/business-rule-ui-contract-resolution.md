# Resolusi Ketidaksesuaian Business Rule

## Perubahan

- `AGENTS.md` kini mewajibkan agen membandingkan setiap UI/UX yang berhubungan dengan bisnis beserta backend, API, otorisasi, state, dan kontrak datanya terhadap `docs/business-rules.md`.
- Agen harus membedakan aturan implementasi saat ini dari aturan target/future yang memang belum dibangun.
- Bila terdapat mismatch, agen berhenti sebelum implementasi terkait dan meminta keputusan pengguna: memperbarui business rule, menyelaraskan implementasi, atau mempertimbangkan alternatif ketiga yang lebih aman bila dua pilihan awal tidak masuk akal secara operasional.
- Alternatif common-sense tidak boleh dipilih atau diimplementasikan tanpa keputusan eksplisit pengguna.
- Memori proyek lokal diperbarui agar prinsip resolusi tersebut bertahan untuk pekerjaan berikutnya.

## Verifikasi

- Meninjau konsistensi dengan aturan konflik dan dokumentasi wajib yang sudah ada di `AGENTS.md`.
- `git diff --check`.

## Tindak lanjut

- README ditinjau tetapi tidak diubah karena ini hanya governance untuk agen repository; tidak ada perubahan alur produk, kontrak publik, konfigurasi, maupun prosedur operasional pengguna.
