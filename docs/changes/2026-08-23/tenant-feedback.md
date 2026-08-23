# Saran & masukan Parent → Staff Admin

## Perilaku baru

Parent aktif sekarang bisa mengirim saran/masukan untuk tenant tempat anaknya
terdaftar, lewat kartu baru di Beranda. Fitur ini murni satu arah — tidak ada
mekanisme balasan dari Staff Admin ke Parent dalam flow ini:

- **Kategori**: Saran, Keluhan, Pertanyaan, atau Lainnya.
- **Penerima notifikasi**: setiap kiriman baru menotifikasi **semua Staff
  Admin aktif** tenant itu (inbox, realtime, push) — Staff biasa tidak
  menerima notifikasi ini maupun tidak bisa mengakses daftarnya sama sekali
  (endpoint list/status di-gate `Role.STAFF_ADMIN`, bukan `STAFF_ADMIN` +
  `STAFF`).
- **Status**: `NEW` → `READ` → `RESOLVED`, ditandai manual oleh Staff Admin.
  Transisi tidak wajib berurutan — Staff Admin boleh langsung menandai
  `RESOLVED` dari `NEW` tanpa melalui `READ`.
- **Riwayat Parent**: Parent bisa lihat semua kiriman miliknya sendiri
  beserta status terkininya, tapi tidak bisa mengedit atau menghapus kiriman
  yang sudah terkirim.

## Mekanisme

- Backend baru: entity `TenantFeedback` (migrasi `V14__tenant_feedback.sql`),
  `TenantFeedbackService` (create/mine/list/updateStatus), 4 endpoint baru di
  bawah `/v1/tenant-feedback`. Mengikuti pola `StaffLeaveRequestService` dan
  `ChildIncidentService.notifyGuardians` (di sini: `notifyStaffAdmins`) yang
  sudah ada — tidak ada abstraksi baru.
- Flag realtime baru `TENANT_FEEDBACK` (backend `RealtimeFlag`, mobile
  `RealtimeFlag` di `packages/api-client`, dipetakan ke query key
  `tenant-feedback-mine`/`tenant-feedback-inbox` di
  `apps/mobile/src/realtime/queryInvalidation.ts`).
- Mobile: dua layar terpisah mengikuti pola
  `staff-leave-requests.tsx`/`staff-leave-approvals.tsx` — `tenant-feedback.tsx`
  (Parent, FAB+BottomSheet submit + riwayat inline) dan
  `tenant-feedback-inbox.tsx` (Staff Admin, `NavigationCard` list + BottomSheet
  detail dengan tombol tandai status). Entry point: kartu baru di Beranda
  Parent, `MenuItem` baru di menu Setup Staff Admin.
- Pesan error `TenantFeedbackError.NOT_FOUND` terdaftar langsung sejak awal
  di `ApiExceptionHandler.errorKeys` + kedua file `.properties` — tidak
  menyusul seperti kasus catatan kesehatan sebelumnya.
- Kategori dan status didefinisikan di `packages/core` (`tenantFeedbackCategories`,
  `tenantFeedbackStatuses`), mengikuti pola `staffLeaveRequestTypes`/`staffLeaveRequestStatuses`
  yang sudah ada, supaya backend/api-client/mobile berbagi satu sumber
  kebenaran untuk daftar nilai yang valid.

## Verifikasi

- `./gradlew test` (backend, full suite) lulus, termasuk
  `TenantFeedbackServiceTest` baru (notifikasi hanya ke Staff Admin aktif,
  bukan yang nonaktif atau role Staff; update status).
- `tsc --noEmit` bersih di `packages/core`, `packages/api-client`, dan
  `apps/mobile` — termasuk memastikan ketujuh locale (id/en/zh/fr/pt/es/ru)
  punya terjemahan lengkap untuk key `tenantFeedback.*`, karena tipe
  `translations: Record<AppLocale, Record<TranslationKey, string>>` di
  `translations.ts` mewajibkan kelengkapan di semua locale, bukan cuma
  id/en seperti dugaan awal.
- Uji end-to-end lewat backend lokal sungguhan memakai akun Parent + Staff
  Admin sekali pakai di tenant "Nasio Care": submit → notifikasi masuk ke
  Staff Admin → muncul di inbox → ditandai `READ` lalu `RESOLVED` → riwayat
  Parent menunjukkan status terbaru. Juga dikonfirmasi Parent mendapat `403`
  saat mencoba mengakses endpoint inbox Staff Admin. Semua akun dan data uji
  sudah dibersihkan setelahnya.
- Migrasi `V14` diterapkan dan diverifikasi di database dev lokal (skema
  tabel + kedua index).

## Tindak lanjut

- Belum ada verifikasi visual di browser/simulator (ekstensi Chrome tidak
  tersedia di environment ini) — sudah diverifikasi lewat HTTP langsung ke
  backend sungguhan sebagai penggantinya.
