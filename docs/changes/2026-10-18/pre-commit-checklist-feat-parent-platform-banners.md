# Checklist Kesiapan Commit — `feat/parent-platform-banners`

<!-- Mories Deo Hutapea,S.E.,S.Kom -->

## Identitas dan ringkasan status

| Field | Nilai |
| --- | --- |
| Branch | `feat/parent-platform-banners` |
| Tujuan perubahan | Promosi global Parent, aksi pengumuman tenant, serta pencarian/filter program perkembangan global |
| Tanggal diperbarui | 2026-10-18 |
| Status kesiapan | READY untuk scope fitur dan dokumentasi yang tercantum; tanpa push/PR |
| Item wajib tertunda | 0 |
| Temuan review terbuka | 0 |
| Blocker | Uji visual device/browser belum dilakukan; dicatat sebagai batas verifikasi, bukan blocker untuk commit |

## Status per area review

| Area dari checklist review sumber | Status | Bukti, nomor butir sumber, gap/follow-up |
| --- | --- | --- |
| 1. Scope dan konsistensi perubahan | `DONE` | Checklist sumber §1: diff dipisah menjadi dua feature scope; perubahan `.gitignore`, `docs/changes/2026-10-17/openspec-adoption.md`, `run-logs/`, dan file lokal lain tidak termasuk commit. |
| 2. Konsistensi dokumentasi | `DONE` | Checklist sumber §2: README, `docs/business-rules.md`, dua catatan harian, OpenSpec proposal, dan checklist branch diperbarui; V36 dijelaskan sebagai teruji pada PostgreSQL scratch, bukan DB persisten/production. |
| 3. Test dan coverage | `DONE` | Checklist sumber §3: test-first merah/hijau untuk jadwal lampau dan close banner terjadwal; `corepack pnpm verify` lulus (lint, typecheck, semua Vitest: 63 file/250 test); UI Jest 12 suite/48 test lulus; backend `./apps/api/gradlew -p apps/api test --no-daemon --rerun-tasks` lulus; API client 68 test lulus. Tidak ada klaim target coverage numerik. |
| 4. Arsitektur dan maintainability | `DONE` | Checklist sumber §4: pemisahan service/action validation/media validation mengikuti pola backend; typed API-client/core contracts; filter katalog dipisah ke helper teruji; tidak ada refactor lintas fitur. |
| 5. Business rule, role, dan security | `DONE` | Checklist sumber §5: endpoint global hanya untuk Parent terautentikasi; CRUD promosi dibatasi Platform Admin; pengumuman tenant mengikuti Staff Admin/tenant scope; CTA dibatasi HTTPS browser atau route allowlist; URL gambar wajib HTTPS. |
| 6. Database dan API contract | `DONE` | Checklist sumber §6: migration V36 fresh-install diuji pada PostgreSQL scratch; Flyway mengonfirmasi versi 36. API wrappers dan payload tests lulus. DB lokal persisten/production tidak disentuh. |
| 7. UI/UX dan accessibility | `DONE` | Checklist sumber §7: dua sumber carousel gambar terpisah, auto-slide + dot; popup tanpa field pesan dan hanya menampilkan gambar, X, serta acknowledgement bila diwajibkan; preview tanpa navigasi; klik image memakai aksi slide terkait; placeholder gambar gagal muat; empty filter clear-all. Component UI tests lulus. Uji visual manual device/browser belum dilakukan dan menjadi follow-up. |
| 8. Performance dan reliability | `DONE` | Checklist sumber §8: feed menyaring expiry, scheduler menutup item expired/terjadwal, jadwal lampau ditolak, penutupan membersihkan `scheduledAt`, dan fallback image tersedia. |
| 9. Verification dan release readiness | `DONE` | Checklist sumber §9: `git diff --check` lulus; root verification, UI Jest, API client, dan backend suite penuh lulus; migrasi scratch fresh-install lulus. Belum ada deploy atau live DB/device test yang diklaim. |
| 10. Keputusan akhir reviewer | `DONE` | Checklist sumber §10: review ulang setelah memperbaiki validasi jadwal lampau dan constraint close; tidak ada finding terbuka pada scope commit ini. Staged diff akan diperiksa terpisah untuk setiap commit. |

## Temuan review dan perbaikannya

| Referensi bagian/butir sumber | Temuan dan tingkat risiko | Perbaikan | Verifikasi ulang / status |
| --- | --- | --- | --- |
| §6 Database/API; §8 Reliability | Timestamp jadwal lampau sebelumnya dapat berubah diam-diam menjadi publish langsung. Risiko: promosi/pengumuman terbit tanpa waktu yang dimaksud. | Validasi request menolak timestamp jadwal yang tidak berada di masa depan. | Test regresi ditambahkan dahulu, gagal sebelum patch, lulus sesudah patch; backend suite penuh lulus. CLOSED. |
| §6 Database/API; §8 Reliability | Menutup banner terjadwal membiarkan `scheduledAt` sehingga bertentangan dengan constraint migrasi. Risiko: close gagal saat persist. | Manual/otomatis close membersihkan timestamp jadwal. | Test regresi ditambahkan dahulu, gagal sebelum patch, lulus sesudah patch; backend suite penuh dan Flyway V36 scratch lulus. CLOSED. |
| §7 UI/UX; §8 Reliability | Klik gambar pengumuman memakai aksi milik slide aktif, bukan slide yang ditekan; daftar banner kosong juga berpotensi mengubah urutan pemanggilan hook saat data datang. | Aksi dihitung per item dan semua hook carousel dijalankan sebelum empty return. | UI Jest penuh mencakup regresi slide/action, carousel timer, empty-list, dan image-only; `pnpm verify` serta backend rerun penuh lulus. CLOSED. |

## Keputusan sebelum commit

- [x] Semua butir review yang berlaku diperiksa untuk sepuluh area checklist sumber.
- [x] Semua area berstatus `DONE`; tidak ada `PENDING` atau `N/A` tanpa alasan.
- [x] Item wajib tertunda = 0; semua temuan dan blocker terselesaikan.
- [x] Test/verifikasi terkait temuan dijalankan ulang.
- [x] `git diff --check` lulus; staged diff diperiksa per commit scope.
- [x] Tidak ada secret, data pribadi, `run-logs/`, `docs/personal-docs/`, `CLAUDE.md`, atau artefak lokal-only yang akan distage.
- [x] Status kesiapan `READY` untuk commit lokal; perubahan visual belum dibuktikan pada device/browser.

## Pembaruan klarifikasi carousel (2026-10-18)

- [x] Promosi platform dan pengumuman tenant didokumentasikan sebagai dua sumber data dan dua carousel gambar yang berbeda.
- [x] Pengumuman baru tidak meminta pesan; body lama tetap kompatibel, boleh kosong, dan notifikasi punya fallback label.
- [x] Popup hanya merender slide gambar; X menutup popup, acknowledgement tetap ada hanya bila diwajibkan oleh record.
- [x] `corepack pnpm verify`: lint/typecheck lulus dan Vitest 63 file/250 test lulus.
- [x] UI Jest penuh: 12 suite/48 test lulus. Backend rerun penuh: BUILD SUCCESSFUL; ada 3 warning deprecation/type mismatch pada test yang sudah ada dan tidak terkait perubahan ini.
- [x] `git diff --check` lulus; belum ada uji visual manual device/browser.

<!-- Mories Deo Hutapea,S.E.,S.Kom -->
