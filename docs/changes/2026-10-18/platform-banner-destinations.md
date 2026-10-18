<!-- Mories Deo Hutapea,S.E.,S.Kom -->

# Tujuan aksi banner platform

## Perubahan

Form pembuatan dan penyuntingan banner platform sekarang menyediakan tujuan Profile untuk banner Parent maupun Staff Admin. Aksi URL HTTPS tetap membuka `in-app-browser.tsx`; label UI menjelaskan bahwa tautan dibuka di browser internal. Tujuan halaman tetap dipilih dari allowlist yang dibatasi menurut audience.

Profile ditambahkan hanya pada allowlist banner platform. Allowlist pengumuman tenant tidak berubah. Server memvalidasi tujuan banner sesuai audience sehingga rute bebas, target lintas-role, dan URL non-HTTPS tetap ditolak.

## Verifikasi

- Tes route Parent dan Staff Admin memastikan Profile menuju `/profile`; route pengumuman tetap tidak menerima Profile.
- Tes UI banner memastikan Profile menavigasi ke halaman yang ditentukan dan URL HTTPS membuka browser internal.
- Tes backend `PlatformBannerServiceTest` serta `TenantAnnouncementActionValidationTest` lulus.
- `corepack pnpm --filter @daycare/app typecheck` lulus.

// Mories Deo Hutapea,S.E.,S.Kom
