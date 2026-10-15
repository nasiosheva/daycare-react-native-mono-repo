// Mories Deo Hutapea,S.E.,S.Kom

# Kontrol operasional pengelolaan langganan tenant

## Riwayat tahap perencanaan awal (sebelum implementasi dimulai)

### Perubahan

- Menambahkan kontrol pemisahan tugas untuk refund manual: prosedur disetujui fungsi keuangan dan approval dilakukan Platform Admin berizin; pengaju tidak boleh menyetujui refund sendiri, sedangkan penyetuju dan pelaksana transfer harus tercatat terpisah. Pengecualian operasional memerlukan approval kedua dan alasan audit.
- Menambahkan simulasi rollout `GRACE` yang read-only, menampilkan tenant terdampak serta dampak status/akses, tanpa menulis status, menagih, atau mengirim notifikasi.
- Menetapkan peninjauan hasil simulasi dan pembuatan ulang preview bila data sumber berubah sebelum aktivasi; rollout aktual dilakukan bertahap setelah konfirmasi.

### Batas perubahan saat itu

- Plan subscription diperbarui; `docs/business-rules.md`, kode, API, skema data, dan perilaku berjalan tidak berubah.
- Kontrol tersebut menjadi persyaratan desain/operasional. Detail normatif harus dimasukkan ke `docs/business-rules.md` sebelum implementasi terkait sesuai Tahap 0.

### Verifikasi dokumen saat itu

- Meninjau ulang bagian Tahap 0, kriteria penerimaan, operasional, dan keputusan pembayaran/refund agar kontrol saling konsisten.
- Pemeriksaan whitespace pada dokumen yang diubah; tidak menjalankan test kode karena perubahan ini hanya dokumentasi.

### Tindak lanjut yang saat itu direncanakan

- Saat Tahap 0 dimulai, definisikan kontrak simulasi, pemilik review/konfirmasi rollout, serta role dan audit yang diperlukan untuk pemisahan tugas refund di `docs/business-rules.md`.

## Implementasi dimulai

- Menambahkan §13.13 pada `docs/business-rules.md` sebagai aturan normatif untuk status/lifecycle, tanggal WIB, role, akses Parent, renewal, harga, payment, koreksi, idempotency, audit, UI, dan release gates keuangan.
- Konflik akses screening diselesaikan: profil dan hasil screening milik akun Parent tetap account-scoped dan tidak dikunci oleh status subscription tenant.
- Production release gates tetap eksplisit: batas maksimum nominal dan sign-off pajak/retensi/refund belum dapat dianggap terpenuhi hanya oleh implementasi teknis.
- Perubahan kode setelah aturan normatif ini mengikuti matriks pada §13.13 dan acceptance criteria plan utama.

## Implementasi kode 14 Oktober 2026

- Menambahkan status `GRACE`, konfigurasi grace per tenant, evaluasi lifecycle WIB yang read-only, snapshot periode/harga pembayaran, dan batas unik payment per periode; akses grace ditambahkan hanya pada endpoint operasional yang di-allowlist, sedangkan onboarding/enrollment baru tetap ditutup.
- Menambahkan audit subscription untuk perubahan grace/status/harga, pembuatan renewal, verifikasi dan pembatalan payment; detail Platform Admin menampilkan timeline audit terpaginasikan dan snapshot periode pembayaran.
- Renewal Platform Admin memerlukan `Idempotency-Key` UUID, mengunci subscription saat membuat payment, replay key/payload yang sama tanpa payment baru, serta menolak payload berbeda dengan HTTP conflict.
- Constraint database untuk mencegah lebih dari satu payment non-VOID pada subscription/periode yang sama berlaku terlepas dari idempotency key; lifecycle juga memastikan status `SUSPENDED` tetap menang atas periode berbayar yang dijadwalkan sampai Platform Admin mengaktifkan kembali.
- Jika payment baru dikonfirmasi setelah grace berakhir, snapshot periode invoice tidak ditimpa; API menyimpan dan UI membedakan periode coverage aktual yang dimulai pada tanggal konfirmasi WIB.
- Perubahan paket/harga memerlukan alasan dan dicatat sebagai audit. Label dan form grace/status tersedia melalui i18n seluruh locale aplikasi.
- Nominal tagihan baru/change divalidasi server terhadap `TENANT_SUBSCRIPTION_MAX_PAYMENT_AMOUNT`; nilai kosong atau bukan IDR bulat positif menolak transaksi dengan fail-closed behavior. Batas produksi harus ditetapkan fungsi keuangan.
- Pada checkpoint awal implementasi, pembayaran SaaS belum siap produksi dan sejumlah bagian belum dibuat. Perkembangan kode sesudah checkpoint ini dicatat pada bagian lanjutan di bawah; release gate finance tetap berlaku.

## Kelanjutan kontrol rollout grace

- Lifecycle `GRACE` kini dikendalikan `TENANT_SUBSCRIPTION_GRACE_ENABLED` yang default-nya `false`; preview dapat menghitung status usulan grace tanpa mengaktifkan perubahan akses.
- Endpoint Platform Admin `GET /api/v1/platform/tenant-subscription/grace-rollout-preview?page=&size=` mengembalikan ringkasan status saat ini/usulan, jumlah terdampak, token snapshot, serta daftar terdampak terpaginasikan. Implementasi hanya membaca subscription dan tenant; tidak menulis state, payment, audit, atau notifikasi.
- Preview memakai token berdasarkan versi dan field lifecycle subscription agar perubahan sumber terdeteksi; operator harus membuat preview baru bila token berubah sebelum rollout.
- Aturan normatif, plan, `.env.example`, dan README menjelaskan default aman dan gate aktivasi.
- UI Platform Admin untuk membuka/meninjau preview telah tersedia dari daftar tenant, dengan ringkasan status, snapshot token, dan pagination daftar tenant terdampak. Simulasi ini belum membuktikan kelengkapan acceptance matrix dan bukan persetujuan finance.

## Verifikasi kode

- `./apps/api/gradlew -p apps/api test --no-daemon` lulus pada validasi akhir sesi ini, termasuk tes status efektif, preview read-only, format invoice, serta self-service Staff Admin.
- `pnpm verify` lulus pada validasi akhir sesi ini: lint, typecheck, dan test seluruh workspace; 223 test aplikasi mobile, 62 test API client, 30 test UI, dan 9 test core lulus.
- `git diff --check` lulus.
- Migrasi V28 belum diterapkan ke database lokal/production dalam sesi ini; validasi yang dilakukan tidak mencakup eksekusi migrasi terhadap database nyata.

## Status implementasi dan release gate

- Implementasi sesi ini mencakup sebagian Tahap 0–3: kontrak business rules, model/migrasi grace, audit, invoice-period dan actual-coverage snapshots, lifecycle read-only, allowlist akses grace, renewal Platform Admin ber-idempotency, kontrol nominal fail-closed, serta UI detail Platform Admin untuk grace/status/alasan/audit dan pembedaan periode aktual bila konfirmasi terlambat.
- Pada checkpoint historis bagian ini, pencarian/filter/pagination daftar tenant dan preview rollout grace masih mengumpulkan kandidat di memori, sedangkan reminder, bukti, dan koreksi belum diimplementasikan. Perubahan lanjutan di bawah menutup sebagian besar gap kode tersebut. Acceptance/E2E matrix lintas seluruh role/status dan kesiapan produksi tetap menjadi pekerjaan terpisah.
- Release tetap memerlukan konfigurasi batas nominal yang disetujui finance, keputusan retensi dan storage bukti privat, sign-off pajak/invoice, serta validasi migrasi dan rollout read-only. Jangan menganggap lulus unit/frontend tests sebagai bukti kesiapan transaksi produksi.

## Kelanjutan implementasi kode: daftar Platform Admin

- Ditambahkan `GET /api/v1/platform/tenants/page` untuk pencarian tenant, filter status subscription efektif WIB, filter institution type, pagination (maksimum 50 tenant per halaman), total hasil, dan ringkasan status yang mengikuti filter pencarian/jenis lembaga.
- Layar `platform-tenants.tsx` kini mengirim semua filter ke API, menampilkan jumlah per status, navigasi halaman, dan kembali ke halaman pertama setelah filter berubah. Endpoint lama `GET /platform/tenants` tetap ada untuk pemanggil lain.
- Validasi terkait: test `PlatformAdministrationServiceTest` lulus dan `pnpm verify` lulus (lint, typecheck, serta test seluruh workspace). Implementasi paging memotong payload/UI per halaman, namun backend saat ini masih mengumpulkan kandidat organisasi sebelum filtering/pagination; query database belum dioptimalkan untuk skala tenant besar.
- Ini belum menyelesaikan Tahap 4/5: reminder/outbox, upload bukti privat, review/koreksi, dan refund tetap belum selesai. Fitur bukti/refund tetap menunggu keputusan retensi/storage dan sign-off operasional/keuangan sebagaimana gate di atas.

## Kelanjutan implementasi kode: invoice dan self-service Staff Admin

- Nomor invoice Tenant SaaS kini mengikuti `UE-SUB-YYYYMM-000001`. Counter per bulan dialokasikan atomik melalui PostgreSQL, invoice lama diberi nomor legacy terpisah, dan fungsi format memvalidasi periode serta batas urutan. Nomor Parent tetap berada pada seri dan billing terpisah.
- Aturan normatif §13.13 diselaraskan dengan format invoice yang sudah ditetapkan di plan utama; tidak mengubah seri invoice Parent.
- Renewal dipindah ke `TenantSubscriptionRenewalService`, dipakai bersama Platform Admin dan Staff Admin. Validasi harga server, lock subscription, idempotency key/payload, larangan invoice pending ganda, periode/due date WIB, invoice sequence, dan audit tetap berada pada satu implementasi.
- API `GET /api/v1/tenant-subscription/self` dan `POST /api/v1/tenant-subscription/self/renew` hanya menerima Staff Admin aktif pada organisasi dari `X-Organization-Id`; self-service ini tetap diizinkan saat tenant dibatasi subscription. Response hanya memuat identitas/status/periode/harga tenant itu dan riwayat invoice SaaS.
- Ditambahkan layar Langganan lembaga pada menu Staff Admin, konfirmasi sebelum request, retry memakai idempotency key yang sama dan disimpan per tenant (SecureStore pada native, localStorage pada web), riwayat invoice, serta terjemahan 7 locale. Endpoint request tidak menerima harga dari client.
- Pada checkpoint awal bagian ini Tahap 5 belum lengkap; implementasi lanjutannya kini tercatat pada bagian bukti, koreksi, dan reminder di bawah. UI tidak menyatakan request renewal sebagai pembayaran lunas.

## Kelanjutan implementasi kode: bukti, koreksi, dan reminder

- Staff Admin kini dapat membaca instruksi pembayaran dari konfigurasi server, mengunggah bukti PDF/JPG/PNG maksimal 2 MB dengan versi immutable, melihat status, dan mengajukan koreksi pembayaran. Kunci idempotensi upload/koreksi disimpan per aksi dan tenant.
- Bukti tersimpan sebagai data biner privat di database; akses konten memeriksa Platform Admin atau Staff Admin tenant pemilik, dan akses dicatat. Antrean Platform Admin dapat melihat bukti secara terautentikasi dan menerima/menolak dengan alasan; penerimaan mengonfirmasi payment melalui jalur lifecycle yang sama.
- Koreksi membutuhkan keputusan Platform Admin beralasan dan membuat adjustment ledger tanpa menimpa payment asal, mengubah coverage, melakukan offset otomatis, atau mengeksekusi refund. Kedua fitur tetap default-off (`TENANT_SUBSCRIPTION_PAYMENT_PROOF_ENABLED=false`, `TENANT_SUBSCRIPTION_CORRECTION_ENABLED=false`) sampai release gates dipenuhi.
- Reminder dijalankan pukul 00:10 WIB untuk H-7/H-3/H-1 terhadap akhir trial, periode aktif/grace, dan due date payment pending. Event key deterministik dan unique constraint mencegah duplikasi lintas instance; inbox Staff Admin dibuat dalam transaksi yang sama, sementara Platform Admin membaca daftar paginated khusus yang role-gated dan menerima sinyal realtime untuk refresh.
- Query reminder kini dibatasi di database ke tanggal target H-7/H-3/H-1: trial berdasarkan tanggal akhir trial, status ACTIVE/GRACE berdasarkan `coalesce(next_period_end, period_end)`, dan payment PENDING berdasarkan due date. Job tidak lagi memuat seluruh langganan untuk menyaringnya di memori.
- Jalur ini belum memiliki retry/outbox eksternal atau status delivery kanal eksternal; isi reminder Staff Admin juga belum dilokalkan sesuai preferensi pengguna. Ini adalah gap implementasi Tahap 4, bukan alasan untuk membuka push Parent.
- Migrasi V29–V31 dibuat namun tidak dijalankan pada database. Storage bukti memerlukan review enkripsi operasional, pemindaian malware, retensi, legal hold, dan sign-off privasi/keuangan sebelum flag upload dinyalakan.

## Verifikasi checkpoint kode

- `./apps/api/gradlew -p apps/api test --no-daemon` lulus; tes baru mencakup deduplikasi reminder H-7/H-3/H-1 dan idempotency renewal yang terikat aktor.
- `pnpm verify` lulus untuk lint, typecheck, dan test seluruh workspace; API client 63 test dan mobile 224 test lulus.
- Setelah perubahan akhir pada invalidasi realtime reminder, kedua tes backend terkait dijalankan ulang dan lulus; `git diff --check` juga lulus.
- Setelah query reminder dipersempit ke tanggal target di database, tes reminder dan renewal dijalankan ulang dan lulus; tes memastikan jalur reminder tidak membaca seluruh tabel subscription.
- Tidak menjalankan Flyway terhadap database lokal/production, UI test browser, atau test device pada checkpoint ini.

## Verifikasi tambahan

- Backend penuh: `./apps/api/gradlew -p apps/api test --no-daemon` lulus setelah ekstraksi renewal dan endpoint self-service. Migrasi belum dijalankan terhadap database lokal.
- Frontend: `pnpm --filter @daycare/app typecheck` lulus; API client tests lulus (62 test), termasuk pengecekan header tenant aktif dan idempotency key self-service.
- Pemeriksaan akhir `pnpm verify`, backend test, dan `git diff --check` lulus pada sesi ini. Migrasi V28 tetap belum diterapkan ke database.
