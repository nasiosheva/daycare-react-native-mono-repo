# Catatan implementasi — 2026-10-10

## Cakupan

- Menyelesaikan wiring fase Parent dan Platform Admin untuk katalog screening:
  route, client API, UI wizard, draft/resume, snapshot hasil, dan ekspor PDF.
- Menambahkan konteks anak tenant yang legal tanpa memberikan akses data screening
  kepada Staff/Staff Admin atau membuat merge otomatis ke profil screening global.
- Menambahkan jawaban `MULTI_CHOICE` untuk konteks bahasa dan area kekhawatiran;
  server menormalisasi kode pilihan dan memvalidasi seluruh pilihan aktif sebelum
  menyimpan batch.
- Menjadikan dataset awal deterministik dan manual-only: 12 template usia 2–60
  bulan, 238 pertanyaan (166 perkembangan + 72 konteks), 964 pilihan, rule typed,
  teks id/en, seluruhnya berstatus `DRAFT`.
- Memperketat penghapusan draft katalog: hanya provenance `MANUAL`, tidak pernah
  menghapus template yang sudah direferensikan sesi/hasil, dan urutan FK aman.

## Gate yang masih sengaja terbuka

Review ahli tumbuh kembang, validasi bahasa/budaya, privasi/hukum, dan persetujuan
publikasi tetap wajib sebelum template apa pun diubah menjadi `PUBLISHED`. Konten usia
61–215 bulan belum di-seed; katalog sudah menerima rentang tersebut untuk fase konten
terpisah. Tidak ada perubahan production, commit, atau push pada sesi ini.

## Verifikasi

- `./apps/api/gradlew -p apps/api compileKotlin --no-daemon`
- `./apps/api/gradlew -p apps/api test --no-daemon`
- `pnpm --filter @daycare/api-client typecheck`
- `pnpm --filter @daycare/api-client test`
- `pnpm --filter @daycare/app typecheck`
- `pnpm --filter @daycare/app test` (44 file, 142 test lulus)
- `git diff --check`

Semua pemeriksaan lokal di atas lulus. Ini adalah bukti compile/unit/typecheck lokal;
belum merupakan bukti deploy production, migrasi database target, uji browser/device,
atau persetujuan klinis, privasi, hukum, dan bahasa.
