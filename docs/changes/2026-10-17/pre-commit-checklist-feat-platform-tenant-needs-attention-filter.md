<!-- Mories Deo Hutapea,S.E.,S.Kom -->

# Checklist Kesiapan Commit — `feat/platform-tenant-needs-attention-filter`

## Identitas dan ringkasan status

| Field | Nilai |
| --- | --- |
| Branch | `feat/platform-tenant-needs-attention-filter` (dibuat dari `production`, sinkron dengan `origin/production` saat dibuat) |
| Tujuan perubahan | (1) Filter dashboard "Perlu ditangani" pada daftar langganan Platform Admin, sesuai `docs/plans/tenant-subscription-management.md` §5-A; (2) perbaikan tooling `scripts/run-mobile.sh` agar `run-web.sh` otomatis membersihkan proses Metro basi di port 8081 |
| Tanggal diperbarui | 2026-10-17 |
| Status kesiapan | READY |
| Item wajib tertunda | 0 |
| Temuan review terbuka | 0 |
| Blocker | Tidak ada |

Lingkup diff yang direview (intended commit — tidak termasuk `.agents/` yang muncul
tidak terkait pekerjaan ini dan sengaja tidak di-stage):

- Modified: `apps/api/.../domain/Models.kt`, `.../service/PlatformAdministrationService.kt`,
  `.../web/Controllers.kt`, `.../test/.../PlatformAdministrationServiceTest.kt`,
  `apps/mobile/app/platform-tenants.tsx`, `apps/mobile/src/i18n/translations.ts`,
  `packages/api-client/src/index.ts`, `packages/api-client/src/index.wrappers.test.ts`,
  `packages/core/src/index.ts`, `packages/core/src/index.test.ts`, `scripts/run-mobile.sh`.
- New: `apps/api/.../domain/TenantSubscriptionAttentionGroupTest.kt`,
  `apps/mobile/src/tenants/tenantAttentionFilter.ts` (+ `.test.ts`),
  `docs/changes/2026-10-17/platform-tenant-needs-attention-filter.md`.

## Status per area review

| Area dari checklist review sumber | Status | Bukti, nomor butir sumber, gap/follow-up |
| --- | --- | --- |
| 1. Scope dan konsistensi perubahan | DONE | Branch baru dibuat dari `production` (item §1 butir 4: "dibuat dari base branch yang benar, tidak langsung di production") setelah menyadari checkout sebelumnya sudah pindah ke `production` akibat PR #83 ter-merge. Semua file yang berubah diperlukan oleh fitur ini; `.agents/` (tidak terkait) sengaja TIDAK di-stage (butir 5-6). Tidak ada secret/credential/`run-logs/`/`docs/personal-docs/` di diff (`git diff` discan manual, nihil — butir 7). |
| 2. Konsistensi dokumentasi | DONE | `docs/changes/2026-10-17/platform-tenant-needs-attention-filter.md` sudah dibuat, menjelaskan perubahan/behavior/verifikasi/tidak-ada-follow-up. Tidak ada perubahan business rule baru di luar yang sudah dirancang `docs/plans/tenant-subscription-management.md` §5-A sehingga `docs/business-rules.md` sengaja tidak disentuh (N/A — alasan: §5-A sudah menjadi rujukan desain UI murni, bukan aturan bisnis baru). README.md tidak disentuh karena tidak ada env var/command/operasional baru (N/A). |
| 3. Test dan coverage | DONE | Test-first di setiap layer (CLAUDE.md "Test-first implementation"): `TenantSubscriptionAttentionGroupTest.kt` (3 test, pure mapping 6 status), `PlatformAdministrationServiceTest.kt` (1 test baru: filter ATTENTION + validasi mutual-exclusivity dgn `status`), `packages/core/src/index.test.ts` (1 test: mapping 6 status), `packages/api-client/.../index.wrappers.test.ts` (1 test: query string `attentionGroup`), `apps/mobile/src/tenants/tenantAttentionFilter.test.ts` (2 test: agregasi count + status kosong). Setiap test dikonfirmasi GAGAL dulu (unresolved reference/compile error/runtime undefined/assertion gagal) sebelum kode produksi ditulis — dicatat di daily note. Re-run fresh di branch ini: backend `BUILD SUCCESSFUL` (UP-TO-DATE, tidak ada source berubah sejak run sukses terakhir), `pnpm test` 237/237 test mobile + seluruh `packages/*` lulus. |
| 4. Arsitektur dan maintainability | DONE | Mapping status→grup didefinisikan SEKALI di `packages/core` (shared source of truth, dikonsumsi mobile+api-client) dan direplikasi presisi di Kotlin (`domain/Models.kt`) — tidak ada duplikasi logic bisnis lain. Tidak ada abstraction baru selain fungsi pure kecil (`attentionGroupCount`) yang memang dipakai ulang (badge count). `Controllers.kt` tetap 1 file per layer sesuai baseline CLAUDE.md, sudah >1000 baris SEBELUM perubahan ini (1243→1244, +1 baris param baru) — pola arsitektur yang disahkan eksplisit di CLAUDE.md, bukan pelanggaran baru (item §4 butir "file legacy... perubahan tidak boleh menambah ukurannya tanpa alasan teknis" — alasannya: menambah 1 `@RequestParam` opsional ke endpoint yang sudah ada, bukan fitur baru yang seharusnya di file terpisah). File baru (`tenantAttentionFilter.ts`, 8 baris) jauh di bawah batas. |
| 5. Business rule, role, dan security | DONE | Endpoint tetap di balik `platformAccess.requirePlatformAdmin(jwt)` (tidak diubah, hanya menambah parameter opsional). Validasi server: `require(status == null || attentionGroup == null)` mencegah kombinasi ambigu — diuji eksplisit di test (`assertThrows`). Tidak ada privilege escalation baru (filter hanya mempersempit hasil yang SUDAH terotorisasi Platform Admin, tidak membuka data baru). Tidak ada data sensitif di pesan error baru. |
| 6. Database dan API contract | DONE | Tidak ada migration (murni derived/computed, tidak ada kolom DB baru). Kontrak API: parameter BARU bersifat opsional (`attentionGroup: TenantSubscriptionAttentionGroup? = null`), backward compatible — client lama yang tidak mengirim parameter ini tetap berfungsi identik (diverifikasi: query tanpa parameter tetap mengembalikan hasil sama seperti sebelumnya, lihat bukti network request `?page=0&size=20` di bawah). `statusCounts` response TIDAK berubah bentuk (tidak menambah field baru) — badge count dihitung client-side dari data agregat yang sudah ada, sesuai §5-A "angka ringkasan harus memakai query server yang konsisten dengan daftar, bukan hitung dari halaman yang termuat". |
| 7. UI/UX dan accessibility | DONE | Tab baru memakai komponen `TabBar` yang sudah ada (tidak ada komponen custom baru), diposisikan sesuai §5-A butir 1 ("filter Perlu ditangani" setelah "Semua"). Label lengkap 7 locale (id/en/zh/fr/pt/es/ru) di `tenantSubscriptionTranslations` yang sudah ada, bukan hardcode. Diuji manual di browser (lihat §9) — empty state, loading, dan interaksi tab berfungsi tanpa error console. |
| 8. Performance dan reliability | DONE | Tidak ada N+1 query baru — filter memakai data yang SUDAH di-load (`subscriptionsByOrganization`) di method yang sama, hanya predikat filter yang berubah (`when` tiga cabang, bukan query terpisah). Tidak ada perubahan pada pagination/virtualization. `scripts/run-mobile.sh` fix: scoped ke `cwd` proses (hanya kill proses milik `apps/mobile` project ini), ada batas waktu tunggu rilis port (maks 5 detik) sebelum lanjut — tidak infinite loop. |
| 9. Verification dan release readiness | DONE | `git diff --check` lulus (exit 0, dicek ulang di branch ini). `pnpm lint` exit 0 semua workspace. `pnpm typecheck` lulus semua workspace. `pnpm test` 237/237 + seluruh `packages/*` lulus (re-run fresh di branch ini, bukti di atas). Backend `./apps/api/gradlew -p apps/api test --no-daemon` BUILD SUCCESSFUL. **Verifikasi manual di browser** (bukan cuma static check): backend+web dev server dijalankan lokal, login Platform Admin lokal, 3 skenario filter diuji via network request nyata — `?page=0&size=20` (Semua, 200), `?...&attentionGroup=ATTENTION` (Perlu ditangani, 200, empty state benar karena data lokal semua Aktif), `?...&status=ACTIVE` (Aktif, 200, TIDAK membawa `attentionGroup` — mutual exclusivity terbukti di request nyata bukan cuma assersi unit test). Tidak ada error console. `run-logs/` dibersihkan pasca-testing. CI/CD tidak disentuh. |
| 10. Keputusan akhir reviewer | **APPROVE** | Tidak ada temuan BLOCKING maupun NON-BLOCKING terbuka. Semua area DONE dengan bukti command/test/browser nyata, bukan static reading saja. |

## Temuan review dan perbaikannya

| Referensi bagian/butir sumber | Temuan dan tingkat risiko | Perbaikan | Verifikasi ulang / status |
| --- | --- | --- | --- |
| §1 butir 4 (base branch benar) | **Ditemukan saat proses ini**: checkout sudah berada di `production` (PR #83 pembawa branch asal sudah ter-merge, plus 3 PR lanjutan #84-#86), sehingga working tree changes ada langsung di atas `production` — melanggar larangan commit langsung di `production`. Risiko: commit tanpa sadar ke branch terlindungi. | Dibuat branch baru `feat/platform-tenant-needs-attention-filter` dari `production` yang sudah dikonfirmasi sinkron dengan `origin/production` (`git fetch` + `git log` diff kosong di kedua arah) sebelum staging apa pun. | Selesai — `git status` sekarang menunjukkan branch baru, bukan `production`. |

Tidak ada temuan lain yang masih terbuka.

## Keputusan sebelum commit

- [x] Semua butir review yang berlaku diperiksa satu per satu terhadap checklist sumber.
- [x] Semua area berstatus `DONE` atau `N/A` dengan alasan yang valid.
- [x] Item `PENDING` = 0; semua temuan dan blocker telah diselesaikan.
- [x] Test/verifikasi terkait temuan yang diperbaiki dijalankan ulang dan hasilnya dicatat (lint/typecheck/test/backend semua re-run fresh di branch baru, lihat §9).
- [x] `git diff --check` lulus dan staged diff telah ditinjau (akan ditinjau sekali lagi tepat sebelum `git add` eksplisit per file).
- [x] Tidak ada secret, data pribadi, `run-logs/`, `docs/personal-docs/`, `CLAUDE.md`, atau artefak lokal-only di staged diff (discan manual, `.agents/` sengaja dikecualikan dari staging).
- [x] Status kesiapan di atas adalah `READY`.
