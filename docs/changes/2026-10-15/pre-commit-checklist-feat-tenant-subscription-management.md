<!-- Mories Deo Hutapea,S.E.,S.Kom -->

# Checklist Kesiapan Commit

| Field | Nilai |
| --- | --- |
| Branch | `feat/tenant-subscription-management` |
| Tanggal review | `2026-10-16` |
| Changeset | Langganan tenant, idempotency billing Parent, dan pencegahan pembelian paket bulanan anak yang periodenya tumpang-tindih |
| Status commit | `READY` — seluruh temuan review correctness/security yang ditemukan telah diperbaiki dan diverifikasi ulang |
| Status merge/release | `DEFER` — lihat gate yang belum ditutup di checklist MR; kesiapan commit bukan persetujuan release |

## Ringkasan review

| Area | Status | Bukti |
| --- | --- | --- |
| Scope dan konsistensi | `PASS` | Diff diperiksa; semua perubahan berada dalam scope branch. `CLAUDE.md`, `docs/personal-docs/`, secret, dan log tidak disertakan. |
| Dokumentasi | `PASS` | `README.md`, `docs/business-rules.md`, plan, daily notes, dan checklist menyatakan perilaku yang sama. |
| Test dan coverage | `PASS` | `pnpm verify` lulus; backend Gradle penuh lulus (899 tests, 0 failure/error; 4 integration tests dilewati karena DB integrasi tidak dikonfigurasi). Test regression menunjukkan red sebelum implementasi dan green setelahnya. |
| Arsitektur | `PASS` | Menggunakan service/repository/transaksi yang sudah ada; pemeriksaan overlap terpusat pada billing service dan akses data pada repository. |
| Business rule/security | `PASS` | Pembelian monthly dengan periode overlap ditolak lintas idempotency key dan jalur approval enrollment; row lock anak menyerialisasi request bersamaan. Retry pending identik memakai invoice yang ada. |
| Database/API | `PASS` untuk kontrak lokal | Migration V34 men-scoping idempotency keputusan tenant dengan organisasi, aktor, operasi, dan key. Startup/migrasi tenant nyata tetap gate release yang terpisah. |
| UI/accessibility | `PASS` untuk perubahan UI dalam scope | UI subscription dan seluruh string terkait lulus lint/typecheck/test workspace; validasi browser/device belum dilakukan dan dicatat sebagai gate MR. |
| Reliability | `PASS` untuk perubahan yang ditinjau | Jalur transaksi, row locks, duplicate/replay, konflik, dan status pembayaran mendapat regression coverage. |
| Verifikasi | `PASS` | `pnpm verify`, backend full test, dan `git diff --check` lulus. |
| Keputusan reviewer lokal | `APPROVE FOR COMMIT` | Review ulang dilakukan setelah temuan sebelumnya diperbaiki; tidak ada temuan correctness/security terbuka pada diff yang akan dipublish. |

## Temuan review yang ditutup

| Temuan | Perbaikan | Bukti |
| --- | --- | --- |
| Pembayaran/keputusan tenant dapat memakai key sama lintas tenant atau operasi | Key keputusan dibatasi organisasi + aktor + operasi + key; V34 melakukan backfill operasi dan mengganti unique constraint | `PlatformAdministrationServiceTest`, `V34__scope_tenant_payment_decisions.sql`, full backend suite |
| Renewal terlalu dini dapat membuat periode yang sudah dibayar kembali | Renewal berikutnya dijadwalkan dari akhir periode berbayar terakhir | `TenantSubscriptionRenewalServiceTest`, full backend suite |
| Approval pembayaran dapat mengaktifkan tenant yang tetap berstatus suspended | Pembayaran dicatat tanpa membatalkan status `SUSPENDED` | `PlatformAdministrationServiceTest`, full backend suite |
| Request pembelian paket bulanan dengan key berbeda dapat membuat invoice/entitlement overlap untuk anak dan paket yang sama | Lock anak, cek overlap aktif/pending, replay invoice untuk intent pending identik, dan guard approval enrollment | `BillingServiceCoverageTest`; test baru red sebelum patch lalu green; full backend suite |
| Error overlap tidak memiliki pesan lokal yang stabil | Kode error dipetakan ke pesan Indonesia dan Inggris | `ApiExceptionHandlerTest`, full backend suite |

## Pemeriksaan sebelum publish

- [x] Review seluruh diff yang relevan terhadap `docs/personal-docs/code-review-checklist.md`; temuan diperbaiki, test dijalankan ulang, dan diff ditinjau ulang.
- [x] Frontend: `pnpm verify` (lint, typecheck, tests) lulus; 327 test.
- [x] Backend: `./apps/api/gradlew -p apps/api test --no-daemon --rerun-tasks` lulus; 899 tests, 0 failure/error, 4 integration tests skipped karena DB integration tidak disetel.
- [x] Regression monthly overlap dan localized error lulus; test terlebih dahulu diperlihatkan gagal sebelum patch.
- [x] `git diff --check` lulus.
- [x] `CLAUDE.md` tetap ignored dan tidak masuk changeset; `docs/personal-docs/` tidak diubah.
- [x] `run-logs/` tidak memiliki isi yang perlu dipublish.
- [x] Staged diff ditinjau ulang: 38 file yang terkait branch; tidak ada `CLAUDE.md`, `docs/personal-docs/`, secret, atau log. `git diff --cached --check` lulus.

Checklist MR tetap menyatakan gate migration tenant nyata, acceptance/browser/device, CI head PR, finance/privacy, refund, dan operasional reminder sebagai terbuka. Tidak ada klaim bahwa perubahan ini sudah dirilis atau tervalidasi pada production.
