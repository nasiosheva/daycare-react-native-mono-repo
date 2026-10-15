<!-- Mories Deo Hutapea,S.E.,S.Kom -->

# Checklist Pull/Merge Request per Branch

## Identitas

| Field | Nilai |
| --- | --- |
| Branch sumber | `feat/tenant-subscription-management` |
| Target branch | `production` |
| MR/PR | Belum dibuat |
| Work item / tujuan | Implementasi bertahap subscription SaaS tenant, self-service Staff Admin, pembayaran/koreksi, reminder, dan idempotency billing Parent |
| Tanggal checklist | `2026-10-15` |
| Status kesiapan | `NOT READY — review/release gate masih terbuka` |

## Ringkasan untuk deskripsi PR/MR

| Area review | Status | Gap / blocker / bukti |
| --- | --- | --- |
| 1. Scope dan konsistensi perubahan | `PARTIAL` | Scope mencakup plan subscription/idempotency Parent dan checklist proses review/PR yang diminta untuk branch ini; `CLAUDE.md` serta `docs/personal-docs/` tetap dikecualikan. Final staged diff dan review item-per-item seluruh branch belum dilakukan. |
| 2. Konsistensi dokumentasi | `PASS` | Plan, `docs/business-rules.md`, README, dan catatan perubahan diperbarui; finance/release gates tetap ditandai terbuka. |
| 3. Test dan coverage | `PARTIAL` | `pnpm verify` lulus (327 frontend tests); backend 874 tests lulus, 0 failure, 4 ignored. Test delegasi mencakup 17 handler subscription. Aggregate JaCoCo: line 93.95% (9,122/9,709), branch 87.99% (5,724/6,505), method 66.53% (4,240/6,373), bukan coverage diff. Red-green tercatat untuk actor lock, correction scope, dan injected WIB clock; test boundary/authorization service tercatat di daily note. |
| 4. Arsitektur dan maintainability | `PARTIAL` | Implementasi memakai API client/shared types dan service terpisah; item review arsitektur lengkap per file belum dilakukan. |
| 5. Business rule, role, dan security | `PARTIAL` | Row-lock aktor menyerialisasi retry key-sama lintas resource; endpoint koreksi Staff Admin kini hanya mengembalikan request milik actor (regression test red-green lulus). Acceptance/access matrix penuh serta finance/privacy sign-off sebelum rollout belum selesai. |
| 6. Database dan API contract | `PARTIAL` | Semua migration SQL V1–V33 berhasil dijalankan berurutan pada PostgreSQL scratch kosong terisolasi. Belum diuji melalui Flyway atau terhadap database dengan history/data existing karena PostgreSQL lokal tidak tersedia. Idempotency key sama kini diserialisasi pada proof/correction; semantik duplikasi lintas-key untuk aksi Parent belum dikunci dan tidak aman diselesaikan dengan constraint generik tanpa membedakan pembelian sah. |
| 7. UI/UX dan accessibility | `PARTIAL` | Expo web export berhasil; screen Staff Admin/Platform Admin dan i18n tersedia. Browser interaction, device serta seluruh state/accessibility belum diverifikasi. |
| 8. Performance dan reliability | `PARTIAL` | Reminder query dibatasi dan deduplikasi dibuat; external outbox/delivery monitoring dan localization reminder masih terbuka. |
| 9. Verification dan release readiness | `PARTIAL` | Frontend/backend test lokal lulus; CI untuk head PR belum ada, migrasi DB dan uji browser/device belum dilakukan, release gates masih default-off. `git diff --check` lulus setelah perubahan lokal terakhir. |
| 10. Keputusan akhir reviewer | `DEFER` | Belum layak dinyatakan siap merge/release sampai review rinci dan blocker di bawah ditutup atau dikecualikan dengan keputusan eksplisit. |

Checklist branch lengkap: `docs/changes/2026-10-15/mr-checklist-feat-tenant-subscription-management.md`
Temuan terbuka/blocker: Flyway/history-existing DB validation, acceptance/access/E2E matrix, review coverage per method, definisi intent pembelian lintas-key, finance/privacy/tax release decisions, refund workflow, reminder delivery operations, browser/device validation, dan CI head PR.

## Scope dan aturan produk

- [ ] Tujuan branch dan acceptance criteria tertulis; scope commit yang dipush sesuai plan langganan tenant serta idempotency billing Parent. Perubahan checklist proses lokal belum masuk ke branch remote dan perlu keputusan include/exclude sebelum MR.
- [x] `README.md` dan `docs/business-rules.md` ditinjau/diperbarui; rilis produksi tetap dibedakan dari implementasi teknis.
- [ ] Role, tenant, branch, child/resource ownership, dan capability diperiksa lengkap pada access matrix lintas semua status; unit tests ada, tetapi matriks penerimaan penuh belum diselesaikan.
- [ ] Kontrak backend/API client/core/mobile telah direview item per item; test suite lulus, review kontrak menyeluruh belum dicatat.
- [ ] Business identity untuk mencegah pembayaran ganda akibat dua key berbeda diverifikasi/ditutup. Lock aktor menutup race key-sama untuk proof/correction; key berbeda dapat berarti aksi baru yang sah sehingga perlu kontrak intent bisnis dan test sebelum constraint dibuat.

## Implementasi dan pengalaman pengguna

- [ ] Arsitektur dan maintainability semua file ditinjau terhadap checklist review lokal; review penuh belum dilakukan.
- [ ] Loading, empty, error/retry, disabled, submitting, dan success telah diuji pada browser/device; implementasi UI ada tetapi validasi visual/interaksi langsung belum dilakukan.
- [ ] Seluruh locale, keyboard/accessibility, dan layout lintas platform diverifikasi; belum ada browser/device evidence untuk branch ini.
- [x] `git status` menunjukkan tidak ada `.env`, `CLAUDE.md`, `docs/personal-docs/`, atau `run-logs/` yang staged/terlacak pada commit branch.

## Database, test, dan verifikasi

- [ ] Migration V1–V33 dijalankan melalui Flyway dan diperiksa pada database kosong serta database dengan history sebelumnya. SQL semua versi berhasil dieksekusi berurutan pada PostgreSQL scratch kosong; koneksi ke database lokal biasa tidak tersedia, dan validasi Flyway/history-existing belum dilakukan.
- [ ] Test ditulis sebelum implementasi dan bukti red-green tercatat untuk seluruh behavior; test pass tercatat, tetapi bukti red sebelum implementasi tidak tersedia.
- [x] `pnpm verify` — lulus (lint, typecheck, dan test seluruh workspace); frontend: 327 test lulus.
- [x] `./apps/api/gradlew -p apps/api test --no-daemon` — `BUILD SUCCESSFUL`; laporan test terkini: 874 test, 0 failure, 4 ignored.
- [x] `pnpm --filter @daycare/app exec expo export --platform web --output-dir .subscription-web-export-check` — web bundle berhasil; output sementara sudah dibersihkan. Ini build proof, bukan browser interaction proof.
- [x] Setelah perbaikan row-lock aktor, test terarah `TenantSubscriptionPaymentProofServiceTest` dan `TenantSubscriptionCorrectionServiceTest` lulus; suite backend penuh kemudian lulus kembali.
- [ ] CI untuk head branch/MR saat ini — belum diverifikasi; MR belum dibuat.
- [x] JaCoCo aggregate backend terkini dicatat di daily note; ini angka seluruh backend, bukan perubahan branch saja. Test delegasi mencakup 17 handler subscription, tetapi bukan browser/API integration proof.
- [x] `git diff --check` lulus pada perubahan lokal terakhir yang diperiksa.
- [ ] Database, browser, device, dan production validation — belum dilakukan pada checklist ini.

## Gate rilis yang masih terbuka

- Migration belum dijalankan pada database nyata; V33 juga belum divalidasi terhadap state billing Parent yang sudah ada.
- Idempotency belum menutup semua duplicate business action jika key berbeda; unique business constraint lintas-key masih perlu dirancang/diuji.
- Request proof/koreksi dengan key sama diserialisasi pada row aktor; duplicate business action Parent dengan key berbeda masih memerlukan definisi intent yang tidak menghalangi pembelian sah.
- Endpoint daftar koreksi Staff Admin telah diperbaiki agar hanya mengembalikan request milik actor yang sedang login.
- Upload bukti dan koreksi tetap default-off. Storage perlu sign-off privasi/keuangan untuk retensi, legal hold, enkripsi operasional, dan malware scanning.
- Belum ada sign-off tertulis batas nominal, status PKP/perlakuan pajak, klasifikasi/retensi dokumen, serta prosedur kredit/refund; workflow refund belum diimplementasikan.
- Acceptance/access/E2E matrix lintas role/status, pemantauan delivery reminder, retry/outbox eksternal, dan lokalisasi isi reminder masih terbuka.
- `TENANT_SUBSCRIPTION_GRACE_ENABLED` tetap `false`; grace hanya boleh diaktifkan setelah preview read-only ditinjau dan rollout disetujui. Feature flags bukti/koreksi juga tetap `false` sampai gate terkait selesai.

## Setelah merge

- [ ] Merge dikonfirmasi pada PR/MR yang benar.
- [ ] Checkout disinkronkan ke `production` dan hanya branch lokal yang sudah merged/remote-deleted dibersihkan.

## Catatan status

Checklist ini menggabungkan bukti branch dan pemeriksaan lokal yang tersedia. MR belum dibuat, sehingga CI head MR dan hasil review independen masih pending. Jangan menafsirkan status test pass sebagai persetujuan production rollout.
