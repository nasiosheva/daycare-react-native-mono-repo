# Parent can still see a child at a subscription-restricted tenant

## Perilaku baru

Sebelumnya, begitu subscription tenant berubah dari `ACTIVE`/`TRIAL` menjadi
`SUSPENDED`/`PENDING_PAYMENT`/`EXPIRED`, `AccessService.require()` menolak
**semua** request ke tenant itu dengan `403 "Tenant subscription is not
active"` — termasuk `GET /children` milik Parent. Efeknya di Home: anak dari
tenant itu langsung hilang total dari daftar, tanpa penjelasan.

Sekarang Parent tetap bisa melihat anaknya di tenant yang subscription-nya
tidak aktif — read-only, murni informasional. Ini exception sempit yang
sudah dipertimbangkan di `docs/business-rules.md` §13.12
(`TENANT_SUBSCRIPTION_RESTRICTED`), diimplementasikan sebagian: hanya
untuk daftar anak, bukan seluruh allowlist target di baris itu.

## Mekanisme

- Backend: `AccessService.require()` (`IdentityAndAccessService.kt`)
  menerima parameter baru `allowSubscriptionRestrictedForRoles: Set<Role> =
  emptySet()`. Cek subscription-aktif sekarang mengecualikan role yang ada
  di set ini. `AttendanceService.listChildren()` memakainya dengan
  `setOf(Role.PARENT)` — jadi hanya Parent, hanya untuk endpoint ini.
  Staff/Staff Admin di tenant yang sama tetap `403` seperti sebelumnya.
- Mobile: `useParentChildrenAcrossTenants` (di `useAttendance.ts`) sekarang
  menandai setiap anak dengan `tenantSubscriptionRestricted` (dihitung dari
  `membership.subscriptionStatus` yang dikirim, memakai
  `hasOperationalTenantSubscription` yang sudah ada — tidak menemukan cek
  baru).
  - `home.tsx`: filter yang sebelumnya membuang tenant subscription-restricted
    dari `parentMemberships` dihapus. Kartu anak dari tenant itu tetap
    tampil dengan badge "Subscription tenant tidak aktif"
    (`tenantReadiness.issueSubscription`, key yang sudah ada, dipakai
    ulang) menggantikan status kehadiran, dan **tanpa** tombol
    Profil/Perkembangan/QR/Absensi sama sekali — karena endpoint-endpoint
    itu belum memakai `allowSubscriptionRestrictedForRoles` dan akan tetap
    `403` kalau ditekan.
  - `parent-qr.tsx`: sebaliknya, anak dari tenant subscription-restricted
    **disaring keluar** dari daftar — menerbitkan QR kehadiran tetap
    memerlukan subscription aktif (belum termasuk exception), jadi tidak
    ada gunanya ditampilkan di layar ini.
  - `payment-history.tsx` tidak disentuh — sudah tidak memfilter berdasar
    subscription sejak awal, dan endpoint invoice belum diberi exception,
    jadi perilakunya (dan bug lama "satu tenant gagal fetch membuat seluruh
    layar menampilkan error") tidak berubah oleh perubahan ini.

## Verifikasi

- Backend: unit test baru `AccessServiceTest.kt` (Parent lolos lewat
  allowlist saat `SUSPENDED`; Staff Admin tetap `403` walau allowlist yang
  sama diberikan; Parent tanpa allowlist tetap `403`; tenant `ACTIVE` tidak
  butuh allowlist sama sekali). Test `AttendanceServiceTest.kt` yang sudah
  ada diperbarui stub-nya (parameter baru dengan nilai non-default membuat
  stub Mockito lama tidak lagi cocok). `./gradlew test` (suite penuh) lulus.
- Mobile: `tsc --noEmit` bersih, `eslint` bersih, `vitest run` — 35 file,
  98 test, semua lulus.
- Belum ada verifikasi visual di browser/simulator (di luar kemampuan
  environment ini) untuk badge baru di kartu anak Home.

## Tindak lanjut yang belum dikerjakan (sengaja, di luar scope permintaan ini)

- Profil anak, development, QR, dan absence-request untuk anak yang sama
  masih `403` kalau Parent menekannya dari tenant yang subscription-nya
  tidak aktif — hanya daftar anak yang dibuka. Memperluas exception ke
  endpoint lain (atau membangun `GuardianAuthority`/`reasonCode`/
  `allowedActions` penuh sesuai target §13.12) belum diminta dan belum
  dikerjakan.
- Invoice sendiri dan inbox safety yang ditujukan (dua item lain di baris
  `TENANT_SUBSCRIPTION_RESTRICTED`) juga masih target, belum dibuka.
- Bug lama di `useParentInvoicesAcrossTenants`/`useParentChildrenAcrossTenants`:
  satu query per-tenant yang gagal (`isError`) membuat seluruh layar
  menampilkan state error meski tenant lain berhasil dimuat. Tidak
  disentuh di sini karena tidak terkait langsung dengan permintaan ini.
