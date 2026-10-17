# Checklist PR — Staff Attendance Simplification

<!-- Mories Deo Hutapea,S.E.,S.Kom -->

## Identitas

| Field | Nilai |
| --- | --- |
| Branch sumber | `feature/staff-attendance-simplification` |
| Target branch | `production` |
| PR | https://github.com/nasiosheva/daycare-react-native-mono-repo/pull/85 |
| Tujuan | Persetujuan pengecualian pickup satu kali untuk attendance Staff, serta perbaikan alur Parent booking/QR/push, status konektivitas offline, guard alert pada web, dan konfigurasi workflow OpenSpec. |
| Tanggal checklist | `2026-10-17` |

## Ringkasan untuk deskripsi PR

| Area review | Status | Gap / blocker / bukti |
| --- | --- | --- |
| 1. Scope dan konsistensi perubahan | `PASS` | Diff terhadap `production`: 73 file setelah skill Codex lokal dikeluarkan dari Git; seluruh perubahan tersisa ditinjau dan berhubungan dengan tujuan branch. Tidak ada isi `run-logs/` pada PR. |
| 2. Konsistensi dokumentasi | `PASS` | `README.md`, `docs/business-rules.md`, catatan perubahan harian, dan checklist branch diperbarui. |
| 3. Test dan coverage | `PASS` | `pnpm verify` lulus (lint, typecheck, test seluruh TS workspace); mobile 58 file/235 test dan API client 66 test. Backend full suite: 94 suite/909 test lulus. JaCoCo terakhir: 94% line, 87% branch. |
| 4. Arsitektur dan maintainability | `PASS` | Mengikuti service/hook/helper, API client, i18n, route guard, dan pola offline yang sudah ada; tidak ada temuan terbuka pada review lokal. |
| 5. Business rule, role, dan security | `PASS` | Attendance tetap dicatat Staff setelah persetujuan pengecualian oleh Staff Admin; akses dan data tetap tenant/branch/child-scoped. Booking dan QR tetap divalidasi server-side. |
| 6. Database dan API contract | `PASS` | Menambahkan migrasi Flyway V35 untuk approval pengecualian pickup; perubahan kontrak booking idempotency dan CORS ikut diuji. Migrasi belum dijalankan pada database lokal/production. |
| 7. UI/UX dan accessibility | `PARTIAL` | Automated UI tests lulus. Pemeriksaan visual manual melalui browser/perangkat belum dilakukan; bukan klaim terverifikasi dan perlu follow-up reviewer. |
| 8. Performance dan reliability | `PASS` | Booking memakai idempotency persisten, push registration/outbox mencegah pengiriman ganda, dan offline hanya dinyatakan saat konektivitas perangkat memang terputus. |
| 9. Verification dan release readiness | `PASS` | `pnpm verify`, backend suite, `git diff --check`, dan pemeriksaan `run-logs/` lulus/bersih. CI PR dan penerapan migrasi menunggu setelah PR dibuat/di-merge. |
| 10. Keputusan akhir reviewer | `APPROVE` | Review lokal tidak menemukan blocker; catatan verifikasi visual tercatat sebagai follow-up, bukan hasil yang sudah lulus. |

Checklist branch lengkap: `docs/changes/2026-10-17/mr-checklist-feature-staff-attendance-simplification.md`

Checklist pra-commit: `docs/changes/2026-10-17/pre-commit-checklist-feature-staff-attendance-simplification.md`

Temuan terbuka/blocker: Tidak ada blocker kode yang diketahui. Follow-up: verifikasi visual manual; CI dan migrasi berjalan sesuai alur rilis.

## Bukti verifikasi

- `pnpm verify` — lulus; mencakup lint, typecheck, dan test seluruh TypeScript workspace. Mobile: 58 file/235 test lulus; API client: 66 test lulus.
- `apps/api/gradlew -p apps/api test --no-daemon` — 94 suite/909 test lulus.
- `pnpm --filter @daycare/app test:ui` — 7 suite/27 test lulus pada verifikasi branch sebelumnya; ada warning React `act(...)` yang tidak menyebabkan test gagal.
- JaCoCo backend terakhir: 94% line, 87% branch.
- `git diff --check origin/production...HEAD` — lulus.
- `find run-logs -mindepth 1 -print` — tidak menghasilkan isi; direktori kosong/tidak ada artefak runtime.
- Browser/perangkat: belum diverifikasi secara manual.
- Database migration V35: ditambahkan, tetapi belum dijalankan lokal atau production.

## Cakupan utama

- [x] Staff attendance dan persetujuan pengecualian pickup satu kali.
- [x] Booking Parent aman terhadap retry melalui idempotency.
- [x] Eligibility QR Parent dan registrasi token push diperjelas.
- [x] Indikator offline membedakan koneksi perangkat dari jangkauan API.
- [x] Web tidak memakai native alert untuk feedback.
- [x] Dokumentasi aturan bisnis, catatan perubahan, dan konfigurasi workflow OpenSpec tersedia; skill Codex lokal tidak dimasukkan ke Git.
- [x] Tidak menyertakan secret, akun lokal, `CLAUDE.md`, `.agents/skills/`, `docs/personal-docs/`, atau isi `run-logs/`.
- [ ] Pemeriksaan visual browser/perangkat — follow-up, belum dilakukan.
- [ ] CI GitHub — menunggu PR.
- [ ] Validasi migrasi pada database target — dilakukan sesuai proses deployment.

<!-- Mories Deo Hutapea,S.E.,S.Kom -->
