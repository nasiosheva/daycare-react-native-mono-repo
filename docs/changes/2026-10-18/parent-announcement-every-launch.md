<!-- Mories Deo Hutapea,S.E.,S.Kom -->
# Popup pengumuman tampil pada setiap peluncuran aplikasi

## Perilaku

- Popup pengumuman Parent yang masih memenuhi syarat tampil setiap aplikasi diluncurkan ulang.
- Menekan X hanya menyembunyikan popup selama runtime aplikasi saat ini; tidak membuat status tutup permanen atau per akun.
- Perilaku ini sudah mengikuti state in-memory di `ParentAnnouncementPopup`; tidak diperlukan perubahan produksi atau penyimpanan backend.

## Verifikasi

- `pnpm --filter @daycare/app test:ui` — lulus, 14 suite / 65 test, termasuk popup muncul kembali setelah mount baru.
- `pnpm verify` — lulus untuk lint, typecheck, dan Vitest seluruh workspace; aplikasi: 72 file / 284 test.

## Batas verifikasi

- Test mount baru memverifikasi state dismissal tidak dipersistenkan. Tidak dilakukan uji manual force-stop/relaunch pada device.
- Membawa aplikasi dari background ke foreground tidak dianggap sebagai peluncuran baru; popup yang sudah ditutup tetap tersembunyi selama runtime yang sama.
