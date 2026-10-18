<!-- Mories Deo Hutapea,S.E.,S.Kom -->
# Akses langsung pengelolaan banner dan pengumuman

## Perubahan

- Menu Platform Admin membuka `/platform-banners` secara langsung.
- Menu Staff Admin membuka `/tenant-announcements` secara langsung, tetap dalam konteks tenant aktif dan dengan otorisasi route/API yang ada.
- Menghapus halaman hub perantara `parent-home-content` beserta komponen presentasinya; tidak mengubah lifecycle, audience, atau kontrak API banner/pengumuman.
- README dan aturan bisnis diperbarui agar menggambarkan entry point per role.

## Verifikasi

- `corepack pnpm --filter @daycare/app typecheck` — lulus.
- `git diff --check` — lulus.
- Pencarian source memastikan tidak ada referensi route/component hub lama.
