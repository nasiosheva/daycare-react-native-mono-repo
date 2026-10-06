# Home loading shimmer

## Perubahan

- Menambahkan shimmer layout untuk loading awal Home, termasuk placeholder toolbar, tile, dan kartu.
- Parent onboarding sekarang menampilkan shimmer saat daftar enrollment sedang dimuat.
- Ringkasan Staff Admin menampilkan shimmer per kartu ketika sumber data terkait masih loading; readiness Platform Admin juga memakai shimmer.
- Shimmer pada grid Ringkasan Anak dan Pembayaran diberi wrapper full-width agar tidak menyusut menjadi pil vertikal di Android.
- Nilai placeholder tidak dianggap sebagai angka nol dan digantikan setelah query selesai, gagal, atau menghasilkan empty state.

## Verifikasi

- `pnpm --filter @daycare/app typecheck` lulus.
- `git diff --check` lulus.
- `pnpm --filter @daycare/app lint` masih terblokir oleh error baseline import alias dan aturan hook pada file lain; tidak ada error baru dari `apps/mobile/app/home.tsx` yang dilaporkan.
