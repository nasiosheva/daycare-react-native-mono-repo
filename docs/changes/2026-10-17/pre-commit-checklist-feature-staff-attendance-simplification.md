# Checklist Pra-Commit — Staff Attendance dan Perbaikan Parent/Offline

<!-- Mories Deo Hutapea,S.E.,S.Kom -->

## Identitas dan ringkasan status

| Field | Nilai |
| --- | --- |
| Branch | `feature/staff-attendance-simplification` |
| Tujuan perubahan | Sederhanakan attendance Staff; amankan booking Parent dengan idempotency; perjelas eligibility QR/push; bedakan offline perangkat dari API; dan tambah guard lint/UI serta workflow OpenSpec. |
| Tanggal diperbarui | `2026-10-17` |
| Status kesiapan | `READY` |
| Item wajib tertunda | 0 |
| Temuan review terbuka | 0 |
| Blocker | Tidak ada. Browser/perangkat tetap menjadi verifikasi visual lanjutan sebelum PR, sesuai permintaan untuk ditunda. |

## Status per area review

| Area dari checklist review sumber | Status | Bukti, nomor butir sumber, gap/follow-up |
| --- | --- | --- |
| 1. Scope dan konsistensi perubahan | `DONE` | Checklist sumber §1: branch `feature/staff-attendance-simplification` berasal dari `production` pada `814a5f6`; scope dipisah menjadi commit attendance, booking, QR/push, offline, lint guard, dan konfigurasi OpenSpec. `run-logs/`, `.agents/skills/`, `CLAUDE.md`, dan artefak lokal dikecualikan dari Git. |
| 2. Konsistensi dokumentasi | `DONE` | Checklist sumber §2: README, business rules §4/§13.2/§13.9/§13.13.1 dan catatan harian untuk setiap scope diselaraskan; perubahan docs akan berada pada commit terpisah. Tidak mengklaim uji browser/perangkat. |
| 3. Test dan coverage | `DONE` | Final batch: App 58 file/235 tes; UI 7 suite/27 tes; API 94 suite/909 tes; API client 2 file/66 tes. Typecheck dan ESLint terarah lulus tanpa warning. UI suite masih mencetak warning React `act(...)` yang sudah ada; tidak ada test gagal. Coverage terukur khusus attendance tercatat di sesi sebelumnya. |
| 4. Arsitektur dan maintainability | `DONE` | Checklist sumber §4: idempotency menggunakan API client/service yang ada; connectivity monitor dipisah dari API reachability; push registration dedupe berada di helper; UI memakai hook, guard, i18n, dan komponen existing. OpenSpec hanya menambah workflow/config. |
| 5. Business rule, role, dan security | `DONE` | Staff tetap satu-satunya pencatat attendance; approval exception tetap tenant/branch/child-scoped. Booking tetap role Parent/ownership-scoped dan server memvalidasi capability; UI filter bukan boundary authorization. Offline snapshot tetap scope-bound. |
| 6. Database dan API contract | `DONE` | Attendance migration/contract tercatat di scope sebelumnya; booking idempotency mengirim header stabil, replay memverifikasi payload dan membaca booking yang tersimpan; CORS mengizinkan header. Push token reuse tetap mematuhi unique token dan menghapus instalasi stale. Tidak ada migration baru untuk batch tersisa. |
| 7. UI/UX dan accessibility | `DONE` | Attendance exception memakai flow yang disepakati. Booking memiliki retry/empty/loading eksplisit dan hanya menawarkan tenant Daycare; QR menjelaskan alasan eligibility serta CTA booking. Alert guard mengarahkan feedback route ke `notify`. Visual browser/perangkat belum dilakukan dan dicatat sebagai follow-up sebelum PR. |
| 8. Performance dan reliability | `DONE` | Retry query terarah; mutation idempotent; booking date dinormalisasi; pendaftaran push in-flight dideduplikasi; pemulihan offline bersamaan tidak mengirim outbox yang sama dua kali. Native connectivity dibaca melalui `expo-network`, dengan nilai unknown fail-open terhadap klaim offline. |
| 9. Verification dan release readiness | `DONE` | App 58/235, UI 7/27, API client 2/66, backend 94/909, typecheck, targeted ESLint, dan `git diff --check` lulus. Test UI mengeluarkan warning `act(...)` existing. Device/browser dan migrasi database tidak dijalankan dan tidak diklaim. |
| 10. Keputusan akhir reviewer | `DONE` | Intended diffs ditinjau per scope; temuan warning lint pada AuthProvider/import/type syntax diperbaiki dan ESLint diulang bersih. Tidak ada temuan blocking tersisa; setiap commit berikutnya harus staged dan diperiksa ulang sebelum commit. |

## Temuan review dan perbaikannya

| Referensi bagian/butir sumber | Temuan dan tingkat risiko | Perbaikan | Verifikasi ulang / status |
| --- | --- | --- | --- |
| §5 role/security; §7 UI; business rules §13.9 | Staff Admin sebelumnya dapat mencapai roster/scanner dan menerima aksi dari konteks; risiko aksi yang tak sesuai role. | Guard route/notification dibuat Staff-only; backend mengosongkan `allowedActions` untuk Staff Admin sambil mempertahankan konteks baca-saja dan akses rekap. | Route tests dan `AttendanceServiceTest` lulus; ditutup. |
| §5 role/security; business rules §13.13.1 | Staff-only recorder sebelumnya berkontradiksi dengan pengecualian checkout yang mengharuskan Admin mencatat attendance, sementara UI dapat submit tanpa authorization. | Implementasikan request Staff dan review Staff Admin dengan grant sekali pakai; Staff tetap mencatat attendance setelah approval. | Implementasi, authorization checks, staged scope, dan tes backend/mobile telah ditinjau; test suite terkait diulang setelah final rename. Ditutup. |
| §7 UI/UX | Pemeriksaan manual lewat Chrome belum bisa dilakukan karena konektor ekstensi lokal tidak tersedia; pengguna meminta ditunda. | Tidak mengklaim hasil browser; lanjutkan pengujian visual sebelum PR setelah konektor tersedia. | Follow-up non-blocking untuk commit lokal. |
| §4 maintainability / §9 verification | Targeted ESLint menemukan unnecessary dependency `organizationId`, tipe `Array<T>`, dan import setelah `vi.mock`; ini menimbulkan warning pada file yang disentuh. | Hapus dependency yang tidak diperlukan (API membaca organization dari ref), gunakan tipe array baseline, dan pindahkan import ke header module. | Targeted ESLint akhir: 0 warning, 0 error. Ditutup. |
| §8 reliability | Banyak trigger retry offline dapat overlap setelah sinyal perangkat/API/app resume. | Tambah guard konkurensi pada flush dan regression test yang membuktikan satu draft hanya dikirim sekali saat recovery signals berbarengan. | App unit suite akhir lulus; ditutup. |

## Verifikasi yang dijalankan

- Sebelum implementasi, tes role route mobile dan backend dijalankan dan gagal pada perilaku akses Staff Admin; setelah patch dan penyelarasan dengan kontrak konteks baca-saja, tes kembali lulus.
- `pnpm --filter @daycare/app test` — 58 file, 235 tes lulus.
- `pnpm --filter @daycare/app run test:coverage` — lulus; `attendanceAction` seluruh cabang status diuji.
- `pnpm --filter @daycare/app test:ui` — 7 suite, 27 tes lulus; ada warning React `act(...)` yang sudah ada pada tes `OfflineProvider`, tidak terkait scope ini.
- `pnpm --filter @daycare/app typecheck` — lulus.
- ESLint terarah pada screen, route guards, dan helper attendance — lulus.
- `apps/api/gradlew -p apps/api test --no-daemon` — 94 suite, 909 tes lulus; tiga suite terarah sesudah perubahan terakhir juga lulus (44 tes).
- `apps/api/gradlew -p apps/api test --no-daemon --tests com.daycare.api.service.PickupAuthorizationServiceTest` — lulus kembali setelah final review.
- `pnpm --filter @daycare/api-client test -- src/index.wrappers.test.ts` — 2 file, 66 tes lulus.
- Final re-run setelah review lint: `pnpm --filter @daycare/app test` — 58 file / 235 tests; UI suite — 7 suites / 27 tests; API client — 2 files / 66 tests; backend — 94 suites / 909 tests; typecheck and targeted ESLint — passed.
- `git diff --check` dan `git diff --cached --check` — lulus.

## Keputusan sebelum commit

- [x] Scope attendance ditinjau terpisah dari perubahan lokal lainnya.
- [x] Tidak ada secret, akun lokal, log runtime, `CLAUDE.md`, atau `docs/personal-docs/` pada staged scope.
- [x] Tes teknis yang dijalankan lulus.
- [x] Tes lokal yang tercantum di atas lulus.
- [x] Tinjau staged diff akhir dan tutup review akhir; uji browser/perangkat dicatat sebagai follow-up sebelum PR sesuai permintaan user.
- [x] Status kesiapan `READY`; item wajib tertunda = 0 dan tidak ada temuan terbuka.
