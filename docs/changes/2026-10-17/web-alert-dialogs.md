# Dialog konfirmasi yang mati total di web

## Temuan

`Alert.alert()` dari `react-native-web` adalah **no-op total** (dicek
langsung di `node_modules/react-native-web/.../Alert/index.js`:
`static alert() {}`). `apps/mobile/app/_layout.tsx` menimpa `Alert.alert`
di web hanya untuk kasus **tanpa** argumen `buttons` (diarahkan ke toast
`publishInlineFeedback`). Setiap pemanggilan `Alert.alert(title, message,
buttons)` dengan array `buttons` — pola konfirmasi destruktif standar React
Native — tetap memanggil `Alert.alert` asli di web dan **tidak melakukan
apa-apa**: dialog tidak muncul, dan aksi yang terikat ke tombolnya tidak
pernah berjalan.

Ini bukan sekadar isu kosmetik. Dua kasus benar-benar memutus alur kerja di
web:
- **Setelah scan QR berhasil** (`attendance-scan.tsx`), presensi sudah
  tercatat di server, tapi konfirmasi sukses dan `router.back()` tidak
  pernah muncul/berjalan di web — Staff tertahan di layar scan tanpa
  tahu check-in-nya berhasil.
- **Setelah ganti PIN Admin** (`admin-pin.tsx`), PIN sudah tersimpan, tapi
  konfirmasi dan navigasi balik ke Profile tidak pernah terjadi di web.

Empat lagi adalah konfirmasi destruktif yang aksinya sama sekali tidak bisa
dipicu di web: nonaktifkan anak (`child-detail.tsx`), hapus pengingat
(`staff-reminders.tsx`), hapus template program (`child-program-templates.tsx`),
dan arsipkan kegiatan kurikulum (`curriculum-activity-detail.tsx`).

## Perbaikan

- Enam dialog konfirmasi destruktif diganti ke pola `BottomSheet` +
  `Banner(tone="warning")` + `positiveAction(variant="danger")` yang sudah
  menjadi standar di app ini (dipakai pertama kali untuk batal pengajuan
  Parent, hapus Program Perkembangan, dan tarik consent).
- Dua acknowledgment satu-tombol (`admin-pin.tsx`, `attendance-scan.tsx`)
  disederhanakan: tidak perlu dialog sama sekali — langsung `notify(...,
  "success")` lalu navigasi, karena navigasinya tidak bergantung pada
  keputusan pengguna.
- Sisa 7 pemanggilan `Alert.alert` yang sebenarnya **sudah** berfungsi di
  web (tidak punya `buttons`, jadi ketangkap oleh patch di `_layout.tsx`)
  tetap diganti ke `notify(...)` langsung di `classrooms.tsx`,
  `parent-enrollment-form.tsx`, `verify-phone.tsx`, `booking.tsx`,
  `parent-child-profile.tsx`, dan `sign-up.tsx` — supaya mendapat warna
  tone (warning/success/danger) yang hilang lewat patch generik itu, dan
  tidak lagi bergantung pada monkey-patch global.
- `learning.activityArchived` ("Kegiatan diarsipkan", teks lampau) yang
  sebelumnya salah dipakai sebagai *deskripsi konfirmasi* sebelum
  pengarsipan kegiatan diganti dengan key baru
  `learning.archiveActivityConfirmation` yang memang berupa pertanyaan
  konfirmasi, mengikuti pola `learning.archiveConfirmation` yang sudah ada
  untuk tingkatan.
- `HomeLoadingState` (`home.tsx`) sudah diperbaiki pakai `ShimmerList` di
  PR sebelumnya; audit kali ini tidak menemukan gap shimmer baru.

Monkey-patch `Alert.alert` di `_layout.tsx` sendiri **tidak diubah** — ia
tetap berguna sebagai jaring pengaman untuk kode pihak ketiga yang mungkin
memanggil `Alert.alert` langsung, dan tetap benar untuk kasus native.

## Dampak

- 12 file mobile diubah: `admin-pin.tsx`, `attendance-scan.tsx`,
  `booking.tsx`, `child-detail.tsx`, `child-program-templates.tsx`,
  `classrooms.tsx`, `curriculum-activity-detail.tsx`,
  `parent-child-profile.tsx`, `parent-enrollment-form.tsx`, `sign-up.tsx`,
  `staff-reminders.tsx`, `verify-phone.tsx`.
- Kunci i18n baru `learning.archiveActivityConfirmation` di 7 bahasa
  (`uiFlowConfirmationTranslations` di `translations.ts`).
- Tidak ada perubahan backend, API, atau business rule — `README.md` dan
  `docs/business-rules.md` tidak perlu diubah; ini murni perbaikan bug
  reachability UI di platform web.
- Efek samping: `pnpm install` dijalankan ulang di repo karena
  `react-test-renderer` (sudah ada di `package.json`) belum terpasang di
  `node_modules`, menyebabkan 3 file test gagal dimuat sebelum perbaikan
  ini — bukan disebabkan oleh perubahan kode di atas, dikonfirmasi dengan
  menjalankan test yang sama di `production` bersih.

## Verifikasi

- `corepack pnpm test`: ui 30, core 9, api-client 64, mobile 224 — semua
  lulus (termasuk assertion baru untuk `learning.archiveActivityConfirmation`
  di `translations.test.ts`).
- `tsc --noEmit` bersih di semua file yang diubah.
- `expo lint` tidak ada temuan baru (satu warning `react-hooks/exhaustive-deps`
  di `parent-enrollment-form.tsx` adalah pra-ada, tidak terkait baris yang
  diubah).
- Tidak ada perubahan backend sehingga tidak perlu re-run test backend.

## Tindak lanjut

- Tidak menyentuh monkey-patch `Alert.alert` global di `_layout.tsx`;
  masih ada risiko kalau ada kode baru di masa depan yang memanggil
  `Alert.alert(..., buttons)` langsung tanpa sadar pola ini mati di web.
  Mempertimbangkan lint rule custom (`no-restricted-imports` untuk `Alert`
  dari `react-native` di `apps/mobile/app`) bisa jadi langkah lanjutan,
  tapi di luar cakupan audit kali ini.
