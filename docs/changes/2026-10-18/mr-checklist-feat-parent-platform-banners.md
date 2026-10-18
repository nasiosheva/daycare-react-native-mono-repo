<!-- Mories Deo Hutapea,S.E.,S.Kom -->

# Checklist Pull/Merge Request per Branch

## Identitas

| Field | Nilai |
| --- | --- |
| Branch sumber | `feat/parent-platform-banners` |
| Target branch | `production` |
| PR | [#89](https://github.com/nasiosheva/daycare-react-native-mono-repo/pull/89) |
| Work item / tujuan | Platform banners and tenant announcements, parent carousel actions, secure in-app browser, and local launcher improvements. |
| Tanggal checklist | `2026-10-18` |

## Ringkasan untuk deskripsi PR

| Area review | Status | Gap / blocker / bukti |
| --- | --- | --- |
| 1. Scope dan konsistensi perubahan | `PASS` | Branch contains the reviewed feature, test, migration, launcher, and documentation scopes. No local logs or credentials are included. |
| 2. Konsistensi dokumentasi | `PASS` | README, `docs/business-rules.md`, OpenSpec artifacts, daily notes, and branch readiness checklist are included and aligned. |
| 3. Test dan coverage | `PASS` | Frontend `pnpm verify` passed (mobile 72 files/284 tests); UI 14 suites/65 tests passed. Backend test passed. JaCoCo aggregate: line 93.84%, branch 87.43%; selected new helpers: 100% statements/lines/functions, 98.36% branches. |
| 4. Arsitektur dan maintainability | `PASS` | Reuses existing UI, URL validation, search normalization, and role routes; browser adapters and image handling are separated by platform. |
| 5. Business rule, role, dan security | `PASS` | Audience and management remain role/tenant-scoped; browser destinations are HTTPS-only and web content is sandboxed. |
| 6. Database dan API contract | `PARTIAL` | Backend tests pass and contracts/migrations are included. V37 was not run against a persistent local database per prior instruction; CI and deployment migration execution remain unverified. |
| 7. UI/UX dan accessibility | `PARTIAL` | UI tests cover changed interactions and labels. Manual visual verification on Android/iOS devices was not performed. |
| 8. Performance dan reliability | `PASS` | Filtering uses loaded data; local launcher concurrency regression tests pass; native cache cleanup and secure URL checks are covered. |
| 9. Verification dan release readiness | `PARTIAL` | Full local frontend/backend tests, web export, and Android debug build pass. PR-head Mobile unit tests are currently in progress; no live-service or device verification is claimed. |
| 10. Keputusan akhir reviewer | `DEFER` | No open local code-review findings. Reassess after PR-head CI completes and required review is recorded. |

Checklist branch lengkap: `docs/changes/2026-10-18/mr-checklist-feat-parent-platform-banners.md`

Pre-commit checklist: `docs/changes/2026-10-18/pre-commit-checklist-feat-parent-platform-banners.md`
Temuan lokal terbuka: tidak ada. Blocker verifikasi: PR-head CI pending; V37 persistent-database execution and manual device verification not performed.

## Scope dan aturan produk

- [x] Tujuan branch dan acceptance criteria tertulis; perubahan tetap dalam scope.
- [x] `README.md` dan `docs/business-rules.md` ditinjau; aturan dan implementasi selaras.
- [x] Role, tenant, branch, child/resource ownership, dan capability diperiksa pada backend/service serta UI boundary yang relevan.
- [x] API, migration, client, mobile, launcher, dan dokumen terkait ditinjau bersama; tidak ada perubahan data/API yang tidak terdokumentasi.
- [x] Operasi lifecycle dan retry mengikuti contract existing; perubahan UI tidak mengubah semantik API.

## Implementasi dan pengalaman pengguna

- [x] Perubahan mengikuti arsitektur dan abstraction repo; filter dan browser/download helper tidak menduplikasi validasi bersama.
- [x] Pre-commit checklist branch berstatus READY dan tidak memiliki temuan terbuka.
- [x] Review code checklist dilakukan sebelum commit; temuan MIME/origin yang ditemukan sudah diperbaiki serta dites ulang.
- [x] Loading, empty, error, disabled, permission denial, dan success states ditinjau untuk screen yang berubah.
- [x] Teks baru tersedia dalam seluruh locale yang didukung; accessibility labels dan UI tests diperiksa.
- [x] Tidak ada secret, token, data pribadi, log lokal, atau file lokal-only di commits.

## Database, test, dan verifikasi

- [x] Migration V36/V37 ditinjau dalam scope branch; V37 tidak dijalankan pada persistent DB sesuai instruksi sebelumnya.
- [x] Test-first regression untuk scope terbaru dicatat di daily notes; test merah/hijau telah direkam.
- [x] Frontend `pnpm verify` lulus: Core 10, UI 30, API client 68, Mobile 284; UI Jest 14 suites/65 tests.
- [x] Backend `./apps/api/gradlew -p apps/api test --no-daemon --console=plain` lulus (`BUILD SUCCESSFUL`).
- [ ] CI wajib untuk commit/head PR saat ini lulus; belum dapat diperiksa sebelum PR dibuat.
- [x] Coverage dilaporkan: backend JaCoCo aggregate line 93.84%, branch 87.43%; targeted announcement/browser/filter helper line/function 100%, branch 98.36%.
- [x] Web export dan Android `:app:assembleDebug` lulus; tidak diklaim sebagai uji manual browser/device.

## Dokumentasi dan release hygiene

- [x] Daily notes dan `docs/business-rules.md` mencatat perubahan, behavior, verifikasi, dan batas.
- [x] Perubahan code/docs yang mendukung watermark memiliki watermark.
- [x] Branch sumber `feat/parent-platform-banners`; target PR `production`.
- [x] Seluruh isi `run-logs/` dibersihkan sebelum PR dan direktori diverifikasi kosong; tidak ada isinya di-commit.
- [x] `docs/personal-docs/`, `CLAUDE.md`, credentials, local accounts, dan artefak lokal-only tidak termasuk.
- [x] Checklist PR ini disimpan bersama dokumentasi branch dan tabel ringkasannya disalin ke deskripsi PR.

## Bukti verifikasi dan hasil yang belum selesai

| Pemeriksaan | Hasil / perintah / tautan | Catatan atau alasan N/A |
| --- | --- | --- |
| Test frontend | `pnpm verify` PASS; mobile 72 files/284 tests. UI `pnpm --filter @daycare/app test:ui` PASS, 14 suites/65 tests. | Ada warning React `act(...)`/`react-test-renderer`; seluruh test lulus. |
| Test backend | `./apps/api/gradlew -p apps/api test --no-daemon --console=plain` PASS. | `jacocoTestReport` juga PASS. |
| CI head PR | PENDING | [Mobile unit tests](https://github.com/nasiosheva/daycare-react-native-mono-repo/actions/runs/39105659448/job/117610824309) sedang berjalan untuk head PR #89. |
| Coverage line/branch | Backend aggregate JaCoCo: line 93.84%, branch 87.43%. Selected new helpers: line/function 100%, branch 98.36%. | Source: `apps/api/build/reports/jacoco/test/jacocoTestReport.xml` dan Vitest targeted coverage output. |
| DB/migration | V36/V37 included; V37 not run on persistent local/prod DB. | Tidak menjalankan migration persistent karena instruksi pengguna sebelumnya. |
| Browser/device/live service | Expo web export PASS; Android debug build PASS. | Manual iOS/Android device and live-service checks not performed. |
| Blocker/follow-up | PR-head CI pending; device QA and persistent DB migration verification remain follow-ups. | No known local test failure or open code-review finding. |

## Setelah merge

- [ ] Merge dikonfirmasi pada PR yang benar.
- [ ] Checkout disinkronkan ke `production` (`fetch`, `checkout`, `pull --ff-only`) dan hanya branch lokal yang sudah merged/remote-deleted yang dibersihkan.
- [ ] Worktree dan file lokal-only yang tidak terkait tetap dipertahankan.
