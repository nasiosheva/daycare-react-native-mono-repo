# Rencana: Batch seed Cek perkembangan melalui Platform Admin

## Tujuan

Menyediakan cara terkontrol bagi Platform Admin untuk melihat, melakukan
preview, dan menerapkan batch katalog screening yang sudah dibundel di server
tanpa SSH atau menjalankan service API kedua di production.

## Batasan

- Hanya Platform Admin aktif yang dapat melihat dan menjalankan batch.
- Browser hanya mengirim `batchId` yang sudah di-allowlist; browser tidak boleh
  mengirim isi dataset, checksum, SQL, atau kode Kotlin.
- Batch awal tetap menghasilkan template `DRAFT`. Publish, review, dan validasi
  tetap merupakan aksi katalog yang terpisah.
- Startup API, deploy, restart, rollback, dan migration tidak menjalankan seed.
- Tidak ada operasi delete atau overwrite terhadap batch yang sudah diterapkan.

## Alur UI

1. Platform Admin membuka Katalog Screening.
2. Bagian Batch Data menampilkan batch yang tersedia, checksum, jumlah template,
   pertanyaan, pilihan, terjemahan, dan status penerapan.
3. Admin menekan Preview. Server memvalidasi batch dan menampilkan hasil tanpa
   mutasi.
4. Admin menekan Terapkan, membaca peringatan, lalu mengetik `APPLY` pada
   dialog konfirmasi.
5. Server menerapkan batch secara idempotent dan UI menampilkan manifest audit.
6. Admin melanjutkan validasi/review/publish setiap template secara terpisah.

## Kontrak backend

- `GET /api/v1/platform/screening/seed-batches` mengembalikan metadata batch
  allowlist dan status manifest.
- `POST /api/v1/platform/screening/seed-batches/{batchId}/preview` melakukan
  validasi read-only.
- `POST /api/v1/platform/screening/seed-batches/{batchId}/apply` menerima hanya
  `{ "confirmation": "APPLY" }`.
- Semua endpoint memanggil `requirePlatformAdmin` dan memakai transaksi.
- `appliedBy` diisi dari identitas akun Platform Admin yang terautentikasi,
  bukan dari input browser.
- Batch yang telah ada dengan checksum sama menghasilkan `ALREADY_APPLIED`;
  checksum berbeda ditolak.

## Pengamanan dan audit

- ID batch dan checksum berasal dari `ScreeningInitialDataset`.
- Konfirmasi eksplisit wajib dilakukan untuk mutasi.
- Manifest mencatat batch, versi, checksum, aktor, waktu, dan jumlah data.
- Tidak ada data Parent yang dibaca atau dikembalikan dalam alur ini.
- Endpoint tidak tersedia untuk Parent, Staff, atau Staff Admin.
- Error validasi harus ditampilkan sebagai pesan yang dapat ditindaklanjuti,
  tanpa stack trace atau rahasia konfigurasi.

## Validasi

- Unit test untuk allowlist, preview, apply, idempotensi, checksum mismatch,
  dan akses non-Platform Admin.
- API test untuk kontrak HTTP.
- UI test untuk preview, konfirmasi, error, dan status applied.
- Dokumentasikan hasil penerapan production melalui manifest, bukan dengan
  menganggap deploy otomatis telah menjalankan seed.

// Mories Deo Hutapea,S.E.,S.Kom
