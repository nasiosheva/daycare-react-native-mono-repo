<!-- Mories Deo Hutapea,S.E.,S.Kom -->
# Filter daftar pengumuman tenant

## Perubahan

- Menambahkan pencarian pengumuman berdasarkan label judul, isi lama, dan label audience.
- Staff Admin dapat menyaring daftar berdasarkan status lifecycle dan cakupan penerima tenant/cabang, lalu menghapus semua filter sekaligus.
- Kartu pengumuman ber-audience cabang menampilkan nama cabang yang cocok dengan `branchId`, termasuk cabang nonaktif; jika nama tidak tersedia, UI menampilkan fallback terlokalisasi.
- Parent hanya mendapat pencarian pada daftar baca; kontrol lifecycle/audience pengelolaan tidak ditampilkan.
- Empty state khusus ditampilkan jika tidak ada hasil filter; data/API dan lifecycle pengumuman tidak berubah.
- Label tersedia untuk seluruh locale aplikasi.

## Test-first dan verifikasi

- Red: `corepack pnpm --filter @daycare/app test -- src/content-management/tenantAnnouncementFilters.test.ts` gagal karena modul filter belum ada.
- Green: `corepack pnpm --filter @daycare/app exec vitest run src/content-management/tenantAnnouncementFilters.test.ts` — 3 test lulus.
- Red: `corepack pnpm --filter @daycare/app exec vitest run src/content-management/tenantAnnouncementBranch.test.ts` gagal karena resolver nama cabang belum ada.
- Green: `corepack pnpm --filter @daycare/app exec vitest run src/content-management/tenantAnnouncementBranch.test.ts` — 2 test lulus, termasuk cabang nonaktif.
- `corepack pnpm --filter @daycare/app exec vitest run src/i18n/translations.test.ts src/content-management/tenantAnnouncementFilters.test.ts src/content-management/tenantAnnouncementBranch.test.ts` — 3 file / 20 test lulus.
- UI test `tenant-announcements.ui.test.tsx` memverifikasi pencarian, filter audience, serta nama cabang.
- `pnpm verify` — lint, typecheck, dan seluruh test workspace lulus; aplikasi 72 file / 284 test.
- `pnpm --filter @daycare/app test:ui` — 14 suite / 65 test lulus.
- `pnpm --filter @daycare/app lint` — lulus tanpa error; warning yang tersisa hanya pada file legacy lain.

## Dokumentasi

- README dan §10.2 `docs/business-rules.md` diperbarui agar menjelaskan kontrol pencarian/filter dan perbedaan kontrol Staff Admin vs Parent.
