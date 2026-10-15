<!-- Mories Deo Hutapea,S.E.,S.Kom -->

# Checklist kesiapan commit

## Perubahan

- Menambahkan template checklist kesiapan commit per branch yang mencatat
  status `DONE`, `PENDING`, atau `N/A` beserta bukti, temuan review, pekerjaan
  tersisa, dan blocker. Sepuluh area template mengikuti bagian-bagian dalam
  `docs/personal-docs/code-review-checklist.md`; setiap butir sumber yang
  berlaku harus diperiksa dan gap merujuk nomor bagian/butirnya.
- Memperbarui `CLAUDE.md` agar salinan branch-specific checklist dibuat atau
  diperbarui sebelum setiap commit dan commit hanya dilakukan saat status
  `READY`, tanpa item wajib tertunda, temuan terbuka, atau blocker.
- Menautkan aturan di README dan menambahkan tabel ringkasan sepuluh area ke
  template checklist MR agar juga ditampilkan pada deskripsi PR/MR. Checklist
  ini melengkapi, bukan menggantikan, review checklist lokal maupun checklist
  MR.

## Verifikasi

- `git diff --check` — lulus.
- Test aplikasi tidak dijalankan karena perubahan ini hanya dokumentasi/proses.
