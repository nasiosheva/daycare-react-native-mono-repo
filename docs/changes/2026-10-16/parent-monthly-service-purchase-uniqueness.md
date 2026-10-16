<!-- Mories Deo Hutapea,S.E.,S.Kom -->

# Cegah pembelian paket bulanan Parent yang tumpang-tindih

## Perubahan

- Satu paket bulanan yang sama untuk anak yang sama tidak dapat dibuat kembali
  bila entitlement aktif atau menunggu pembayaran memiliki periode layanan yang
  bertumpang-tindih, termasuk bila request memakai idempotency key berbeda.
- Check duplikasi berjalan untuk pembelian Parent langsung dan approval
  enrollment. Kedua flow mengunci baris anak sebelum memeriksa/membuat
  entitlement sehingga aksi paralel pada anak yang sama terserialisasi.
- Retry intent bulanan pending yang identik (Parent, anak, paket, periode, dan
  kode promo) mengembalikan invoice yang sudah ada serta mencatat key baru.
  Pemilik Parent lain, periode/promo berbeda, invoice aktif/lunas, atau data
  overlap ambigu ditolak tanpa membuat invoice baru.
- Periode non-overlap, paket berbeda, dan anak berbeda tidak diblokir aturan
  ini. Expired/void tidak dianggap coverage yang sedang berjalan.
- Aturan diselaraskan di `docs/business-rules.md`, plan langganan, README, dan
  checklist branch.

## Bukti test-first dan verifikasi

- Red: `./apps/api/gradlew -p apps/api test --no-daemon --tests '*.BillingServiceCoverageTest'` gagal pada test baru karena pembelian bulanan tidak mengambil lock anak dan tidak mencegah invoice kedua.
- Green: perintah yang sama lulus setelah repository query overlap, row lock,
  guard duplikasi, dan replay invoice pending identik diterapkan.
- Regression tests mencakup active overlap dengan key baru, replay pending
  intent identik, lock saat purchase bulanan, dan jalur approval enrollment.
- Full `pnpm verify` lulus: lint, typecheck, dan 327 test workspace.
- Full backend `./apps/api/gradlew -p apps/api test --no-daemon --rerun-tasks`
  lulus: 899 tests, 0 failure/error; 4 API integration tests dilewati karena
  database integrasi tidak dikonfigurasi.
- `git diff --check` lulus. Migration tenant nyata, concurrency integration
  multi-connection, browser/device, dan CI head PR belum diuji; tidak ada
  database production yang disentuh.
