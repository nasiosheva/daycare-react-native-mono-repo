// Mories Deo Hutapea,S.E.,S.Kom

# Perbaikan temuan code review: tenant subscription management

## Konteks

Code review menyeluruh (4 reviewer paralel: backend logic/security, backend test
coverage, mobile UI/UX, dokumentasi) terhadap seluruh working tree branch
`feat/tenant-subscription-management` dibanding `production` menghasilkan 7
temuan BLOCKING dan beberapa non-blocking. Dokumen ini mencatat perbaikan atas
seluruh temuan BLOCKING plus satu non-blocking (README) yang dikerjakan di
hari yang sama.

## Perubahan

### 1. Idempotency untuk `markPaymentPaid`/`voidPayment`
- Migration baru `V32__tenant_payment_decision_idempotency.sql`: kolom
  `decision_by_user_id`, `decision_idempotency_key`, `decision_payload_hash`
  pada `tenant_payments` + unique constraint `(decision_by_user_id,
  decision_idempotency_key)`, meniru pola `review_idempotency_key` yang sudah
  ada di `tenant_payment_proofs`/`tenant_payment_correction_requests`.
- `PlatformAdministrationService.markPaymentPaid`/`voidPayment` sekarang
  menerima `Idempotency-Key` UUID, mengunci row pembayaran (`findWithLockById`,
  sebelumnya `findById` tanpa lock), replay key+payload sama mengembalikan
  hasil yang sama, payload berbeda menghasilkan `TenantSubscriptionIdempotencyConflict`.
- `Controllers.kt` kedua endpoint menambahkan `@RequestHeader("Idempotency-Key")`.
- `packages/api-client` dan seluruh pemanggil mobile (`tenant-detail.tsx`,
  `platform-tenants.tsx`, alur approve proof di
  `TenantSubscriptionPaymentProofService.review`) diperbarui mengirim key.
- Test baru: replay+conflict untuk kedua method di `PlatformAdministrationServiceTest.kt`.

### 2. Registrasi error message (aturan "three registrations" di CLAUDE.md)
- 35 pesan validasi baru dari 7 service (`TenantSubscriptionBillingPolicy`,
  `TenantSubscriptionRenewalService`, `TenantSubscriptionPaymentProofService`,
  `TenantSubscriptionCorrectionService`, serta pesan `Page must be zero or
  greater`/`Page size must be between 1 and 50/100` yang sebelumnya juga belum
  terdaftar) didaftarkan ke `ApiExceptionHandler.errorKeys` +
  `errors_id.properties` + `errors_en.properties`.

### 3. Penambahan test coverage (branch coverage JaCoCo, sebelum → sesudah)
- `TenantSubscriptionPaymentProofService.kt`: 14% → 68% branch, 21% → 67%
  method, 24% → 98% line. Menutup gap kritis: `content()` (otorisasi akses
  dokumen lintas tenant, sebelumnya 0%), `review()` (0%), `submit()` happy
  path (sebelumnya tidak pernah diuji), `ownProofs`/`reviewQueue`/`featureStatus`.
- `TenantSubscriptionRenewalService.kt`: 52% → 90% branch, 100% method/line.
  Menutup konversi TRIAL, chaining periode sudah-vs-belum-dimulai, periode
  fresh-start setelah EXPIRED, validasi fee/status/pending-payment/billing-policy.
- `TenantSubscriptionInvoiceNumberGenerator.kt`: file test baru dibuat
  (sebelumnya tidak ada sama sekali, 0% coverage) — 100% branch, menguji
  format nomor invoice dan error saat upsert sequence gagal.
- `TenantSubscriptionReminderService.kt`: 30% → 75% branch. Menutup
  `platformReminderPage` (0% sebelumnya), reminder tipe `PERIOD_END` dan
  `PAYMENT_DUE` (sebelumnya hanya `TRIAL_END` yang diuji).

### 4. Arsitektur i18n `translations.ts`
- 9 blok translation baru untuk fitur ini sudah lengkap 7 locale, tapi tidak
  digabung ke pola baku (`...spread` ke const `id`/`en`/dst final) — tipe
  `translations` dilemahkan jadi `Partial<Record<TranslationKey, string>>`
  dan `translate()` memakai 9 lookup manual paralel. Dikembalikan ke pola
  baku: tipe kembali ke `Record<AppLocale, Record<TranslationKey, string>>`
  (jaring pengaman compile-time penuh), 9 blok di-spread ke tiap locale,
  lookup manual di `translate()` dihapus.
- Mengembalikan tipe ketat ini langsung menangkap bug nyata: satu pemanggilan
  `api.markTenantPaymentPaid(...)` di `platform-tenants.tsx` (dari perbaikan
  #1 di atas) sempat lupa diupdate dengan parameter `idempotencyKey` baru —
  `tsc --noEmit` gagal compile sampai diperbaiki.

### 5. Idempotency key persisten di antrean review Platform Admin
- `tenant-subscription-review.tsx`: key sebelumnya di-generate ulang
  (`createIdempotencyKey()` inline) setiap `submitDecision()` dipanggil, dan
  BottomSheet tidak ditutup saat error — retry setelah gagal mendapat key
  baru, melanggar kontrak replay idempoten. Key sekarang di-generate SEKALI
  saat decision dibuka (`ReviewDecision.idempotencyKey`) dan dipakai ulang
  untuk setiap percobaan submit sampai sheet ditutup.

### 6. Ringkasan finansial dinamis pada konfirmasi renewal Staff Admin
- `tenant-subscription.tsx`: konfirmasi renewal sebelumnya memakai
  `Alert.alert` dengan teks statis generik. Diganti BottomSheet yang
  menampilkan nominal tagihan, periode tambahan, dan tanggal jatuh tempo —
  dihitung dari data subscription yang sudah di-fetch (mirror kasus umum
  logika server: TRIAL/ACTIVE/GRACE melanjutkan dari periode berjalan,
  EXPIRED mulai dari hari ini), bukan nilai statis. Kasus langka
  "periode berikutnya sudah dibuat dan di-chain" sengaja tidak direplikasi
  persis di client (hanya server yang menghitungnya) untuk menghindari
  recalculating server-owned value yang bisa menyimpang dari kebenaran server.

### 7. Non-blocking: README env var
- Menambahkan 3 baris tabel environment variable yang sebelumnya tidak
  disebut: `TENANT_SUBSCRIPTION_PAYMENT_PROOF_ENABLED`,
  `TENANT_SUBSCRIPTION_CORRECTION_ENABLED`, `TENANT_SUBSCRIPTION_PAYMENT_INSTRUCTIONS`.

## Verifikasi

- `./apps/api/gradlew -p apps/api test --no-daemon` — BUILD SUCCESSFUL, seluruh
  suite backend lulus (termasuk test baru).
- `pnpm --filter @daycare/app typecheck` — lulus (menangkap dan memverifikasi
  perbaikan bug argumen yang hilang di atas).
- `pnpm lint` — lulus bersih di seluruh workspace TS (exit 0).
- `pnpm test` — 224 test mobile + seluruh test `packages/*` lulus.

## Follow-up yang masih terbuka (tidak dikerjakan di sesi ini)

- `docs/business-rules.md` §13.13: definisi metrik laporan Tahap 6 (§12.11
  plan) dan SLA verifikasi bukti bayar 2 hari kerja (§12.8 plan) belum
  dipindahkan jadi aturan normatif — masih hanya ada di dokumen plan.
  Non-blocking karena Tahap 6 belum diimplementasikan, tapi perlu diputuskan
  sebelum Tahap 6 dikerjakan developer lain.
- Dua deviasi UI lama dari `docs/plans/tenant-subscription-management.md` §5
  (grouping "Perlu ditangani" di list Platform Admin; preview tanggal efektif
  saat edit grace-period di `tenant-detail.tsx`) — sudah diketahui sejak
  review plan sebelumnya, tetap non-blocking, belum dikerjakan.
- Release gates produksi (batas nominal finance sign-off, pajak, retensi
  bukti, mekanisme refund, matriks E2E) tetap eksplisit belum terpenuhi,
  sesuai `docs/changes/2026-10-14/tenant-subscription-operational-controls.md`.
