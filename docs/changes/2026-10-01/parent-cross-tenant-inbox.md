# Inbox notifikasi Parent lintas tenant

## Perilaku baru

Sebelumnya inbox dan badge bell di Home hanya memuat notifikasi tenant
aktif (backend memang meng-scope `GET /notifications` per
`X-Organization-Id`). Parent dengan anak di dua tenant tidak melihat
notifikasi tenant lainnya kecuali mengganti tenant aktif. Karena device
token Expo juga disimpan satu tenant per instalasi
(`AdministrationService.registerDevice`, `findByInstallationId`) dan push
dikirim ke `findAllByUserIdAndOrganizationId`, push dari tenant non-aktif
juga tidak pernah sampai. Jadi inbox adalah satu-satunya tempat notifikasi
itu bisa terlihat.

Sekarang, ketika tenant aktif dibuka sebagai Parent:
- inbox dan badge bell di Home menggabungkan notifikasi dari setiap
  membership `PARENT` (aktif maupun nonaktif, karena endpoint inbox
  `readOnly = true`), kecuali tenant yang langganannya tidak operasional
  (server selalu `403` untuk tenant itu, §13.12);
- setiap item menampilkan nama tenant asal bila tenant lebih dari satu,
  daftar diurutkan terbaru lebih dulu lintas tenant, pencarian dijalankan
  per tenant;
- tandai dibaca memakai tenant asal item; membuka action path
  memvalidasi ulang terhadap membership/status/capability tenant asal
  (untuk route yang mensyaratkan Daycare, capability tenant itu diambil segar
  lewat `fetchQuery` saat tap; gagal → tertutup)
  lalu membuka route dengan `organizationId` tenant asal;
- bila satu tenant gagal dimuat, tenant lain tetap tampil dengan banner
  `notifications.tenantLoadFailed` + coba lagi; error state penuh hanya bila
  semua tenant gagal; empty state hanya bila tidak ada tenant yang gagal
  (memenuhi target partial-failure §1 dan aturan empty-state §13.2).

Staff dan Staff Admin tidak berubah (inbox tenant aktif saja). Aturannya
ditulis di `docs/business-rules.md` §8, di atas aturan resolusi tenant per
aksi §1/§13.2 (`parent-per-action-tenant-rules.md`).

## Mekanisme

- `packages/api-client`: `notifications(search?, organizationId?)` dan
  `markNotificationRead(id, organizationId?)` memakai `orgOverride` —
  dikonfirmasi keduanya membaca `X-Organization-Id` di `Controllers.kt`.
- `src/notifications/inboxTenants.ts` (pure, dites): `inboxTenants()`
  memilih tenant inbox; `mergeInboxNotifications()` menandai item dengan
  tenant asal dan mengurutkan.
- `src/notifications/useInboxNotifications.ts`: satu query per tenant
  dengan key `["notifications", organizationId, search]`, sehingga
  invalidation realtime/mark-read `["notifications", organizationId]` tetap
  bekerja per tenant, dan bell (search `""`) berbagi cache dengan inbox.
- `notificationRouteAccess.ts`: route yang layar tujuannya me-resolve tenant
  dari route param kini `passesOrganizationId` (absence requests, incident
  reports, development, profil anak, kesehatan, pesan anak); route yang
  layarnya sudah agregat lintas tenant ditandai `resolvesTenantInScreen`
  (booking, QR, les privat). `canOpenNotificationRoute` menerima parameter
  opsional `activeOrganizationId`: notifikasi tenant non-aktif hanya bisa
  dibuka pada route bertanda salah satu flag itu (fail-closed). Flow tap
  push di `_layout.tsx` tidak mengirim parameter ini dan perilakunya tidak
  berubah (masih `selectOrganization()` lalu navigasi).
- `home.tsx`: `NotificationBellButton` memakai hook yang sama; bell di
  Parent Home tidak lagi di-gate `subscriptionActive` tenant aktif karena
  hook sudah melewati tenant yang langganannya tidak operasional.
- String baru `notifications.tenantLoadFailed` di ketujuh locale
  (`notificationInboxTranslations`).

## Perbaikan terkait (commit terpisah di branch yang sama)

`ChildHealthService` mengirim `/child-health?childId=` ke wali dan
`ChildMessageService` mengirim `/child-messages?childId=`, tetapi kedua
route tidak terdaftar di policy notifikasi, sehingga tombol **Buka** diam
saja (fail-closed sebagai route tak dikenal). Keduanya didaftarkan untuk
PARENT/STAFF_ADMIN/STAFF dengan membership aktif.

## Verifikasi

- `pnpm verify` (lint + typecheck + test semua workspace): exit 0;
  `apps/mobile` 36 file / 106 test lulus, termasuk `inboxTenants.test.ts`
  baru (pemilihan tenant, urutan gabungan) dan kasus baru di
  `notificationRouteAccess.test.ts` (buka notifikasi tenant non-aktif hanya
  pada route per-aksi; parameter `organizationId` ditambahkan; flow push
  tanpa `activeOrganizationId` tidak berubah).
- Tidak ada perubahan backend, jadi suite backend tidak dijalankan untuk
  perubahan ini.
- Belum diverifikasi visual di browser/simulator: butuh akun Parent lokal
  dengan notifikasi di dua tenant, dan kredensialnya tidak tersedia di repo.

## Tindak lanjut

- Realtime (WebSocket terikat satu `organizationId`) dan push Expo (device
  token satu tenant per instalasi) masih hanya untuk tenant aktif — butuh
  perubahan kontrak backend.
- Tap push di `_layout.tsx` masih mengganti tenant aktif; bisa diganti ke
  resolusi per aksi setelah push lintas tenant tersedia.
- Gap target partial-failure pada `useParentChildrenAcrossTenants` /
  `useParentInvoicesAcrossTenants` (lihat `parent-per-action-tenant-rules.md`).
