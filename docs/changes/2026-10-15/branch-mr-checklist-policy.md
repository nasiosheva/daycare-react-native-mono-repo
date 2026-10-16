<!-- Mories Deo Hutapea,S.E.,S.Kom -->

# Checklist khusus per branch/MR

## Perubahan

- Dibuat template checklist MR/PR di
  `docs/checklists/branch-mr-checklist-template.md` yang mencakup scope dan
  business rules, security/tenant scope, contract, concurrency/idempotency,
  UX/i18n, migration, test/coverage/CI, dokumentasi, hygiene, dan post-merge.
- `CLAUDE.md` mewajibkan salinan terpisah per branch/MR, bukti untuk setiap
  hasil, alasan untuk `N/A`, dan menegaskan checklist ini tidak menggantikan
  checklist code review lokal.
- README menautkan template sebagai aturan kontribusi. `CLAUDE.md` tetap lokal
  dan di-ignore; tidak boleh ikut MR.

## Verifikasi

- Memeriksa pola dokumentasi dan instruksi repo; path template di README dan
  `CLAUDE.md` mengarah ke file yang dibuat.
- `git diff --check` — lulus.
- Tidak ada test aplikasi yang dijalankan karena perubahan ini hanya
  dokumentasi/proses.
