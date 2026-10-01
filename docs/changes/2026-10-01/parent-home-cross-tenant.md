# Parent Home lintas tenant sepenuhnya + agregat tahan gagal sebagian

## Perilaku baru

Parent Home sebelumnya mencampur dua dunia: kartu anak sudah lintas tenant
(sejak PR #44), tetapi bagian lain masih terikat tenant aktif:

- paket aktif (`useEntitlements`) dan tagihan yang perlu tindakan
  (`useInvoices`) hanya untuk tenant aktif; pill paket hanya tampil untuk
  anak di tenant aktif;
- **bug:** query layanan les privat dijalankan untuk setiap anak lintas tenant
  tetapi dengan header tenant aktif, sehingga request anak tenant lain ditolak
  server dan menu Les privat bisa hilang;
- pintasan Program (`programsSummary`) hanya tenant aktif;
- gate capability Daycare/Academic memakai tenant aktif (tombol QR untuk anak
  tenant lain selalu tampil tanpa cek);
- bila langganan tenant **aktif** tidak operasional, seluruh kartu anak dan
  tagihan disembunyikan, termasuk anak tenant lain. Ini bertentangan dengan
  §13.12, yang menyatakan anak tetap muncul di Home walau langganan tenantnya
  `SUSPENDED`/`PENDING_PAYMENT`/`EXPIRED`.

Sekarang setiap bagian Parent Home mengagregasi seluruh membership Parent
dan bertindak di tenant milik anak/tagihan itu (resolusi tenant per aksi,
§1):
- paket aktif per anak dari tenant anak itu, hanya untuk tenant yang offering
  `PUBLISHED`-nya punya `DAYCARE_OPERATIONS` (endpoint entitlements
  mewajibkannya);
- tagihan yang perlu tindakan dari semua tenant beroperasi, dengan nama tenant
  asal bila tenant lebih dari satu (§13.15: kartu Home wajib membawa sumber);
  tombol Bayar membuka tenant asal tagihan;
- les privat per anak dengan header tenant anak, hanya bila tenant itu punya
  `ACADEMIC_CURRICULUM` dan langganannya beroperasi;
- pintasan Program menjumlahkan program aktif semua tenant dan membuka anak
  pertama beserta tenant-nya;
- tombol QR dan pill paket memakai capability tenant anak (fail-closed selama
  capability belum termuat);
- kartu anak tidak lagi disembunyikan karena status langganan tenant aktif;
  anak dari tenant yang dibatasi tetap tampil dengan badge dan tanpa aksi
  (perilaku per anak yang sudah ada sejak PR #55).

Riwayat Pembayaran: tombol Bayar tidak lagi memanggil `selectOrganization()`
(sisa pola lama), karena `parent-payment.tsx` sudah me-resolve tenant dari
route param.

Kegagalan sebagian (target §1 yang dicatat di
`parent-per-action-tenant-rules.md`): Home (kartu anak dan tagihan) dan
Riwayat Pembayaran kini menampilkan data tenant yang berhasil, banner
`common.tenantLoadFailed` berisi nama tenant yang gagal + coba lagi, error
penuh hanya bila semua tenant gagal, dan empty state hanya bila tidak ada
tenant gagal. Paket yang gagal untuk satu tenant menampilkan "gagal dimuat"
pada kartu anak tenant itu saja.

Pull-to-refresh Home tetap hanya me-refresh tenant aktif, sesuai aturan Home
di §1. Tenant lain diperbarui saat Home dimuat ulang.

## Mekanisme

- `src/tenants/acrossTenants.ts`: `useAcrossTenants` (satu query satu-tenant
  per tenant) + `summarizeAcrossTenants` (pure, dites) → `results`,
  `failedTenants`, `allFailed`, `isFetching`, `retryFailed`. Ini agregat
  ketiga (rule of three), jadi pola lama disatukan:
  `useParentChildrenAcrossTenants`, `useParentInvoicesAcrossTenants`,
  `useParentEntitlementsAcrossTenants` (baru), dan `useInboxNotifications`
  semuanya memakainya. Return `isError`/`refetch` lama diganti
  `failedTenants`/`allFailed`/`retryFailed`.
- `useParentInvoicesAcrossTenants` kini melewati tenant yang langganannya
  tidak beroperasi (server selalu menolak invoice di sana).
- `useOfferingCapabilitiesByTenant` (`useUiAccessContext.ts`): capability
  offering per tenant dari query `ui-access-context` per membership (cache
  dibagi dengan `useUiAccessContext`); `useAnyMembershipHasOffering` dibangun
  ulang di atasnya dengan perilaku sama.
- `combineProgramSummaries` (pure, dites) di `parentHomeSummary.ts`;
  `createParentHomeSummary` kini generik juga untuk tipe invoice supaya
  `organizationId` tagihan tetap bertipe.
- `api.parentChildProgramsSummary(organizationId?)` memakai `orgOverride`
  (endpoint membaca `X-Organization-Id`, PARENT read-only).
- `TenantLoadFailureBanner` + string `common.tenantLoadFailed` di 7 locale.

## Verifikasi

- `pnpm verify`: exit 0; mobile 37 file / 109 test, termasuk
  `acrossTenants.test.ts` dan `combineProgramSummaries` baru.
- Tidak ada perubahan backend.
- Belum diverifikasi visual di browser/simulator (butuh akun Parent lokal
  multi-tenant; kredensial tidak ada di repo).

## Tindak lanjut

- Target §1 yang tersisa: pemilih anak lintas tenant di booking, QR,
  Development, Goal, dan les privat belum memberi tahu tenant yang gagal
  (tenant hilang diam-diam; bila semua gagal tampil empty state, melanggar
  aturan empty state §13.2). Data `failedTenants` sudah tersedia dari hook,
  tinggal ditampilkan dengan `TenantLoadFailureBanner`.
- Pull-to-refresh Home lintas tenant memerlukan perubahan aturan Home di §1.
