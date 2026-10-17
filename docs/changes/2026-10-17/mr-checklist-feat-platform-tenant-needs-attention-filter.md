<!-- Mories Deo Hutapea,S.E.,S.Kom -->

# Checklist Pull/Merge Request — `feat/platform-tenant-needs-attention-filter`

## Identitas

| Field | Nilai |
| --- | --- |
| Branch sumber | `feat/platform-tenant-needs-attention-filter` |
| Target branch | `production` |
| MR/PR | (diisi setelah dibuat) |
| Work item / tujuan | Filter dashboard "Perlu ditangani" pada daftar langganan Platform Admin (`docs/plans/tenant-subscription-management.md` §5-A, gap yang sudah tercatat sejak review sebelumnya) + fix tooling `scripts/run-mobile.sh` (stale Metro port 8081 menyebabkan `run-web.sh` gagal diam-diam) |
| Tanggal checklist | 2026-10-17 |

## Ringkasan untuk deskripsi PR/MR

| Area review | Status | Gap / blocker / bukti |
| --- | --- | --- |
| 1. Scope dan konsistensi perubahan | PASS | Branch dibuat dari `production` yang sinkron penuh dengan `origin/production`; hanya file terkait kedua perubahan ini yang di-stage (direktori `.agents/` tidak terkait sengaja dikecualikan). |
| 2. Konsistensi dokumentasi | PASS | Daily note `docs/changes/2026-10-17/platform-tenant-needs-attention-filter.md`. `docs/business-rules.md`/README tidak disentuh (N/A — tidak ada aturan bisnis/env var/command baru, §5-A plan sudah cukup sebagai rujukan desain UI). |
| 3. Test dan coverage | PASS | Test-first di 5 layer (Kotlin domain, service, `packages/core`, `packages/api-client`, mobile) — setiap test dikonfirmasi gagal dulu sebelum kode produksi ditulis. Lihat tabel bukti di bawah. |
| 4. Arsitektur dan maintainability | PASS | Mapping status→grup satu sumber kebenaran (`packages/core`), direplikasi presisi di Kotlin. Tidak ada duplikasi/abstraction berlebih. |
| 5. Business rule, role, dan security | PASS | Otorisasi Platform Admin tidak berubah; validasi mutual-exclusivity `status`/`attentionGroup` di server, diuji eksplisit. |
| 6. Database dan API contract | PASS | Tidak ada migration. Parameter baru opsional, backward compatible, diverifikasi lewat request nyata tanpa parameter tetap identik perilakunya. |
| 7. UI/UX dan accessibility | PASS | Pakai komponen `TabBar` yang sudah ada, i18n lengkap 7 locale, diuji manual di browser. |
| 8. Performance dan reliability | PASS | Tidak ada query tambahan (filter memakai data yang sudah di-load); fix `run-mobile.sh` punya batas waktu tunggu (tidak infinite loop) dan scoped ke `cwd` project sendiri. |
| 9. Verification dan release readiness | PASS | Lihat tabel bukti verifikasi di bawah. |
| 10. Keputusan akhir reviewer | APPROVE | Tidak ada temuan terbuka. |

Checklist branch lengkap: `docs/changes/2026-10-17/pre-commit-checklist-feat-platform-tenant-needs-attention-filter.md`
Temuan terbuka/blocker: tidak ada

## Scope dan aturan produk

- [x] Tujuan branch dan acceptance criteria tertulis; perubahan tetap dalam scope (§5-A plan + fix tooling terkait langsung dengan testing fitur ini).
- [x] `README.md` dan `docs/business-rules.md` ditinjau; tidak ada aturan bisnis baru yang perlu diselaraskan (perubahan UI murni mengikuti desain §5-A yang sudah disahkan).
- [x] Role diperiksa di server: `platformAccess.requirePlatformAdmin(jwt)` tidak berubah, hanya parameter filter opsional ditambahkan.
- [x] Kontrak API konsisten di backend (`Controllers.kt`/`PlatformAdministrationService.kt`), `packages/api-client`, `packages/core`, dan mobile.
- [x] Filter server bersifat read-only (tidak ada efek samping/retry/konflik untuk ditangani); validasi mutual-exclusivity mencegah kombinasi ambigu.

## Implementasi dan pengalaman pengguna

- [x] Mengikuti arsitektur/pola repo (satu sumber kebenaran di `packages/core`, pola `TabBar`/i18n yang sudah ada); tidak menduplikasi aturan.
- [x] Checklist kesiapan commit terlampir: `docs/changes/2026-10-17/pre-commit-checklist-feat-platform-tenant-needs-attention-filter.md` — status READY, 0 item pending, 0 temuan terbuka.
- [x] Seluruh diff ditinjau memakai `docs/personal-docs/code-review-checklist.md` sebelum commit; test/verifikasi dijalankan ulang (lihat tabel bukti).
- [x] Loading/error/empty state tidak berubah (memakai state existing dari `useQuery` yang sudah ada); diverifikasi empty state baru ("Belum ada data") tampil benar untuk tab baru.
- [x] Teks baru (`tenant.filterNeedsAttention`) diterjemahkan 7 locale (id/en/zh/fr/pt/es/ru).
- [x] Tidak ada secret/token/data pribadi/log lokal — discan manual, nihil.

## Database, test, dan verifikasi

- [x] Tidak ada migration baru (N/A — perubahan murni derived/computed).
- [x] Test ditulis sebelum kode produksi di semua 5 layer; setiap test dikonfirmasi RED (gagal) sebelum implementasi, lalu GREEN setelahnya. Command dan hasil di tabel bukti.
- [x] Unit test baru/diperbarui: `TenantSubscriptionAttentionGroupTest.kt` (3), `PlatformAdministrationServiceTest.kt` (+1), `packages/core/src/index.test.ts` (+1), `packages/api-client/.../index.wrappers.test.ts` (+1), `apps/mobile/src/tenants/tenantAttentionFilter.test.ts` (2).
- [x] `pnpm lint` dan `pnpm test` lulus (lihat tabel bukti).
- [x] `./apps/api/gradlew -p apps/api test --no-daemon` lulus (lihat tabel bukti).
- [ ] CI wajib untuk head commit saat ini — **belum ada hasil CI remote**; MR belum dibuka saat checklist ini ditulis, PENDING sampai PR dibuka dan CI jalan.
- [x] `git diff --check` lulus. Coverage: tidak ada perubahan coverage backend yang signifikan untuk diukur ulang (perubahan kecil pada file yang sudah >90% coverage dari sesi sebelumnya; tidak ada klaim angka baru).
- [x] Validasi dibedakan jelas: lint/typecheck/test = otomatis lokal; backend+web dev server lokal + browser Chrome asli = manual lokal; tidak ada klaim validasi production/device fisik.

## Dokumentasi dan release hygiene

- [x] Daily note `docs/changes/2026-10-17/platform-tenant-needs-attention-filter.md` mencatat perubahan/dampak/verifikasi/follow-up.
- [x] README/business-rules tidak memerlukan update (N/A, lihat alasan di atas).
- [x] Semua file baru memuat watermark `Mories Deo Hutapea,S.E.,S.Kom`.
- [x] Branch bukan `production`; target MR adalah `production`; tidak ada broad-stage (`.agents/` sengaja dikecualikan).
- [x] `run-logs/` kosong (dicek ulang sebelum checklist ini ditulis).
- [x] `docs/personal-docs/`, `CLAUDE.md`, akun lokal, secret tidak termasuk.
- [x] Checklist branch ini disimpan bersama dokumentasi MR.

## Bukti verifikasi dan hasil yang belum selesai

| Pemeriksaan | Hasil / perintah / tautan | Catatan atau alasan N/A |
| --- | --- | --- |
| Test frontend | PASS — `pnpm lint` (exit 0, semua workspace), `pnpm typecheck` (lulus), `pnpm test` (237/237 test mobile + seluruh `packages/*`) | Dijalankan fresh di branch ini setelah checkout |
| Test backend | PASS — `./apps/api/gradlew -p apps/api test --no-daemon` → BUILD SUCCESSFUL | Dijalankan fresh di branch ini |
| CI head MR | PENDING | MR belum dibuka saat checklist ditulis; akan diperbarui setelah CI jalan di head commit `afeb607` |
| Coverage line/branch | Tidak diukur ulang — perubahan kecil (+1 param, +1 method call) pada file yang sudah dicakup test existing di PR #83 sebelumnya | Tidak ada klaim angka baru tanpa sumber |
| DB/migration | N/A — tidak ada migration di perubahan ini | |
| Browser/device/live service | PASS — backend + web dev server lokal (`run-mobile.sh web local`), login Platform Admin lokal (`admin@gmail.com`), diuji via Claude in Chrome: 3 tab (Semua/Perlu ditangani/Aktif) menghasilkan request `GET .../tenants/page` yang benar (tanpa param / `attentionGroup=ATTENTION` / `status=ACTIVE`, mutually exclusive), semua 200, tidak ada console error | Localhost dev host, bukan production/device fisik |
| Blocker/follow-up | Tidak ada | |

## Setelah merge

- [ ] Merge dikonfirmasi pada MR/PR yang benar.
- [ ] Checkout disinkronkan ke `production` (`fetch`, `checkout`, `pull --ff-only`) dan branch lokal yang sudah merged dibersihkan.
- [ ] Worktree dan file lokal-only yang tidak terkait tetap dipertahankan.
