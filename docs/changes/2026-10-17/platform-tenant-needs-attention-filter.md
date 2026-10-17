// Mories Deo Hutapea,S.E.,S.Kom

# Filter "Perlu ditangani" pada daftar langganan Platform Admin

## Konteks

`docs/plans/tenant-subscription-management.md` §5-A (baris 91, 113) merancang
pengelompokan dashboard **Perlu ditangani / Aktif / Dibatasi-kedaluwarsa** dan
filter "Perlu ditangani" pada layar daftar tenant Platform Admin, tapi belum
pernah diimplementasikan — gap ini sudah tercatat sebagai deviasi non-blocking
sejak review sebelumnya. Perubahan ini mengimplementasikannya sebagai filter
tab penuh yang query ke server (bukan hanya pengelompokan visual halaman yang
sedang termuat), sesuai keputusan eksplisit saat fitur ini diminta.

## Perubahan

- **`apps/api/.../domain/Models.kt`**: enum `TenantSubscriptionAttentionGroup`
  (`ATTENTION`/`ACTIVE`/`RESTRICTED`) + extension function
  `TenantSubscriptionStatus.attentionGroup()` — `PENDING_PAYMENT`/`GRACE` →
  ATTENTION, `TRIAL`/`ACTIVE` → ACTIVE, `SUSPENDED`/`EXPIRED` → RESTRICTED.
- **`PlatformAdministrationService.tenantPage`**: parameter baru
  `attentionGroup: TenantSubscriptionAttentionGroup? = null`. Validasi: `status`
  dan `attentionGroup` tidak boleh diisi bersamaan. Saat diisi, filter memakai
  `effectiveStatus.attentionGroup() == attentionGroup`, dihitung dari status
  efektif yang sama dengan yang dipakai filter `status` biasa (bukan status
  mentah yang tersimpan) — tetap pagination server-side atas seluruh hasil
  filter, bukan dari halaman yang sedang termuat.
- **`Controllers.kt`**: endpoint `GET /platform/tenants/page` menerima query
  param opsional baru `attentionGroup`.
- **`packages/core`**: `tenantSubscriptionAttentionGroups`,
  `TenantSubscriptionAttentionGroup`, `tenantSubscriptionStatusAttentionGroup`
  — mapping yang sama persis dengan versi Kotlin, sebagai source of truth
  bersama untuk mobile dan api-client.
- **`packages/api-client`**: `tenantPage()` menerima `attentionGroup` opsional,
  diserialisasi ke query string.
- **`apps/mobile/app/platform-tenants.tsx`**: tab baru "Perlu ditangani" di
  TabBar filter status, diposisikan setelah "Semua". Badge angkanya dihitung
  dari `statusCounts` yang sama (agregat server, konsisten dengan daftar, bukan
  dihitung dari halaman yang termuat) via helper `attentionGroupCount` baru di
  `apps/mobile/src/tenants/tenantAttentionFilter.ts`. Memilih tab ini mengosongkan
  filter status individual dan sebaliknya (mutually exclusive, sesuai validasi
  backend).
- **i18n**: key baru `tenant.filterNeedsAttention` ditambahkan ke blok
  `tenantSubscriptionTranslations` yang sudah ada, lengkap 7 locale
  (id/en/zh/fr/pt/es/ru).

## Verifikasi (test-first sesuai CLAUDE.md)

Setiap lapisan ditulis test dulu, dikonfirmasi gagal (unresolved reference/compile
error/runtime undefined), baru diimplementasikan:
1. `TenantSubscriptionAttentionGroupTest.kt` (pure mapping, 3 test) — gagal
   compile → lulus setelah enum+extension ditambahkan.
2. `PlatformAdministrationServiceTest.kt` (filter end-to-end + validasi mutual
   exclusivity) — gagal compile → lulus setelah service+controller diubah.
3. `packages/core/src/index.test.ts` (mapping 6 status) — gagal runtime
   (`undefined`) → lulus setelah ditambahkan ke `index.ts`.
4. `packages/api-client/src/index.wrappers.test.ts` (query string) — gagal
   assertion (param diabaikan diam-diam) → lulus setelah `tenantPage()` diubah.
5. `apps/mobile/src/tenants/tenantAttentionFilter.test.ts` (agregasi count) —
   gagal "module not found" → lulus setelah helper ditulis.

Verifikasi akhir: `./apps/api/gradlew -p apps/api test --no-daemon` BUILD
SUCCESSFUL; `pnpm lint` (exit 0, semua workspace); `pnpm test` (237 test
mobile + seluruh test `packages/*` lulus); `pnpm --filter @daycare/app typecheck`
lulus.

## Tidak ada perubahan lain

Tidak menyentuh `docs/business-rules.md` — §5-A di dokumen plan sudah menjadi
rujukan desain yang cukup untuk perubahan UI murni ini, tidak ada aturan bisnis
baru. Tidak ada perubahan `README.md` — tidak ada env var, command, atau
operasional baru.
