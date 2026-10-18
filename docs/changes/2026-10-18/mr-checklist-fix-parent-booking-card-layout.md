# Checklist Pull Request per Branch

<!-- Mories Deo Hutapea,S.E.,S.Kom -->

## Identitas

| Field | Nilai |
| --- | --- |
| Branch sumber | `fix/parent-booking-card-layout` |
| Target branch | `production` |
| PR | Belum dibuat. |
| Work item / tujuan | Perbaiki kartu ringkasan booking Parent di layar ponsel agar label dan ringkasan terbaca utuh. |
| Tanggal checklist | `2026-10-18` |

## Ringkasan untuk deskripsi PR/MR

| Area review | Status | Gap / blocker / bukti |
| --- | --- | --- |
| 1. Scope dan konsistensi perubahan | `PASS` | Hanya layout kartu booking Parent, regression test, dan dokumentasi terkait. |
| 2. Konsistensi dokumentasi | `PASS` | Daily change note dan checklist branch tersedia; README/business rules tidak berubah karena tidak ada perubahan flow atau aturan. |
| 3. Test dan coverage | `PASS` | `pnpm verify` lulus. UI Jest: 14 suites/68 tests lulus. Backend Gradle test lulus. Coverage tidak dikumpulkan; tidak ada logic bisnis baru. |
| 4. Arsitektur dan maintainability | `PASS` | Menggunakan `useWindowDimensions` dan style screen yang sudah ada; tanpa dependency/abstraction baru. |
| 5. Business rule, role, dan security | `N/A` | Perubahan presentasi saja; tidak mengubah role, authorization, tenant scope, atau data. |
| 6. Database dan API contract | `N/A` | Tidak ada perubahan API, DTO, persistence, atau migration. |
| 7. UI/UX dan accessibility | `PARTIAL` | Automated tests mencakup lebar 360 dp dan 900 dp; action/accessibility labels dipertahankan. Belum ada validasi visual langsung di perangkat Android. |
| 8. Performance dan reliability | `PASS` | Hanya memilih layout berdasarkan lebar layar; tidak menambah request, subscription, atau proses berat. |
| 9. Verification dan release readiness | `PARTIAL` | `pnpm verify`, backend tests, typecheck, lint, dan `git diff --check` lulus. CI PR menunggu setelah PR dibuat; verifikasi device belum dilakukan. |
| 10. Keputusan akhir reviewer | `APPROVE` | Review kode tidak menemukan temuan blocking; follow-up visual Android dicatat. |

Checklist branch lengkap: `docs/changes/2026-10-18/mr-checklist-fix-parent-booking-card-layout.md`

Checklist kesiapan commit: `docs/changes/2026-10-18/pre-commit-checklist-fix-parent-booking-card-layout.md` (`READY`)

Temuan terbuka/blocker: Tidak ada blocker. Follow-up non-blocking: verifikasi visual di device Android.

## Scope dan aturan produk

- [x] Tujuan branch dan acceptance criteria jelas; perubahan tetap dalam scope.
- [x] README dan business rules ditinjau; tidak ada perubahan aturan bisnis.
- [x] Role, tenant, branch, ownership, dan capability tidak berubah.
- [x] API, data, konfigurasi, status, dan efek samping tidak berubah.
- [x] Tidak ada operasi bisnis baru yang perlu idempotency atau locking.

## Implementasi dan pengalaman pengguna

- [x] Mengikuti pola screen dan komponen yang ada; tidak menduplikasi business logic.
- [x] Checklist kesiapan commit tersedia dan berstatus READY.
- [x] Seluruh diff telah direview; tidak ada temuan blocking.
- [x] State dan aksi booking tidak berubah; hanya layout kartu responsif yang berubah.
- [x] Tidak ada string baru; accessibility labels dan interaksi kartu tetap.
- [ ] Belum ada validasi visual langsung di Android device; follow-up non-blocking.
- [x] Tidak ada secret, token, data pribadi, log, atau file lokal-only yang masuk.

## Database, test, dan verifikasi

- [x] Migration/API database tidak relevan untuk perubahan ini.
- [x] Test ditulis sebelum implementasi; red/green: test sempit 360 dp awalnya gagal saat layout masih row, lalu lulus setelah patch; layout 900 dp juga diuji.
- [x] Test terkait: UI suite 14 suites/68 tests lulus.
- [x] Test frontend penuh `corepack pnpm verify` lulus (lint, typecheck, dan workspace tests).
- [x] Test backend penuh `./apps/api/gradlew -p apps/api test --no-daemon` lulus.
- [ ] CI untuk head PR menunggu hasil setelah PR dibuat.
- [x] `git diff --check` lulus. Coverage tidak dikumpulkan karena tidak ada business logic baru.
- [x] Local automated verification dibedakan dari device/CI; tidak mengklaim device proof.

## Dokumentasi dan release hygiene

- [x] Daily note tersedia: `docs/changes/2026-10-18/parent-booking-mobile-card-layout.md`.
- [x] README/business-rules tidak perlu diubah; tidak ada perubahan flow, aturan, API, data, atau operasi.
- [x] File baru sudah memakai watermark kanonis.
- [x] Branch `fix/parent-booking-card-layout` menarget `production`; diff hanya berisi scope terkait.
- [x] `run-logs/` diperiksa kosong sebelum PR; tidak ada konten log di commit.
- [x] `docs/personal-docs/`, `CLAUDE.md`, akun lokal, secret, keystore, dan artefak lokal-only tidak masuk.
- [x] Checklist branch ini disimpan bersama dokumentasi perubahan.

## Bukti verifikasi dan hasil yang belum selesai

| Pemeriksaan | Hasil / perintah / tautan | Catatan atau alasan N/A |
| --- | --- | --- |
| Test frontend | PASS — `corepack pnpm verify`; lint, typecheck, dan workspace tests lulus. Mobile Vitest: 72 suites/284 tests; workspace total: 392 tests. UI Jest: 14 suites/68 tests. | Suite UI mencetak warning React `act(...)` yang telah ada pada test icon/offline lain; semua test lulus. |
| Test backend | PASS — `./apps/api/gradlew -p apps/api test --no-daemon` (`BUILD SUCCESSFUL`). | Rerun normal sesudah rerun task penuh juga sukses; Gradle menyatakan task up-to-date. |
| CI head PR | PENDING | Belum dibuat saat checklist ini ditulis. |
| Coverage line/branch | N/A | Tidak menjalankan laporan coverage untuk perubahan presentasi; regression test mengunci kedua layout breakpoint. |
| DB/migration | N/A | Tidak ada perubahan database atau migration. |
| Browser/device/live service | Belum dilakukan | UI diuji otomatis; belum menjalankan device Android atau live service. |
| Blocker/follow-up | Tidak ada blocker | Follow-up: konfirmasi visual di perangkat Android setelah tersedia. |

## Setelah merge

- [ ] Merge dikonfirmasi pada PR yang benar.
- [ ] Checkout disinkronkan ke `production` dan branch lokal merged dibersihkan.
- [ ] Worktree serta file lokal-only yang tidak terkait tetap dipertahankan.
