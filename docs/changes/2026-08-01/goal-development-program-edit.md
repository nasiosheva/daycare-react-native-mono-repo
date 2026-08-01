# Edit Program Perkembangan dari Goals

## Perubahan

- Staff Admin aktif kini melihat daftar Program Perkembangan milik tenant di layar Goals dan dapat memilih **Ubah** untuk membuka form edit yang sudah tersedia.
- Daftar dan aksi edit tidak pernah menampilkan Program Perkembangan global pada UI tenant.
- Form edit menjelaskan bahwa perubahan Program Perkembangan reusable, termasuk target dan indikatornya, diterapkan pada Goal Anak yang menggunakannya.
- Query daftar Program Perkembangan untuk pengelolaan dipisahkan dari pencarian pada pemilih **Tetapkan Goal**, sehingga hasil pencarian assignment tidak menyembunyikan program yang dapat diedit.

## Verifikasi

- `corepack pnpm verify`.
- `git diff --check`.

## Tindak lanjut

- Goal Anak tidak memiliki endpoint edit terpisah. Riwayat dan simpulan Goal tetap dikelola melalui check-in dan tindakan terminal yang ada.
