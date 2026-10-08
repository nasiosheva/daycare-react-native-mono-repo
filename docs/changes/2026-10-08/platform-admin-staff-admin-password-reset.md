# Platform Admin dapat reset password Staff Admin tenant

## Latar belakang

Sebelumnya Platform Admin tidak bisa membantu Staff Admin tenant yang lupa
password: `POST /tenant-users/{userId}/password` hanya bisa dipanggil oleh
Staff Admin tenant itu sendiri yang sedang login aktif
(`AdministrationService.changeTenantUserPassword`), dan
`PlatformAdministrationService` tidak punya endpoint password sama sekali.
`updateTenantStaffAdmin`/`removeTenantStaffAdmin` juga secara eksplisit
menolak `primaryStaffAdmin`.

## Keputusan

Platform Admin dapat me-reset password `STAFF_ADMIN` mana pun dalam satu
tenant, **termasuk `primaryStaffAdmin`** — satu-satunya pengecualian terhadap
proteksi permanen akun primary. Ini satu-satunya jalur pemulihan ketika Staff
Admin tenant terkunci dari akunnya sendiri dan tidak ada Staff Admin aktif
lain di tenant itu. Reset password tidak mengubah flag `primaryStaffAdmin`,
status aktif, nama tampilan, email, atau username.

`docs/business-rules.md` §2 dan `docs/tenant-staff-accounts.md` diperbarui
untuk mencatat pengecualian ini secara eksplisit.

## Perubahan

- **Backend**: `PlatformAdministrationService.resetTenantStaffAdminPassword`
  (baru). Mensyaratkan `platformAccess.requirePlatformAdmin`, membership milik
  tenant yang diminta, `active = true`, dan `role = STAFF_ADMIN`; sengaja
  **tidak** memeriksa `!membership.primaryStaffAdmin`. Memakai ulang
  `TenantUserAccountService.changePassword` (validasi panjang password
  minimal 6 karakter) dan DTO `ChangeTenantUserPasswordRequest` yang sudah ada
  (tidak perlu registrasi error key baru — `PASSWORD_TOO_SHORT` sudah
  terdaftar).
- **Endpoint**: `POST /api/v1/platform/tenants/{organizationId}/staff-admins/{membershipId}/password`
  (`204 No Content`), mengikuti pola URL endpoint Platform Admin lain untuk
  Staff Admin (`staff-admins/{membershipId}`).
- **`packages/api-client`**: `resetTenantStaffAdminPassword(organizationId, membershipId, password): Promise<void>`.
- **Mobile** (`app/tenant-detail.tsx`): ikon reset password baru di setiap
  Staff Admin **aktif**, termasuk primary (ikon ubah nama dan hapus tetap
  hanya untuk non-primary). Bottom Sheet baru dengan `PasswordInput` (memakai
  ulang key `password.*` yang sudah ada), minimal 6 karakter. Tidak
  menginvalidasi query tenant karena reset password tidak mengubah field
  apa pun pada respons `Tenant`.
- **i18n**: `tenantStaffAdminPasswordTranslations` (3 key baru, 7 locale):
  `tenant.resetStaffAdminPassword`, `tenant.staffAdminPasswordReset`,
  `tenant.staffAdminPasswordResetFailed`.

## Verifikasi

- Backend: `PlatformAdministrationServiceTest.kt` (baru) — reset password
  Staff Admin non-primary aktif; reset password **primary** Staff Admin aktif
  (perilaku utama yang diminta); ditolak untuk membership tenant lain,
  membership nonaktif, dan role `STAFF`; ditolak untuk pemanggil bukan
  Platform Admin. Ditambahkan juga 2 test yang sebelumnya belum ada untuk
  `TenantUserAccountService.changePassword` (sukses dan password < 6
  karakter) di `TenantAccountProvisioningTest.kt`, karena method itu kini
  dipanggil dari dua service.
- `./apps/api/gradlew -p apps/api test --no-daemon` lulus (suite penuh).
- `pnpm verify` lulus: lint (0 error), typecheck, 142 test TypeScript
  (termasuk test kelengkapan locale baru di `translations.test.ts`).
- Uji perangkat: belum.
