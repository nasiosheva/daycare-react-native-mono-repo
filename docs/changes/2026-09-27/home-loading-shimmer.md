# Shimmer pada loading state awal Home

## Perilaku baru

`HomeScreen`'s `HomeLoadingState` (ditampilkan selagi auth/profile masih
memuat, sebelum peran diketahui) sebelumnya memakai `ActivityIndicator` +
teks "Memuat...". Diganti dengan `<ShimmerList />`, supaya konsisten dengan
setiap loading state lain di file yang sama (`StaffHome`, `ParentHome`,
`StaffAdminHome`, `PlatformAdminHome` semuanya sudah memakai `ShimmerList`
untuk `isFetching`) dan dengan pola shimmer-first yang sudah dipakai di
hampir semua layar list lain di app.

`apps/mobile/app/index.tsx` (splash sebelum tahu harus redirect ke
sign-in/sign-up/home) sengaja **tidak** diubah — itu benar-benar belum tahu
bentuk konten apa pun, beda dengan Home yang sudah tahu akan menampilkan
kartu-kartu ringkasan begitu peran diketahui.

## Dampak

- `apps/mobile/app/home.tsx`: `HomeLoadingState` pakai `ShimmerList`;
  `ActivityIndicator` import dan style `loading` yang jadi tidak terpakai
  dihapus.
- Tidak ada perubahan API/kontrak/business rule — `README.md` dan
  `docs/business-rules.md` tidak perlu diubah.

## Verifikasi

- `tsc --noEmit` bersih, `expo lint` tidak ada temuan baru di
  `home.tsx`.
- `corepack pnpm test`: mobile 98, api-client 37, ui 8, core 7 — semua
  lulus (tidak ada test yang mengasersi `ActivityIndicator`/teks loading
  ini secara spesifik).
