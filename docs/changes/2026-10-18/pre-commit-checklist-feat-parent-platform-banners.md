# Checklist Kesiapan Commit — `feat/parent-platform-banners`

<!-- Mories Deo Hutapea,S.E.,S.Kom -->

## Identitas dan ringkasan status

| Field | Nilai |
| --- | --- |
| Branch | `feat/parent-platform-banners` |
| Tujuan perubahan | Sisa scope pada branch: audience banner Staff Admin, hub konten berdasarkan role, ringkasan antrean review langganan, TextField clearable/galeri komponen, dan forwarding proses launcher Web; dipisah ke commit per scope |
| Tanggal diperbarui | 2026-10-18 |
| Status kesiapan | READY; scope sudah dipisahkan dan disquash sebelum push ulang |
| Item wajib tertunda | 0 |
| Temuan review terbuka | 0 |
| Blocker | Tidak ada. Batas verifikasi: uji visual device/browser belum dilakukan; migration V37 belum diterapkan sesuai instruksi pengguna dan tidak diklaim teruji di database. |

## Status per area review

| Area dari checklist review sumber | Status | Bukti, nomor butir sumber, gap/follow-up |
| --- | --- | --- |
| 1. Scope dan konsistensi perubahan | `DONE` | Checklist sumber §1: commit yang direncanakan dipisah untuk (a) audience banner/hub konten, (b) antrean review langganan, (c) clearable TextField dan galeri, (d) process forwarding Web, (e) dokumentasi/config. `.agents/`, `.claude/`, `run-logs/`, dan file lokal lain tidak distage; `run-logs/` tetap utuh. |
| 2. Konsistensi dokumentasi | `DONE` | Checklist sumber §2: README dan `docs/business-rules.md` mencatat audience/hub dan review langganan; daily note banner serta launcher mencatat behavior dan hasil verifikasi; OpenSpec adoption dan `.gitignore` disinkronkan untuk adapter lokal. Checklist ini diperbarui untuk hasil final. |
| 3. Test dan coverage | `DONE` | Checklist sumber §3: `corepack pnpm verify` lulus: lint/typecheck dan Vitest 64 file/252 test; UI Jest 13 suite/58 test; `./apps/api/gradlew -p apps/api test --no-daemon --rerun-tasks` BUILD SUCCESSFUL. Shell syntax dan `git diff --check` lulus. Warning React `act(...)` dan 3 warning Kotlin deprecation/type-mismatch dicatat; tidak ada test gagal. |
| 4. Arsitektur dan maintainability | `DONE` | Checklist sumber §4: business logic audience dan validasi aksi tetap di backend service/helper; route allowlist typed di core dan mobile; data akses lewat API client; content hub reusable terpisah dari screen; TextField memperluas komponen dasar; launcher hanya mengganti wrapper dengan `exec`. |
| 5. Business rule, role, dan security | `DONE` | Checklist sumber §5: audience PARENT/STAFF_ADMIN/tenant STAFF_ADMIN di-enforce service dan feed; membership aktif/tenant aktif divalidasi backend; CTA route dibatasi menurut role dan browser HTTPS; hub membatasi aksi menurut role; review-summary tetap Platform Admin-only. |
| 6. Database dan API contract | `DONE` | Checklist sumber §6: entity, repository, service, controller, API client, shared enums dan migration V37 cocok; default menjaga record lama sebagai `PARENT_GLOBAL`; constraint mewajibkan tenant target hanya untuk audience tenant; V37 belum dijalankan sesuai instruksi pengguna. Migration dan DB lokal/production tidak diklaim telah diterapkan. |
| 7. UI/UX dan accessibility | `DONE` | Checklist sumber §7: form audience menampilkan pemilih tenant hanya untuk audience tenant, route create hub dibersihkan setelah dipakai, aksi per role diterjemahkan, clearable TextField memakai label aksesibilitas, carousel tetap swipeable dan image-only. UI Jest lulus; uji visual device/browser belum dilakukan. |
| 8. Performance dan reliability | `DONE` | Checklist sumber §8: feed tenant memakai query scoped dan indeks partial; summary memakai repository count, bukan mengambil seluruh halaman; launcher `exec` meneruskan sinyal ke proses Expo. |
| 9. Verification dan release readiness | `DONE` | Checklist sumber §9: workspace lint/typecheck/test, UI Jest, backend full rerun, shell syntax, serta `git diff --check` lulus. Tidak ada klaim migrasi persistent, production, atau device/browser. |
| 10. Keputusan akhir reviewer | `DONE` | Checklist sumber §10: peninjauan diff mengonfirmasi scope, role authorization, tenant target constraint, route allowlist, hook create form, i18n, clear action, serta launcher forwarding. Tidak ditemukan finding blocking; setiap staged diff akan dicek lagi sebelum commit. |

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

## Batas dan pemisahan commit

- Carousel swipe pause pada commit sebelumnya tetap menjadi commit tersendiri. Perubahan sesudahnya disusun dalam tiga scope: fitur konten platform/home beserta dokumentasinya; perbaikan launcher Web beserta dokumentasinya; konfigurasi adapter lokal beserta panduan OpenSpec.
- Test-first dan red/green untuk perubahan awal banner, hub, review summary, dan TextField dicatat pada test terkait/daily notes; validasi akhir dijalankan ulang sebelum commit.
- Migration V37 hanya disiapkan dan ditinjau statis. Tidak dijalankan pada database persistent maupun production karena pengguna meminta migrasi tidak dijalankan tanpa instruksi.
- `run-logs/` tidak distage, tidak dihapus, dan tetap lokal. Tidak ada secret, credentials, atau `docs/personal-docs/` di commit.
- Batas bukti: belum ada uji visual device/browser; UI tests menghasilkan warning React `act(...)` dari ikon/asynchronous provider tetapi seluruh assertions lulus.
- Commit terbaru dikelompokkan ulang per scope agar implementasi dan dokumentasi scope yang sama berada dalam satu commit. History push sebelumnya akan diperbarui menggunakan `--force-with-lease` setelah verifikasi head remote.
- Verifikasi ulang source setelah pengelompokan tidak diperlukan karena tidak ada perubahan kode sejak test penuh lulus; `git diff --check` dan staged-diff review tetap dilakukan untuk setiap scope.
- `.gitignore` mengecualikan adapter/config Codex/Claude lokal, disinkronkan dengan panduan OpenSpec. `run-logs/` tetap tidak disentuh dan tidak distage.
- Scope platform/home telah disquash menjadi satu commit berisi implementasi, test, migrasi, aturan bisnis, README, daily note, dan checklist; staged diff lulus `git diff --cached --check`.
- Scope berikutnya adalah launcher Web (`scripts/run-mobile.sh` dengan `docs/changes/2026-10-18/web-reload-process-forwarding.md`); shell syntax sudah lulus.

<!-- Mories Deo Hutapea,S.E.,S.Kom -->
