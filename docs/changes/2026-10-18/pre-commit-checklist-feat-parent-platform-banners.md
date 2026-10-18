# Checklist Kesiapan Commit — `feat/parent-platform-banners`

<!-- Mories Deo Hutapea,S.E.,S.Kom -->

## Identitas dan ringkasan status

| Field | Nilai |
| --- | --- |
| Branch | `feat/parent-platform-banners` |
| Tujuan perubahan | Scope branch: banner platform dan pengumuman tenant, carousel Parent, filter/cabang, aksi gambar, browser internal aman, dan launcher lokal bersama |
| Tanggal diperbarui | 2026-10-18 |
| Status kesiapan | READY; follow-up tujuan banner sudah direview dan seluruh verifikasi relevan lulus |
| Item wajib tertunda | 0 |
| Temuan review terbuka | 0 |
| Blocker | Tidak ada. Batas verifikasi: uji visual device/browser belum dilakukan; migration V37 belum diterapkan sesuai instruksi pengguna dan tidak diklaim teruji di database. |

## Status per area review

| Area dari checklist review sumber | Status | Bukti, nomor butir sumber, gap/follow-up |
| --- | --- | --- |
| 1. Scope dan konsistensi perubahan | `DONE` | Checklist sumber §1: perubahan mencakup filter banner, fitting gambar, entry point role, Metro terpisah dan reuse backend. `.agents/`, `.claude/`, `run-logs/`, credentials, serta file lokal lain tidak distage; `run-logs/` tetap utuh. |
| 2. Konsistensi dokumentasi | `DONE` | Checklist sumber §2: README, aturan bisnis, OpenSpec, daily note, pre-commit checklist, dan checklist PR menjelaskan audience-scoped Profile/browser target; tenant-announcement allowlist tetap terpisah. |
| 3. Test dan coverage | `DONE` | Setelah review fix: `corepack pnpm verify` lulus lint, typecheck, seluruh workspace tests (Core 10, UI 30, API client 68, Mobile 284 tests/72 files); UI Jest penuh 14 suite/66 test lulus; backend full `./apps/api/gradlew -p apps/api test --no-daemon --console=plain` lulus. Coverage helper tidak dihitung ulang pada sesi ini. |
| 4. Arsitektur dan maintainability | `DONE` | Checklist sumber §4: akses tetap melalui route/screen yang sudah ada; hub perantara dihapus; logic banner filter memakai helper terpisah dan normalisasi pencarian dipakai bersama; launcher memakai helper backend/port tanpa mengganti business logic. |
| 5. Business rule, role, dan security | `DONE` | Checklist sumber §5: banner Profile dibatasi per audience oleh allowlist dan validator server; browser hanya menerima HTTPS; aksi Profile tidak meluaskan validator pengumuman tenant. |
| 6. Database dan API contract | `DONE` | Checklist sumber §6: `actionTarget` tetap string allowlisted; tidak ada schema/migration/API DTO change. Backend tests memastikan kedua audience banner menerima PROFILE dan validator pengumuman tenant tetap menolaknya. |
| 7. UI/UX dan accessibility | `DONE` | Checklist sumber §7: pilihan Profile memakai label terjemahan existing; aksi URL menyebut browser internal. Form memakai BottomSheet/ChipGroup dan URL field existing. UI tests/typecheck lulus; belum ada uji visual manual device/browser. |
| 8. Performance dan reliability | `DONE` | Checklist sumber §8: filtering dilakukan pada data query yang sudah tersedia; launcher mengunci startup backend bersamaan, mempertahankan backend setelah app stop, dan memisahkan port Web/Android. Test concurrency terisolasi lulus. |
| 9. Verification dan release readiness | `DONE` | Checklist sumber §9: latest `pnpm verify`, backend full test, full UI Jest, dan `git diff --check` lulus. Tidak ada klaim migrasi, production, uji manual device, atau uji visual browser. |
| 10. Keputusan akhir reviewer | `DONE` | Checklist sumber §10: follow-up direview terhadap allowlist/audience, server validation, route helper, i18n, kontrak, dan regresi pengumuman. Tidak ada temuan terbuka; staged diff diperiksa sebelum commit dan run-logs dikecualikan. |

## Temuan review dan perbaikannya

| Referensi bagian/butir sumber | Temuan dan tingkat risiko | Perbaikan | Verifikasi ulang / status |
| --- | --- | --- | --- |
| §6 Database/API; §8 Reliability | Timestamp jadwal lampau sebelumnya dapat berubah diam-diam menjadi publish langsung. Risiko: promosi/pengumuman terbit tanpa waktu yang dimaksud. | Validasi request menolak timestamp jadwal yang tidak berada di masa depan. | Test regresi ditambahkan dahulu, gagal sebelum patch, lulus sesudah patch; backend suite penuh lulus. CLOSED. |
| §6 Database/API; §8 Reliability | Menutup banner terjadwal membiarkan `scheduledAt` sehingga bertentangan dengan constraint migrasi. Risiko: close gagal saat persist. | Manual/otomatis close membersihkan timestamp jadwal. | Test regresi ditambahkan dahulu, gagal sebelum patch, lulus sesudah patch; backend suite penuh dan Flyway V36 scratch lulus. CLOSED. |
| §7 UI/UX; §8 Reliability | Klik gambar pengumuman memakai aksi milik slide aktif, bukan slide yang ditekan; daftar banner kosong juga berpotensi mengubah urutan pemanggilan hook saat data datang. | Aksi dihitung per item dan semua hook carousel dijalankan sebelum empty return. | UI Jest penuh mencakup regresi slide/action, carousel timer, empty-list, dan image-only; `pnpm verify` serta backend rerun penuh lulus. CLOSED. |
| §7 UI/UX; §8 Reliability | `pagingEnabled` bergerak per lebar viewport, tetapi perhitungan auto-scroll dan indeks menggunakan slide yang lebih sempit. Risiko: gambar dan dot aktif dapat tidak sinkron setelah swipe/auto-advance. | Selaraskan lebar dialog dan slide pada viewport yang tersedia (maksimum 560 dp). | Regression UI test gagal sebelum patch (`Expected: 600, Received: 560`), lalu targeted popup Jest lulus 12/12. CLOSED. |

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
- [x] Review fix terakhir: `corepack pnpm verify` lulus (72 file/284 test aplikasi); UI Jest penuh 14 suite/66 test; backend suite penuh `BUILD SUCCESSFUL`.
- [x] `git diff --check` lulus; belum ada uji visual manual device/browser.

## Batas dan pemisahan commit

- Carousel swipe pause pada commit sebelumnya tetap menjadi commit tersendiri. Perubahan sesudahnya disusun dalam tiga scope: fitur konten platform/home beserta dokumentasinya; perbaikan launcher Web beserta dokumentasinya; konfigurasi adapter lokal beserta panduan OpenSpec.
- Test-first dan red/green untuk perubahan awal banner, hub, review summary, dan TextField dicatat pada test terkait/daily notes; validasi akhir dijalankan ulang sebelum commit.
- Migration V37 hanya disiapkan dan ditinjau statis. Tidak dijalankan pada database persistent maupun production karena pengguna meminta migrasi tidak dijalankan tanpa instruksi.
- `run-logs/` tidak distage, tidak dihapus, dan tetap lokal. Tidak ada secret, credentials, atau `docs/personal-docs/` di commit.
- Batas bukti: belum ada uji visual device/browser; UI tests menghasilkan warning React `act(...)` dari ikon/asynchronous provider tetapi seluruh assertions lulus.
- Commit terbaru dikelompokkan per scope: implementasi dan test dalam commit code; README, business rules, daily notes, serta checklist dalam commit dokumentasi. History remote yang sudah dipush tidak ditulis ulang.
- Final verification dijalankan ulang setelah perubahan code terakhir: `pnpm verify`, UI suite, targeted coverage, Expo web export, Android assembleDebug, dan staged `git diff --check`.
- `.gitignore` mengecualikan adapter/config Codex/Claude lokal, disinkronkan dengan panduan OpenSpec. `run-logs/` tetap tidak disentuh dan tidak distage.
- Pembaruan entry point mengganti hub konten yang sudah ada: Platform Admin menuju `/platform-banners`, Staff Admin menuju `/tenant-announcements`. Route screens tersebut tetap menjadi boundary otorisasi; perubahan hanya navigasi dan dokumentasinya.
- Push dilakukan sebagai fast-forward dari `origin/feat/parent-platform-banners`; commit yang sudah berada di remote tidak ditulis ulang. Perubahan code dikonsolidasikan per scope menjadi tiga commit, sedangkan README, business rules, daily notes, dan checklist berada pada satu commit documentation.
- Commit code banner pertama: `c8ce8c7` (`feat: improve platform banner browsing`); staged diff telah dibatasi pada screen/filter, normalisasi pencarian bersama, terjemahan, dan fitting gambar.
- Commit code launcher kedua: `4fdf236` (`fix: share local API across mobile launchers`); staged diff hanya berisi launcher, helper lifecycle/port, dan test concurrency shell.
- Commit code navigasi ketiga: `c0bee3d` (`fix: route content management by role`); Platform Admin diarahkan ke banner, Staff Admin ke pengumuman tenant, dan hub lama dihapus.
- Scope platform/home sebelumnya telah disquash menjadi satu commit berisi implementasi, test, migrasi, aturan bisnis, README, daily note, dan checklist; perubahan lanjutan pada sesi ini dicatat terpisah di bawah.
- Scope launcher Web telah disquash menjadi satu commit berisi script, daily note, dan checklist; shell syntax serta staged `git diff --cached --check` lulus.
- Scope terakhir adalah konfigurasi adapter lokal: `.gitignore` bersama pembaruan panduan OpenSpec supaya `.agents/` dan `.claude/` tetap lokal.

## Verifikasi lanjutan dan perubahan sesi ini (2026-10-18)

- [x] Filter daftar pengumuman Staff Admin mendukung pencarian, lifecycle, audience, cabang nonaktif, dan fallback nama cabang; Parent hanya mendapat pencarian. UI regression test lulus.
- [x] Popup Parent full-bleed menempatkan X icon-only dan dot pada gambar, dengan aksi Unduh/Bagikan sejajar. Format file mengikuti URL/MIME; MIME tidak dikenal ditolak. Permission galeri hanya diminta saat download native.
- [x] CTA HTTPS banner/popup membuka browser internal; URL dinormalisasi dan dibatasi HTTPS. Native memakai WebView dengan HTTPS navigation dan mixed-content off; web frame diizinkan hanya dari HTTPS origin/loopback dev dan menggunakan sandbox.
- [x] Daily notes serta README/business rules diperbarui; semua test workspace 72 file/284 tests dan UI suite 14/65 lulus. Targeted coverage 100% statements/lines/functions, 98.36% branches.
- [x] Web export dan Android assembleDebug lulus. Tidak ada uji manual device/iOS, migrasi baru, atau validasi live service/database pada scope ini.
- [x] `run-logs/` tetap lokal dan tidak distage.

## Tujuan banner Profile dan browser internal (2026-10-18)

- [x] Opsi tautan banner menyebut browser internal dengan jelas; destination HTTPS tetap dinormalisasi/diotorisasi oleh flow browser yang sudah ada.
- [x] Tambah tujuan `PROFILE` khusus banner platform untuk audience Parent dan Staff Admin; route pengumuman tenant tetap dibatasi allowlist sebelumnya.
- [x] Test-first: regression route test dan backend service test gagal sebelum implementasi, lalu lulus setelah implementasi.
- [x] Validasi targeted: `actionDestination.test.ts` 2/2, `ParentPromotionSlider.ui.test.tsx` 13/13, dan backend `PlatformBannerServiceTest` + `TenantAnnouncementActionValidationTest` lulus. Mobile typecheck lulus.
- [x] Full verification setelah follow-up: `corepack pnpm verify`, backend `./gradlew test --no-daemon`, serta `git diff --check` lulus.
- [x] Review lokal checklist §1–10 selesai untuk diff ini; tidak ada temuan terbuka. Migration/schema tidak berubah sehingga migration run tidak diperlukan.

<!-- Mories Deo Hutapea,S.E.,S.Kom -->
