<!-- Mories Deo Hutapea,S.E.,S.Kom -->

# Komponen UI: preview gaya alternatif

## Perubahan

- Menambahkan halaman development-only `/component-preview` untuk melihat konsep komponen dasar dengan gaya modern-minimal.
- Konsep memakai kanvas terang, permukaan putih, aksen emas/navy, dan warna teal untuk status positif.
- Galeri menampilkan contoh aktual untuk seluruh komponen visual yang diekspor `packages/ui/src/index.ts`: teks, audio, avatar, navigasi, tombol, status, banner, bottom sheet, kartu, pilihan, empty/error state, FAB, feedback, menu, wizard, PIN, screen, header, shimmer, tab, field, dan switch. Komponen yang punya beberapa varian juga menampilkan varian relevannya.
- Contoh BottomSheet, wizard, switch, pilihan, audio, dan layar PIN dapat dicoba secara interaktif.
- `CLAUDE.md` lokal mewajibkan galeri dan tesnya diperbarui setiap komponen bersama baru ditambahkan atau perilakunya berubah.
- Tidak mengubah komponen atau tampilan layar produksi; tidak menambahkan package atau dependency.

## Verifikasi

- Red test: `pnpm --filter @daycare/app exec jest --config jest.ui.config.cjs src/ui/ComponentDesignPreview.ui.test.tsx --runInBand` gagal sesuai harapan karena kategori komponen belum ada di galeri.
- Green test: `pnpm --filter @daycare/app exec jest --config jest.ui.config.cjs src/ui/ComponentDesignPreview.ui.test.tsx --runInBand --silent` lulus (5 tes), termasuk kelengkapan kategori dan interaksi sheet/wizard/PIN.
- Coverage komponen preview dari Jest: 92.45% statements, 91.66% branches, 89.18% functions, 91.66% lines. Baris yang belum tercakup adalah contoh tombol loading/nonaktif dan switch nonaktif.
- Suite UI: `pnpm --filter @daycare/app test:ui --silent` lulus (8 suite, 32 tes).
- Full verify: `pnpm verify` lulus untuk seluruh workspace frontend (lint, typecheck, dan 340 tes Vitest).
- Backend: `./apps/api/gradlew -p apps/api test --no-daemon` lulus; Gradle melaporkan task test up-to-date.
- Typecheck: `pnpm --filter @daycare/app typecheck` lulus.
- ESLint terarah pada tiga file galeri/test/route lulus.
- `git diff --check` lulus.
- Verifikasi browser/device belum dilakukan; browser lokal tidak tersedia pada sesi ini. Route HTTP di `localhost:8081/component-preview` merespons 200.

## Batasan

- Galeri menunjukkan komponen aktual dengan theme aplikasi saat ini, sekaligus mempertahankan contoh visual alternatif terisolasi. Ini belum menetapkan design-system baseline dan tidak mengganti style aplikasi.
