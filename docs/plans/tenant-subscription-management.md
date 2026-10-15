// Mories Deo Hutapea,S.E.,S.Kom

# Rencana Pengelolaan Langganan Tenant

Dokumen ini adalah rencana produk dan implementasi bertahap untuk langganan tenant (lembaga) pada platform Usia Emas. Keputusan normatif yang sudah disepakati dicatat pada §13.13 `docs/business-rules.md`. **Implementasi hanya boleh dianggap selesai bila aturan normatif, kode, test, dan flow UI/API konsisten.** Jika kebutuhan implementasi menemukan keputusan baru atau konflik dengan aturan normatif, hentikan bagian yang terdampak, perbarui dan tinjau `docs/business-rules.md`, lalu lanjutkan berdasarkan aturan terbaru.

**Status implementasi (14 Oktober 2026):** Kode Tahap 0–5 telah tersedia sebagian: lifecycle/grace dengan rollout default-off, allowlist akses, audit, snapshot pembayaran/invoice sequence, renewal idempoten, self-service Staff Admin, instruksi pembayaran dari konfigurasi server, bukti privat ber-versi dan antrean review, pengajuan/approval koreksi, serta reminder H-7/H-3/H-1 dengan deduplikasi database dan halaman Platform Admin. Upload bukti dan koreksi tetap default-off. Ini belum production-ready: migrasi V28–V31 belum dijalankan/diuji pada DB nyata, storage bukti belum memiliki sign-off retensi/keamanan termasuk malware scanning dan enkripsi operasional, belum ada mekanisme refund, dan acceptance/access/E2E matrix serta pemantauan pengiriman reminder masih perlu ditutup. Baca status dan validasi terbaru di catatan implementasi harian.

**Kontrol rollout grace:** Grace runtime harus tetap nonaktif secara default (`TENANT_SUBSCRIPTION_GRACE_ENABLED=false`). Preview read-only harus tersedia dan ditinjau sebelum flag diaktifkan; preview ulang bila token snapshot berubah. Flag ini bukan pengganti acceptance matrix atau persetujuan finance.

**Status lanjutan (15 Oktober 2026):** Command billing Parent untuk pembelian paket dan upload bukti kini memakai ledger idempotency persisten yang berbeda dari SaaS tenant, replay resource terikat tenant/aktor/operasi, konflik payload, penyimpanan key stabil di mobile, serta row lock saat transisi invoice/bukti. Migration V33 belum dijalankan. Verifikasi tercatat di [catatan harian](../changes/2026-10-15/parent-billing-idempotency.md); ini belum menutup constraint bisnis lintas-key maupun gate rilis SaaS.

## 1. Tujuan dan batas cakupan

Pengelolaan langganan harus membantu Platform Admin mengetahui tenant mana yang sedang trial, aktif, menunggu pembayaran, ditangguhkan, atau kedaluwarsa; mengambil tindakan yang tepat; menjaga jejak perubahan; dan menghindari tenant kehilangan data atau akses Parent secara tidak sengaja.

Fitur ini mengelola biaya SaaS yang dibayar lembaga kepada platform. Fitur ini **bukan** invoice Parent, biaya sekolah/daycare, tagihan kelas, entitlement layanan anak, atau pembayaran booking. Data dan alur tersebut tetap terpisah.

Tujuan produk:

- Status, paket, periode, dan pembayaran langganan mempunyai arti yang konsisten di UI, API, dan aturan akses.
- Platform Admin dapat memantau pekerjaan yang perlu dilakukan tanpa mencari satu per satu tenant.
- Setiap tindakan sensitif dapat ditelusuri ke aktor dan waktunya.
- Tenant yang dibatasi tetap mengikuti allowlist akses yang sudah ditetapkan di `docs/business-rules.md`; pengelolaan billing tidak boleh membuka data lintas tenant atau menghapus data operasional.
- Pengembangan dilakukan bertahap: visibilitas dahulu, lalu lifecycle/transaksi dan audit/notifikasi; self-service renewal/bukti bayar untuk Staff Admin sudah menjadi target, sedangkan reporting tetap opsional.

Bukan tujuan tahap awal: integrasi payment gateway, auto-charge, penghapusan tenant/data saat tidak membayar, perubahan paket otomatis, atau pengiriman notifikasi kepada Parent tentang tagihan SaaS tenant.

## 2. Prinsip domain dan keselamatan

1. **Tenant adalah unit langganan.** Satu langganan berlaku untuk satu organisasi/tenant, bukan per anak, cabang, Parent, atau staff.
2. **Subscription tenant berbeda dari tagihan Parent.** Jangan memakai ulang invoice/entitlement Parent untuk menagih biaya SaaS.
3. **Server adalah sumber kebenaran.** Client tidak menentukan status aktif, tanggal kedaluwarsa, jumlah yang harus dibayar, atau hak akses berdasarkan jam perangkat.
4. **Akses berasal dari status langganan yang telah divalidasi server.** Kartu/label UI bukan kontrol keamanan. Endpoint tenant tetap melakukan validasi autentikasi, membership, capability, dan status subscription.
5. **Semua billing memakai idempotency.** Mekanisme idempotency server menjadi standar lintas domain untuk billing langganan tenant SaaS dan billing Parent. Pengulangan key dan payload sama mengembalikan hasil operasi pertama, sedangkan key sama dengan payload berbeda ditolak. Setiap domain tetap memiliki constraint bisnis uniknya sendiri (misalnya tenant + subscription + periode atau Parent + invoice/entitlement); jangan menyatukan record atau aturan billing yang berbeda. Retry jaringan, double tap, multi-tab, atau dua aktor tidak boleh membuat invoice/payment ganda atau status bertentangan.
6. **Tidak ada penghapusan data operasional akibat subscription.** Pembatasan tidak menghapus anak, catatan, invoice, akun, atau riwayat tenant.
7. **Tidak ada diagnosis akses dengan menebak status.** Jika subscription tidak ditemukan atau datanya tidak konsisten, akses sensitif gagal tertutup dan masalah terlihat untuk Platform Admin; exception keselamatan hanya yang secara eksplisit diizinkan business rules/server.
8. **Perubahan komersial memiliki audit.** Nilai lama dan baru, aktor, waktu, alasan, dan referensi pembayaran (bila ada) disimpan sebagai riwayat; jangan hanya menimpa nilai tanpa jejak.
9. **Istilah UI menjelaskan tindakan.** “Tandai pembayaran diterima” harus dibedakan dari “aktifkan manual”; jangan membuat keduanya terlihat setara.
10. **Kebijakan grace dapat berbeda per tenant.** Durasi bukan konstanta global di UI/client; nilai tenant disimpan dan dibaca server, diubah oleh Platform Admin sesuai izin, serta tercatat di audit.

## 3. Kondisi sistem saat ini

Rincian berikut adalah baseline yang ditemukan di model dan `PlatformAdministrationService`; sebelum implementasi, verifikasi kembali terhadap branch dan migrasi aktif.

| Area | Kondisi saat ini |
|---|---|
| Paket/status | Paket `STARTER`, `STANDARD`, `PREMIUM`; status `TRIAL`, `PENDING_PAYMENT`, `ACTIVE`, `SUSPENDED`, `EXPIRED`. |
| Data | Ada satu `TenantSubscription` per organisasi dengan paket, status, tanggal periode, tanggal akhir trial, dan biaya bulanan. Riwayat pembayaran disimpan terpisah sebagai `TenantPayment` dengan jumlah, status, jatuh tempo, serta waktu pembayaran. |
| Buat tenant | Wizard Platform Admin dapat memilih paket dan trial 1–12 bulan, atau biaya bulanan tanpa trial. Tenant, cabang utama, subscription/payment awal, aktivitas bawaan, dan Staff Admin utama dibuat dalam satu submit. |
| Pengelolaan tenant | Halaman daftar/detail Platform Admin menampilkan informasi subscription dan pembayaran; tersedia pengubahan paket/biaya, perpanjangan, ubah status aktif/tangguh, tandai pembayaran lunas, dan void pembayaran pending. |
| Perpanjangan | Saat ini perpanjangan menolak subscription ACTIVE yang periodenya masih berjalan; periode baru dimulai hari ini dan pembayaran baru dibuat. Pembayaran pending sebelumnya di-void. Perilaku ini perlu ditinjau karena dapat mendorong admin menunggu sampai tenant kedaluwarsa. |
| Status otomatis | Pembacaan detail tenant dapat mengubah TRIAL yang berakhir menjadi `PENDING_PAYMENT`, dan ACTIVE yang periodenya lewat menjadi `EXPIRED`. Batas tanggal dan cara mutasi saat read perlu dikonsolidasikan menjadi aturan lifecycle yang eksplisit dan dapat diuji. |
| Akses Parent | Katalog enrollment hanya menampilkan tenant `ACTIVE`/`TRIAL` yang memenuhi capability. Aturan restricted access Parent untuk invoice milik sendiri dan daftar anak read-only adalah exception terkontrol di `docs/business-rules.md`; jangan memperluasnya secara implisit. |
| Audit dan pengingat | Belum menjadi bagian memadai dari model subscription saat ini: perubahan paket/biaya/status dan alasan tindakan tidak memiliki ledger audit subscription yang lengkap; belum ada pusat pengingat lifecycle yang dapat diandalkan. |
| Konfigurasi grace per tenant | Belum ada status `GRACE` atau konfigurasi durasi grace per tenant. |

**Catatan kesesuaian:** `docs/business-rules.md` adalah sumber aturan. Jika rincian implementasi di atas berbeda dari dokumen tersebut, catat sebagai gap dan selesaikan melalui perubahan aturan bisnis yang ditinjau sebelum mengubah kode.

## 4. Pengguna, izin, dan pengalaman yang diinginkan

### Platform Admin

- Melihat semua tenant dan ringkasan status langganan.
- Membuka detail tenant, melihat paket, tanggal, pembayaran, dan audit.
- Mengubah paket/biaya, membuat atau membatalkan pembayaran, merekam pembayaran diterima, menangguhkan, serta mengaktifkan kembali hanya sesuai transisi yang disahkan.
- Wajib melihat dampak akses sebelum tindakan yang mengubah status; alasan diwajibkan untuk tindakan korektif/manual.
- Tidak boleh menghapus pembayaran atau audit; koreksi dicatat sebagai tindakan baru.

### Staff Admin tenant

Staff Admin tenant boleh melihat langganan tenantnya sendiri, mengajukan renewal, mengirim bukti pembayaran, dan mengajukan koreksi atas payment tenantnya. Staff Admin tidak dapat mengubah paket/harga kontraktual, mengubah status subscription, memverifikasi pembayaran, menandai lunas, menyetujui koreksi, atau mengakses tenant lain. Bukti yang dikirim berstatus menunggu verifikasi Platform Admin; upload sukses tidak sama dengan pembayaran diterima dan tidak mengubah hak akses. Koreksi juga tidak mengubah payment sampai disetujui Platform Admin.

### Parent dan staff non-admin

Tidak mengelola langganan SaaS. Parent tidak melihat harga kontraktual atau tindakan Platform Admin. Saat tenant dibatasi, Parent hanya mendapat rute/data yang secara eksplisit diizinkan server dan business rules; jangan mengubah restriction menjadi bypass umum.

## 5. Informasi dan interaksi UI

### Daftar langganan Platform Admin

Menyediakan pencarian nama tenant dan filter status/paket, urutan berdasarkan yang paling perlu ditangani, pagination server-side, serta ringkasan status. Setiap baris/kartu sekurangnya memperlihatkan:

- nama tenant dan cabang utama (bila relevan untuk identifikasi, bukan unit billing);
- paket dan status dengan label teks, bukan warna saja;
- akhir trial atau periode aktif;
- pembayaran pending terdekat: nilai dan jatuh tempo;
- kontak operasional yang memang tersedia dan boleh ditampilkan;
- indikator tindakan berikutnya, misalnya “perlu tindak lanjut pembayaran”, yang diturunkan dari data server.

Kelompok dashboard yang disarankan: **Perlu ditangani** (trial hampir habis, pembayaran menunggu, atau status perlu konfirmasi), **Aktif**, dan **Dibatasi/kedaluwarsa**. Angka ringkasan harus memakai query server yang konsisten dengan daftar, bukan hitung dari halaman yang sedang dimuat saja.

### Detail subscription tenant

Pisahkan informasi berikut agar mudah dipindai:

1. status dan ringkasan dampak akses;
2. paket, biaya, tanggal mulai/akhir periode, tanggal akhir trial;
3. pembayaran dengan status, jumlah, jatuh tempo, waktu dibayar, dan referensi bila didukung;
4. riwayat perubahan subscription dan tindakan admin;
5. tindakan yang tersedia sesuai status, izin, dan validasi server.

Setiap aksi destruktif atau finansial memakai dialog konfirmasi yang menyebut tenant, nilai/tanggal, dan akibatnya. Kegagalan harus mempertahankan konteks dan menampilkan alasan API yang aman; jangan memberi kesan sukses optimistis.

Semua teks baru harus tersedia dalam bahasa Indonesia dan Inggris mengikuti i18n aplikasi. Tampilan web/mobile harus dapat dioperasikan dengan keyboard/screen reader dan tidak mengandalkan warna saja.

### Flow UI khusus konfigurasi masa tenggang per tenant

Tujuannya agar Platform Admin dapat memahami dan mengubah kebijakan satu tenant tanpa tertukar dengan tanggal periode aktif atau langsung mengubah status akses.

#### A. Tenant yang sudah ada

1. Platform Admin membuka **Langganan** dari navigasi platform, lalu mencari tenant atau memakai filter “Perlu ditangani”.
2. Kartu tenant menampilkan nama, status langganan, tanggal akhir periode, serta ringkasan “Masa tenggang: N hari” atau “Tanpa masa tenggang”. Jika tenant sedang `GRACE`, tampilkan pula tanggal akhir grace dan sisa hari dari data server.
3. Admin membuka detail tenant. Pada bagian **Periode & masa tenggang**, tampilkan terpisah:
   - periode langganan yang sudah dibayar dan tanggal akhirnya;
   - konfigurasi masa tenggang tenant;
   - status lifecycle saat ini dan tanggal akhir grace jika sedang berlaku;
   - penjelasan singkat bahwa mengubah konfigurasi tidak mengubah grace yang sedang berjalan.
4. Admin menekan **Ubah masa tenggang**. Form menampilkan nilai saat ini, input jumlah hari, unit “hari kalender”, nilai batas yang diperbolehkan, dan pilihan cepat yang nilainya berasal dari konfigurasi kebijakan—bukan konstanta tersebar di UI.
5. Untuk nilai `0`, UI menjelaskan secara eksplisit bahwa tenant tidak mendapat masa tenggang dan akan mengikuti transisi langsung setelah periode berakhir. Nilai kosong, negatif, non-integer, atau di luar batas ditolak sebelum submit dan tetap divalidasi ulang oleh server.
6. Saat nilai berubah, tampilkan preview yang tidak ambigu: “Nilai baru: N hari; berlaku mulai periode langganan berikutnya; masa tenggang yang sedang berjalan tidak berubah.” Jika tenant belum berada dalam periode aktif, preview harus menjelaskan kapan nilai mulai berlaku sesuai aturan lifecycle yang disahkan.
7. Admin menekan **Simpan**. Dialog konfirmasi menyebut nama tenant, nilai lama → nilai baru, tanggal efektif, dan dampak nilai nol bila dipilih. Admin mengisi alasan perubahan jika aturan audit mewajibkannya, lalu mengonfirmasi.
8. UI menunggu respons server. Setelah sukses, tutup dialog, muat ulang detail dari server, tampilkan konfirmasi, dan perbarui kartu/list bila terbuka. Jangan mengubah status atau tanggal akhir grace secara optimistis di client.
9. Jika gagal karena nilai/status berubah bersamaan, tampilkan konflik dan data terbaru dengan pilihan meninjau ulang. Jika koneksi terputus atau hasil request tidak diketahui, jangan kirim ulang otomatis; refresh state dahulu untuk mencegah perubahan ganda.

#### B. Tenant baru

- Pada langkah **Paket dan langganan** di wizard tambah tenant, tampilkan konfigurasi masa tenggang setelah pilihan paket dan trial/pembayaran.
- Nilai awal berasal dari kebijakan default platform yang disetujui; Platform Admin boleh menyesuaikannya untuk tenant baru. Tampilkan unit, rentang sah, arti `0`, dan ringkasan tanggal efektif.
- Tinjauan akhir wizard memperlihatkan nilai masa tenggang yang akan disimpan. Nilai tersebut dibuat atomik bersama subscription tenant; kegagalan submit tidak boleh membuat konfigurasi terpisah atau tenant setengah jadi.
- Untuk tenant yang sudah ada saat fitur dirilis, tampilkan status “Konfigurasi perlu ditinjau” sampai nilai per-tenant diisi/backfill. Jangan menerapkan angka default tersembunyi yang dapat mengubah hak akses.

#### C. Aturan presentasi dan izin

- Kontrol edit konfigurasi grace/paket/harga hanya muncul untuk Platform Admin dengan capability yang sesuai. Staff Admin tenant dapat melakukan flow renewal/bukti bayar pada §5.F untuk tenant sendiri; Parent dan staff lain tidak mendapat akses. Tidak ada endpoint tulis yang mengandalkan kontrol UI.
- Bedakan label konfigurasi (“Masa tenggang: 7 hari”) dari status aktual (“Status: GRACE; berakhir 20 Okt”). Jangan memakai badge status saja untuk menjelaskan sisa waktu.
- Saat konfigurasi belum tersedia, jangan tampilkan `0 hari` seolah-olah sudah dipilih; tampilkan “Belum dikonfigurasi” dan cegah lifecycle `GRACE` berjalan untuk tenant itu sampai kebijakan diisi.
- Tanggal preview dihitung oleh server atau memakai aturan zona waktu/tanggal bisnis yang sama; client tidak boleh menghitung batas otorisasi dengan jam lokal.
- Aksi pengaturan tidak menandai pembayaran lunas, memperpanjang periode, mengubah paket/harga, atau mengaktifkan tenant. Masing-masing tetap aksi terpisah dengan konfirmasi sendiri.

#### D. Flow renewal sebelum periode berakhir

1. Pada detail tenant berstatus `ACTIVE`, Platform Admin berizin dapat memilih **Perpanjang langganan** sebelum tanggal akhir periode. Aksi tidak menunggu tenant berubah menjadi `EXPIRED`.
2. Form renewal menampilkan periode aktif saat ini dan periode tambahan yang akan dibeli. Tanggal mulai periode tambahan adalah hari setelah tanggal akhir periode aktif, walaupun renewal dilakukan lebih awal.
3. Sebelum konfirmasi, tampilkan paket/biaya dan status payment yang akan dibuat. Jika pembayaran diterima sebelum periode lama berakhir, tampilkan bahwa akses aktif tidak terputus dan tanggal akhir periode bertambah sesuai periode tambahan; tanggal mulai periode aktif tidak diganti menjadi tanggal renewal.
4. Setelah dikonfirmasi, server membuat payment untuk periode tambahan secara idempoten. UI menampilkan instruksi/status pembayaran dan tanggal periode dengan label jelas; pembuatan renewal sendiri tidak boleh ditampilkan sebagai pembayaran lunas.
5. Jika pembayaran belum diterima sampai periode berjalan berakhir, jalankan kebijakan `GRACE` sesuai durasi tenant. Perlakuan bila pembayaran baru masuk setelah periode berakhir mengikuti keputusan lifecycle terlambat pada §12.4, bukan kalkulasi client.
6. Jika server menolak karena ada payment/renewal yang sudah dibuat atau state berubah bersamaan, UI memuat ulang data lalu meminta admin meninjau ulang; jangan membuat payment kedua otomatis.

#### E. Flow perubahan paket/harga

1. Platform Admin membuka pengaturan paket/harga tenant atau katalog paket yang berwenang dikelola, lalu memilih perubahan yang akan ditawarkan.
2. Form menjelaskan bahwa ketentuan baru berlaku untuk renewal yang dibuat setelah perubahan disimpan; paket/harga pada periode yang sudah dibeli tetap berlaku sampai tanggal akhir periode tersebut.
3. Sebelum menyimpan, tampilkan ringkasan nilai lama dan baru, cakupan tenant (satu tenant atau seluruh paket, sesuai fitur yang dipilih), waktu efektif, serta dampak pada payment renewal yang sudah terbit.
4. Setelah disimpan, detail tenant menampilkan **Ketentuan periode berjalan** terpisah dari **Ketentuan renewal berikutnya**. Jika belum ada perubahan, keduanya dapat ditampilkan sama tanpa duplikasi visual.
5. Saat renewal dibuat, server mengambil ketentuan terbaru yang berlaku dan menyimpan snapshot paket/harga untuk periode dan payment tersebut. UI meminta konfirmasi nilai baru sebelum membuat payment.
6. Perubahan harga setelah payment renewal dibuat tidak mengubah payment pending yang sudah memiliki snapshot. Jika perlu mengganti nominal, admin harus membatalkan/void payment lama dengan audit, lalu membuat renewal/payment baru sesuai aturan.

#### F. Flow renewal dan bukti pembayaran oleh Staff Admin tenant

1. Staff Admin membuka **Langganan** dari menu tenant. Server menentukan organization dari membership aktif; UI tidak mengirim organization ID bebas sebagai otorisasi. Staff Admin hanya melihat data tenant yang menjadi scope membership-nya.
2. Halaman menampilkan status/periode berjalan, paket/harga yang telah dibeli, harga/periode renewal berikutnya yang berlaku, instruksi pembayaran, dan status bukti terakhir.
3. Staff Admin menekan **Ajukan renewal**. Ringkasan menunjukkan paket/harga terbaru, periode tambahan yang dimulai setelah akhir periode berjalan, nominal, jatuh tempo, dan konsekuensi jika pembayaran terlambat. Staff Admin mengonfirmasi sebelum payment dibuat.
4. Server membuat permintaan/payment renewal secara idempoten dan mengikatnya ke tenant serta periode tertentu. Retry atau double tap tidak membuat payment kedua. UI memakai key yang sama untuk retry satu aksi; key baru hanya untuk renewal baru yang dikonfirmasi pengguna.
5. Untuk payment `PENDING`, Staff Admin dapat mengunggah bukti bayar PDF/JPG/PNG maksimal **2 MB per file** dan mengaitkannya dengan payment tersebut. UI menjelaskan batas file, menyatakan bukti akan diperiksa Platform Admin, dan menampilkan waktu upload serta status “Menunggu verifikasi”.
6. Pengiriman bukti tidak mengubah status payment menjadi `PAID`, tidak memperpanjang periode, dan tidak membuka akses. Platform Admin meninjau bukti di antrean verifikasi lalu menerima atau menolak dengan alasan. Keputusan tersebut membuat audit event; penerimaan mengubah payment/subscription secara atomik sesuai aturan periode, penolakan mempertahankan payment belum lunas dan memberi Staff Admin alasan serta cara mengirim ulang bila diizinkan.
7. Staff Admin dapat melihat status, alasan penolakan, atau unggah ulang bukti sesuai batas kebijakan. Bukti lama tidak ditimpa/hapus tanpa jejak; akses unduh dibatasi untuk Platform Admin berizin dan Staff Admin tenant pemilik.
8. Ketika subscription `GRACE`, `EXPIRED`, atau `SUSPENDED`, halaman self-service tetap tersedia sebagai jalur informasi/penyelesaian billing, tetapi tidak menjadi bypass endpoint operasional. Batas akses serta tindakan yang diizinkan harus diberikan eksplisit di server.

#### G. Flow verifikasi pembayaran oleh Platform Admin

1. Platform Admin membuka antrean **Perlu verifikasi**, berisi payment SaaS dengan bukti baru atau status review yang perlu ditindaklanjuti. Antrean menunjukkan tenant, periode, nominal yang diharapkan, waktu unggah, dan status subscription tanpa membuka data yang tidak relevan.
2. Admin membuka item dan membandingkan detail payment dengan bukti privat yang diunggah. UI menampilkan preview aman, tenant/periode terkait, nominal, dan riwayat bukti; akses file dicatat dan dibatasi.
3. Admin memilih **Terima pembayaran** atau **Tolak bukti**. Sebelum menerima, tampilkan dampak: payment menjadi `PAID`, aktor/waktu tercatat, serta periode/status subscription yang terdampak. Sebelum menolak, alasan wajib diisi agar Staff Admin dapat memperbaiki pengajuan.
4. Konfirmasi dilakukan server-side secara atomik setelah memvalidasi payment masih `PENDING`, bukti milik tenant/payment yang tepat, dan actor memiliki izin Platform Admin. Double submit atau payment yang telah diproses ditolak/idempoten; UI memuat ulang status.
5. Setelah sukses, antrean dan detail tenant diperbarui dari response server. Penolakan tidak mengubah payment menjadi `PAID`; Staff Admin melihat alasan dan dapat mengirim ulang bukti sesuai policy.

#### H. Flow pengajuan koreksi pembayaran

1. Staff Admin tenant membuka riwayat payment tenant sendiri dan memilih **Ajukan koreksi** pada payment yang perlu diperiksa. Aksi tidak tersedia untuk payment tenant lain atau saat ada permintaan koreksi aktif yang belum diputus.
2. Form menampilkan payment asli yang tidak dapat diedit, lalu meminta jenis masalah, penjelasan/alasan, nilai atau data yang dianggap benar bila relevan, serta bukti pendukung jika diwajibkan untuk jenis koreksi tersebut.
3. Sebelum kirim, ringkasan memperlihatkan data payment saat ini dan permintaan perubahan. UI menyatakan bahwa pengajuan belum mengubah status, nominal, periode, maupun akses sampai Platform Admin menyetujui.
4. Setelah submit, permintaan memiliki ID/status **Menunggu persetujuan Platform Admin** dan terhubung ke payment asli. Staff Admin dapat melihat status, komentar/alasan keputusan, dan timeline; pengajuan aktif tidak dapat digandakan.
5. Platform Admin membuka antrean **Koreksi pembayaran**, melihat nilai asli, usulan koreksi, alasan, bukti, dan dampak finansial/akses yang diperkirakan. Admin dapat **Setujui** atau **Tolak**; alasan keputusan wajib dicatat.
6. Persetujuan membuat adjustment/reversal event baru yang merujuk payment asli dan merekam nilai sebelum/sesudah, reviewer, waktu, dan alasan. Jangan mengedit atau menghapus payment asli/audit. Jika koreksi membutuhkan pembayaran baru, reversal, refund, atau perubahan periode, jalankan command terpisah yang policy-nya telah disahkan dan tampilkan konfirmasi dampak sebelum commit.
7. Penolakan hanya menutup permintaan koreksi dan menyimpan alasan; payment asli tetap utuh. Staff Admin melihat hasilnya dan dapat mengajukan ulang sebagai permintaan baru bila masih diizinkan.
8. Request correction dan review tetap memakai transaksi, scope tenant, audit append-only, serta idempotency/concurrency protection. Pengajuan dari Staff Admin tidak pernah menyetujui dirinya sendiri.

## 6. Model lifecycle target yang disetujui sebelum dicatat normatif

Status yang tersedia sekarang tetap menjadi baseline implementasi: `TRIAL`, `PENDING_PAYMENT`, `ACTIVE`, `SUSPENDED`, dan `EXPIRED`. Untuk target lifecycle, dokumen ini mengusulkan **satu status tambahan `GRACE`** serta konfigurasi durasinya per tenant. Status dan konfigurasi baru harus lebih dahulu disahkan dan ditambahkan ke `docs/business-rules.md`, lalu diimplementasikan konsisten pada API, model, UI, katalog Parent, serta access gate. Jangan menambah status lain seperti `PAST_DUE`, `CANCELLED`, atau `RENEWAL_PENDING` hanya demi UI tanpa keputusan bisnis terpisah.

| Kondisi | Status sekarang/target yang disarankan | Perilaku akses yang harus eksplisit |
|---|---|---|
| Periode uji coba belum berakhir | `TRIAL` | Sama dengan akses tenant operasional yang diizinkan. |
| Trial berakhir tanpa aktivasi pembayaran | `PENDING_PAYMENT` menurut baseline | Perlakukan sebagai restricted; tenant tidak ditawarkan pada katalog Parent. Renewal trial pertama tidak mendapat `GRACE`. |
| Pembayaran awal belum diterima | `PENDING_PAYMENT` | Invoice awal jatuh tempo 7 hari setelah diterbitkan (atau pada tanggal akhir trial untuk konversi trial); tidak mendapat `GRACE` dan tidak aktif hanya karena bukti/request dibuat. |
| Pembayaran diverifikasi dan periodenya berlaku | `ACTIVE` | Akses operasional sesuai plan/capability. |
| Periode berakhir tanpa pembayaran, tetapi masih dalam masa tenggang tenant | `GRACE` **(status baru yang disetujui)** | Operasi inti untuk anak yang sudah terdaftar tetap tersedia; Parent dengan anak aktif dapat melihat perawatan berjalan dan berkomunikasi. Tenant tidak tersedia untuk enrollment baru. |
| Admin menangguhkan karena alasan operasional/risiko | `SUSPENDED` | Restricted segera tanpa menunggu grace; alasan dan aktor wajib tercatat. |
| Masa tenggang habis tanpa perpanjangan yang efektif | `EXPIRED` | Restricted sesuai allowlist. Jangan menghapus atau mengubah kepemilikan data. |

Alur target renewal adalah `ACTIVE` → `GRACE` ketika periode berakhir tanpa pembayaran terkonfirmasi → `EXPIRED` setelah grace tenant habis. `periodEnd` berlaku inklusif sampai pukul **23.59.59 WIB** pada tanggal tersebut. Grace dimulai pukul **00.00 WIB** pada hari berikutnya dan berlangsung sebanyak `gracePeriodDays` hari kalender; `EXPIRED` berlaku pukul 00.00 WIB setelah hari grace terakhir. Jika nilai grace 0, tenant langsung `EXPIRED` pukul 00.00 WIB setelah `periodEnd`. Durasi dibaca dari konfigurasi tenant (`gracePeriodDays`), bukan angka yang ditanam di client. Renewal **boleh dimulai sebelum periode berakhir**, tetapi periode tambahan selalu dimulai pada hari setelah akhir periode yang sudah berjalan; tanggal permintaan renewal tidak menggeser atau mengurangi periode tambahan. Pembayaran yang diterima lebih awal dicatat untuk periode berikutnya dan tidak mengubah tanggal awal periode berjalan. Pembayaran renewal yang dikonfirmasi sebelum grace berakhir menyambung coverage; bila baru dikonfirmasi setelah grace berakhir, periode baru dimulai pada tanggal konfirmasi Platform Admin dan tidak di-backdate. `PENDING_PAYMENT` tetap untuk pembayaran awal/aktivasi yang belum selesai (tanpa grace); invoice awal non-trial jatuh tempo pada tanggal penerbitan + 7 hari kalender WIB, sementara invoice konversi trial dan renewal jatuh tempo pada tanggal akhir trial/periode; setiap tanggal jatuh tempo inklusif sampai 23.59.59 WIB. `SUSPENDED` tetap untuk penangguhan manual dan membatasi akses segera.

Konfigurasi grace bersifat per tenant dan dikelola Platform Admin, dengan rentang `0–30` hari kalender dan nilai awal 7 hari. Nilai 0 berarti tanpa grace; perubahan berlaku untuk periode berikutnya dan tidak mengubah grace yang sedang berjalan. Tenant existing diisi awal 7 hari, ditampilkan pada daftar review Platform Admin, dan dapat disesuaikan per tenant sebelum lifecycle grace diaktifkan. Semua perhitungan tanggal bisnis (akhir periode, grace, jatuh tempo, dan reminder) menggunakan zona waktu **WIB (`Asia/Jakarta`)**; timestamp audit/pembayaran disimpan sebagai instant UTC dan ditampilkan dalam WIB. Selama `GRACE`, staff dapat menjalankan operasi inti untuk anak yang sudah terdaftar (kehadiran, keselamatan/kesehatan, penjemputan, catatan perawatan, dan komunikasi yang terkait perawatan berjalan); Parent dengan anak aktif tetap dapat melihat informasi perawatan berjalan dan berkomunikasi pada konteks tersebut. Tenant tidak ditawarkan untuk enrollment Parent baru. `SUSPENDED` membatasi akses segera tanpa menunggu grace. Perubahan status dievaluasi konsisten melalui server/job atau saat otorisasi, dengan audit yang jelas.

## 7. Tahapan implementasi

Status checklist implementasi tidak menggantikan acceptance criteria di §10 dan §14; tiap tahap baru selesai setelah semua gap dan release gate tahap tersebut diverifikasi.

Urutan ini mengurangi risiko: setiap tahap memiliki hasil yang dapat diuji dan menerapkan keputusan produk yang telah disetujui, dengan prasyarat teknis/keuangan yang harus diselesaikan sebelum area terkait dirilis.

### Tahap 0 — Kunci kebijakan dan kontrak

**Tujuan:** menjadikan `docs/business-rules.md` kontrak normatif yang lengkap sebelum mengubah status, periode, transaksi, atau hak akses.

**Pekerjaan:**

- Sebagai blocker wajib, menulis seluruh keputusan produk §12 ke bagian langganan/pembayaran tenant di `docs/business-rules.md`; aturan harus menjelaskan status, tanggal, role, scope tenant, UI, API, data/audit, dan efek akses yang relevan.
- Meninjau silang `docs/business-rules.md` terhadap rencana ini dan acceptance matrix. Selesaikan perbedaan secara eksplisit sebelum kode dimulai; jangan memilih diam-diam antara plan dan business rules.
- Merinci prasyarat yang tersisa (retensi/keamanan file, aturan bukti per tipe koreksi, format invoice, review pajak, dan pemetaan akses endpoint), lalu menyiapkan acceptance matrix yang merujuk bagian business rules terkait.
- Implementasikan konfigurasi `gracePeriodDays` per tenant sesuai keputusan: default 7, batas 0–30, 0 meniadakan grace, hanya Platform Admin yang dapat mengubah, dan perubahan berlaku untuk periode berikutnya.
- Terapkan backfill 7 hari untuk tenant existing dan tampilkan daftar review Platform Admin sebelum lifecycle `GRACE` diaktifkan; jangan membiarkan nilai null menghasilkan durasi yang ditebak.
- Membuat tabel transisi status yang memuat aktor, prasyarat, efek tanggal, efek akses, pembayaran terkait, dan alasan/audit.
- Terapkan mata uang IDR, snapshot harga untuk periode yang sudah dibeli, kebijakan tanggal efektif harga baru, dan nomor invoice server yang unik serta tidak digunakan ulang. Tetapkan format nomor, aturan pembulatan/batas nominal, dan rincian invoice sebagai spesifikasi teknis; minta review fungsi keuangan atas perlakuan pajak sebelum invoice produksi.
- Terapkan batas tanggal bisnis WIB (`Asia/Jakarta`) dan penyimpanan timestamp UTC sesuai §6; tetapkan kontrak API, penyimpanan key idempotency minimal 90 hari, retry, dan respons konflik.
- Menetapkan endpoint dan DTO yang menjadi sumber data daftar/detail agar UI tidak menyimpulkan status sendiri.
- Menetapkan klasifikasi setiap jenis bukti/dokumen bersama fungsi keuangan: dokumen yang menjadi dasar pembukuan mengikuti masa simpan hukum yang berlaku; data pribadi lain tidak otomatis mendapat masa simpan yang sama. Tetapkan pemilik kebijakan, pemicu penghapusan, audit akses, penyimpanan privat, serta legal hold sebelum storage bukti dirilis.
- Mendefinisikan role/capability dan alur refund manual bersama fungsi keuangan: pengaju, Platform Admin penyetuju, dan pelaksana transfer; pengaju tidak boleh menyetujui refund sendiri, dan setiap pengecualian operasional memerlukan approval kedua serta alasan audit.
- Menetapkan akses finansial dan allowlist data Parent saat tenant `EXPIRED`, termasuk memastikan profil/hasil screening Parent-owned tetap dapat diakses sesuai business rules dan tidak ikut terkunci oleh subscription tenant.
- Menyediakan simulasi rollout lifecycle `GRACE` yang hanya membaca data dan tidak mengubah status, akses, mengirim notifikasi, atau membuat transaksi. Simulasi memperlihatkan tenant terdampak, status/tanggal yang akan berlaku, dan ringkasan perubahan akses; hasil harus ditinjau sebelum rollout, dan preview harus dibuat ulang bila data sumber berubah.
- Audit command billing Parent yang sudah ada (pembuatan invoice, pembelian entitlement/booking, upload bukti, pembatalan, verifikasi pembayaran, serta callback/retry bila ada) untuk memastikan operasi mana yang sudah idempoten dan menutup celah duplikasi tanpa mengubah semantik bisnis Parent.

**Keluaran wajib:** `docs/business-rules.md` yang diperbarui dan ditinjau, state-transition/access matrix, rancangan API/data, dan acceptance criteria yang merujuk aturan tersebut. **Tidak ada perubahan kode billing, lifecycle, UI, atau authorization sebelum keluaran ini lengkap.**

### Tahap 1 — Visibilitas dan ringkasan Platform Admin

**Tujuan:** menemukan tenant yang perlu tindakan tanpa mengubah lifecycle.

**Pekerjaan:**

- Menyempurnakan daftar langganan dengan pencarian, filter, pagination, urutan, ringkasan server, dan empty/loading/error states.
- Menampilkan nilai dan tanggal dari response backend yang sama; menambahkan label “perlu ditangani” hanya dari aturan yang disepakati.
- Mengimplementasikan alur UI konfigurasi per tenant pada §5: nilai dan tanggal terlihat di list/detail, kontrol edit hanya bagi Platform Admin berizin, preview tanggal efektif, konfirmasi/alasan, serta state konflik/error.
- Menautkan setiap kartu ke detail tenant serta menjaga perilaku responsive/mobile.
- Menambah pengujian untuk filter/pagination, role Platform Admin, dan pemisahan data tenant.

**Batas:** belum mengubah cara renewal, periode, status, pembayaran, atau access gate bekerja.

### Tahap 2 — Audit trail dan tindakan admin yang aman

**Tujuan:** membuat tindakan subscription dapat ditelusuri dan mengurangi kesalahan manual.

**Pekerjaan:**

- Tambahkan ledger audit append-only untuk perubahan paket/biaya, tindakan pembayaran, status, dan periode: tenant/subscription, jenis tindakan, aktor, timestamp server, nilai sebelum/sesudah, alasan, payment ID/referensi bila sesuai, dan correlation/idempotency key yang aman.
- Wajibkan alasan untuk suspend, reaktivasi manual, koreksi pembayaran, perubahan biaya di luar proses normal, serta override yang disetujui.
- Tampilkan timeline audit di detail; tidak ada edit/hapus audit melalui UI.
- Validasi izin pada server dan pastikan tenant role tidak bisa memanggil endpoint Platform Admin.
- Buat aksi pembayaran/status memakai transaksi DB dan optimistic/version check atau mekanisme concurrency yang baseline dukung.
- Terapkan atau gunakan mekanisme idempotency lintas billing yang sama untuk command finansial Parent yang teridentifikasi pada Tahap 0; jangan migrasikan Parent ke model subscription SaaS.

**Batas:** jangan membuat audit berisi token, password, bukti sensitif yang tidak perlu, atau data kartu pembayaran.

### Tahap 3 — Perbaiki periode, renewal, dan konsistensi pembayaran

**Tujuan:** renewal dapat diproses sebelum jatuh tempo tanpa mengakhiri akses periode yang sudah dibayar.

**Pekerjaan:**

- Terapkan tanggal/periode dan perilaku pre-expiry renewal yang disetujui pada tahap 0; periode yang sudah dibayar tidak dipotong dan periode berikutnya serta payment dihubungkan secara eksplisit.
- Terapkan aturan renewal sebelum expiry yang telah disepakati: Platform Admin dan Staff Admin tenant sesuai kewenangannya dapat memulai renewal sebelum langganan berakhir. Periode tambahan dihitung mulai hari setelah tanggal akhir periode berjalan, bukan tanggal renewal; pembayaran lebih awal tidak mengubah periode berjalan. UI harus memperlihatkan tanggal mulai dan akhir periode tambahan sebelum konfirmasi.
- Invoice renewal jatuh tempo pada akhir periode berjalan. Pembayaran yang dikonfirmasi sebelum grace habis menyambung coverage; sesudah grace habis, periode baru dimulai pada tanggal konfirmasi Platform Admin tanpa backdate.
- Kebijakan harga/paket telah diputuskan: perubahan dapat ditetapkan kapan pun; periode yang sudah dibeli tetap memakai paket dan harga lama sampai habis; renewal yang dibuat setelah perubahan memakai ketentuan baru. Simpan snapshot immutable pada periode/payment, dan jangan mengubah payment yang sudah terbit secara diam-diam.
- Pastikan satu invoice/payment pending yang valid per periode/jenis tagihan atau definisi lain yang disetujui; retry idempoten tidak menghasilkan duplikasi.
- Saat pembayaran diterima, verifikasi status pembayaran dan subscription secara atomik, rekam `paidAt` dari server dan referensi/aktor; pembayaran `VOID`/sudah `PAID` tidak dapat diproses ulang.
- Tentukan koreksi salah tandai lunas dengan reversal/adjustment audit baru, bukan menghapus record.
- Pastikan snapshot paket/harga untuk periode dan payment historis tidak berubah ketika konfigurasi harga diperbarui.
- Konsolidasikan perubahan otomatis status dari read path ke evaluator lifecycle yang dapat dipanggil aman oleh authorization dan/atau job terjadwal; hindari efek samping tak tercatat dari GET.

**Batas:** tidak menambah auto-charge atau payment gateway. Renewal dan penerimaan pembayaran tetap manual sampai alur eksternal disetujui.

### Tahap 4 — Pengingat dan antrean tindak lanjut

**Tujuan:** mengurangi subscription kedaluwarsa yang tidak diketahui admin.

**Pekerjaan:**

- Buat reminder in-app untuk Platform Admin dan Staff Admin tenant dengan lead time 7, 3, dan 1 hari sebelum akhir trial/jatuh tempo/periode sesuai konteks; notifikasi hasil verifikasi/koreksi dikirim in-app kepada Staff Admin pengaju.
- Implementasi saat ini menjalankan job harian pukul 00:10 WIB untuk H-7/H-3/H-1; ledger event memiliki kunci deterministik dan unique constraint lintas instance. Notifikasi Staff Admin disimpan dalam inbox tenant sendiri pada transaksi yang sama; Platform Admin mendapat daftar reminder lintas tenant yang dilindungi Platform Admin dan sinyal realtime untuk refresh.
- Pengiriman inbox lokal bersifat transaksional; retry/outbox untuk kanal eksternal, status gagal kirim, dan observability operasional belum tersedia. Notifikasi Staff Admin dari job masih berbahasa Indonesia; lokalisasi isi notifikasi per preferensi pengguna belum tersedia.
- Reminder tidak mengubah status, akses, atau pembayaran.

### Tahap 5 — Self-service renewal dan bukti pembayaran tenant

**Tujuan:** Staff Admin dapat memahami status, mengajukan renewal, mengirim bukti, dan meminta koreksi payment tenant sendiri, tanpa memegang kontrol administratif Platform Admin.

**Pekerjaan:**

- Staff Admin tenant melihat paket, status, periode/trial, harga renewal terbaru, instruksi pembayaran, dan status verifikasi untuk tenant sendiri.
- Sediakan aksi idempoten mengajukan renewal dan mengunggah bukti untuk payment yang sesuai.
- Sediakan antrean verifikasi Platform Admin dengan tampilan bukti yang aman, menerima/menolak disertai alasan, dan audit lengkap.
- Sediakan pengajuan koreksi oleh Staff Admin dan antrean persetujuan Platform Admin. Persetujuan menghasilkan adjustment/reversal yang terlacak; record payment lama tidak ditimpa atau dihapus.
- Terima PDF/JPG/PNG maksimal 2 MB per file; simpan privat, lakukan pemeriksaan keamanan, dan tentukan masa retensi bersama kebijakan keuangan; bukti tidak boleh menjadi public URL.
- Pertahankan jalur baca/pengajuan billing ketika tenant restricted secara eksplisit, tanpa membuka endpoint operasional lain.
- Tenant tidak dapat mengubah biaya, status, mencatat pembayaran lunas, membaca tenant lain, atau menambah akses ketika restricted.

**Batas:** Parent dan Staff non-admin tidak mendapat menu ini. Upload bukti bukan verifikasi otomatis; tidak ada payment gateway atau auto-charge pada tahap ini.

### Tahap 6 — Rekonsiliasi dan laporan (opsional)

**Tujuan:** mendukung operasi finance ketika volume subscription meningkat.

**Pekerjaan jika dibutuhkan:**

- Laporan periodik status, penerimaan, outstanding, trial conversion, dan perubahan harga, dengan definisi metrik yang eksplisit.
- Ekspor terbatas untuk role berwenang dan audit ekspor; jangan masukkan kredensial atau data Parent/anak yang tidak diperlukan.
- Rekonsiliasi payment manual/gateway dengan idempotency, mismatch queue, serta koreksi yang mempertahankan riwayat.

**Batas:** integrasi gateway hanya fase terpisah dengan threat model, webhook signature/replay protection, idempotency, dan proses refund yang dirancang.

## 8. Rancangan data/API yang perlu dipenuhi

Rancangan akhir mengikuti pola repository setelah tahap 0. Kebutuhan domain minimum:

- **Subscription**: tenant ID unik, plan, status, periode efektif, trial end, nominal/aturan harga yang berlaku, versi/updated timestamp untuk concurrency.
- **Snapshot ketentuan periode**: plan dan harga/currency yang benar-benar dibeli untuk suatu periode, agar perubahan plan/price mendatang tidak mengubah periode aktif atau riwayat. Renewal menggunakan ketentuan baru yang berlaku ketika renewal dibuat; payment menyimpan snapshot yang sama.
- **Konfigurasi grace**: `gracePeriodDays` per tenant dengan nilai tervalidasi; bila batas aktif-grace perlu dibekukan, simpan `graceStartedAt`/`graceEndsAt` atau event lifecycle agar perubahan konfigurasi tidak mengubah grace yang sedang berjalan.
- **Payment/invoice SaaS**: subscription/tenant ID, periode yang ditagih (termasuk tanggal mulai setelah akhir periode yang berjalan untuk renewal awal), amount/currency, status, due date, paid timestamp, payment reference, created-by/verified-by bila manual. Jangan memakai entitas Parent billing bila semantiknya berbeda.
- **Coverage aktual**: catat tanggal coverage yang benar-benar diberikan terpisah dari snapshot periode invoice. Biasanya keduanya sama; jika payment renewal baru dikonfirmasi setelah `GRACE` berakhir, coverage dimulai pada tanggal konfirmasi WIB tanpa mengubah periode/ketentuan invoice yang telah diterbitkan. Audit harus menghubungkan keputusan konfirmasi dan rentang coverage aktual.
- **Idempotency command**: key unik per scope/aktor/operasi, hash payload ternormalisasi, resource/response hasil, status pemrosesan, serta waktu pembuatan/retensi. Key yang sama dengan payload identik mengembalikan hasil tersimpan; key sama dengan payload berbeda menghasilkan conflict. Pemrosesan paralel harus aman.
- **Subscription audit event**: append-only, actor, event type, timestamp, reason, safe before/after snapshot, referensi payment, serta request correlation ID.
- **Lifecycle reminder:** `tenant_subscription_reminders` mencatat tenant, subscription, payment opsional, jenis event, tanggal target, lead days, event key unik, dan waktu pencatatan. Inbox Staff Admin dibuat atomik dengan ledger; API Platform Admin membaca event lintas tenant melalui otorisasi Platform Admin. Retry metadata belum dipakai karena pengiriman inbox berada dalam transaksi database; outbox/retry eksternal tetap diperlukan bila kanal di luar inbox ditambahkan.
- **Bukti pembayaran**: relasi ke payment SaaS tertentu, metadata file aman, uploader/waktu upload, status review, reviewer/waktu keputusan, alasan penolakan, serta versioning agar upload ulang tidak menghilangkan jejak. Simpan file di storage privat; database menyimpan metadata dan referensi aman.
- **Permintaan koreksi**: payment asli, tenant, pengaju, tipe/alasan, usulan nilai/data, bukti pendukung privat, status review, reviewer, keputusan/alasan/waktu, serta adjustment/reversal event yang terbentuk. Permintaan dan keputusan disimpan terpisah dari record payment asli.

API minimal setelah disetujui:

- daftar ringkasan subscription terpaginasikan dengan filter/search/sort yang di-allowlist;
- detail subscription beserta pembayaran dan timeline audit terpaginasikan;
- command terpisah untuk perubahan plan/fee, renewal, verifikasi penerimaan, void/cancel payment, suspend/reactivate sesuai state matrix;
- endpoint Staff Admin untuk melihat subscription, mengajukan renewal, mengunggah/melihat bukti, serta mengajukan koreksi payment hanya dalam scope tenant membership; command Platform Admin terpisah untuk menerima/menolak bukti dan menyetujui/menolak koreksi.

Setiap command memvalidasi role, tenant scope, transition, tanggal, amount, payment state, concurrency, dan idempotency di server. Response error harus stabil dan tidak membocorkan apakah tenant lain ada. GET harus read-only sejauh mungkin; bila masih ada lazy lifecycle transition, efek tersebut harus dipindah/ditetapkan secara eksplisit dan audit-able.

### Kontrak idempotency dan pencegahan tagihan ganda

- Infrastruktur key/hash/replay handling digunakan bersama oleh command billing Parent dan subscription tenant SaaS; namespace operasi serta business key tetap membedakan domain dan jenis resource.
- Client mengirim idempotency key acak yang stabil untuk satu aksi logis; jangan membentuk key dari data rahasia atau hanya timestamp.
- Server mengikat key pada actor, operasi/route, tenant scope, dan hash payload yang dinormalisasi. Key sama + payload sama mengembalikan resource/hasil pertama; key sama + payload berbeda ditolak sebagai conflict.
- Penyimpanan key dan perubahan domain dilakukan atomik. Jika commit sukses tetapi response hilang, retry mengembalikan payment/renewal yang sudah dibuat.
- Tambahkan unique business constraint untuk satu renewal/payment charge aktif per subscription + periode + jenis tagihan. Dua request dengan key berbeda untuk periode sama mengembalikan payment yang sama atau conflict yang aman, bukan membuat payment kedua.
- Tetapkan business key unik per jenis operasi Parent berdasarkan model yang benar (misalnya satu invoice untuk satu purchase/entitlement atau satu verifikasi per invoice); jangan menerapkan constraint subscription ke invoice Parent.
- Verifikasi payment dan approval/rejection koreksi memakai command idempoten serta transisi status compare-and-set agar double click tidak memproses keputusan dua kali.
- Upload bukti mengikat file ke payment dan memiliki identitas/version unik; retry tidak membuat record review ganda. Resubmit setelah penolakan adalah tindakan baru dengan audit baru.
- Simpan record idempotency sekurangnya 90 hari. Unique business constraint tetap melindungi periode/transaksi lebih lama, termasuk setelah record key diarsipkan atau retensinya berakhir.

## 9. Aturan akses ketika subscription terbatas

- Backend terus menjadi enforcement point; menyembunyikan tombol di UI tidak cukup.
- `ACTIVE` dan `TRIAL` memberi akses hanya sesuai capability dan aturan tenant yang sudah berlaku.
- `GRACE` memberi Staff akses hanya untuk operasi inti anak yang sudah terdaftar (kehadiran, keselamatan/kesehatan, penjemputan, catatan perawatan, dan komunikasi terkait perawatan berjalan); Parent dengan anak aktif dapat melihat informasi perawatan berjalan serta berkomunikasi. Enrollment Parent baru ditutup. Daftar endpoint dan operasi tepatnya wajib ditulis per role di business rules.
- `PENDING_PAYMENT`, `SUSPENDED`, dan `EXPIRED` mengikuti aturan restriction server yang disahkan. `SUSPENDED` membatasi akses operasional segera, termasuk ketika masa grace belum habis. Jangan menganggap semua role memiliki exception yang sama.
- Parent saat `EXPIRED` hanya memperoleh invoice miliknya dan data historis anak tenant yang telah disetujui untuk kesinambungan perawatan/penyelesaian kewajiban secara read-only; akses dibatasi untuk anak milik Parent tersebut. Tidak ada enrollment, booking, atau komunikasi operasional baru. Perubahan status tenant tidak menghapus atau mencabut data/fitur yang dimiliki Parent secara independen dari tenant, termasuk profil dan hasil screening perkembangan anak milik Parent; kepemilikan serta penghapusan akun Parent tetap mengikuti business rules. Jangan membuka data operasional tenant (mis. QR, absensi, pesan, booking) di luar allowlist.
- Staff Admin tenant mendapat allowlist terbatas untuk melihat subscription sendiri, mengajukan renewal/koreksi, melihat instruksi, dan mengirim bukti payment tenant sendiri, termasuk saat tenant restricted. Ini harus menjadi grant endpoint eksplisit di server dan business rules, bukan bypass umum pada subscription gate; endpoint operasional lain tetap dibatasi.
- Tidak ada cross-tenant fallback, pemilihan organization dari payload tanpa membership check, atau penggunaan cache tenant sebelumnya saat status gagal dimuat.

## 10. Verifikasi dan kriteria penerimaan

### Unit/domain/service

- Semua transisi status legal dan ilegal diuji, termasuk batas tanggal, pergantian bulan/tahun, trial, expiry, suspend/reactivate, renewal, payment paid/void, dan payment ganda.
- Batas waktu diuji tepat di 23.59.59/00.00 WIB, termasuk grace 0 dan 1 hari; due date diuji untuk invoice awal non-trial, konversi trial, dan renewal.
- Due date yang jatuh pada tanggal WIB tetap valid sampai 23.59.59 lokal dan menjadi overdue mulai 00.00 hari kalender berikutnya; perbandingan server tidak bergantung pada presisi pecahan detik.
- Amount positif, format/currency, due date, periode, fee snapshot, dan perubahan harga divalidasi server.
- Transaksi atomik: kegagalan di tengah tidak meninggalkan payment/subscription setengah berubah.
- Idempotency dan konkurensi diuji dengan request ulang serta dua tindakan bersamaan.
- Record idempotency dapat di-replay selama retensi minimal 90 hari; setelah itu unique business constraint tetap mencegah transaksi domain yang sama dibuat ulang.
- Uji key sama/payload sama mengembalikan resource yang sama; key sama/payload berbeda ditolak; dua key berbeda untuk tenant/periode yang sama tidak membuat payment ganda; simulasi commit sukses dengan response timeout mengembalikan hasil yang sama saat retry.
- Jalankan regression test billing Parent: retry pembuatan invoice/purchase dan upload bukti tidak menggandakan resource; konfirmasi payment tidak mengeksekusi entitlement/booking dua kali; pembatalan/refund tetap mengikuti aturan domain Parent.
- Audit dibuat sekali untuk command berhasil, tidak menyimpan secret, dan tidak terhapus ketika payment dikoreksi.
- Baca detail/list tidak membuat transisi status tersembunyi yang tidak diaudit.

### API/security

- Hanya Platform Admin dapat membaca/mengubah lintas tenant; Staff Admin hanya tenant sendiri untuk endpoint yang disetujui; Parent tidak dapat mengelola SaaS subscription.
- Staff Admin dapat membuat renewal request dan mengunggah bukti hanya untuk payment `PENDING` pada tenant sendiri; tidak dapat menyatakan pembayaran lunas atau memanggil aksi review.
- Hanya Platform Admin berizin yang dapat menerima/menolak bukti dan mengonfirmasi payment. Staff Admin hanya dapat mengajukan koreksi payment tenant sendiri; tidak dapat menyetujui koreksi. Approval membuat adjustment/reversal event tanpa menghapus/mengubah histori asli.
- Bukti payment tidak dapat dilihat/diubah lintas tenant; URL file privat dan validasi ownership dites untuk upload, preview, dan download.
- Uji IDOR dengan organization/payment ID tenant lain, role salah, scope header yang dipalsukan, dan status restricted.
- Uji bahwa restricted Parent hanya dapat mengakses allowlist yang disepakati, dan tidak dapat membaca data tenant/anak lain.
- Error tidak membocorkan detail sensitif atau keberadaan tenant lintas scope.

### UI/e2e

- List: filter, sort, pagination, empty/loading/error, stale data, dan navigasi detail.
- Detail: nilai/date/status konsisten dengan API; action confirmation, pembatalan dialog, double tap, request lambat, dan error server.
- Perubahan pembayaran/status memperbarui ringkasan tanpa menampilkan sukses sebelum server mengonfirmasi.
- E2E Staff Admin: ajukan renewal, unggah bukti, lihat status menunggu, lalu verifikasi/penolakan Platform Admin; memastikan bukti tidak mengaktifkan subscription sebelum diterima.
- E2E koreksi: Staff Admin mengajukan koreksi, payment asli tetap tidak berubah, Platform Admin menolak atau menyetujui; jika disetujui audit/adjustment terbentuk dan tidak ada approval oleh pengaju.
- Setiap kategori koreksi (nominal tidak cocok, referensi salah, bukti/invoice keliru, pembayaran ganda/lebih bayar) memiliki validasi input, bukti yang sesuai, dan hasil review yang dapat diaudit.
- Kekurangan bayar tetap menyisakan saldo tagihan; kelebihan/duplikasi membentuk kredit tercatat tanpa memperpanjang subscription atau terpakai otomatis; refund melalui approval/audit manual terpisah.
- Refund hanya berjalan melalui proses manual yang disetujui fungsi keuangan dan disetujui Platform Admin dengan capability yang ditetapkan; keputusan, pengaju, penyetuju, pelaksana transfer, penerima, nominal, alasan, bukti transfer, dan kaitan ke payment asal tercatat serta tidak mengubah/menghapus payment asal. Pengaju tidak boleh menyetujui refund yang diajukannya sendiri; penyetuju dan pelaksana transfer dicatat terpisah, dan pengecualian operasional wajib mendapat approval kedua serta alasan audit. Tidak ada refund otomatis atau offset kredit dalam MVP.
- Penghapusan bukti mengikuti retensi yang disetujui fungsi keuangan dan legal hold; data tidak dipertahankan otomatis tanpa batas hanya karena bukti pembayaran memuat data pribadi.
- Perubahan status tenant menjadi `EXPIRED` tidak menghapus atau mengunci profil/hasil screening anak yang Parent-owned; data historis tenant tetap dibatasi per anak dan allowlist.
- Batas nominal diterapkan dan diuji di server dari konfigurasi yang disetujui; request di atas batas ditolak meski client melewati validasi.
- Simulasi rollout `GRACE` tidak menulis perubahan bisnis, mengirim notifikasi, atau memicu billing; actual rollout hanya dapat dilakukan setelah hasil simulasi ditinjau dan data sumber yang relevan masih cocok.
- Bahasa Indonesia/Inggris, aksesibilitas, ukuran layar, koneksi lambat/offline, dan sesi kedaluwarsa.
- Web/mobile visual check serta API-backed test; UI mock saja bukan bukti enforcement backend.

### Operasional

- Migrasi additive dan backward-compatible, backup/rollback strategy, observability untuk command dan job, serta dashboard error tanpa data rahasia.
- Uji data existing: satu subscription per tenant, payment orphan, status/period tidak konsisten, dan nilai nullable.
- Jalankan simulasi read-only sebelum aktivasi lifecycle `GRACE`; tinjau daftar tenant dan dampak status/akses, pastikan tidak ada payment atau notifikasi yang dibuat oleh simulasi, dan minta konfirmasi eksplisit sebelum eksekusi.
- Canary pada tenant internal/sandbox; verifikasi status, payment, access gate Parent dan Staff, lalu rollout bertahap. Jika data tenant berubah setelah simulasi, batalkan preview lama dan hitung ulang sebelum aktivasi.

## 11. Risiko dan mitigasi

| Risiko | Mitigasi |
|---|---|
| Perpanjangan memotong sisa periode atau membuat tenant terkunci sementara menunggu verifikasi | Terapkan tanggal efektif dan timing pembayaran yang disepakati; transaksi atomik dan regression test access gate sebelum akhir periode, selama grace, dan sesudah grace. |
| UI menampilkan ACTIVE sementara server sudah membatasi atau sebaliknya | Server sebagai sumber status; refresh/version response; tidak menghitung status client-side. |
| Menandai lunas tanpa bukti/otorisasi | Role check, konfirmasi, alasan/referensi sesuai kebijakan, audit append-only, dan pemisahan “manual override” dari verifikasi normal. |
| Request retry membuat payment ganda | Idempotency key/unique period constraint dan test concurrent requests. |
| Parent kehilangan akses yang secara eksplisit dijanjikan, atau mendapat akses berlebih | Regression test seluruh matrix restricted dan perubahan business rules sebelum perubahan route. |
| Harga baru mengubah riwayat lama | Snapshot harga pada payment/periode; perubahan harga hanya berlaku sesuai effective date yang disetujui. |
| Data finansial bocor lintas tenant atau ke Parent | Scope authorization server-side, minimisasi DTO, IDOR tests, dan audit akses ekspor. |
| Pengingat terkirim berulang atau ke pengguna yang salah | Outbox/event key unik, deduplication, recipient scope, dan delivery status. |

## 12. Keputusan yang disetujui dan prasyarat implementasi

Keputusan produk berikut telah disetujui dan harus ditulis normatif di `docs/business-rules.md` sebelum implementasi.

1. **Grace per tenant:** Platform Admin dapat menetapkan 0–30 hari kalender per tenant; nilai awal 7 hari, `0` berarti tanpa grace. Perubahan berlaku untuk periode berikutnya dan tidak mengubah grace berjalan. Tenant existing diisi 7 hari sebagai nilai awal, masuk daftar review Platform Admin, dan dapat disesuaikan sebelum lifecycle grace diaktifkan.
2. **Batas waktu WIB:** seluruh tanggal bisnis memakai WIB (`Asia/Jakarta`). `periodEnd` inklusif sampai 23.59.59 WIB; grace mulai 00.00 WIB keesokan hari, berlaku selama jumlah hari kalender yang dikonfigurasi, lalu `EXPIRED` pada 00.00 WIB berikutnya. Grace 0 berarti `EXPIRED` pada 00.00 WIB setelah `periodEnd`. Audit/payment timestamps disimpan UTC dan ditampilkan dalam WIB.
3. **Jatuh tempo:** invoice awal non-trial jatuh tempo pada tanggal kalender WIB yang sama dengan tanggal penerbitan + 7 hari kalender; tanggal tersebut inklusif sampai 23.59.59 WIB. Invoice konversi trial jatuh tempo pada tanggal akhir trial, dan invoice renewal pada tanggal akhir periode berjalan, dengan batas inklusif yang sama. `GRACE` berlaku hanya untuk renewal dari subscription yang sudah aktif, bukan aktivasi awal atau trial yang berakhir.
4. **Akses terbatas:** selama `GRACE`, tenant tidak ditawarkan untuk enrollment Parent baru atau pembelian layanan baru. Staff dapat menjalankan kehadiran, keselamatan/kesehatan, penjemputan, catatan perawatan, dan komunikasi terkait perawatan berjalan bagi anak yang sudah terdaftar. Parent dengan anak aktif dapat melihat informasi perawatan berjalan dan berkomunikasi dalam konteks tersebut. Saat `EXPIRED`, operasi harian dan komunikasi operasional baru diblokir; Staff Admin tetap dapat mengakses self-service langganan/pembayaran, sedangkan Parent hanya mendapat akses baca ke invoice miliknya dan data historis anak yang diperlukan untuk kesinambungan perawatan/penyelesaian kewajiban. Daftar endpoint dan batas data persis wajib disahkan di `docs/business-rules.md`; data tidak dihapus karena status berubah. `SUSPENDED` membatasi akses operasional segera.
5. **Renewal awal dan terlambat:** Platform Admin boleh memulai renewal sebelum periode berakhir; periode tambahan dimulai sehari setelah periode berjalan berakhir. Pembayaran awal tidak memotong/menggeser periode. Pembayaran dikonfirmasi sebelum grace habis menyambung coverage; jika dikonfirmasi setelah grace, periode baru dimulai tanggal konfirmasi Platform Admin tanpa backdate.
6. **Paket/harga:** perubahan dapat ditetapkan kapan pun. Periode yang telah dibeli tetap memakai snapshot paket/harga sampai akhir; renewal yang dibuat setelah perubahan memakai ketentuan baru. Payment yang sudah diterbitkan tidak berubah diam-diam.
7. **Pembayaran dan koreksi:** hanya Platform Admin berizin yang dapat memverifikasi bukti dan mengonfirmasi pembayaran. Staff Admin tenant dapat mengajukan koreksi dengan kategori: nominal tidak cocok, referensi salah, bukti/invoice keliru, atau pembayaran ganda/lebih bayar. Platform Admin menyetujui/menolak dengan alasan; payment lama tidak diedit/dihapus, dan koreksi dicatat sebagai adjustment/reversal. Kekurangan bayar mempertahankan sisa tagihan; kelebihan atau pembayaran ganda dicatat sebagai kredit tenant yang tidak otomatis memperpanjang subscription atau mengurangi invoice lain. Pada MVP kredit tidak dapat dipakai untuk offset invoice; pengembalian uang adalah proses manual terpisah dengan approval dan audit tersendiri. Refund mengikuti prosedur yang disetujui fungsi keuangan dan disetujui Platform Admin berizin; catat pengaju, penyetuju, dan pelaksana transfer. Pengaju tidak menyetujui refund sendiri, dan pengecualian wajib mendapat approval kedua dengan alasan audit.
8. **Self-service dan bukti:** Staff Admin tenant dapat melihat subscription, mengajukan renewal/koreksi, dan mengunggah bukti untuk tenant sendiri; tidak dapat mengubah harga/status, mengonfirmasi pembayaran, atau menyetujui koreksi. Bukti berupa PDF/JPG/PNG maksimal **2 MB per file**, disimpan privat, akses/unduhan diaudit, upload ulang menjadi versi baru, dan diverifikasi Platform Admin dengan target operasional dua hari kerja. Fungsi keuangan menetapkan klasifikasi dan retensi bukti: dokumen yang menjadi dasar pembukuan/pencatatan disimpan sesuai kewajiban hukum yang berlaku (UU KUP Pasal 28(11) menetapkan 10 tahun untuk dokumen dalam cakupan tersebut); jangan menerapkan retensi 10 tahun secara otomatis pada semua data pribadi. Jadwal retensi, penghapusan, dan legal hold harus konsisten dengan tujuan pemrosesan serta UU Pelindungan Data Pribadi. ([UU KUP terkonsolidasi](https://www.pajak.go.id/sites/default/files/2021-11/SDSN%20UU%20KUP%20stdtd%20UU%20HPP.pdf), [UU Pelindungan Data Pribadi](https://peraturan.bpk.go.id/Home/Download/224884/UU%20Nomor%2027%20Tahun%202022.pdf)).
9. **Notifikasi:** in-app reminder dikirim kepada Platform Admin dan Staff Admin pada H-7/H-3/H-1 sebelum akhir trial/jatuh tempo/periode; notifikasi hasil verifikasi/koreksi dikirim kepada Staff Admin pengaju. Reminder yang sudah lewat saat invoice dibuat dilewati. Pengiriman dideduplikasi dan dibatasi ke tenant terkait.
10. **Tagihan dan gateway:** mata uang awal IDR; nominal memakai rupiah bulat, divalidasi/dihitung server tanpa floating point, dan harus berada dalam rentang yang didukung penyimpanan serta batas operasional yang disetujui sebelum produksi. Nomor invoice dibuat server, unik, immutable, dan tidak digunakan ulang meski invoice dibatalkan; format target `UE-SUB-YYYYMM-000001`, dengan seri Tenant SaaS terpisah dari invoice Parent yang sudah ada. Due date adalah tanggal kalender WIB yang inklusif sampai 23.59.59; server menyimpan/membandingkan batas eksklusif pada pukul 00.00 WIB hari berikutnya. Perlakuan pajak, status PKP, klasifikasi layanan, harga termasuk/tidak termasuk pajak, dan bentuk dokumen pajak harus ditinjau fungsi keuangan/konsultan sebelum invoice produksi; jangan menganggap satu tarif/formula berlaku untuk semua penyerahan karena aturan PPN dan DPP memiliki skema berbeda ([DJP—PMK 131/2024 dan PMK 11/2025](https://stats.pajak.go.id/id/siaran-pers/pemerintah-terbitkan-aturan-dpp-nilai-lain-dan-besaran-tertentu-ppn), [DJP—petunjuk faktur pajak](https://www.pajak.go.id/id/peraturan/petunjuk-teknis-pembuatan-faktur-pajak-dalam-rangka-pelaksanaan-peraturan-menteri)). Payment gateway/auto-charge bukan bagian MVP.
11. **Laporan:** definisi dashboard: jumlah `ACTIVE` dan `GRACE` ditampilkan terpisah; pembayaran diterima berdasarkan payment `PAID` dan `paidAt` dalam WIB; outstanding hanya payment belum dibayar dan bukan `VOID`; trial conversion memakai cohort trial yang berakhir dan menjadi `ACTIVE` dalam 30 hari setelah akhir trial.
12. **Idempotency lintas billing:** command finansial Parent dan Tenant SaaS memakai idempotency key stabil. Key sama + payload sama mengembalikan hasil pertama; payload berbeda ditolak. Gunakan constraint bisnis unik per domain/periode agar key berbeda pada request paralel tetap tidak membuat invoice/payment ganda. Simpan key sekurangnya 90 hari; constraint bisnis tetap berlaku lebih lama.

**Prasyarat sebelum rilis yang masih memerlukan owner operasional/keuangan:** fungsi keuangan mengklasifikasikan dokumen mana yang merupakan dasar pembukuan dan menyetujui jadwal retensi/penghapusan; mengesahkan penanganan kredit/kelebihan bayar dan proses refund manual; menetapkan batas maksimum nominal operasional yang diterapkan sebagai konfigurasi server ter-audit (bukan validasi client/hardcode); serta memberi sign-off tertulis atas status PKP, klasifikasi layanan, perlakuan pajak, dan dokumen pajak. Engineering melengkapi format invoice final, validasi jumlah, keamanan/retensi storage, dan matriks endpoint role/status di `docs/business-rules.md`, termasuk pengecualian akses data Parent-owned. Pajak tidak boleh diaktifkan pada invoice produksi sebelum sign-off keuangan/pajak. Gateway/auto-charge dan refund otomatis tetap di luar MVP.

## 13. Urutan keputusan/pengiriman

1. Perbarui `docs/business-rules.md` dengan keputusan §12 dan kontrak teknis/operasional yang diperlukan. Ini prasyarat wajib, bukan pekerjaan opsional atau dokumentasi susulan.
2. Tinjau konsistensi business rules dengan plan, lalu finalisasi acceptance matrix dan API/data/access matrix berdasarkan business rules yang telah ditinjau.
3. Baru setelah langkah 1–2 lulus, implementasikan Tahap 1 (visibilitas daftar/detail dan UI konfigurasi grace per tenant) beserta test UI/API; konfigurasi grace adalah kontrol tulis yang memang diizinkan bagi Platform Admin.
4. Implementasikan Tahap 2 (audit dan command safety) sesuai business rules.
5. Implementasikan Tahap 3 (renewal/payment/lifecycle) sesuai tanggal, transisi, dan efek akses yang normatif.
6. Implementasikan Tahap 4 reminders dan Tahap 5 self-service Staff Admin sesuai business rules; Tahap 6 reporting tetap opsional sesuai prioritas dan pemilik proses.
7. Setiap perubahan keputusan bisnis atau penyimpangan yang ditemukan selama tahap mana pun mengharuskan pembaruan dan peninjauan `docs/business-rules.md` sebelum implementasi terkait dilanjutkan.
8. Setiap tahap mempunyai review keamanan, test regression access matrix, catatan perubahan harian, serta rollout/rollback yang terpisah. Kriteria selesai setiap tahap mencakup kesesuaian business rules, bukan hanya lulus test kode.

## 14. Definisi selesai

Pengelolaan langganan untuk scope yang dirilis **belum selesai** bila `docs/business-rules.md` belum diperbarui. Selesai hanya jika aturan normatif telah ditinjau dan konsisten dengan status/tanggal di list/detail/API/access gate; setiap tindakan pembayaran atau lifecycle tervalidasi dan diaudit; retry tidak membuat duplikasi; role dan tenant scope teruji; UI menjelaskan status serta langkah berikutnya; data historis tidak berubah/terhapus; dan perilaku Parent pada tenant restricted tetap tepat sesuai business rules.
