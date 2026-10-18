<!-- Mories Deo Hutapea,S.E.,S.Kom -->
# Interaksi carousel Parent

## Perubahan

- Lebar kartu mengikuti viewport carousel yang benar-benar dirender, menyisakan cuplikan slide berikutnya.
- Dot indikator berada di atas bagian bawah gambar dengan latar transparan gelap, tanpa menangkap gesture.
- Auto-slide berhenti selama drag dan memulai hitungan interval baru setelah drag selesai, untuk banner maupun popup pengumuman.
- Galeri `/component-preview` menampilkan tiga slide contoh khusus preview.

## Verifikasi

- Test-first untuk pause/resume hook dan wiring kedua carousel: 3 suite UI, 21 test lulus.
- `corepack pnpm --filter @daycare/app typecheck` lulus.
- `git diff --check` lulus.
- Uji visual browser/device belum dilakukan; browser lokal tidak tersedia.
