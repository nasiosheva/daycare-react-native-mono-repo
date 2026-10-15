<!-- Mories Deo Hutapea,S.E.,S.Kom -->

# Checklist Kesiapan Commit per Branch

> Salin ke `docs/changes/YYYY-MM-DD/pre-commit-checklist-<branch-slug>.md`.
> Perbarui sebelum setiap commit. Checklist ini bersumber dari seluruh sepuluh
> bagian `docs/personal-docs/code-review-checklist.md`; checklist lokal tersebut
> tetap menjadi acuan rinci dan harus diperiksa item demi item.

## Identitas dan ringkasan status

| Field | Nilai |
| --- | --- |
| Branch | `<branch>` |
| Tujuan perubahan | `<ringkasan>` |
| Tanggal diperbarui | `YYYY-MM-DD` |
| Status kesiapan | `NOT READY / READY` |
| Item wajib tertunda | `<jumlah dan daftar atau 0>` |
| Temuan review terbuka | `<jumlah dan daftar atau 0>` |
| Blocker | `<daftar atau tidak ada>` |

Status area: `DONE`, `PENDING`, atau `N/A (alasan)`. Untuk setiap area,
periksa semua butir yang relevan pada bagian bernomor sama di checklist sumber.
Catat bukti untuk status `DONE`; catat nomor bagian/butir sumber, dampak, dan
follow-up untuk setiap gap, temuan, atau `N/A`. `N/A` wajib memiliki alasan.

## Status per area review

| Area dari checklist review sumber | Status | Bukti, nomor butir sumber, gap/follow-up |
| --- | --- | --- |
| 1. Scope dan konsistensi perubahan | `PENDING` | |
| 2. Konsistensi dokumentasi | `PENDING` | |
| 3. Test dan coverage | `PENDING` | |
| 4. Arsitektur dan maintainability | `PENDING` | |
| 5. Business rule, role, dan security | `PENDING` | |
| 6. Database dan API contract | `PENDING` | |
| 7. UI/UX dan accessibility | `PENDING` | |
| 8. Performance dan reliability | `PENDING` | |
| 9. Verification dan release readiness | `PENDING` | |
| 10. Keputusan akhir reviewer | `PENDING` | |

## Temuan review dan perbaikannya

| Referensi bagian/butir sumber | Temuan dan tingkat risiko | Perbaikan | Verifikasi ulang / status |
| --- | --- | --- | --- |
| `<tidak ada / nomor item>` | `<deskripsi>` | `<perbaikan>` | `<hasil>` |

## Keputusan sebelum commit

- [ ] Semua butir review yang berlaku diperiksa satu per satu terhadap checklist sumber.
- [ ] Semua area berstatus `DONE` atau `N/A` dengan alasan yang valid.
- [ ] Item `PENDING` = 0; semua temuan dan blocker telah diselesaikan.
- [ ] Test/verifikasi terkait temuan yang diperbaiki dijalankan ulang dan hasilnya dicatat.
- [ ] `git diff --check` lulus dan staged diff telah ditinjau.
- [ ] Tidak ada secret, data pribadi, `run-logs/`, `docs/personal-docs/`, `CLAUDE.md`, atau artefak lokal-only di staged diff.
- [ ] Status kesiapan di atas adalah `READY`.

Commit hanya boleh dilakukan jika seluruh keputusan ini terpenuhi. Checklist
ini melacak kesiapan dan gap per branch; checklist sumber lokal tetap dipakai
untuk pemeriksaan rinci. Checklist MR/PR juga tetap wajib secara terpisah.
