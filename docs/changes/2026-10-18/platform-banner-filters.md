<!-- Mories Deo Hutapea,S.E.,S.Kom -->
# Filter daftar banner platform

## Perubahan

- Daftar banner menyediakan pencarian berdasarkan judul dan nama tenant.
- Platform Admin dapat menggabungkan pencarian dengan filter status lifecycle dan penerima banner.
- Parent hanya mendapat pencarian pada data banner yang memang tersedia bagi Parent; filter lifecycle dan penerima hanya ditampilkan untuk Platform Admin.
- Hasil kosong karena filter menyediakan aksi untuk menghapus seluruh filter. Tidak ada perubahan API, otorisasi, atau data.

## Verifikasi

- Test-first merah: `corepack pnpm --filter @daycare/app exec vitest run src/content-management/platformBannerFilters.test.ts` gagal karena helper filter belum tersedia.
- Hijau: `corepack pnpm --filter @daycare/app exec vitest run src/content-management/platformBannerFilters.test.ts src/development/globalDevelopmentProgramFilters.test.ts` lulus, 2 file / 6 test.
- Hijau: `corepack pnpm --filter @daycare/app typecheck` lulus.
- Hijau: `corepack pnpm --filter @daycare/app lint` lulus tanpa error; ada 15 warning lama di file lain.
- Hijau: `git diff --check`.
