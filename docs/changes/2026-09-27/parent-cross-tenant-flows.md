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

### Tahap 5 — `parent-qr.tsx`, `development.tsx`, dan `home.tsx`'s `openChild`
`parent-qr.tsx` sebelumnya memakai pola "switch lalu navigate" lama:
`useEffect`/`openChild` di layar itu sendiri memanggil `selectOrganization()`
tiap kali anak dari tenant lain dipilih (menghapus seluruh query cache),
lalu men-gate render `<ChildQr>` dengan `child.organizationId ===
organizationId` (tenant aktif). Sekarang `useAttendanceQr` menerima
`organizationId?` dan setiap anak memakai `organizationId`-nya sendiri
secara langsung — `selectOrganization`/`useEffect` switch dihapus total.

`development.tsx` menerima perlakuan yang sama seperti `goals.tsx` di
Tahap 4: `useParentChildrenAcrossTenants` untuk jalur Parent (`isParent`)
supaya anak lintas-tenant tidak lagi ter-resolve jadi `null` oleh
`resolveSelectedChildId`, `useUiAccessContext` diberi `organizationId`
hasil resolusi, dan tiga quick-link (`goals`, `child-health`,
`incident-reports`) serta `useDevelopmentEntries`/`useDevelopmentEntryPhoto`/
`useDevelopmentEntryMedia` (dan komponen turunannya,
`DevelopmentHistory`/`DevelopmentMediaItem`/`DevelopmentPhotoThumbnail`)
meneruskan `organizationId` yang sama. `useChildren()` untuk jalur
Staff Admin (`!hasFixedChild`, picker multi-anak) tidak disentuh karena
Parent dikonfirmasi selalu datang dengan `childId` route param (semua
navigasi nyata ke `/development` — `home.tsx`, `child-detail.tsx` —
menyertakan `childId`; hanya menu Staff Admin yang tidak, dan Parent
tidak punya akses ke menu itu).

Dengan keempat target `openChild` (`parent-child-profile`, `development`,
`parent-qr`, `absence-requests`) sudah mendukung parameter route,
`home.tsx`'s `openChild` diubah untuk mengirim `organizationId` sebagai
route param dan **tidak lagi memanggil `selectOrganization()` sama sekali**:
```ts
const openChild = (childOrganizationId: string, pathname: string, params: Record<string, string>) => {
  router.push({ pathname, params: { ...params, organizationId: childOrganizationId } } as never);
};
```

**Temuan otorisasi (dikonsultasikan ke user, bukan diputuskan sendiri):**
`booking.tsx` dan `parent-qr.tsx` dibungkus `LegacyDaycareRouteGuard`, yang
mengecek "apakah tenant **aktif** Parent punya kapabilitas Daycare" sebelum
mengizinkan render layar sama sekali — murni ambient, dievaluasi terhadap
tenant aktif, bukan tenant anak manapun. Setelah Tahap 2 membuat isi
`booking.tsx` lintas-tenant, guard pintu masuknya tetap terikat tenant
aktif: Parent yang tenant aktifnya kebetulan tidak punya kapabilitas
Daycare akan ter-redirect ke `/home` sebelum picker anak lintas-tenant
sempat muncul, walau mereka punya anak lain (di tenant lain) yang eligible
untuk booking — membatalkan sebagian tujuan Tahap 2. `parent-qr.tsx`
punya gap yang sama dari kerja sesi sebelumnya (bukan regresi baru).
User diberi tiga pilihan (cek lintas semua tenant / longgarkan syarat
kapabilitas / biarkan apa adanya) dan memilih opsi pertama.

Diimplementasikan dengan menambah `crossTenant?: boolean` pada
`LegacyDaycareRoutePolicy` (di `legacyDaycareRouteAccess.ts`), diset
`true` hanya untuk `parentBooking`/`parentQr`. Saat `crossTenant` true:
- `hasLegacyDaycareRouteAccess` mengecek apakah ADA membership dengan role
  yang sesuai (dan aktif, kalau disyaratkan) di manapun — bukan hanya di
  `organizationId` (tenant aktif) yang dikirim.
- `LegacyDaycareRouteGuard` memakai hook baru `useAnyMembershipHasOffering`
  (`useUiAccessContext.ts`) yang menjalankan satu query `ui-access-context`
  paralel per membership PARENT aktif (`useQueries`, pola yang sama dengan
  `useParentChildrenAcrossTenants`) dan mengembalikan `true` kalau
  **manapun** dari tenant itu punya kapabilitas Daycare. Setiap query
  memakai queryKey `["ui-access-context", <tenantId>]` yang sama dengan
  `useUiAccessContext(enabled, organizationId)` di layar lain, jadi tenant
  yang sudah pernah di-fetch di layar lain tidak di-fetch ulang.
- Policy Staff/Staff Admin (`attendanceScan`, `staffAdminDaycareOperations`,
  `bookingApprovals`) tidak diberi `crossTenant`, jadi perilakunya sama
  persis seperti sebelumnya (tetap terikat tenant aktif — staff memang
  beroperasi dalam satu tenant, tidak ada ambiguitas lintas-tenant untuk
  mereka).
- Dua test baru ditambahkan ke `LegacyDaycareRouteGuard.test.ts`:
  Parent dengan tenant aktif tanpa kapabilitas tapi tenant lain punya →
  akses diberikan untuk `parentBooking`/`parentQr`; Parent tanpa satu pun
  tenant yang eligible → akses ditolak. Tiga test lama tetap lulus tanpa
  perubahan (skenario single-tenant mereka jatuh ke cabang non-`crossTenant`
  yang sama seperti sebelumnya).

### Tahap 6 — `tenant-feedback.tsx` (kategori B, switcher ad hoc)
Ini contoh paling langsung dari keluhan awal user: picker tenant di layar
ini sebelumnya memanggil `selectOrganization(item.organizationId)`
langsung tiap kali Parent memilih tenant lain untuk melihat/mengirim
feedback — menyapu bersih seluruh cache query hanya untuk melihat
riwayat feedback tenant lain. Sekarang penentuan "tenant mana yang
sedang dilihat" adalah **state lokal murni** (`selectedOrganizationId`),
bukan derivasi dari tenant aktif ambient:
```ts
const [selectedOrganizationId, setSelectedOrganizationId] = useState<string | undefined>(undefined);
const organizationId = selectedOrganizationId ?? activeOrganizationId ?? undefined;
```
Query `myTenantFeedback`/mutasi `createTenantFeedback` memakai
`organizationId` hasil resolusi ini, bukan tenant aktif. Gate akses layar
di paling atas (`if (activeMembership?.role !== "PARENT") return
<Redirect href="/home" />`) tetap memakai tenant **aktif** secara sengaja
— layar ini hanya dibuka dari menu Parent Home, yang hanya render kalau
tenant aktifnya sudah PARENT, jadi ini bukan sumber gap yang sama dengan
`LegacyDaycareRouteGuard` di Tahap 5 (tidak ada cara masuk ke layar ini
dengan tenant aktif non-PARENT).

`parent-enrollment.tsx` dikonfirmasi ulang **tidak perlu diubah** — daftar
"Active Tenants"-nya memang sengaja memanggil `selectOrganization()` lalu
`router.replace("/home")`: itu adalah pemilihan tenant aktif yang
disengaja (bukan gangguan per-aksi), dan endpoint cancel enrollment-nya
sendiri tidak punya parameter `X-Organization-Id` sama sekali di
`Controllers.kt` (baris 260, `fun cancel(jwt, enrollmentId)`).

## Verifikasi (tahap 1-6)

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
- `npx eslint app/development.tsx app/parent-qr.tsx app/home.tsx
  src/education/useUiAccessContext.ts
  src/navigation/LegacyDaycareRouteGuard.tsx` — hanya 3 error
  `import/no-unresolved` pada `development.tsx` (pola pre-existing yang
  sama) dan 1 warning pre-existing di `useUiAccessContext.ts`
  (`hasBranchOfferingCapability` re-export tidak terpakai langsung di
  file itu sendiri) — keduanya sudah ada sebelum Tahap 5, tidak ada
  temuan baru.
- `npx vitest run` — 35 file, **100** test (98 sebelumnya + 2 test baru
  di `LegacyDaycareRouteGuard.test.ts`), semua lulus (termasuk
  `src/education/useUiAccessContext.test.ts` yang sudah ada, tidak
  terpengaruh karena parameter barunya opsional).
- `npx eslint app/tenant-feedback.tsx` — 0 masalah.
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
Berlaku sama untuk Tahap 5 — README tidak mendokumentasikan mekanisme
internal `LegacyDaycareRouteGuard` atau `openChild`, jadi tidak ada
kalimat yang jadi salah. Tahap 6 juga tidak mengubah kemampuan yang
terlihat user (README sudah menyebut Parent bisa mengirim feedback untuk
tenant tempat anaknya terdaftar; picker multi-tenant itu sudah ada
sebelum Tahap 6, hanya mekanismenya yang berubah dari switch-tenant ke
state lokal) — tidak ada kalimat README yang jadi salah.

## Tindak lanjut yang belum dikerjakan (tahap berikutnya dari rencana yang sama)

- `private-tutoring.tsx` belum disentuh — Tahap 7. Kemungkinan besar
  perlu penanganan `LegacyDaycareRouteGuard`-serupa kalau layar itu juga
  di-gate oleh kapabilitas ambient; belum dicek ulang.
- `notifications.tsx` / `notificationRouteAccess.ts` — bug lama (hanya 2
  dari banyak action route meneruskan `organizationId`, validasi memakai
  tenant aktif bukan tenant milik notifikasi) belum diperbaiki; ini paling
  akhir karena bergantung pada semua layar tujuan di atas.
- Rencana lengkap ada di `.claude/plans/quiet-sniffing-pinwheel.md` (lokal,
  tidak masuk repo) — tahapan 4-8.
