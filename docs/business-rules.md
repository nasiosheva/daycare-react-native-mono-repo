# Aturan Bisnis dan Platform Knowledge Umur Emas

Dokumen ini adalah sumber normatif aturan bisnis dan pengetahuan produk lintas modul. Dokumen ini wajib dibaca sebelum implementasi, review, atau perubahan flow, kontrak API, model data, otorisasi, dan arsitektur. Detail implementasi, perubahan harian, hasil verifikasi, serta gap antara aturan target dan implementasi dicatat terpisah di `docs/changes/`.

Aturan yang ditandai sebagai **target** menyatakan arah produk yang telah disetujui tetapi belum tentu sudah tersedia di code atau database. Implementasi yang belum sesuai tidak boleh dijadikan alasan untuk mengubah aturan secara diam-diam.

## 1. Batas data dan peran

- **Tenant** adalah batas data dan penagihan. Anak, cabang, kelas, tagihan, layanan, booking, perkembangan, dan konfigurasi operasional selalu dimiliki tepat oleh satu tenant.
- Satu tenant dapat memiliki beberapa cabang aktif, tetapi hanya satu cabang utama. Keanggotaan `STAFF_ADMIN` berlaku untuk seluruh tenant, bukan hanya cabang tertentu. Setiap daftar atau agregasi yang difilter per cabang (mis. jumlah staf aktif per cabang, daftar akun tenant per cabang) wajib tetap menyertakan setiap `STAFF_ADMIN` pada cabang mana pun yang difilter, terlepas dari nilai `branchId` pada membership-nya (biasanya `null`) — mempersempit per cabang tidak boleh menyembunyikan akun yang secara aturan berlaku lintas cabang.
- **Platform Admin (`ADMIN`)** mengelola lifecycle tenant, langganan, pembayaran tenant, master jenis lembaga, kurikulum global, Program Perkembangan global, serta kategori perkembangan global.
- **Staff Admin (`STAFF_ADMIN`)** mengelola konfigurasi dan operasi tenant: cabang, anak, kelas, pendamping, Goal, layanan, pembayaran Parent, booking, dan persetujuan enrollment.
- **Staff (`STAFF`)** hanya dapat membaca atau mengubah data anak dalam penugasan langsungnya atau kelas aktif yang ditugaskan kepadanya. Kemampuan tambahan, seperti mengelola program anak atau kategori perkembangan, harus diberikan secara eksplisit oleh Staff Admin.
- **Parent (`PARENT`)** hanya dapat melihat dan bertindak atas anak yang terhubung sebagai wali pada tenant aktif. Satu Parent dapat memiliki relasi pada beberapa tenant.
- Navigasi Parent menempatkan akses Profil pada ikon toolbar di Home, baik ketika Parent sudah memiliki tenant aktif maupun masih berada pada onboarding. Profil selalu merupakan child screen mandiri dengan app bar dan tombol kembali, bukan bottom tab Parent; keluar akun tetap hanya tersedia dari Profil.
- Akun yang tidak aktif tetap dapat memiliki akses baca sesuai peran dan scope yang sudah ada, tetapi seluruh mutasi memerlukan membership aktif.

## 2. Tenant, cabang, dan akun Staff

- Membuat tenant selalu membuat satu akun `STAFF_ADMIN` aktif pertama. Akun ini dilindungi: tidak dapat dihapus sebagai Staff Admin terakhir.
- Staff Admin dapat menambahkan Staff Admin tambahan dan Staff. Platform Admin menambahkan Staff Admin tambahan dari detail tenant dengan nama tampilan, email wajib, password, serta username unik global yang opsional; username disimpan pada identitas global. Akun selalu dibuat melalui Firebase Email/Password dengan email wajib. Pada layar masuk, pengguna dapat memakai email atau—bila disetel—username; backend hanya menerjemahkan username ke email terdaftar sebelum Firebase memverifikasi password. Menonaktifkan akun berarti mencabut akses tenant, bukan menghapus identitas global atau riwayatnya.
- Cabang non-utama dapat diarsipkan. Cabang yang diarsipkan tidak tersedia untuk enrollment baru, kelas baru, kapasitas baru, atau penempatan anak baru; riwayatnya tetap dipertahankan.
- Jenis lembaga `DAYCARE`, `PAUD`, dan `TK` dapat dimiliki bersamaan oleh tenant. Jenis tambahan dapat disimpan di katalog, tetapi tidak otomatis memperoleh capability bisnis baru.

## 3. Enrollment Parent dan pembayaran

1. Parent mendaftar secara global sebagai `PARENT`, lalu memilih tenant, anak, dan paket layanan. Katalog tenant yang ditampilkan ke Parent memuat **semua tenant dengan langganan `ACTIVE` atau `TRIAL` dan capability `DAYCARE_OPERATIONS`**, terlepas dari apakah tenant tersebut sudah punya cabang atau Paket Layanan aktif. Tenant `PENDING_PAYMENT`, `SUSPENDED`, atau `EXPIRED` tidak ditampilkan. Tenant tanpa cabang/paket aktif tetap tampil di katalog tetapi Parent belum dapat menyelesaikan pemilihan cabang/paket sampai Staff Admin tenant melengkapi datanya.
2. Sistem membuat aplikasi `PENDING_APPROVAL` dengan snapshot paket serta harga; tahap ini belum membuat booking atau invoice.
3. Hanya Staff Admin tenant yang dapat menyetujui atau menolak aplikasi. Daftar persetujuan membedakan **Pengajuan pendaftaran Parent** dari **Permintaan booking**, sehingga keputusan pendaftaran sebelum pembayaran tidak tertukar dengan keputusan booking setelah pembayaran.
4. Persetujuan membuat membership Parent tenant, relasi wali-anak, invoice, dan entitlement layanan yang masih pending.
5. Parent melihat instruksi transfer tenant, lalu mengunggah bukti pembayaran JPEG/PNG.
6. Staff Admin memverifikasi bukti pembayaran. Hanya sesudah verifikasi entitlement menjadi aktif dan Parent dapat memakai layanan terkait.

Parent dapat membatalkan aplikasi yang masih `PENDING_APPROVAL`. Ketika invoice enrollment yang telah disetujui melewati jatuh tempo dan Parent tidak memiliki entitlement aktif lain pada tenant itu, akses operasional Parent tenant dinonaktifkan dan Parent perlu mengajukan aplikasi baru.

## 4. Paket, booking, dan kehadiran

- Paket layanan dan entitlement berada dalam scope tenant dan, bila relevan, cabang.
- Kapasitas harian (baik pada Paket Layanan maupun pengaturan kapasitas cabang) wajib berupa bilangan bulat antara 1 dan 999. Backend memvalidasi ulang batas ini terlepas dari pemformatan input di client.
- Booking kapasitas hanya dibuat setelah entitlement aktif. Aplikasi enrollment tidak mengunci kapasitas booking. Daftar persetujuan booking menampilkan nomor serta total invoice yang menjadi snapshot pembayaran booking; total tersebut tidak dihitung ulang di client agar diskon dan harga yang sudah terkunci tetap akurat.
- Riwayat booking Parent selalu dibatasi pada anak yang sedang dipilih di layar Booking. Jumlah pada kartu, daftar, dan keadaan kosong memakai scope anak yang sama; membuka riwayat meminta data terbaru, sedangkan realtime dan mutasi booking tetap menginvalidasi data yang sama.
- Staff dalam scope anaknya dapat menyetujui atau menolak booking biasa. Persetujuan enrollment tetap khusus Staff Admin. Kegagalan keputusan harus ditampilkan inline pada konteks persetujuan yang sedang terbuka; error tidak boleh hanya bergantung pada dialog sistem, terutama di web.
- Pada tenant dengan capability `DAYCARE_OPERATIONS`, kehadiran memerlukan booking yang telah dikonfirmasi. PAUD dan TK tetap dapat memakai kehadiran sebagai shared core tanpa prasyarat booking Daycare.
- Check-in/out dapat dilakukan manual atau melalui QR Parent. Payload QR diverifikasi terhadap child ID dan nama yang ditandatangani server; nama tampilan saja tidak dipercaya.

## 5. Anak, kelas, dan scope Staff

- Data anak selalu terkait tenant, cabang, dan status enrollment. Anak dengan aplikasi Parent yang belum disetujui tidak dihitung sebagai anak aktif kelas dan tidak memakai kapasitas kelas.
- `LearningLevel` adalah tingkatan (misalnya Nursery atau TK A); `Classroom`/rombel adalah kelompok paralel (misalnya `TK A – Matahari`). Keduanya terpisah.
- Satu anak memiliki paling banyak satu penempatan kelas aktif. Memindahkan anak menutup penempatan sebelumnya dan menyimpan riwayatnya.
- `STAFF_ADMIN` dapat menempatkan anak aktif ke rombel aktif mana pun dalam cabang anak yang sama. `STAFF` dengan penugasan langsung pada anak dapat memilih rombel aktif mana pun dalam cabang yang sama. `STAFF` yang hanya memperoleh akses melalui rombel aktif anak hanya dapat memindahkan anak ke rombel aktif dalam cabang yang sama yang juga menugaskan Staff tersebut. Target yang ditampilkan kepada klien dan validasi mutasi di server wajib memakai aturan yang sama.
- Kapasitas kelas diprioritaskan; jika kelas tidak menetapkan kapasitas sendiri, kapasitas cabang digunakan.
- Scope Staff berasal dari penugasan langsung pada anak atau penugasan pada kelas aktif. Scope hanya dapat mempersempit akses, tidak pernah memperluas akses tenant.

## 6. Kurikulum, Goal, dan perkembangan

UI/UX saat ini belum memiliki satu entity bernama **Rencana Belajar** yang ditetapkan sebagai satu paket kepada anak. Flow pembelajaran dibagi menjadi tiga konsep yang berbeda: Program Kurikulum, Program Anak, dan Goal Anak. Ketiganya tidak boleh dianggap sebagai record atau lifecycle yang sama.

### 6.1 Program Kurikulum

- Program Kurikulum adalah wadah reusable untuk satu atau lebih Program Perkembangan (`DevelopmentProgram`). Program dapat bersifat global atau dimiliki tenant dan dapat ditautkan ke `LearningLevel`.
- Kategori seperti `BAHASA_KOMUNIKASI` berada pada Program Perkembangan, bukan pada Program Kurikulum. Satu Program Perkembangan dapat dipakai oleh beberapa Program Kurikulum dan satu Program Kurikulum dapat memiliki beberapa Program Perkembangan.
- Platform Admin membuat, mengubah, mengaktifkan kembali, dan mengarsipkan Program Kurikulum global dari menu **Master data global > Kurikulum global**.
- Staff Admin membuat, mengubah, mengaktifkan kembali, dan mengarsipkan Program Kurikulum tenant. Staff hanya dapat membaca daftar Program Kurikulum.
- Program global tampil bersama program tenant dengan label Global dan dapat ditautkan langsung ke tingkatan tenant tanpa disalin. Tenant tidak memiliki snapshot atau versi lokal dari program global pada flow saat ini.
- Tenant tidak berwenang mengubah atau mengarsipkan Program global. Jika UI tenant menampilkan aksi tersebut pada item Global, aksi itu adalah gap UI dan bukan pemberian hak bisnis.
- Program global hanya dapat menautkan Program Perkembangan global aktif. Program tenant dapat menautkan Program Perkembangan global aktif dan Program Perkembangan aktif milik tenant sendiri.
- `isTemplate=true` dan `source=GLOBAL` menandai record global; record tenant menggunakan `isTemplate=false` dan `source=TENANT`.
- Program yang diarsipkan tidak dapat dipilih untuk relasi tingkatan baru. Relasi lama tetap dipertahankan.

### 6.2 Program Anak

- Program Anak adalah catatan operasional sederhana milik satu anak, berisi nama dan optional deskripsi. Program Anak bukan Program Kurikulum, bukan Program Perkembangan, dan tidak mempunyai indikator, target durasi, progres, atau versioning.
- Staff Admin aktif dapat melihat, menambahkan, dan menghapus Program Anak untuk seluruh anak aktif dalam tenant.
- Staff aktif hanya dapat membuka dan mengelola Program Anak bila memiliki permission tenant `canManageChildPrograms` dan anak berada dalam penugasan langsung atau kelas aktifnya.
- Staff tanpa `canManageChildPrograms` tidak menerima entry point Program Anak pada detail anak. Permission tersebut tidak memberikan hak untuk mengubah Program Kurikulum atau Program Perkembangan.
- Parent tidak menerima entry point Program Anak pada UI saat ini.

### 6.3 Program Perkembangan dan Goal Anak

- Program Perkembangan (`DevelopmentProgram`, sebelumnya disebut Goal Template/Goal Category) menyimpan tingkatan, kategori perkembangan, nama, deskripsi, target durasi, minimum persentase `Yes`, minimum streak, dan indikator (`DevelopmentProgramItem`).
- Platform Admin membuat, mengubah, dan menghapus Program Perkembangan global dari menu **Master data global > Program Perkembangan global**. Indikator hanya dapat ditambahkan saat Program Perkembangan global dibuat; menambah, mengubah, atau mengarsipkan indikator pada Program Perkembangan global yang sudah ada belum didukung.
- Staff Admin mengelola Program Perkembangan tenant, termasuk menambah/mengubah/mengarsipkan indikatornya; Staff tidak dapat membuat atau mengubah Program Perkembangan.
- Program Perkembangan (global maupun tenant) tidak memiliki status arsip/nonaktif terpisah. Penghapusan ditolak selama program masih ditetapkan ke anak mana pun; program yang belum pernah ditetapkan dapat dihapus permanen.
- Pemilih **Tetapkan Goal** saat ini menampilkan seluruh Program Perkembangan global aktif serta Program Perkembangan tenant aktif yang `LearningLevel`-nya sama dengan tingkatan kelas aktif anak. Anak tanpa kelas aktif tidak memperoleh Program Perkembangan tenant dari filter UI tersebut.
- Staff Admin aktif dan Staff aktif dalam scope anak dapat menetapkan Goal langsung kepada anak. Penetapan Goal tidak menggunakan permission `canManageChildPrograms`, karena permission tersebut khusus Program Anak.
- Penetapan menghasilkan Goal Anak dengan tanggal mulai dan target selesai. Program Perkembangan yang sama tidak boleh menghasilkan lebih dari satu Goal aktif untuk anak yang sama.
- Staff Admin dan Staff aktif dalam scope dapat mencatat satu hasil `Yes`/`No` per indikator per hari dan menyimpulkan Goal secara manual dengan ringkasan wajib.
- Satu hari dianggap berhasil bila semua indikator aktif bernilai `Yes`. Hari tanpa catatan tidak mengurangi persentase `Yes`, tetapi memutus streak berturut-turut.
- Parent hanya dapat membaca Goal, hasil harian, progres terhitung, dan kesimpulan akhir anak yang terhubung sebagai walinya.
- Goal yang telah selesai tetap dipertahankan sebagai riwayat.

## 7. Platform Knowledge dan pembentukan template global

Bagian ini adalah **aturan target**. Pipeline agregasi, schema provenance, job evaluasi, API review, dan UI Admin belum dianggap tersedia sampai dicatat sebagai selesai dan terverifikasi pada `docs/changes/`.

### 7.1 Sumber knowledge dan privasi

- Platform Knowledge hanya mengolah Program Kurikulum tenant dan Program Perkembangan tenant: kelompok usia/tingkatan, topik, nama dan deskripsi, kategori, indikator, serta metadata struktur yang diperlukan untuk pengelompokan.
- Program Kurikulum global yang hanya ditautkan tenant, Program Anak, Goal Anak, check-in indikator, dan hasil perkembangan individual tidak menjadi sumber knowledge baru.
- Identitas tenant, Staff, Parent, dan anak; catatan perkembangan individual; hasil penilaian; pembayaran; kehadiran; serta data pribadi lain tidak boleh masuk ke kandidat atau template global.
- Tenant lain tidak dapat melihat record mentah, attribution, atau kontribusi suatu tenant. Template hasil agregasi tidak mencantumkan identitas sumber tenant.
- Duplikasi rencana dalam tenant yang sama tidak menambah bobot. Satu tenant hanya dihitung satu kali untuk satu kelompok knowledge.

### 7.2 Normalisasi dan ambang kandidat

- Rencana dibandingkan dalam kelompok usia atau rentang `LearningLevel` yang sama. Topik, Goal, dan indikator dinormalisasi agar perbedaan kapitalisasi, tanda baca, urutan, atau redaksi yang setara tidak memecah kelompok yang sama.
- Pengelompokan semantik harus menghasilkan skor dan alasan yang dapat diaudit. Implementasi model atau algoritma boleh berkembang, tetapi versi algoritma, konfigurasi ambang, waktu evaluasi, dan jumlah tenant sumber wajib disimpan.
- **Tenant relevan** adalah tenant aktif yang memiliki tingkatan aktif dengan rentang usia yang beririsan dengan kelompok kandidat.
- Kandidat baru hanya lahir jika satu kelompok didukung oleh minimal **50 tenant berbeda** dan jumlahnya **lebih dari 50% tenant relevan** pada kelompok usia tersebut.
- Nilai minimum tenant dan persentase dapat dikonfigurasi Platform Admin. Perubahan berlaku untuk evaluasi berikutnya, tidak menerbitkan template secara langsung, dan wajib masuk audit.
- Contoh: bila terdapat 100 tenant relevan untuk usia tiga tahun dan 51 tenant mempunyai rencana bertopik Teknologi dengan indikator yang setara, sistem membuat satu kandidat Teknologi. Seratus variasi dari satu tenant tetap dihitung sebagai satu tenant.

### 7.3 Review, publikasi, dan versioning

1. Job yang idempotent mengevaluasi rencana tenant dan membentuk atau memperbarui kandidat tanpa membuat kandidat duplikat untuk kelompok yang sama.
2. Kandidat baru berstatus `CANDIDATE` dan tidak terlihat sebagai template global bagi tenant.
3. Platform Admin dapat memperbaiki redaksi, menggabungkan kandidat duplikat, menyetujui, atau menolak kandidat. Semua keputusan menyimpan pelaku, waktu, dan alasan.
4. Persetujuan mengubah kandidat menjadi `APPROVED`; publikasi membuat Program Kurikulum global dan Program Perkembangan global berstatus `PUBLISHED` yang tersedia langsung bagi seluruh tenant.
5. Kandidat yang ditolak berstatus `REJECTED` dan menyimpan alasan. Kelompok yang sama tidak dibuat ulang sampai komposisi sumber atau hasil normalisasinya berubah secara material.
6. Template yang tidak lagi ditawarkan berstatus `ARCHIVED`. Relasi dan riwayat yang sudah ada tetap dipertahankan.

Status minimum lifecycle Platform Knowledge adalah `CANDIDATE`, `APPROVED`, `PUBLISHED`, `REJECTED`, dan `ARCHIVED`. Setiap kandidat atau versi template global menyimpan provenance agregat: versi algoritma, konfigurasi ambang, jumlah tenant berbeda, jumlah tenant relevan, waktu evaluasi, dan referensi versi sebelumnya tanpa menyimpan identitas tenant pada kontrak lintas tenant.

## 8. Perkembangan, notifikasi, dan pengingat

- Catatan perkembangan memakai kategori bawaan maupun kategori tenant yang aktif. Staff hanya dapat menulis dalam scope anaknya.
- Setiap notifikasi inbox disimpan per penerima dan tetap tersedia walaupun push perangkat dimatikan.
- Pengaturan notifikasi hanya menunda push Expo pada perangkat native saat ini atau membisukan notifikasi browser secara lokal. Pengaturan itu tidak menghentikan realtime invalidation dan tidak menyembunyikan inbox.
- Pengingat Staff dijadwalkan lokal pada perangkat Android/iOS. API menyimpan rule dan acknowledgement instalasi; push fallback hanya dikirim bila instalasi belum mengakui rule terbaru. Pengingat yang terlewat tidak diputar ulang.

## 9. Pembatasan data dan lifecycle aman

- Data historis operasional dipertahankan melalui archive/deactivate/void, bukan hard delete, bila data sudah dapat memengaruhi riwayat atau pembayaran.
- Seluruh endpoint backend melakukan otorisasi berdasarkan token, tenant, role, membership aktif, dan scope anak/cabang bila berlaku.
- Filter cabang, tingkatan, dan rombel hanya mempersempit hasil yang sudah diizinkan. Backend tetap memvalidasi seluruh identifier dan relasi hierarkinya.
- Export PDF/XLSX selalu dibangun backend dari data yang telah terotorisasi. Client tidak boleh mengirim baris data atau template laporan untuk menghasilkan file.

## 10. Dokumentasi perubahan

Ketika flow, aturan bisnis, kontrak API, konfigurasi, atau verifikasi berubah:

1. Perbarui dokumen ini bila aturan lintas modul berubah.
2. Perbarui `README.md` bila ringkasan produk, flow utama, atau cara operasi berubah.
3. Tambahkan catatan pada `docs/changes/YYYY-MM-DD/` dengan perilaku, dampak, verifikasi, dan tindak lanjut.
