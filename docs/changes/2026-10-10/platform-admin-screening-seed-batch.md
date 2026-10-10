# Batch seed screening melalui Platform Admin

## Rencana dan perubahan

- Menambahkan alur Platform Admin untuk melihat metadata batch seed screening,
  menjalankan preview, dan menerapkan batch yang sudah di-allowlist.
- Apply memerlukan konfirmasi eksplisit `APPLY`, menggunakan akun Platform
  Admin yang sedang login sebagai aktor audit, dan tetap idempotent.
- Seed hanya membuat katalog `DRAFT`; publish tetap melalui lifecycle katalog.
- Deploy dan startup API tetap tidak menjalankan seed otomatis.

## Verifikasi

- Preview tidak mengubah database.
- Apply dicatat pada `screening_seed_manifests`.
- Batch yang sama tidak menggandakan data.
- Status akses dan error ditampilkan di UI Platform Admin.

// Mories Deo Hutapea,S.E.,S.Kom
