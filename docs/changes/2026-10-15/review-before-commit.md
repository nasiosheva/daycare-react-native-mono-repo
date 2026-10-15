<!-- Mories Deo Hutapea,S.E.,S.Kom -->

# Review sebelum commit

## Perubahan

- `CLAUDE.md` kini mewajibkan review atas seluruh diff sebelum setiap commit,
  menggunakan checklist review kode lokal sebagai acuan utama.
- Semua temuan harus diperbaiki; test dan verifikasi terkait dijalankan ulang.
  Commit ditahan selama masih ada temuan correctness/security atau masalah
  lain yang belum terselesaikan.
- Checklist MR dan README mencatat gerbang yang sama, termasuk pemeriksaan
  `git diff --check` dan staged diff untuk mencegah file lokal-only ikut.

## Verifikasi

- `git diff --check` — lulus.
- Test aplikasi tidak dijalankan; perubahan ini hanya dokumentasi/proses.
