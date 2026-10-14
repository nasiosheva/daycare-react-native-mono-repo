// Mories Deo Hutapea,S.E.,S.Kom

# Rencana Pengelolaan Langganan Tenant

## Tujuan

Menyusun rencana bertahap untuk pengelolaan subscription SaaS tenant oleh Platform Admin, terpisah dari billing Parent/anak.

## Perubahan dokumen

- Ditambahkan `docs/plans/tenant-subscription-management.md` dengan baseline yang ditemukan, prinsip keselamatan, kebutuhan UI/API/data, tahapan 0–6, kriteria test, risiko, keputusan yang disetujui, prasyarat implementasi, dan definisi selesai.
- Rencana memprioritaskan visibilitas Platform Admin sebelum perubahan transaksi/lifecycle, lalu audit, renewal/pembayaran, pengingat, dan self-service Staff Admin; reporting tetap opsional.
- Menggarisbawahi bahwa akses restricted Parent hanya boleh mengikuti allowlist eksplisit di `docs/business-rules.md`.
- Status target menambahkan `GRACE` sebagai status keenam di antara `ACTIVE` dan `EXPIRED`, dengan konfigurasi 0–30 hari per tenant oleh Platform Admin dan nilai awal 7 hari; akses operasional untuk anak aktif dan penutupan enrollment baru Parent juga dicatat.
- Ditambahkan flow UI untuk tenant existing (lihat nilai, ubah hari, preview tanggal efektif, konfirmasi, audit, dan penanganan konflik), tenant baru pada wizard, serta tenant existing yang belum mendapat nilai konfigurasi.
- Keputusan renewal dicatat: renewal boleh dimulai sebelum periode berakhir, tetapi periode tambahan dihitung mulai setelah akhir periode berjalan, bukan dari tanggal renewal. Pembayaran lebih awal tidak menggeser periode aktif.
- Keputusan paket/harga dicatat: perubahan dapat ditetapkan kapan pun, tetapi periode yang sudah dibeli mempertahankan snapshot paket/harganya sampai berakhir; renewal baru mengikuti ketentuan terbaru dan payment yang sudah terbit tidak berubah diam-diam.
- Self-service Staff Admin dicatat sebagai keputusan: dapat melihat subscription tenantnya, mengajukan renewal/koreksi, dan mengunggah bukti bayar; verifikasi/penerimaan pembayaran serta persetujuan koreksi tetap kewenangan Platform Admin dan bukti tidak otomatis mengaktifkan akses.
- Ditambahkan flow UI antrean verifikasi pembayaran oleh Platform Admin dan pengajuan koreksi oleh Staff Admin dengan persetujuan Platform Admin, alasan keputusan, audit, serta adjustment/reversal tanpa menimpa payment asli.
- Keputusan produk grace, renewal terlambat, reminder, mata uang IDR, invoice bernomor unik, dan metrik laporan ditandai disetujui; nilai grace awal 7 hari (rentang 0–30), reminder H-7/H-3/H-1, dan target review bukti dua hari kerja.
- Zona waktu bisnis ditetapkan WIB (`Asia/Jakarta`), dengan `periodEnd` inklusif sampai 23.59.59 WIB; grace dimulai pukul 00.00 WIB keesokan hari dan berakhir pukul 00.00 WIB setelah hari grace terakhir. Grace 0 langsung berakhir setelah `periodEnd`; timestamp audit/pembayaran disimpan UTC dan ditampilkan WIB.
- Jatuh tempo ditetapkan: invoice awal non-trial tujuh hari kalender setelah terbit; invoice konversi trial pada akhir trial; invoice renewal pada akhir periode berjalan. Grace hanya berlaku untuk renewal subscription yang sebelumnya aktif.
- Renewal sebelum akhir periode diperbolehkan. Jika pembayaran dikonfirmasi sebelum grace berakhir, coverage tersambung; jika sesudahnya, periode baru dimulai saat Platform Admin mengonfirmasi pembayaran, tanpa backdate.
- Kategori koreksi pembayaran dirinci menjadi nominal tidak cocok, referensi salah, bukti/invoice keliru, dan pembayaran ganda/lebih bayar. Koreksi disetujui dicatat sebagai adjustment/reversal; payment asal tetap immutable.
- Nomor invoice harus dibuat server, unik, immutable, dan tidak digunakan ulang; mata uang IDR. Pajak tetap memerlukan review fungsi keuangan sebelum invoice produksi.
- Idempotency lintas Parent dan Tenant SaaS memerlukan key stabil, replay untuk payload sama, conflict untuk payload berbeda, unique business constraint per domain, dan retensi record key sekurangnya 90 hari.
- Batas bukti pembayaran ditetapkan PDF/JPG/PNG maksimal 2 MB per file; retensi ditautkan ke kebijakan keuangan.
- Pencegahan double payment ditetapkan sebagai standar lintas billing: idempotency key persisten untuk command Tenant SaaS dan Parent, ditambah unique business constraint khusus tiap domain agar request paralel dengan key berbeda juga tidak membuat invoice/payment ganda. Record dan semantik billing Parent tetap terpisah.
- Atas persetujuan pengguna, akses `EXPIRED` dirinci sebagai operasi harian dan komunikasi operasional baru tertutup; Staff Admin tetap dapat menyelesaikan billing, sedangkan Parent mendapat invoice sendiri dan data historis anak yang disetujui secara read-only.
- Koreksi nominal kurang mempertahankan saldo; kelebihan/duplikasi menjadi kredit yang tidak otomatis memperpanjang subscription atau mengurangi invoice lain dan tidak dapat di-offset pada MVP. Refund tetap manual dengan approval dan audit terpisah.
- Detail invoice ditetapkan dalam plan: IDR rupiah bulat dihitung server, seri nomor invoice Tenant SaaS terpisah (`UE-SUB-YYYYMM-000001`), due date kalender WIB inklusif hingga 23.59.59, dan komparasi server memakai batas eksklusif 00.00 hari berikutnya. Invoice awal non-trial jatuh tempo pada tanggal terbit + 7 hari kalender.
- Retensi bukti harus ditentukan fungsi keuangan berdasarkan klasifikasi; dokumen dasar pembukuan mengikuti kewajiban hukum yang berlaku, bukan retensi 10 tahun otomatis untuk semua data pribadi. Penyimpanan bukti privat, audit akses, jadwal hapus, dan legal hold dicatat.
- Status PKP, klasifikasi layanan, perlakuan pajak, serta dokumen pajak wajib mendapat sign-off keuangan/pajak sebelum invoice produksi; plan menautkan sumber resmi DJP sebagai rujukan untuk verifikasi.
- Persetujuan lanjutan memperjelas bahwa saat tenant `EXPIRED`, data tenant historis hanya boleh dibaca Parent untuk anaknya sendiri sesuai allowlist; status tenant tidak boleh mencabut profil/hasil screening yang dimiliki Parent secara independen.
- Batas maksimum nominal harus ditetapkan fungsi keuangan dan diterapkan sebagai konfigurasi server yang diaudit, bukan batas client/hardcode. Klasifikasi retensi menentukan jadwal simpan dan hapus; legal hold serta audit akses wajib diperhitungkan.
- Kredit/kelebihan bayar tidak di-offset otomatis pada MVP. Refund adalah proses manual dengan approval, pencatatan pelaksana/penerima/nominal/alasan/bukti transfer, serta referensi payment asal. Perlakuan pajak tetap menunggu sign-off tertulis fungsi keuangan/pajak.
- Acceptance criteria ditambah untuk memastikan expiry tenant tidak menghapus/mengunci data Parent-owned, akses historis tenant dibatasi per anak dan allowlist, nominal ditolak server di atas batas yang disetujui, dan bukti mengikuti klasifikasi retensi/legal hold.

## Tindak lanjut yang disetujui pada 14 Oktober 2026

- Refund manual memakai pemisahan tugas: pengaju tidak menyetujui refund sendiri; penyetuju adalah Platform Admin berizin dan dicatat terpisah dari pelaksana transfer. Pengecualian operasional memerlukan approval kedua dan alasan audit.
- Sebelum rollout lifecycle `GRACE`, jalankan simulasi read-only yang menunjukkan tenant terdampak dan perubahan status/akses tanpa mengubah data, membuat tagihan, atau mengirim notifikasi. Tinjau hasilnya dan ulangi simulasi jika data sumber berubah sebelum eksekusi.
- Rincian kontrol operasional tetap dirujuk pada [plan utama](../../plans/tenant-subscription-management.md) dan [catatan operasional 14 Oktober](../2026-10-14/tenant-subscription-operational-controls.md).

## Batas pekerjaan sesi ini

- Dokumentasi perencanaan saja; tidak mengubah kode, migrasi, seed, API, UI, atau `docs/business-rules.md`.
- Atas persetujuan pengguna, rencana kini menetapkan pembaruan dan peninjauan `docs/business-rules.md` sebagai blocker wajib sebelum implementasi billing/lifecycle/UI/access, serta sebagai syarat selesai setiap scope yang dirilis. Jika keputusan baru atau konflik muncul saat implementasi, hentikan bagian terkait dan selaraskan aturan normatif terlebih dahulu.
- `docs/business-rules.md` belum diubah pada sesi perencanaan ini; perubahan tersebut wajib dilakukan saat implementasi dimulai dan sebelum kode yang terdampak.
- Prasyarat teknis/finansial yang belum disahkan (klasifikasi/retensi bukti, detail kredit dan refund, batas nominal, serta sign-off pajak) tetap harus diselesaikan sebelum fitur terkait dirilis.

## Verifikasi

- Memeriksa model subscription/payment, service Platform Admin, status/paket yang tersedia, serta aturan akses dan wizard tenant pada business rules.
- Menjalankan pemeriksaan whitespace pada dokumen yang diperbarui.
