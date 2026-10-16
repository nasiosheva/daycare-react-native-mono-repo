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
  memakai preview server agar tanggalnya identik dengan invoice yang akan
  dibuat, termasuk trial, periode prepaid yang di-chain, tanggal WIB, dan
  subscription expired.

### 7. Non-blocking: README env var
- Menambahkan 3 baris tabel environment variable yang sebelumnya tidak
  disebut: `TENANT_SUBSCRIPTION_PAYMENT_PROOF_ENABLED`,
  `TENANT_SUBSCRIPTION_CORRECTION_ENABLED`, `TENANT_SUBSCRIPTION_PAYMENT_INSTRUCTIONS`.

### 8. Serialisasi key idempotency bukti dan koreksi
- Review checklist menemukan bahwa submit/review proof dan create/review correction
  membaca key sebelum mengambil lock aktor. Unique constraint mencegah duplikasi
  database, tetapi dua request paralel dengan key sama pada payment berbeda dapat
  berakhir sebagai unique-constraint error, bukan replay/conflict domain yang
  konsisten.
- Service terkait sekarang mengambil pessimistic lock row aktor di dalam
  transaksi sebelum lookup idempotency key. Test memverifikasi lock dilakukan
  pada jalur submit proof, submit correction, dan replay review.

### 9. Scope daftar koreksi Staff Admin
- Review lanjutan menemukan endpoint `/self/payments/{paymentId}/corrections`
  sebelumnya hanya memfilter organisasi dan payment, sehingga koreksi yang
  diajukan Staff Admin lain pada tenant yang sama ikut dikirim. Ini tidak sesuai
  dengan endpoint/client `ownCorrections` dan prinsip least privilege.
- Query kini juga dibatasi pada `requestedByUserId` milik actor yang sudah
  tervalidasi oleh `AccessService`. Regression test baru dibuktikan merah pada
  implementasi lama (hasil berisi semua request), lalu hijau sesudah filter
  actor diterapkan.

### 10. Coverage controller dan tanggal scheduler reminder
- Menambahkan test delegasi untuk seluruh endpoint pada controller
  subscription Staff Admin dan Platform Admin, termasuk tenant scope,
  pagination, request body, serta `Idempotency-Key`.
- Regression test scheduler membuktikan `sendDueReminders()` sebelumnya
  mengabaikan injected `Clock` dan membaca tanggal sistem langsung. Entry point
  kini menghitung tanggal memakai clock yang sama pada zona `Asia/Jakarta`;
  tes merah/hijau memakai waktu tetap yang melintasi tanggal WIB.

### 11. Actor lock harus fail-closed
- Review kode menemukan hasil `UserProfileRepository.findWithLockById` diabaikan
  pada submit/review bukti dan koreksi. Jika row aktor hilang di antara
  autentikasi dan command, operasi masih dapat melanjutkan tanpa lock sehingga
  jaminan serialisasi idempotency tidak berlaku.
- Kedua service kini menolak command bila row aktor tidak ditemukan. Regression
  tests untuk proof dan correction terlebih dahulu gagal karena pembayaran
  masih disentuh, lalu lulus setelah guard diterapkan.

## Verifikasi

- `./apps/api/gradlew -p apps/api test --no-daemon` — BUILD SUCCESSFUL, seluruh
  suite backend lulus (termasuk test baru).
- `pnpm --filter @daycare/app typecheck` — lulus (menangkap dan memverifikasi
  perbaikan bug argumen yang hilang di atas).
- `pnpm lint` — lulus bersih di seluruh workspace TS (exit 0).
- `pnpm test` — 224 test mobile + seluruh test `packages/*` lulus.
- Test terarah `TenantSubscriptionPaymentProofServiceTest` dan
  `TenantSubscriptionCorrectionServiceTest` — checkpoint red gagal pada 5
  verifikasi karena actor lock belum dipanggil; setelah implementasi lock
  ditambahkan, suite terarah lulus. Suite backend penuh dan `pnpm verify`
  kemudian lulus dengan implementasi final.
- Verifikasi ulang 15 Oktober setelah merapikan assertion duplikat:
  `pnpm verify` lulus (327 test frontend), backend Gradle lulus (864 test,
  0 failure, 4 ignored), dan kedua test service terarah lulus.
- Seluruh file migration SQL V1–V33 dieksekusi berurutan terhadap PostgreSQL
  scratch kosong terisolasi; berhasil. Ini memvalidasi SQL pada database kosong,
  bukan Flyway startup/history migration atau database existing. PostgreSQL
  lokal biasa tidak tersedia saat audit.
- `pnpm --filter @daycare/app exec expo export --platform web --output-dir
  .subscription-web-export-check` — bundle web berhasil; folder output sementara
  dibersihkan. Ini bukan validasi interaksi browser/device.
- Test merah/hijau `ownRequests only returns correction requests submitted by
  the current staff admin` — merah sebelum filter actor, hijau sesudah query
  repository dibatasi ke `requestedByUserId`.
- Verifikasi penuh terbaru setelah regression fix: `pnpm verify` lulus (327
  test frontend); backend Gradle lulus (871 test, 0 failure, 4 ignored).
  JaCoCo aggregate backend line 93.80% (9,107/9,709), branch 88.08%
  (5,726/6,501), method 66.41% (4,232/6,373); angka
  aggregate bukan coverage khusus diff.
- `TenantSubscriptionControllerTest` menguji delegasi 17 handler subscription
  pada controller Staff Admin, Platform Admin subscription, dan Platform Admin
  tenant (renewal, grace, audit, serta perubahan status).
- Test reminder terjadwal lulus untuk tanggal tetap pada zona Jakarta; test
  sengaja dibuat gagal pada implementasi lama yang membaca system clock.
- Format bukti PDF, JPEG, dan PNG diuji dengan signature file; signature PNG
  yang salah ditolak dan nama file dibersihkan dari komponen path.
- Regression tests actor row missing gagal sebelum guard fail-closed; setelah
  perubahan, kedua suite service terkait lulus.
- Verifikasi terakhir setelah guard dan controller tests: `pnpm verify` lulus
  (327 test frontend); backend Gradle lulus (874 test, 0 failure, 4 ignored).
  JaCoCo aggregate: line 93.95% (9,122/9,709), branch 87.99%
  (5,724/6,505), method 66.53% (4,240/6,373). Aggregate ini bukan coverage
  khusus diff.

### 12. Renewal setelah periode lanjutan dibayar lebih awal

- Review menemukan bahwa renewal kedua setelah periode lanjutan dibayar tetapi
  belum dimulai kembali memilih `subscription.periodEnd`, sehingga membentuk
  rentang periode yang sama. Unique index database mencegah invoice ganda,
  tetapi pelanggaran constraint akan menjadi error server yang tidak tertangani.
- Test `renew chains after an already-paid future period` diubah lebih dulu
  untuk mengharuskan periode baru dimulai sehari setelah `nextPeriodEnd`; test
  gagal pada implementasi lama, lalu lulus setelah service selalu melanjutkan
  dari periode terjadwal terakhir. Renewal setelah status efektif `EXPIRED`
  tetap memulai coverage dari hari ini.
- Review ulang menemukan status `TRIAL` juga dapat tetap aktif setelah renewal
  dini dibayar. Regression test `renew chains after an already-paid future
  period while trial is still active` dibuktikan gagal pada implementasi
  sebelumnya; pemilihan `nextPeriodEnd` kini diprioritaskan sebelum fallback
  `trialEndsAt`, dan test tersebut lulus.
- Verifikasi: test service terarah lulus dan suite backend penuh lulus.
- Tidak ada perubahan aturan produk atau README: perilaku chaining tersebut
  sudah ditetapkan di `docs/business-rules.md` §13.13; perubahan ini membuat
  implementasi mematuhi aturan yang ada.

### 13. Temuan review lanjutan: status pembayaran, lifecycle, idempotency, dan booking

- `PlatformAdministrationService.markPaymentPaid` tidak lagi mengubah status
  `SUSPENDED` menjadi `ACTIVE`. Test regresi memastikan invoice tetap dapat
  dibayar tanpa membuka kembali akses; reaktivasi tetap membutuhkan aksi manual.
- Pembayaran aktivasi awal yang dikonfirmasi setelah periode invoice berakhir
  mempertahankan periode invoice sebagai snapshot dan mencatat coverage aktual
  dari tanggal konfirmasi WIB selama satu bulan tanpa grace. Aturan ini kini
  ditulis di `docs/business-rules.md` dan plan utama.
- `markPaymentPaid` dan `voidPayment` mengunci row aktor sebelum lookup replay.
  Scope key kini tenant + aktor + operasi; migration additive V34 mengganti
  unique constraint lama dan mengisi operasi untuk keputusan yang sudah ada.
- API Staff Admin menyediakan `renewalPreview` hasil kalkulasi bersama service
  renewal. UI tidak lagi menghitung periode atau due date dengan jam lokal/UTC;
  tanggal periode top-level API untuk kedua role juga memakai periode prepaid
  ketika sudah efektif.
- Semua jalur pembuatan booking harian mengunci row anak sebelum memeriksa
  booking overlap dan menyimpan booking, menyerialisasi wali yang berbeda.
- Tes regresi ditulis sebelum implementasi. Tes terarah yang tercatat pada
  review awal menunjukkan status `RED` untuk perilaku yang belum tersedia;
  hasil verifikasi akhir dicatat di bagian verifikasi setelah dijalankan.

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

### 14. Verifikasi Flyway V34 di PostgreSQL scratch

- Flyway cold-start pada database scratch kosong menerapkan V1–V34 dengan
  seluruh versi berstatus sukses.
- Scratch kedua dihentikan di history V33, lalu startup berikutnya tanpa target
  menerapkan V34 dan mencatatnya sukses. Ini membuktikan jalur upgrade Flyway
  dari versi tepat sebelumnya pada schema scratch.
- Sebelum upgrade, dua row fixture synthetic pada schema V33 disisipkan dengan
  status PAID dan VOID. Setelah Flyway V34, query membuktikan keduanya terisi
  `decision_operation=MARK_PAID` dan `decision_operation=VOID`; unique constraint
  baru juga terpasang.
- Pemeriksaan PostgreSQL awal menemukan API integration test belum mengaktifkan
  Spring profile `local`, payload trial membawa monthly fee, dan assertion
  mengasumsikan notification list selalu kosong. Test setup/payload/assertion
  diperbaiki agar sesuai konfigurasi dan kontrak.
- `SecurityConfig` kini menunda Firebase issuer discovery sampai token Firebase
  pertama benar-benar didecode. Regression test dengan `issuer.invalid` gagal
  sebelum patch lalu lulus sesudahnya; verifikasi JWT lokal tidak memerlukan
  jaringan, sedangkan validasi token Firebase tetap menggunakan issuer decoder.
- Keempat `ApiIntegrationTest` lulus pada PostgreSQL scratch setelah profile,
  billing cap, dan trial diselaraskan. Verifikasi penuh dengan integration
  database aktif lulus: backend 882 test, 0 failure/error/skipped; `pnpm verify`
  juga lulus dengan 327 test frontend.
- Suite `ApiIntegrationTest` dijalankan ulang pada database scratch yang sama
  tanpa reset; tetap lulus, karena test sekarang menggunakan identitas tenant
  admin unik dan tidak bergantung pada notification count yang kosong.
- JaCoCo diperiksa sesudah full backend unit suite: semua method production
  yang ditambah/diubah (termasuk `SecurityConfig.jwtDecoder`, kedua keputusan
  payment, `tenantResponse`, booking lock helper, current/renewal preview, dan
  `renewalTerms`) memiliki method coverage 100%. Branch coverage khusus diff
  belum 100%; ini dicatat sebagai gap, bukan diklaim selesai.
- Database tenant existing/produksi tidak disentuh atau divalidasi; fixture
  tersebut hanya membuktikan transformasi SQL pada scratch yang terisolasi.

### 15. Regression coverage lanjutan setelah review ulang

- Ditambahkan test untuk keputusan payment yang fail-closed jika row Platform
  Admin tidak lagi tersedia ketika lock; lookup payment tidak boleh dilanjutkan.
- Ditambahkan test renewal preview untuk status suspended dan fallback
  `trialEndsAt` ke `periodEnd`; jalur booking-lock juga diuji untuk anak hilang
  dan anak lintas-tenant.
- Konfirmasi payment sekarang punya coverage eksplisit untuk periode aktif,
  jadwal periode mendatang, periode invoice parsial, stale initial payment,
  suspended pada jalur current/fresh/fallback, serta pending grace-period
  override dan fallback.
- Test `tenantResponse` dengan grace aktif memverifikasi akhir grace dari
  periode prepaid berikutnya dan fallback ke grace standar; implementasi
  menghindari null-fallback redundan dengan menghitung periode dalam scope
  subscription yang sudah dipastikan ada.
- Semua perubahan saldo kredit booking kini diserialisasi pada row entitlement:
  pembuatan booking mengunci child lalu entitlement, penolakan mengunci child,
  booking, lalu entitlement, dan check-in mengunci booking serta entitlement.
  Saldo hanya dibaca/diubah setelah entitlement di-refresh dengan pessimistic
  write lock.
- Submit bukti memeriksa replay idempotency setelah tenant scope tetapi
  sebelum status payment. Retry payload yang sama tetap mengembalikan bukti
  terdahulu walaupun payment sudah dikonfirmasi; key/payload berbeda tetap
  menghasilkan conflict.
- Koreksi pembayaran ganda/lebih bayar memakai total semua transfer, wajib
  lebih besar daripada payment tercatat, dan menghasilkan adjustment
  `EXCESS_CREDIT` sebesar selisih. Label serta keterangan field UI tersedia
  dalam tujuh locale; aturan normatif dan plan utama juga diperbarui.
- Test `SecurityConfig` membuktikan issuer Firebase tidak dicari ketika decoder
  dibuat, lalu dispatch token Firebase ke decoder lazy tanpa akses jaringan.
- Verifikasi akhir lokal: `./gradlew test --no-daemon` lulus, 889 tests,
  0 failure/error, 4 API integration tests skipped karena DB integrasi tidak
  disiapkan pada run terakhir. Run integrasi PostgreSQL scratch yang tercatat
  sebelumnya tetap bukti terpisah dan tidak mencakup test tambahan ini.
- Verifikasi ulang setelah temuan review terbaru: `./apps/api/gradlew -p apps/api
  test --no-daemon` lulus (895 test cases, 0 failure/error, 4 skipped), dan
  `pnpm verify` lulus (lint, typecheck, serta 327 test frontend). Test terarah
  untuk booking/approval/check-in/proof/correction juga lulus.
- JaCoCo aggregate branch: 5,776/6,523 (88.55%). Branches pada jalur baru yang
  diperiksa sudah ter-cover; aggregate backend masih di bawah target 90% karena
  branch yang tersisa berada di berbagai kode lain dan bukan seluruhnya bagian
  diff ini.
- `git diff --check` lulus. Tidak ada commit atau push dalam tindak lanjut ini.
