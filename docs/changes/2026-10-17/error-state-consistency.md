# Normalisasi tampilan error query ke ErrorState

## Latar belakang

Lanjutan audit konsistensi UI (setelah shimmer di `home.tsx` dan bug
`Alert.alert` yang mati di web). Ditemukan 11 layar yang menangani
`.isError` dari react-query dengan tampilan sendiri-sendiri — bukan rusak
(semua tetap menampilkan indikasi error dan aksi retry), tapi tidak
konsisten: ada yang teks polos tanpa tombol retry, ada yang tombol retry
tanpa pesan, ada yang `Banner` + tombol manual dibungkus `View`.

## Perilaku baru

Semua disamakan ke komponen `ErrorState` (variant `compact`) yang sudah
jadi standar di banyak layar lain:

- `add-tenant.tsx` — katalog jenis lembaga di step 1 wizard.
- `analytics.tsx` — tiga query (okupansi, retensi, tren perkembangan),
  sebelumnya tanpa tombol retry sama sekali.
- `child-program-templates.tsx`
- `global-development-categories.tsx` — sebelumnya tanpa tombol retry.
- `global-learning-levels.tsx`
- `learning-levels.tsx` — tiga query (tingkatan, template, program).
- `institution-types.tsx`
- `platform-tenants.tsx`
- `tenant-grace-rollout.tsx`
- `tenant-users.tsx`

**Tidak diubah:** `staff-admin.tsx`'s `OperationalTaskCenter` tetap pakai
`Banner` dengan slot `action` inline. Komponen itu tampil sebagai baris di
dalam `MenuSection` bersama item menu lain, bukan placeholder area penuh
seperti layar lain — mengganti ke `ErrorState` (kotak besar dengan ikon)
akan merusak tata letak baris menu, bukan memperbaiki konsistensi.

`Banner`/`Button` yang sebelumnya dipakai untuk form-submission error
(`formError`, `archiveError`, `deleteError`, `submitError` di
`add-tenant.tsx`) **tidak diubah** — itu beda semantik dari "query gagal
dimuat, coba lagi": tidak ada aksi fetch ulang, cuma pesan yang tetap
tampil sampai pengguna perbaiki input.

## Dampak

- 10 file mobile diubah. Style `feedback`/`errorState` yang jadi tidak
  terpakai dihapus dari `global-learning-levels.tsx`, `learning-levels.tsx`,
  `tenant-users.tsx`, `child-program-templates.tsx`.
- Tidak ada perubahan backend, API, kunci i18n baru, atau business rule.

## Verifikasi

- `corepack pnpm test`: ui 30, core 9, api-client 64, mobile 224 — semua
  lulus.
- `tsc --noEmit` bersih di semua file yang diubah.
- `expo lint`: satu warning `Button` unused di `global-learning-levels.tsx`
  sudah diperbaiki (import dihapus); tidak ada temuan lain.
