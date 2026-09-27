# Parent flows tidak lagi wajib switch tenant aktif

## Perilaku baru

Sebelumnya, tindakan Parent yang menyentuh tenant lain (selain tenant aktif
yang dipilih lewat switcher di `profile.tsx`) harus lewat
`selectOrganization()` dulu — yang menghapus **seluruh** React Query cache
(`queryClient.clear()`) — sebelum request ke tenant itu bisa jalan. Tiga
layar read-only (`home.tsx`, `parent-qr.tsx`, `payment-history.tsx`) sudah
dibuat cross-tenant sesi sebelumnya memakai pola "switch lalu navigate".

Sekarang setiap layar/hook yang sudah disentuh mengirim
`X-Organization-Id` per-request secara eksplisit (lewat parameter
`organizationId?` baru di `packages/api-client`), tanpa pernah memanggil
`selectOrganization()`. Backend sudah sepenuhnya stateless per-request
(`AccessService.require()` mengecek `(user, X-Organization-Id)` fresh di
setiap call, tidak ada konsep "tenant aktif" di server) sehingga tidak ada
perubahan backend yang dibutuhkan sama sekali.

Pekerjaan ini dilakukan bertahap per rencana yang disetujui user
(`saya ingin menampilkan lintas tenant ... perbaiki semua flow supaya
tidak perlu lagi switch tenant`); dokumen ini diperbarui setiap tahap
berikutnya selesai.

## Tahap yang sudah selesai

### Tahap 1 — fondasi di `packages/api-client/src/index.ts`
Helper privat baru:
```ts
private orgOverride(organizationId?: string): RequestInit {
  return organizationId ? { headers: { "X-Organization-Id": organizationId } } : {};
}
```
Lima method `BillingController` (`servicePlans`, `purchaseService`,
`entitlements`, `bookEntitlement`, `bookings`) mendapat parameter trailing
opsional `organizationId?: string` yang memakai helper ini — additive saja,
semua call site lama tetap jalan tanpa perubahan (dikonfirmasi lewat
`Controllers.kt` baris 929-998 bahwa kelimanya memang mendeklarasikan
`@RequestHeader("X-Organization-Id")`).

### Tahap 2 — `booking.tsx`
Layar ini pemicu awal permintaan user: dari 3 anak Parent, cuma 1 yang
muncul di booking karena layar memakai `useChildren()` (single-tenant).
Sekarang:
- Memakai `useParentChildrenAcrossTenants` (hook yang sudah ada dari sesi
  sebelumnya), bukan `useChildren()`.
- `organizationId` yang dipakai untuk fetch plans/entitlements/bookings/
  invoices, dan untuk mutasi purchase/book-entitlement, diturunkan dari
  anak yang sedang dipilih di picker — bukan dari tenant aktif ambient.
- Chip pemilihan anak menampilkan nama tenant (`(organizationName)`) kalau
  Parent punya lebih dari satu membership PARENT aktif.
- Navigasi "bayar invoice" meneruskan `organizationId` anak yang dipilih,
  bukan tenant aktif.
- `useBookingMutation` (di `useBooking.ts`) sekarang menerima
  `resolveOrganizationId` opsional untuk menentukan cache mana yang harus
  di-invalidate; kalau target beda dari tenant aktif, keduanya
  di-invalidate supaya tidak ada layar yang menampilkan data stale.

## Verifikasi (tahap 1-2)

- `cd apps/mobile && npx tsc --noEmit` — bersih.
- `npx eslint app/booking.tsx src/booking/useBooking.ts` — 2 error
  (`import/no-unresolved` pada `@/date-picker/DatePicker`, dan
  `react-hooks/rules-of-hooks` false-positive pada fungsi lokal bernama
  `useRemaining`). Dikonfirmasi **pre-existing**: `git stash` lalu jalankan
  eslint lagi terhadap file asli (belum diubah) menghasilkan 2 error yang
  identik (rule sama, hanya nomor baris bergeser), lalu `git stash pop`
  mengembalikan perubahan. Bukan regresi dari perubahan ini.
- `npx vitest run` — 35 file, 98 test, semua lulus (tidak ada test khusus
  untuk `booking.tsx`/`useBooking.ts` sebelumnya, jadi ini sinyal "tidak
  merusak", bukan cakupan baru).
- Belum ada verifikasi visual di browser/simulator (di luar kemampuan
  environment ini).

## README.md

Tidak ada baris di `README.md` yang secara spesifik menjelaskan mekanisme
internal `booking.tsx` per-tenant (baris soal Parent global hanya
menyebut "switch among approved tenant access links" dalam konteks
enrollment, bukan booking), jadi tidak ada kalimat yang jadi salah akibat
tahap 1-2. Akan ditinjau ulang di akhir seluruh rencana (setelah tahap 8)
kalau perubahan kumulatif membuat deskripsi Parent flow di README perlu
kalimat baru yang menyebut "tidak perlu switch tenant".

## Tindak lanjut yang belum dikerjakan (tahap berikutnya dari rencana yang sama)

- `absence-requests.tsx` dan layar per-anak lain (`parent-child-profile.tsx`,
  `emergency-contacts.tsx`, `pickup-authorizations.tsx`, `child-consents.tsx`,
  `child-messages.tsx`, `child-health.tsx`, `incident-reports.tsx`,
  `goals.tsx`, `parent-qr.tsx`, `development.tsx`) belum menerima parameter
  route `organizationId`.
- `home.tsx`'s `openChild` masih memakai `selectOrganization` + navigate;
  baru diganti setelah semua layar tujuan di atas mendukung parameter route.
- `tenant-feedback.tsx` (switcher ad hoc) dan `private-tutoring.tsx` belum
  disentuh.
- `notifications.tsx` / `notificationRouteAccess.ts` — bug lama (hanya 2
  dari banyak action route meneruskan `organizationId`, validasi memakai
  tenant aktif bukan tenant milik notifikasi) belum diperbaiki; ini paling
  akhir karena bergantung pada semua layar tujuan di atas.
- Rencana lengkap ada di `.claude/plans/quiet-sniffing-pinwheel.md` (lokal,
  tidak masuk repo) — tahapan 3-8.
