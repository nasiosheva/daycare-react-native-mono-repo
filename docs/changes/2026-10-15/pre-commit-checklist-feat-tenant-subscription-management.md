<!-- Mories Deo Hutapea,S.E.,S.Kom -->

# Checklist Kesiapan Commit per Branch

## Identitas dan ringkasan status

| Field | Nilai |
| --- | --- |
| Branch | `feat/tenant-subscription-management` |
| Changeset | Actor-lock fail-closed, correction actor scope, deterministic reminder clock, controller/service tests, dan checklist process |
| Tanggal diperbarui | `2026-10-15` |
| Status kesiapan | `READY` untuk changeset lokal; bukan persetujuan merge atau rilis |
| Item wajib tertunda | `0` untuk changeset lokal |
| Temuan correctness/security terbuka | `0` pada changeset lokal |
| Blocker | Tidak ada untuk commit ini. Gate branch/MR/production tetap `NOT READY` di checklist MR terpisah. |

Status ini memeriksa perubahan lokal yang akan di-commit, bukan mengesahkan
seluruh sejarah branch atau kesiapan production. Checklist rinci lokal
`docs/personal-docs/code-review-checklist.md` tetap menjadi acuan review.

## Status per area review

| Area review | Status | Bukti dan batasan |
| --- | --- | --- |
| 1. Scope dan konsistensi perubahan | `DONE` | Diff lokal dibatasi pada hardening row lock, filter actor, clock reminder, test, dan dokumentasi checklist. `CLAUDE.md` serta `docs/personal-docs/` tidak disertakan. |
| 2. Konsistensi dokumentasi | `DONE` | README, daily note, template, checklist pre-commit, dan checklist MR menjelaskan scope serta gap; MR secara eksplisit tetap `NOT READY`. |
| 3. Test dan coverage | `DONE` | `pnpm verify` lulus (327 test frontend). Backend Gradle: 874 test, 0 failure, 4 ignored. Controller tests mencakup 17 handler subscription. JaCoCo aggregate backend: line 93.95% (9,122/9,709), branch 87.99% (5,724/6,505), method 66.53% (4,240/6,373); bukan coverage diff. Regression test guard actor merah sebelum implementasi dan hijau sesudahnya. |
| 4. Arsitektur dan maintainability | `DONE` | Menggunakan service/repository/controller yang ada; tidak ada layer baru atau refactor di luar scope. Filter correction memanfaatkan derived repository query. |
| 5. Business rules, role, dan security | `DONE` untuk changeset ini | Submit/review proof dan correction menolak jika row actor tidak ditemukan; daftar koreksi hanya memuat request milik actor pada scope Staff Admin aktif. Gate finance/privacy untuk rollout tercatat di MR checklist dan tidak dinyatakan lulus. |
| 6. Database dan API contract | `N/A` untuk schema/wire contract | Changeset lokal tidak menambah migration atau mengubah API wire contract. Validasi migration Flyway/history-existing dan semantik business key Parent masih tercatat sebagai gap branch/MR. |
| 7. UI/UX dan accessibility | `N/A` | Tidak ada perubahan UI dalam changeset lokal. Validasi browser/device dan aksesibilitas tetap pada checklist MR. |
| 8. Performance dan reliability | `DONE` untuk changeset ini | Scheduler memakai injected clock pada zona WIB; actor row lock menyerialisasi command per actor. Perubahan tidak mengubah query reminder atau payload. Delivery monitoring/load validation tetap merupakan follow-up MR. |
| 9. Verification | `DONE` untuk commit lokal | `pnpm verify`, backend suite penuh, suite terarah, dan `git diff --check` lulus. Tidak ada CI head-MR karena MR belum dibuat. |
| 10. Keputusan reviewer | `APPROVE` untuk changeset lokal | Self-review atas seluruh diff lokal telah dilakukan. Ini tidak mengubah keputusan `DEFER` untuk MR atau approval release. |

## Temuan review yang diperbaiki

| Temuan | Perbaikan | Verifikasi |
| --- | --- | --- |
| Row aktor yang hilang diabaikan sehingga operasi dapat berjalan tanpa lock | Proof/correction service fail-closed sebelum menyentuh payment atau idempotency record | Regression test keduanya gagal sebelum patch dan lulus sesudah patch; backend full suite lulus |
| Daftar koreksi Staff Admin mengembalikan request dari actor lain di tenant sama | Repository query difilter dengan `requestedByUserId` dari authorization scope | Regression test red-green lulus |
| Reminder scheduler membaca system date, bukan injected clock WIB | Scheduler menggunakan injected clock pada zona `Asia/Jakarta` | Test red-green melintasi pergantian tanggal WIB |
| Delegasi handler subscription belum dites menyeluruh | Menambahkan test delegasi untuk 17 handler terkait | Backend full suite dan JaCoCo lulus |

## Pemeriksaan sebelum commit

- [x] Perubahan lokal ditinjau item demi item sesuai checklist review.
- [x] Semua area lokal `DONE` atau `N/A` dengan alasan; tidak ada item lokal `PENDING`.
- [x] Test/verifikasi terkait seluruh temuan yang diperbaiki telah dijalankan ulang.
- [x] `git diff --check` lulus. Staged diff tetap wajib diperiksa setelah staging.
- [x] Status lokal diperiksa; tidak ada `run-logs/`, secret, data pribadi, `CLAUDE.md`, `docs/personal-docs/`, atau artefak lokal-only di changeset.
- [x] Perbedaan commit readiness vs MR/release readiness dicatat jelas.

Checklist ini mengizinkan commit changeset lokal saja. Checklist MR
`docs/changes/2026-10-15/mr-checklist-feat-tenant-subscription-management.md`
tetap `NOT READY`; jangan merge atau rilis sebelum semua gate branch di sana
ditutup.
