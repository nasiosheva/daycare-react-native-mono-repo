<!-- Mories Deo Hutapea,S.E.,S.Kom -->

# Checklist Pull/Merge Request per Branch

## Identitas

| Field | Nilai |
| --- | --- |
| Branch sumber | `feat/tenant-subscription-management` |
| Target branch | `production` |
| MR/PR | Belum dibuat |
| Work item / tujuan | Implementasi bertahap subscription SaaS tenant, self-service Staff Admin, pembayaran/koreksi, reminder, dan idempotency billing Parent |
| Tanggal checklist | `2026-10-16` |
| Status kesiapan | `DEFER untuk merge/release — review lokal selesai; gate verifikasi operasional masih terbuka` |

## Ringkasan untuk deskripsi PR/MR

| Area review | Status | Gap / blocker / bukti |
| --- | --- | --- |
| 1. Scope dan konsistensi perubahan | `PASS` | Diff branch telah ditinjau; scope subscription/idempotency Parent konsisten dengan plan. `CLAUDE.md`, `docs/personal-docs/`, secret, dan log dikecualikan. Staged diff tetap diperiksa tepat sebelum commit. |
| 2. Konsistensi dokumentasi | `PASS` | Plan, `docs/business-rules.md`, README, dan catatan perubahan diperbarui; finance/release gates tetap ditandai terbuka. |
| 3. Test dan coverage | `PASS untuk test lokal; PARTIAL untuk coverage/release matrix` | `pnpm verify` lulus (frontend 327 tests). Full backend rerun: 899 tests, 0 failure/error, 4 API integration tests skipped karena DB integrasi tidak dikonfigurasi. Method coverage method yang berubah pernah diperiksa 100%; aggregate backend branch coverage terakhir yang tercatat 88.55% (di bawah target 90%). |
| 4. Arsitektur dan maintainability | `PASS untuk review lokal` | Diff ditinjau terhadap checklist review; implementation memakai API client/shared types, service/repository dan pola baseline. Tidak ada temuan maintainability/correctness yang masih terbuka pada review lokal. |
| 5. Business rule, role, dan security | `PASS untuk aturan yang diimplementasikan; PARTIAL untuk release sign-off` | Row-lock aktor dan tenant/actor/operation key scope melindungi command subscription. Pembelian monthly Parent menolak periode overlap untuk anak+paket yang sama walau key berbeda; retry intent pending yang identik memakai invoice pertama. Status suspended tidak diaktifkan oleh konfirmasi pembayaran. Acceptance/access matrix penuh serta finance/privacy sign-off masih terbuka. |
| 6. Database dan API contract | `PARTIAL` | Flyway V1–V34 pernah lulus di PostgreSQL scratch (fresh install, upgrade V33→V34, backfill fixture, dan empat API integration tests). Database tenant nyata belum diuji. Renewal preview server-owned; V34 mengunci scope keputusan pembayaran tenant. Duplikasi lintas-key monthly Parent kini dicegah di transaksi service dengan lock anak dan query overlap; test full lulus, tetapi belum ada uji konkurensi multi-connection pada DB integration run terbaru. |
| 7. UI/UX dan accessibility | `PARTIAL` | UI menggunakan preview renewal tanggal dari server dan lint/typecheck workspace lulus. Browser interaction, device serta seluruh state/accessibility belum diverifikasi. |
| 8. Performance dan reliability | `PARTIAL` | Reminder query dibatasi dan deduplikasi dibuat; external outbox/delivery monitoring dan localization reminder masih terbuka. |
| 9. Verification dan release readiness | `PARTIAL` | Frontend `pnpm verify`, full backend rerun, dan `git diff --check` lulus. Empat API integration tests dilewati pada rerun terbaru; CI head PR belum tersedia sebelum PR dibuat; database tenant nyata dan uji browser/device belum dilakukan; feature gates tetap default-off. |
| 10. Keputusan akhir reviewer | `DEFER untuk merge/release` | Review lokal dan perbaikan temuan selesai. Jangan anggap siap release sampai gate operasional/finansial/database di bawah tervalidasi atau disetujui secara eksplisit. PR boleh dibuat dengan gap tersebut dinyatakan jelas. |

Checklist branch lengkap: `docs/changes/2026-10-15/mr-checklist-feat-tenant-subscription-management.md`
Temuan/gap release terbuka: Flyway/history-existing DB validation pada database tenant nyata, acceptance/access/E2E matrix, branch coverage khusus diff (aggregate terakhir 88.55%), finance/privacy/tax release decisions, refund workflow, reminder delivery operations, browser/device validation, concurrency integration test pada DB, dan CI head PR.

## Scope dan aturan produk

- [x] Tujuan branch dan acceptance criteria tertulis; scope sesuai plan langganan tenant, idempotency billing Parent, checklist proses yang diminta, dan rule larangan overlap paket bulanan Parent.
- [x] `README.md` dan `docs/business-rules.md` ditinjau/diperbarui; rilis produksi tetap dibedakan dari implementasi teknis.
- [ ] Role, tenant, branch, child/resource ownership, dan capability diperiksa lengkap pada access matrix lintas semua status; unit tests ada, tetapi matriks penerimaan penuh belum diselesaikan.
- [x] Kontrak backend/API client/mobile ditinjau untuk perubahan dalam diff dan workspace test lulus.
- [x] Pembelian monthly Parent menggunakan identitas bisnis tenant + anak + paket + periode overlap; duplicate lintas key ditolak, retry pending identik mengembalikan invoice yang ada. Renewal Tenant SaaS tetap melanjutkan dari akhir periode terjadwal yang sudah dibayar.

## Implementasi dan pengalaman pengguna

- [x] Arsitektur dan maintainability ditinjau terhadap checklist review lokal; temuan correctness/security yang diperoleh diperbaiki dan diverifikasi ulang.
- [ ] Loading, empty, error/retry, disabled, submitting, dan success telah diuji pada browser/device; implementasi UI ada tetapi validasi visual/interaksi langsung belum dilakukan.
- [ ] Seluruh locale, keyboard/accessibility, dan layout lintas platform diverifikasi; belum ada browser/device evidence untuk branch ini.
- [x] `git status` menunjukkan tidak ada `.env`, `CLAUDE.md`, `docs/personal-docs/`, atau `run-logs/` yang staged/terlacak pada commit branch.

## Database, test, dan verifikasi

- [ ] Migration V1–V34 dijalankan melalui Flyway dan diperiksa pada database kosong serta database dengan history sebelumnya. Cold-start dan upgrade scratch V33→V34 berhasil; fixture synthetic PAID/VOID juga membuktikan backfill; seluruh 4 `ApiIntegrationTest` lulus pada PostgreSQL scratch. Database tenant existing belum diuji.
- [ ] Test ditulis sebelum implementasi dan bukti red-green tercatat untuk seluruh behavior; test pass tercatat, tetapi bukti red sebelum implementasi tidak tersedia.
- [x] `pnpm verify` — lulus (lint, typecheck, dan test seluruh workspace); frontend: 327 test lulus.
- [x] `INTEGRATION_DATABASE_URL=... ./gradlew test --no-daemon` dari `apps/api/` — `BUILD SUCCESSFUL`; backend 882 test, 0 failure/error/skipped dengan API integration aktif.
- [x] Full backend rerun terbaru: `./apps/api/gradlew -p apps/api test --no-daemon --rerun-tasks` — `BUILD SUCCESSFUL`; 899 tests, 0 failure/error, 4 `ApiIntegrationTest` skipped karena DB integrasi tidak dikonfigurasi untuk run ini.
- [x] `pnpm --filter @daycare/app exec expo export --platform web --output-dir .subscription-web-export-check` — web bundle berhasil; output sementara sudah dibersihkan. Ini build proof, bukan browser interaction proof.
- [x] Setelah perbaikan row-lock aktor, test terarah `TenantSubscriptionPaymentProofServiceTest` dan `TenantSubscriptionCorrectionServiceTest` lulus; suite backend penuh kemudian lulus kembali.
- [ ] CI untuk head branch/MR saat ini — belum diverifikasi; MR belum dibuat.
- [x] JaCoCo diperiksa untuk method production yang ditambah/diubah: seluruh method yang disentuh memiliki 100% method coverage. Jalur baru/berisiko pada pembayaran, lock booking, renewal preview/terms, decoder Firebase, dan perhitungan grace diuji. Aggregate backend branch coverage saat ini 88.55% (5,776/6,523), di bawah target 90%; branch yang tersisa mencakup kode lain di luar jalur diff terfokus. Test delegasi mencakup 17 handler subscription.
- [x] `git diff --check` lulus pada perubahan lokal terakhir yang diperiksa.
- [ ] Database, browser, device, dan production validation — belum dilakukan pada checklist ini.

## Gate rilis yang masih terbuka

- Migration belum dijalankan pada database nyata; V33 juga belum divalidasi terhadap state billing Parent yang sudah ada.
- Scratch PostgreSQL membuktikan Flyway fresh-install, jalur history V33→V34, backfill fixture PAID/VOID, dan constraint baru; state Flyway database tenant nyata belum diuji.
- Renewal Tenant SaaS kini melanjutkan dari periode berbayar terjadwal terakhir, sehingga tidak mencoba membuat periode/invoice sama ketika renewal berikutnya dilakukan sebelum periode baru dimulai.
- Monthly duplicate business action Parent untuk anak+paket+periode overlap ditolak lintas key; behavior tercakup unit regression test, tetapi concurrency integration test pada PostgreSQL multi-connection belum dijalankan pada verifikasi terbaru.
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

Checklist ini menggabungkan bukti branch dan pemeriksaan lokal yang tersedia. PR belum dibuat, sehingga CI head PR dan hasil review independen masih pending. Jangan menafsirkan status test pass sebagai persetujuan production rollout.
