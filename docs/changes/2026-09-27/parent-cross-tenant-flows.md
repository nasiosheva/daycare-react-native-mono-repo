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

### Tahap 3 — `absence-requests.tsx` (contoh kategori C)
Layar per-anak yang juga dipakai Staff/Staff Admin (bukan hanya Parent).
Pola konvensi kategori C diterapkan: `organizationId` diresolusi dari
route param dulu, baru fallback ke tenant aktif —
```ts
const organizationId = (typeof routeOrganizationId === "string" ? routeOrganizationId : undefined) ?? activeOrganizationId ?? undefined;
```
`organizationId` hasil resolusi ini (bukan lagi langsung dari `useAuth()`)
yang dipakai untuk query key, lookup membership, `enabled` check,
`invalidate()`, dan keempat call ke `api.childAbsenceRequests`/
`createChildAbsenceRequest`/`decideChildAbsenceRequest`/
`cancelChildAbsenceRequest` — keempatnya dikonfirmasi ulang butuh header
`X-Organization-Id` langsung dari `Controllers.kt` baris 491-501 sebelum
diberi parameter override. Staff/Staff Admin tidak pernah mengirim route
param ini, jadi perilaku mereka tidak berubah (tetap resolve ke tenant
aktif seperti sebelumnya). `home.tsx` belum mengirim `organizationId` ke
layar ini — itu Tahap 5.

### Tahap 4 — sisa layar kategori C, plus satu temuan struktural
Delapan layar per-anak lain menerima perlakuan yang sama:
`parent-child-profile.tsx`, `emergency-contacts.tsx`,
`pickup-authorizations.tsx`, `child-consents.tsx`, `child-messages.tsx`,
`child-health.tsx`, `incident-reports.tsx`, `goals.tsx`. Semua endpoint
terkait dikonfirmasi ulang butuh `X-Organization-Id` langsung dari
`Controllers.kt` sebelum diberi parameter override (`parentChildProfile`
baris 543, pickup/emergency/consent/health/incident/messages/goals baris
605-734). `parent-child-profile.tsx` juga meneruskan `organizationId` ke
empat navigasi menu keamanannya (`child-messages`, `emergency-contacts`,
`pickup-authorizations`, `child-consents`) — tanpa ini, membuka menu itu
dari profil anak lintas-tenant akan kembali jatuh ke tenant aktif.

**Temuan struktural (bukan sekadar wiring mekanis):** `useUiAccessContext`
(dipakai `parent-child-profile.tsx`, `pickup-authorizations.tsx`,
`child-consents.tsx`, `goals.tsx` untuk gate kapabilitas offering/branch)
ternyata murni ambient — `api.uiAccessContext()` sama sekali tidak punya
override tenant. Untuk Parent yang melihat anak di tenant non-aktif, ini
akan mengevaluasi kapabilitas tenant yang salah (tenant aktif, bukan
tenant anak), yang bisa salah meng-gate akses. Diperbaiki dengan pola
yang sama: `organizationId?` ditambahkan ke `api.uiAccessContext()` dan
ke `useUiAccessContext(enabled, organizationId?)` — additive, 24 caller
lain (`home.tsx`, `private-tutoring.tsx`, layar Staff Admin, dst.) tidak
disentuh dan tetap memakai tenant aktif seperti sebelumnya karena mereka
tidak pernah mengirim parameter ini.

`goals.tsx` juga punya versi bug yang sama dengan `booking.tsx` semula:
untuk Parent, layar ini memakai `useChildren()` (satu tenant aktif) untuk
me-resolve anak yang dipilih dari `childId` route param — kalau anaknya
di tenant lain, `resolveSelectedChildId` mengembalikan `null` dan Goals
tampil kosong. Diperbaiki dengan menambah `useParentChildrenAcrossTenants`
khusus jalur Parent (`isParent`), sementara `useChildren()` tetap dipakai
apa adanya untuk jalur browsing multi-anak milik Staff Admin (perannya
tidak berubah). Hanya query `childGoals` yang diberi override
`organizationId` — mutasi Goals lain (assign/finalize/check-in/koreksi/
template) semuanya aksi Staff/Staff Admin yang selalu memakai tenant aktif
mereka sendiri, jadi tidak disentuh.

## Verifikasi (tahap 1-4)

- `cd apps/mobile && npx tsc --noEmit` — bersih di setiap tahap.
- `npx eslint app/booking.tsx src/booking/useBooking.ts` — 2 error
  (`import/no-unresolved` pada `@/date-picker/DatePicker`, dan
  `react-hooks/rules-of-hooks` false-positive pada fungsi lokal bernama
  `useRemaining`). Dikonfirmasi **pre-existing**: `git stash` lalu jalankan
  eslint lagi terhadap file asli (belum diubah) menghasilkan 2 error yang
  identik (rule sama, hanya nomor baris bergeser), lalu `git stash pop`
  mengembalikan perubahan. Bukan regresi dari perubahan ini.
- `npx eslint app/absence-requests.tsx` — 1 error, `import/no-unresolved`
  pada `@/date-picker/DatePicker` yang sama; import ini tidak disentuh
  Tahap 3, jadi pre-existing dengan pola identik ke Tahap 2.
- `npx eslint` pada kedelapan layar Tahap 4 — total 10 error, semuanya
  `import/no-unresolved` pada alias `@/` yang sudah ada sebelum perubahan
  ini (`@/notify/notify`, `@/date-picker/DatePicker`,
  `@/development/encodeLocalFile`, `@/development/checkInAudioUri`).
  Dikonfirmasi **pre-existing** dengan `git stash`/`git stash pop` yang
  sama terhadap tiga file contoh (`goals.tsx`, `child-consents.tsx`,
  `parent-child-profile.tsx`) — error identik pada file asli.
- `goals.tsx` sempat menghasilkan warning baru
  `react-hooks/exhaustive-deps` (bukan pre-existing) untuk
  `availableChildren` yang dipakai di `useEffect`; diperbaiki dengan
  membungkusnya dalam `useMemo`. Setelah itu `npx eslint app/goals.tsx`
  hanya menyisakan 3 error `import/no-unresolved` yang pre-existing.
- `npx vitest run` — 35 file, 98 test, semua lulus di setiap tahap
  (termasuk `src/education/useUiAccessContext.test.ts` yang sudah ada,
  tidak terpengaruh karena parameter barunya opsional).
- Belum ada verifikasi visual di browser/simulator (di luar kemampuan
  environment ini).

## README.md

Tidak ada baris di `README.md` yang secara spesifik menjelaskan mekanisme
internal `booking.tsx` per-tenant (baris soal Parent global hanya
menyebut "switch among approved tenant access links" dalam konteks
enrollment, bukan booking), jadi tidak ada kalimat yang jadi salah akibat
tahap 1-2. Akan ditinjau ulang di akhir seluruh rencana (setelah tahap 8)
kalau perubahan kumulatif membuat deskripsi Parent flow di README perlu
kalimat baru yang menyebut "tidak perlu switch tenant". Berlaku sama
untuk Tahap 3 dan 4 — belum ada kalimat README yang jadi salah karena
layar-layar per-anak ini atau karena parameter baru `useUiAccessContext`.

## Tindak lanjut yang belum dikerjakan (tahap berikutnya dari rencana yang sama)

- `parent-qr.tsx` dan `development.tsx` (target `openChild` lainnya) belum
  menerima parameter route `organizationId` — mekanisme sama dengan
  kategori C, ditambah kemungkinan gap `useUiAccessContext` yang sama
  kalau salah satunya memakainya (perlu dicek ulang saat dikerjakan).
- `home.tsx`'s `openChild` masih memakai `selectOrganization` + navigate;
  baru diganti setelah `parent-qr.tsx`/`development.tsx` di atas juga
  mendukung parameter route (bersama `absence-requests.tsx`,
  `parent-child-profile.tsx` yang sudah selesai).
- `tenant-feedback.tsx` (switcher ad hoc) dan `private-tutoring.tsx` belum
  disentuh.
- `notifications.tsx` / `notificationRouteAccess.ts` — bug lama (hanya 2
  dari banyak action route meneruskan `organizationId`, validasi memakai
  tenant aktif bukan tenant milik notifikasi) belum diperbaiki; ini paling
  akhir karena bergantung pada semua layar tujuan di atas.
- Rencana lengkap ada di `.claude/plans/quiet-sniffing-pinwheel.md` (lokal,
  tidak masuk repo) — tahapan 4-8.
