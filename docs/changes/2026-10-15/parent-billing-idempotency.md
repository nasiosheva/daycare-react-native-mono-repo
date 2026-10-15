<!-- Mories Deo Hutapea,S.E.,S.Kom -->

# Idempotency billing Parent

## Perubahan

- Pembelian paket dan unggah bukti pembayaran Parent kini meminta UUID
  `Idempotency-Key` pada API dan API client.
- Ledger idempotency Parent menyimpan tenant, aktor, operasi, key, hash payload,
  serta invoice target; migrasi `V33__parent_billing_idempotency.sql` menambah
  tabel dan unique scope key. Migrasi hanya dibuat, tidak dijalankan.
- Retry dengan payload identik mengembalikan invoice/purchase terdahulu;
  pemakaian ulang key dengan payload berbeda menghasilkan conflict. Ledger
  SaaS tenant dan model invoice Parent tetap terpisah.
- Mobile menyimpan key aksi secara persisten sampai server sukses. Hash field
  memakai encoding length-prefixed; file bukti di-hash langsung sebagai byte
  untuk menghindari alokasi string hex sebesar file.
- Invoice dan bukti dikunci ketika bukti dikirim, invoice dibayar, atau bukti
  ditinjau, agar update status bersamaan tidak saling menimpa.

## Verifikasi

- `./apps/api/gradlew -p apps/api test --no-daemon` — lulus, seluruh suite backend.
- `pnpm verify` — lulus (lint, typecheck, dan test workspace: 327 tests).
- Tes baru mencakup replay, payload conflict, key baru, pencatatan ledger,
  boundary hash, serta replay purchase tanpa membuat invoice/booking kedua.
- Tidak ada database lokal/production yang dimigrasikan.

## Batas

- Idempotency key mencegah duplikasi akibat retry dengan key yang sama. Ia
  bukan constraint domain universal untuk dua aksi Parent berbeda dengan key
  berbeda; constraint tambahan harus mengikuti aturan pembelian/booking Parent
  yang sah, agar pembelian layanan berulang yang valid tetap dapat dilakukan.
- Status rollout, retensi bukti, keamanan storage, dan gate subscription SaaS
  tetap mengikuti `docs/business-rules.md` dan plan utama.
