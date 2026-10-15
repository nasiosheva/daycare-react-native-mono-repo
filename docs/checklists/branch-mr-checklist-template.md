<!-- Mories Deo Hutapea,S.E.,S.Kom -->

# Checklist Pull/Merge Request per Branch

> Salin file ini untuk setiap MR/PR yang dibuat dari sebuah branch. Jangan
> menandai selesai tanpa bukti; isi `N/A` dengan alasan bila item tidak relevan.

## Identitas

| Field | Nilai |
| --- | --- |
| Branch sumber | `<branch>` |
| Target branch | `production` |
| MR/PR | `<URL atau belum dibuat>` |
| Work item / tujuan | `<tautan atau ringkasan>` |
| Tanggal checklist | `YYYY-MM-DD` |

## Scope dan aturan produk

- [ ] Tujuan branch dan acceptance criteria tertulis; perubahan tetap dalam scope.
- [ ] `README.md` dan `docs/business-rules.md` ditinjau; aturan dan implementasi selaras. Konflik bisnis sudah mendapat keputusan eksplisit.
- [ ] Role, tenant, branch, child/resource ownership, dan capability diperiksa di server; UI tersembunyi bukan satu-satunya kontrol akses.
- [ ] Perubahan API, data, konfigurasi, status, dan efek samping memiliki kontrak yang konsisten di backend, `packages/api-client`, `packages/core` bila relevan, dan mobile/web.
- [ ] Untuk operasi yang dapat diulang atau bersamaan, idempotency, locking/revision, uniqueness, retry, dan konflik telah ditangani sesuai semantik domain.

## Implementasi dan pengalaman pengguna

- [ ] Perubahan mengikuti arsitektur, abstraksi, pola, dan penamaan repo; tidak menduplikasi aturan yang sudah ada.
- [ ] Loading, empty, error/retry, disabled, submitting, dan hasil sukses ditangani untuk alur yang berubah.
- [ ] Teks baru diterjemahkan untuk semua locale yang diwajibkan; aksesibilitas, keyboard, ukuran teks, dan layout web/mobile diperiksa bila relevan.
- [ ] Tidak ada secret, token, data pribadi, log lokal, atau file lokal-only yang ikut masuk perubahan.

## Database, test, dan verifikasi

- [ ] Migration baru berurutan, additive, kompatibel dengan versi API sebelumnya, dan tidak mengubah migration yang telah terpakai.
- [ ] Test ditulis/diperbarui sebelum kode produksi; test terarah dijalankan lebih dahulu dan gagal karena perilaku yang memang belum tersedia (red), lalu implementasi dibuat dan test lulus (green). Catat command dan hasilnya; bila otomatisasi benar-benar tidak memungkinkan, catat alasan teknis dan metode verifikasi alternatif yang disepakati.
- [ ] Unit/service/API-client/UI test yang relevan ditambah atau diperbarui; hasilnya dicatat di bawah.
- [ ] Test penuh frontend (`pnpm verify`) lulus atau pengecualian beserta alasan dan hasil pengganti dicatat.
- [ ] Test penuh backend (`./apps/api/gradlew -p apps/api test --no-daemon`) lulus atau pengecualian beserta alasan dan hasil pengganti dicatat.
- [ ] CI wajib untuk commit/head MR saat ini lulus; hasil lama dari head berbeda tidak dianggap bukti.
- [ ] `git diff --check` lulus. Coverage dicatat dengan nilai dan sumber laporan; jangan mengklaim target tanpa angka.
- [ ] Validasi lokal, integration/database, browser, device, production, dan CI dibedakan dengan jelas; jangan mengklaim validasi yang tidak dilakukan.

## Dokumentasi dan release hygiene

- [ ] Daily note `docs/changes/YYYY-MM-DD/<context>.md` mencatat perubahan, dampak, verifikasi, dan follow-up.
- [ ] `README.md`, `docs/business-rules.md`, plan, atau dokumentasi modul diperbarui bila perubahan flow, aturan, API, data, konfigurasi, operasi, atau test memerlukannya.
- [ ] File baru/perubahan yang mendukung watermark sudah memuat `Mories Deo Hutapea,S.E.,S.Kom`.
- [ ] Branch bukan `production`; target MR benar; perubahan lokal lain dipertahankan dan tidak broad-stage.
- [ ] `run-logs/` kosong sebelum MR dibuka; tidak ada isi `run-logs/` yang di-commit.
- [ ] `docs/personal-docs/`, `CLAUDE.md`, akun lokal, secret, keystore, dan artefak lokal-only tidak dimasukkan ke MR.
- [ ] Checklist khusus branch ini diisi dan disimpan bersama dokumentasi MR; checklist ini tidak menggantikan review kode wajib di `docs/personal-docs/code-review-checklist.md`.

## Bukti verifikasi dan hasil yang belum selesai

| Pemeriksaan | Hasil / perintah / tautan | Catatan atau alasan N/A |
| --- | --- | --- |
| Test frontend | `<PASS/FAIL/N/A>` | |
| Test backend | `<PASS/FAIL/N/A>` | |
| CI head MR | `<PASS/FAIL/PENDING/N/A>` | |
| Coverage line/branch | `<angka + sumber>` | |
| DB/migration | `<belum dijalankan / test DB / hasil>` | |
| Browser/device/live service | `<hasil atau tidak dilakukan>` | |
| Blocker/follow-up | `<tidak ada atau daftar>` | |

## Setelah merge

- [ ] Merge dikonfirmasi pada MR/PR yang benar.
- [ ] Checkout disinkronkan ke `production` (`fetch`, `checkout`, `pull --ff-only`) dan hanya branch lokal yang sudah merged/remote-deleted yang dibersihkan.
- [ ] Worktree dan file lokal-only yang tidak terkait tetap dipertahankan.
