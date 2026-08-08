# Aturan Bisnis dan Platform Knowledge Usia Emas

Dokumen ini adalah sumber normatif aturan bisnis dan pengetahuan produk lintas modul. Dokumen ini wajib dibaca sebelum implementasi, review, atau perubahan flow, kontrak API, model data, otorisasi, dan arsitektur. Detail implementasi, perubahan harian, hasil verifikasi, serta gap antara aturan target dan implementasi dicatat terpisah di `docs/changes/`.

Aturan yang ditandai sebagai **target** menyatakan arah produk yang telah disetujui tetapi belum tentu sudah tersedia di code atau database. Implementasi yang belum sesuai tidak boleh dijadikan alasan untuk mengubah aturan secara diam-diam.

## 1. Batas data dan peran

- **Tenant** adalah batas data dan penagihan. Anak, cabang, kelas, tagihan, layanan, booking, perkembangan, dan konfigurasi operasional selalu dimiliki tepat oleh satu tenant.
- Satu tenant dapat memiliki beberapa cabang aktif, tetapi hanya satu cabang utama. Keanggotaan `STAFF_ADMIN` berlaku untuk seluruh tenant, bukan hanya cabang tertentu. Setiap daftar atau agregasi yang difilter per cabang (mis. jumlah staf aktif per cabang, daftar akun tenant per cabang) wajib tetap menyertakan setiap `STAFF_ADMIN` pada cabang mana pun yang difilter, terlepas dari nilai `branchId` pada membership-nya (biasanya `null`) — mempersempit per cabang tidak boleh menyembunyikan akun yang secara aturan berlaku lintas cabang.
- **Platform Admin (`ADMIN`)** mengelola lifecycle tenant, langganan, pembayaran tenant, master jenis lembaga, kurikulum global, Program Perkembangan global, serta kategori perkembangan global. Pada setiap jenis lembaga, Platform Admin menetapkan secara terpisah apakah Staff Admin tenant boleh melihat jenis pekerjaan Parent dan/atau rentang penghasilan Parent. Home Admin juga menyediakan dashboard kesiapan tenant yang bersifat informatif: ia melaporkan langganan, Staff Admin, cabang, serta Kelas legacy hanya bila ada offering `PUBLISHED` yang memerlukan layanan Daycare atau kurikulum akademik. Untuk Daycare, paket layanan dan instruksi pembayaran diperiksa pada tenant, sedangkan kapasitas serta jam operasional diperiksa hanya pada setiap cabang **aktif** yang memiliki offering `PUBLISHED` ber-capability `DAYCARE_OPERATIONS`; cabang nonaktif atau cabang lain tidak boleh membuat tenant tampak belum siap. Dashboard ini tidak mengubah status tenant atau visibilitas katalog Parent.
- **Staff Admin (`STAFF_ADMIN`)** mengelola konfigurasi dan operasi tenant: cabang, anak, kelas, pendamping, Goal, layanan, les privat, pembayaran Parent, booking, dan persetujuan enrollment. Home Staff Admin secara read-only menampilkan kesiapan tenant aktif dengan aturan yang sama seperti dashboard Platform Admin; kartu hanya menunjukkan konfigurasi yang belum lengkap dan membuka hub Kelola, tanpa mengubah akses, langganan, atau visibilitas katalog Parent. Hub Kelola menampilkan checklist langkah yang dapat ditindaklanjuti dari respons server; langganan tetap hanya berupa pemberitahuan karena dikelola Platform Admin, dan penambahan anak bukan prasyarat agar lembaga siap menerima pendaftaran.
- **Staff (`STAFF`)** hanya dapat membaca atau mengubah data anak dalam penugasan langsungnya atau kelas aktif yang ditugaskan kepadanya. Kemampuan tambahan, seperti mengelola Program Pendampingan Anak atau kategori perkembangan, harus diberikan secara eksplisit oleh Staff Admin. Home Staff menyediakan ikon inbox notifikasi dengan badge belum dibaca; inbox beserta pengaturannya tidak lagi dibuka dari Profile.
- **Parent (`PARENT`)** hanya dapat melihat dan bertindak atas anak yang terhubung sebagai wali pada tenant aktif. Satu Parent dapat memiliki relasi pada beberapa tenant. Pengecualian yang disengaja adalah `ParentOperatingHoursOverview`: read model agregat **read-only** dari server yang hanya memuat anak dan jam operasional pada tenant yang memang memiliki guardian authority aktif, selalu dikelompokkan dengan `organizationId`/nama tenant dan child scope asal. Ia tidak dapat dipakai sebagai sumber query tenant biasa, cache lintas-tenant, deep link mutasi, atau ID yang dapat dikirim ke endpoint operasi; setiap tap ke detail harus membangun ulang context tenant legal terlebih dahulu.
- Setelah signup, akun dengan `registrationRole=PARENT` dapat melengkapi profil keluarga global dari Profile, tanpa menambah field pada signup. Data suami dan istri—tanggal lahir, jenis pekerjaan, dan rentang penghasilan bulanan—seluruhnya opsional dan tetap sama saat Parent berpindah tenant. Pilihan pekerjaan dibatasi ke daftar sistem; rentang penghasilan dibatasi ke tidak ada penghasilan, kurang dari Rp3 juta, Rp3–5 juta, Rp5–10 juta, Rp10–20 juta, atau lebih dari Rp20 juta. Data ini hanya menjadi pertimbangan manual biaya SPP sekolah anak; sistem tidak menghitung atau mengubah SPP, paket, booking, maupun kredit secara otomatis. Tanggal lahir tetap hanya untuk Parent. Jika tenant mengaktifkan field terkait, server boleh membuat projection/snapshot minimal pada pengajuan Parent untuk `STAFF_ADMIN` ber-scope penerimaan/keuangan yang benar-benar sedang memproses pengajuan tersebut; profil keluarga global penuh tetap owner-only. `STAFF`, tenant tanpa izin tersebut, Platform Admin, daftar tenant umum, dan endpoint profil global tidak menerima field tersebut.
- Navigasi Parent menempatkan akses Profil pada ikon toolbar di Home, baik ketika Parent sudah memiliki tenant aktif maupun masih berada pada onboarding. Profil selalu merupakan child screen mandiri dengan app bar dan tombol kembali, bukan bottom tab Parent; keluar akun tetap hanya tersedia dari Profil. Semua pengguna yang sudah masuk dapat menambah, mengganti, atau mengosongkan username global opsional dari Profil. Username yang diisi harus unik secara global dan panjangnya 2–100 karakter; email tetap wajib dan tidak dapat diubah lewat flow ini.
- Pengganti bahasa aplikasi (`LanguageSelectField`, dropdown yang membuka BottomSheet pilihan) hanya tersedia di layar Profil, untuk pengguna yang sudah masuk. Layar Sign In tidak menampilkan pengganti bahasa; bahasa pada layar pra-login mengikuti bahasa perangkat/preferensi tersimpan tanpa kontrol eksplisit di layar tersebut. Bahasa yang didukung aplikasi: Bahasa Indonesia (`id`, default), Inggris (`en`), Mandarin Sederhana (`zh`), Prancis (`fr`), Portugis (`pt`), Spanyol (`es`), dan Rusia (`ru`); ketujuhnya memiliki cakupan terjemahan lengkap dan identik untuk setiap string UI (`TranslationKey`) — tidak ada bahasa yang hanya sebagian diterjemahkan atau jatuh ke fallback Bahasa Indonesia secara diam-diam. Label peran seperti "Staff Admin" dan "Parent" sengaja tidak diterjemahkan dan tetap tampil sama di ketujuh bahasa.
- Layar Sign In selalu terpusat secara vertikal dan horizontal di dalam viewport, baik pada mobile maupun web, terlepas dari tinggi layar. Ini berlaku pada seluruh lebar layar, bukan hanya breakpoint tertentu; pada layar pendek atau saat keyboard terbuka, konten tetap dapat digulir tanpa kehilangan kemampuan scroll ke elemen yang tertutup keyboard.
- Metode Email/Password Firebase telah dinonaktifkan (dilakukan di Firebase Console) untuk seluruh pengguna, di seluruh peran. Identitas pihak ketiga yang tersisa di Firebase hanya **Google Sign-In** dan **Nomor HP (OTP)**.
- Karena Firebase Email/Password sudah tidak ada, login dengan **email/username dan password** diverifikasi terhadap hash password milik aplikasi sendiri di database (mekanisme yang sebelumnya disebut `local auth`), bukan ke Firebase, lalu backend menerbitkan token sesi sendiri (issuer `daycare-local`) — berlaku untuk seluruh environment dan seluruh peran yang memakai password (Staff, Staff Admin, Platform Admin), bukan lagi kekhususan development di balik flag. Backend memilih decoder JWT (lokal atau Firebase) berdasarkan klaim `iss` token, sehingga kedua jenis sesi berjalan berdampingan. Google dan Nomor HP (OTP) Firebase adalah **verifikasi identitas**, bukan pembuatan akun maupun login password alternatif: `IdentityService.sync()` hanya boleh memakai identitas yang sudah cocok dengan `UserProfile` melalui Firebase UID, email, atau nomor HP dan tidak boleh membuat `UserProfile` baru. Jika email Google atau nomor HP belum terdapat pada akun mana pun, aplikasi mengarahkan pengguna ke `sign-up` untuk membuat akun Parent dengan nama, email, dan password. Email Google yang terverifikasi menjadi email pendaftaran yang tidak dapat diubah; nomor HP terverifikasi disimpan pada akun baru setelah pendaftaran sukses. Google yang sudah cocok dengan akun tidak menyelesaikan login dan diarahkan kembali ke email/username + password; nomor HP yang sudah cocok dapat menyelesaikan sesi OTP tanpa password. Endpoint pendaftaran lokal menerima token Firebase opsional hanya untuk memvalidasi email dan menyimpan nomor HP terverifikasi, lalu mengeluarkan token sesi aplikasi.
- Logout selalu menghapus sesi pada perangkat. Ketika API dapat dijangkau, aplikasi juga mengirim token aktif ke endpoint logout backend secara best-effort dan segera kembali ke Login tanpa menunggu hasilnya. Backend menyimpan hanya hash SHA-256 token sampai expiry alaminya dan menolak token tersebut pada semua request berikutnya, termasuk token aplikasi dan token Firebase. Kegagalan jaringan, response error, atau kegagalan Firebase sign-out tidak boleh menghalangi logout lokal atau navigasi ke Login.
- Akun yang tidak aktif hanya dapat memiliki akses baca yang secara eksplisit
  diizinkan oleh policy resource dan scope historisnya. Mutasi operasional
  normal memerlukan membership aktif; pengecualian hanya action sempit yang
  diterbitkan dan divalidasi sebagai grant resource eksplisit, misalnya
  acknowledge insiden atau penyelesaian invoice tertentu pada §13. Tidak ada
  grant seperti itu yang mengaktifkan kembali membership. Akses baca umum ini
  tidak mencakup health detail, medication, pickup authorization, live
  attendance, insiden baru, export, kontak guardian, atau dokumen admission
  tanpa grant resource yang eksplisit.

## 2. Tenant, cabang, dan akun Staff

- Membuat tenant selalu membuat satu akun `STAFF_ADMIN` aktif pertama, ditandai `primaryStaffAdmin`. Perlindungannya dua lapis dan berbeda mekanisme: akun `primaryStaffAdmin` tidak dapat dihapus, dinonaktifkan, atau diubah sama sekali selama masih menjadi tenant tersebut — bukan karena hitungan Staff Admin aktif, tetapi karena flag ini bersifat permanen; secara terpisah, menonaktifkan Staff Admin mana pun (termasuk yang bukan primary) tetap ditolak bila itu akan membuat jumlah Staff Admin aktif tenant menjadi nol.
- Staff Admin dapat menambahkan Staff Admin tambahan dan Staff dari **Akun tenant** melalui tombol floating. Platform Admin menambahkan Staff Admin tambahan dari detail tenant. Kedua alur meminta nama tampilan, email wajib, password, serta username unik global yang opsional; username disimpan pada identitas global. Saat membuat `STAFF`, izin kelola Program Pendampingan Anak dan kategori perkembangan bersifat opsional serta secara default tidak aktif. Staff Admin dapat mengubah akun `STAFF` aktif dalam tenantnya: nama tampilan, email, username, cabang aktif, serta dua izin tersebut. Peran dan password tidak dapat diubah dari form edit; perubahan password tetap memakai alur khusus. Karena Firebase Email/Password sudah dinonaktifkan (lihat §1), akun dan password-nya mengikuti aturan target di §1: disimpan dan diverifikasi langsung di basis data aplikasi, bukan dibuat atau diverifikasi lewat Firebase. Pada layar masuk, pengguna dapat memakai email atau—bila disetel—username. Menonaktifkan akun berarti mencabut akses tenant, bukan menghapus identitas global atau riwayatnya.
- Nama tampilan, email, dan username adalah bagian dari identitas global; cabang, status aktif, role tenant, dan permission adalah bagian dari membership tenant. Karena itu, edit kredensial yang diizinkan dari tenant memperbarui identitas yang sama secara global, sedangkan edit cabang/permission hanya memengaruhi tenant aktif. Rincian kontrak tersedia pada [Tenant staff accounts](tenant-staff-accounts.md).
- Setiap cabang yang dibuat atau diubah Staff Admin wajib memiliki alamat lengkap free text. Tautan Google Maps bersifat opsional tetapi, bila diisi, harus memakai URL HTTPS Google Maps yang valid. Lokasi adalah data cabang, bukan data tenant global. Parent dapat melihat lokasi cabang anaknya dari Profil Anak dan membuka tautan Maps; Parent tidak dapat mengubahnya.
- Cabang non-utama dapat diarsipkan. Cabang yang diarsipkan tidak tersedia untuk enrollment baru, kelas baru, kapasitas baru, atau penempatan anak baru; riwayatnya tetap dipertahankan.
- Katalog built-in mencakup `DAYCARE`, `TPA`, `KB`, `SPS`, `PAUD`, `TK`, `RA`, `BIMBA`, `SD`, `MI`, `SMP`, `MTS`, `SMA`, `MA`, dan `SMK`. Tenant dapat memiliki lebih dari satu jenis. Selain `DAYCARE`, `PAUD`, dan `TK` yang capability-nya sudah ditentukan, jenis tambahan dapat disimpan dan dipilih tetapi tidak otomatis memperoleh capability bisnis baru atau memunculkan menu/route baru.

## 3. Enrollment Parent dan pembayaran

1. Parent mendaftar secara global sebagai `PARENT`, lalu memilih tenant, anak, dan paket layanan. Katalog tenant yang ditampilkan ke Parent memuat **semua tenant dengan langganan `ACTIVE` atau `TRIAL` dan capability `DAYCARE_OPERATIONS`**, terlepas dari apakah tenant tersebut sudah punya cabang atau Paket Layanan aktif. Tenant `PENDING_PAYMENT`, `SUSPENDED`, atau `EXPIRED` tidak ditampilkan. Tenant tanpa cabang/paket aktif tetap tampil di katalog tetapi Parent belum dapat menyelesaikan pemilihan cabang/paket sampai Staff Admin tenant melengkapi datanya.
2. Sistem membuat aplikasi `PENDING_APPROVAL` dengan snapshot paket serta harga; tahap ini belum membuat booking atau invoice.
3. Hanya Staff Admin tenant yang dapat menyetujui atau menolak aplikasi. Daftar persetujuan membedakan **Pengajuan pendaftaran Parent** dari **Permintaan booking**, sehingga keputusan pendaftaran sebelum pembayaran tidak tertukar dengan keputusan booking setelah pembayaran.
4. Persetujuan membuat membership Parent tenant, relasi wali-anak, invoice, dan entitlement layanan yang masih pending.
5. Parent melihat instruksi transfer tenant, lalu mengunggah bukti pembayaran JPEG/PNG.
6. Staff Admin memverifikasi bukti pembayaran. Hanya sesudah verifikasi entitlement menjadi aktif dan Parent dapat memakai layanan terkait.

Parent dapat membatalkan aplikasi yang masih `PENDING_APPROVAL`. Ketika invoice enrollment yang telah disetujui melewati jatuh tempo dan Parent tidak memiliki entitlement aktif lain pada tenant itu, akses operasional Parent tenant dinonaktifkan dan Parent perlu mengajukan aplikasi baru.

Selain jalur aplikasi di atas, Staff Admin dapat menautkan langsung akun Parent yang **sudah ada** ke seorang anak dari layar detail anak (atau sekaligus saat membuat anak baru), dengan mencari username atau email persis (salah satu wajib diisi; akun yang tidak ditemukan ditolak). Akun target **wajib** memiliki `UserProfile.registrationRole=PARENT`; membership tenant berperan `PARENT`, akun Staff/Admin, atau akun lama tanpa registration role tidak dapat ditautkan sebagai wali baru. Penautan ini tidak membuat akun Parent baru, undangan, aplikasi, invoice, maupun entitlement layanan apa pun — hanya membuat (atau mengaktifkan kembali) membership `PARENT` pada tenant tersebut dan relasi wali-anak bila belum ada. Staff Admin juga dapat memutus relasi ini; tindakan tersebut hanya menghapus relasi wali-anak dan tidak menonaktifkan membership secara otomatis. Anak yang belum memiliki Parent tetap dapat dikelola dalam operasi tenant.

Daftar **Anak** Staff Admin menghitung status wali dari relasi yang sudah berada dalam child scope server dan hanya mengirimkannya kepada Staff Admin: `LINKED` bila setidaknya satu relasi dan seluruh akun target adalah Parent terdaftar, `UNLINKED` bila belum ada relasi, dan `REVIEW_REQUIRED` bila relasi lama mengarah ke akun yang hilang, bukan Parent, atau tanpa registration role. Staff Admin dapat memfilter ketiga status tersebut; filter memakai Bottom Sheet draf dan baru memengaruhi daftar maupun ekspor laporan Anak setelah **OK**. Relasi lama yang perlu diperiksa tidak dicabut, dikonversi, atau diberi membership otomatis; Staff Admin meninjaunya pada detail anak dan dapat melepas relasi yang salah secara manual. Status, filter, penanda peringatan, dan daftar wali pada detail ini tidak dikirim kepada Staff, Parent, atau Platform Admin. Jalur ini ditujukan untuk anak yang datanya sudah diinput langsung oleh Staff Admin (mis. migrasi data atau pendaftaran luring), sebagai pelengkap—bukan pengganti—alur persetujuan enrollment Parent di atas.

### Les privat

- Les privat adalah layanan tambahan khusus penawaran PAUD dan TK. Tenant atau cabang Daycare murni tidak boleh membuat, membaca, atau menawarkan layanan ini kepada Parent. Layanan ini tidak bergantung pada capability `DAYCARE_OPERATIONS` dan tidak membuat entitlement atau booking Daycare.
- Endpoint dan UI les privat memerlukan capability `ACADEMIC_CURRICULUM` dan `UiAccessContext` dengan offering PAUD/TK yang published, sehingga tenant Daycare murni tidak dapat melihat atau mengelolanya. Sampai setiap layanan dan placement legacy mempunyai `offeringId`, capability tenant tetap menjadi compatibility guard server tambahan dan tidak menggantikan scope offering kanonis.
- Staff Admin membuat layanan per cabang dengan rentang usia dalam bulan, satu atau lebih Tingkatan, durasi, serta satu atau lebih tutor aktif. Harga bukan nilai tunggal per sesi: layanan menyimpan sampai tiga tarif independen dan opsional—harian, mingguan, dan bulanan—dengan minimal satu di antaranya wajib diisi bernilai lebih dari nol dan tidak melebihi Rp1.000.000.000. Tutor dapat berupa akun `STAFF` tenant aktif atau tutor eksternal; kontak tutor tidak ditampilkan ke Parent.
- Parent hanya melihat layanan yang cocok dengan anak wali pada tenant dan cabang yang sama, memiliki penempatan Tingkatan aktif yang cocok, serta memenuhi rentang usia pada tanggal pengajuan. Parent memilih salah satu tarif yang tersedia pada layanan tersebut (harian/mingguan/bulanan), lalu mengajukan satu sesi dengan tanggal dan jam pilihan opsional serta catatan. Nominal tarif yang dipilih disalin ke pengajuan saat dibuat; perubahan harga layanan setelahnya tidak memengaruhi pengajuan yang sudah ada.
- Pengajuan dimulai sebagai `PENDING_APPROVAL`. Staff Admin memilih tutor dari layanan dan jadwal, atau menolak dengan alasan wajib. Waktu jadwal saat ini disimpan tanpa zona waktu eksplisit (bukan dalam zona waktu cabang); ini adalah gap implementasi yang belum diperbaiki, bukan perilaku yang disengaja. Server menolak benturan jadwal untuk tutor yang sama pada pengajuan `PENDING_PAYMENT` dan `CONFIRMED`.
- Persetujuan membuat invoice `PRIVATE_TUTORING` satu sesi dengan jatuh tempo dua hari dan memindahkan pengajuan ke `PENDING_PAYMENT`. Bukti pembayaran diverifikasi melalui alur invoice biasa; pembayaran terverifikasi mengonfirmasi sesi (`CONFIRMED`), sedangkan invoice lewat jatuh tempo membatalkan pengajuan. Parent dapat membatalkan pengajuan sebelum bukti pembayaran dikirim; pembatalan membatalkan invoice yang masih `PENDING`.
- Pengajuan, keputusan, pembayaran, pembatalan, dan kedaluwarsa mengirim inbox, invalidasi realtime `PRIVATE_TUTORING`, dan push Expo native bila perangkat penerima terdaftar. Staff internal yang dipilih sebagai tutor menerima notifikasi jadwal setelah pembayaran diverifikasi.

## 4. Paket, booking, dan kehadiran

- Paket layanan dan entitlement berada dalam scope tenant dan, bila relevan, cabang.
- Kapasitas harian (baik pada Paket Layanan maupun pengaturan kapasitas cabang) wajib berupa bilangan bulat antara 1 dan 999. Backend memvalidasi ulang batas ini terlepas dari pemformatan input di client.
- Booking kapasitas dari alur credit-drawdown (pemakaian entitlement yang sudah ada) hanya dibuat setelah entitlement aktif. Alur pembelian langsung dengan tanggal (`purchaseForChild`, non-deferred) berbeda: kapasitas direservasi dan booking dibuat pada saat invoice diterbitkan, selagi entitlement baru masih `PENDING_PAYMENT`; kapasitas baru dilepas kembali bila invoice kedaluwarsa belum dibayar. Aplikasi enrollment tidak mengunci kapasitas booking. Daftar persetujuan booking menampilkan nomor serta total invoice yang menjadi snapshot pembayaran booking; total tersebut tidak dihitung ulang di client agar diskon dan harga yang sudah terkunci tetap akurat.
- Riwayat booking Parent selalu dibatasi pada anak yang sedang dipilih di layar Booking. Jumlah pada kartu, daftar, dan keadaan kosong memakai scope anak yang sama; membuka riwayat meminta data terbaru, sedangkan realtime dan mutasi booking tetap menginvalidasi data yang sama.
- Staff dalam scope anaknya dapat menyetujui atau menolak booking biasa. Persetujuan enrollment tetap khusus Staff Admin. Kegagalan keputusan harus ditampilkan inline pada konteks persetujuan yang sedang terbuka; error tidak boleh hanya bergantung pada dialog sistem, terutama di web.
- Pada tenant dengan capability `DAYCARE_OPERATIONS`, kehadiran memerlukan booking yang telah dikonfirmasi. PAUD dan TK tetap dapat memakai kehadiran sebagai shared core tanpa prasyarat booking Daycare.
- Check-in/out dapat dilakukan manual atau melalui QR Parent. Payload QR diverifikasi terhadap child ID dan nama yang ditandatangani server; nama tampilan saja tidak dipercaya.
- Check-in/out manual meminta konfirmasi eksplisit sebelum disimpan dan boleh menyertakan jam kejadian pilihan Staff (bukan hanya waktu saat submit). Server memvalidasi tiga batasan pada jam tersebut: tidak boleh berada di masa depan, harus jatuh pada hari operasional cabang anak yang sama (dihitung memakai zona waktu cabang, bukan zona waktu server), dan jam check-out tidak boleh lebih awal dari jam check-in yang sudah tercatat.
- Job terjadwal memeriksa setiap menit anak yang masih check-in (belum check-out) pada cabang yang jam operasionalnya untuk hari itu sudah lewat. Bila cabang tersebut juga memiliki minimal satu blok tarif overtime aktif, setiap wali anak menerima satu notifikasi (inbox, realtime, dan push bila tersedia) yang memberitahukan anak masih tercatat hadir dan berpotensi dikenakan biaya tambahan; notifikasi ini dikirim tepat sekali per hari operasional per anak, bukan diulang setiap menit job berjalan. Ini murni pemberitahuan proaktif, bukan pembuatan charge overtime—charge overtime aktualnya tetap dibuat manual oleh Staff Admin sesuai §13.6.2. Cabang tanpa blok tarif overtime tidak menerima notifikasi ini karena anak yang telat dijemput di sana tidak akan pernah dikenakan biaya tambahan.
- Layar QR Parent menampilkan QR anak secara langsung tanpa langkah pilih anak lebih dulu ketika Parent hanya memiliki tepat satu anak yang terlihat pada layar tersebut (baik karena Parent hanya punya satu anak, maupun karena layar dibuka dengan `childId` tertentu). Ketika anak yang terlihat lebih dari satu, Parent tetap memilih anak dari daftar terlebih dahulu sebelum QR ditampilkan pada BottomSheet, seperti semula.
- Staff Admin dapat mengunduh rekap kehadiran anak per cabang untuk rentang tanggal inklusif dalam PDF atau XLSX dari menu Kelola. Rekap hanya mencakup anak aktif dengan enrollment aktif pada cabang yang dipilih dan memuat total check-in, total check-out, serta check-in yang belum check-out untuk setiap anak. Anak tanpa record kehadiran tetap ditampilkan dengan total nol; total nol tidak boleh diberi label atau diartikan sebagai ketidakhadiran karena bisa tidak ada booking atau hari operasional pada periode tersebut. Staff dan Parent tidak menerima akses ekspor ini. Cabang wajib milik tenant dan rentang tanggal harus valid; Staff Admin yang tidak aktif tetap hanya-baca sesuai aturan tenant.
- Parent yang sudah terhubung dapat mengajukan anak tidak masuk untuk rentang tanggal hari ini atau masa depan dengan alasan sakit, keluar kota, acara keluarga, keadaan darurat, atau alasan lain yang wajib diberi catatan. Pengajuan yang tanggalnya tumpang tindih dan masih `PENDING` atau sudah `APPROVED` ditolak. Parent hanya dapat membatalkan pengajuan miliknya saat masih `PENDING`; Staff Admin atau Staff dalam scope anak menyetujui atau menolak, dan penolakan wajib memiliki alasan. Pengajuan tidak masuk bersifat informatif: tidak membuat, membatalkan, mengubah, maupun mengembalikan booking atau kredit layanan. Kehadiran aktual tetap dicatat melalui flow kehadiran yang berlaku.

## 5. Anak, kelas, dan scope Staff

- Data anak selalu terkait tenant, cabang, dan status enrollment. Anak dengan aplikasi Parent yang belum disetujui tidak dihitung sebagai anak aktif kelas dan tidak memakai kapasitas kelas.
- `LearningLevel` adalah tingkatan (misalnya Nursery atau TK A); `Classroom`/rombel adalah kelompok paralel (misalnya `TK A – Matahari`). Keduanya terpisah.
- Satu anak memiliki paling banyak satu penempatan kelas aktif. Memindahkan anak menutup penempatan sebelumnya dan menyimpan riwayatnya.
- `STAFF_ADMIN` dapat menempatkan anak aktif ke rombel aktif mana pun dalam cabang anak yang sama. `STAFF` dengan penugasan langsung pada anak dapat memilih rombel aktif mana pun dalam cabang yang sama. `STAFF` yang hanya memperoleh akses melalui rombel aktif anak hanya dapat memindahkan anak ke rombel aktif dalam cabang yang sama yang juga menugaskan Staff tersebut. Target yang ditampilkan kepada klien dan validasi mutasi di server wajib memakai aturan yang sama.
- Kapasitas kelas diprioritaskan; jika kelas tidak menetapkan kapasitas sendiri, kapasitas cabang digunakan.
- Scope Staff berasal dari penugasan langsung pada anak atau penugasan pada kelas aktif. Scope hanya dapat mempersempit akses, tidak pernah memperluas akses tenant.

## 6. Kurikulum, Goal, dan perkembangan

UI/UX belum memiliki satu entity bernama **Rencana Belajar** yang ditetapkan sebagai satu paket kepada anak. Namun, penetapan Goal baru memiliki rantai wajib: **Program Kurikulum → Program Perkembangan → Goal Anak → Daily Assessment**. Program Pendampingan Anak tetap merupakan konsep terpisah dan tidak boleh dianggap sebagai record atau lifecycle yang sama dengan rantai Goal.

### 6.1 Program Kurikulum

- Program Kurikulum adalah wadah reusable untuk satu atau lebih Program Perkembangan (`DevelopmentProgram`). Program dapat bersifat global atau dimiliki tenant dan dapat ditautkan ke `LearningLevel`.
- Kategori seperti `BAHASA_KOMUNIKASI` berada pada Program Perkembangan, bukan pada Program Kurikulum. Satu Program Perkembangan dapat dipakai oleh beberapa Program Kurikulum dan satu Program Kurikulum dapat memiliki beberapa Program Perkembangan.
- Platform Admin membuat, mengubah, mengaktifkan kembali, dan mengarsipkan Program Kurikulum global dari menu **Master data global > Kurikulum global**.
- Staff Admin membuat, mengubah, mengaktifkan kembali, dan mengarsipkan Program Kurikulum tenant. Staff hanya dapat membaca daftar Program Kurikulum.
- Program global tampil bersama program tenant dengan label Global dan dapat ditautkan langsung ke tingkatan tenant tanpa disalin. Tenant tidak memiliki snapshot atau versi lokal dari program global pada flow saat ini.
- Program global yang dibuat atau diubah wajib memiliki tepat satu **tingkatan referensi global**. Pemilih Program Perkembangan global hanya menampilkan record pada tingkatan referensi tersebut, dan API menolak relasi Program Perkembangan lintas tingkatan. Tingkatan referensi global ini tidak menggantikan relasi Program Kurikulum ke tingkatan tenant: Staff Admin tetap dapat menautkan program global yang sama ke tingkatan tenant tanpa membuat salinan.
- Program global lama yang belum memiliki tingkatan referensi tetap dapat dibaca untuk menjaga data historis, tetapi Platform Admin wajib memilih tingkatan referensi sebelum dapat menyimpannya kembali. Sistem tidak menebak atau memigrasikan tingkatan referensi dari nama program maupun Goal yang lama.
- Tenant tidak berwenang mengubah atau mengarsipkan Program global. Jika UI tenant menampilkan aksi tersebut pada item Global, aksi itu adalah gap UI dan bukan pemberian hak bisnis.
- Program global hanya dapat menautkan Program Perkembangan global yang
  tersedia (belum dihapus). Program tenant dapat menautkan Program
  Perkembangan global yang tersedia dan Program Perkembangan tenant sendiri
  yang tersedia.
- `isTemplate=true` dan `source=GLOBAL` menandai record global; record tenant menggunakan `isTemplate=false` dan `source=TENANT`.
- Program yang diarsipkan tidak dapat dipilih untuk relasi tingkatan baru maupun penetapan Goal baru. Relasi dan Goal historis tetap dipertahankan.

### 6.2 Program Pendampingan Anak

- **Program Pendampingan Anak** (entity tetap bernama `ChildProgram` untuk kompatibilitas) adalah rencana individual milik satu anak untuk kebutuhan operasional dan koordinasi rumah-sekolah, misalnya toilet training, adaptasi kelas, makan mandiri, atau pendampingan perilaku. Ia bukan Program Kurikulum, Program Perkembangan, maupun Goal Anak.
- Program menyimpan nama, deskripsi konteks internal, status `ACTIVE`/`COMPLETED`/`DISCONTINUED`, pilihan eksplisit untuk membagikan program, **ringkasan khusus Parent** opsional, dan panduan rumah opsional. Program baru bersifat `ACTIVE` dan **tidak dibagikan** kepada Parent secara default. Deskripsi konteks internal tidak boleh diproyeksikan ke Parent; hanya nama, ringkasan khusus Parent, panduan rumah, dan Langkah yang dibagikan yang boleh keluar pada response Parent.
- Satu Program dapat memiliki beberapa **Langkah Pendampingan** yang berisi judul, instruksi untuk Staff, urutan tampil, status selesai/belum selesai, serta panduan rumah opsional. Langkah yang dibagikan baru boleh terlihat Parent bila Program induknya juga dibagikan; Parent tidak dapat mengubah langkah maupun status selesai.
- Staff dapat membuat **Catatan Pelaksanaan** internal pada Program atau Langkah untuk mencatat kejadian dan tindak lanjut. Catatan internal tidak pernah dikirim pada response Parent.
- Parent yang benar-benar terhubung sebagai guardian pada anak boleh membaca ringkasan, panduan rumah, dan Langkah yang secara eksplisit dibagikan. Parent dapat mengirim **Umpan Balik Parent** teks singkat pada Program yang dibagikan; umpan balik mencatat Parent pengirim serta waktu, dapat dibaca Staff, dan tidak dapat mengubah status Program/Langkah atau catatan Staff.
- Status selesai pada Program atau Langkah hanya menutup rencana pendampingan/tindakan operasional. Ia **bukan** penilaian kompetensi atau perkembangan anak dan tidak menghasilkan skor, persentase, streak, indikator, rubrik, target durasi, maupun kesimpulan Goal. Data ini tidak boleh dipakai oleh Platform Knowledge.
- Staff Admin aktif dapat melihat dan mengelola semua Program Pendampingan Anak dalam tenant. Staff aktif hanya dapat membuat, mengubah, menutup, menghapus, menambah Langkah, dan menulis Catatan Pelaksanaan bila memiliki permission tenant `canManageChildPrograms` serta anak berada dalam penugasan langsung atau kelas aktifnya. Permission ini tidak memberikan hak untuk mengubah Program Kurikulum atau Program Perkembangan.
- Parent tidak melihat Program yang tidak dibagikan, Catatan Pelaksanaan internal, umpan balik Parent lain, atau data anak di luar guardian link dan tenant aktifnya. Staff Admin/Staff melihat seluruh data Program Pendampingan Anak yang berada dalam scope legalnya.
- Menghapus Langkah hanya diperbolehkan selama belum memiliki Catatan Pelaksanaan yang menautkannya. Menghapus Program hanya diperbolehkan selama belum memiliki Langkah, Catatan Pelaksanaan, atau Umpan Balik Parent. Program yang sudah memiliki riwayat harus ditutup dengan `COMPLETED` atau `DISCONTINUED` agar koordinasi dan konteks historis tetap terjaga.
- Daftar Program pada detail anak dapat dibuka dalam Bottom Sheet. Saat Staff memilih **Kelola Program**, UI wajib menutup Bottom Sheet tersebut terlebih dahulu, baru menavigasi ke layar kelola Program; sheet tidak boleh tetap terpasang di belakang layar tujuan.

### 6.3 Program Perkembangan dan Goal Anak

- Program Perkembangan (`DevelopmentProgram`, sebelumnya disebut Goal Template/Goal Category) menyimpan tingkatan, kategori perkembangan, nama, deskripsi, target durasi, minimum persentase `Yes`, minimum streak, dan indikator (`DevelopmentProgramItem`).
- Platform Admin membuat, mengubah, dan menghapus Program Perkembangan global dari menu **Master data global > Program Perkembangan global**. Indikator hanya dapat ditambahkan saat Program Perkembangan global dibuat; menambah, mengubah, atau mengarsipkan indikator pada Program Perkembangan global yang sudah ada belum didukung.
- Staff Admin mengelola Program Perkembangan tenant, termasuk menambah/mengubah/mengarsipkan indikatornya; Staff tidak dapat membuat atau mengubah Program Perkembangan. Layar **Goals** menampilkan daftar Program Perkembangan milik tenant beserta aksi **Ubah** hanya untuk Staff Admin aktif; record `source=GLOBAL` tidak boleh memiliki aksi ubah pada UI tenant.
- Program Perkembangan adalah definisi reusable tanpa snapshot versi per Goal Anak. Menyimpan perubahan target, nama, deskripsi, tingkatan, kategori, atau indikator tenant memengaruhi tampilan dan perhitungan Goal Anak yang menggunakannya saat ini, termasuk Goal aktif dan riwayat yang dibaca Parent. Form **Ubah Program Perkembangan** wajib memberi pemberitahuan yang jelas sebelum Staff Admin menyimpan perubahan tersebut.
- Program Perkembangan (global maupun tenant) tidak memiliki status
  arsip/nonaktif terpisah. Penghapusan ditolak selama program masih ditetapkan
  ke anak mana pun; program yang belum pernah ditetapkan dapat dihapus
  permanen. Dalam §6, “tersedia” berarti record belum dihapus dan relasinya
  valid; ini bukan status `PUBLISHED`.
- Pemilih **Tetapkan Goal** selalu dimulai dengan Program Kurikulum aktif yang
  tersedia untuk tenant. Setelah memilihnya, UI dan API hanya menerima Program
  Perkembangan tersedia yang memang ditautkan ke Program Kurikulum tersebut.
  Program Perkembangan tenant tetap harus sesuai dengan `LearningLevel` kelas
  aktif anak; Program global tetap harus sesuai rentang usia anak bila rentang
  usia tersedia.
- Staff Admin aktif dan Staff aktif dalam scope anak dapat menetapkan Goal langsung kepada anak. Penetapan Goal tidak menggunakan permission `canManageChildPrograms`, karena permission tersebut khusus Program Pendampingan Anak.
- Layar Goal menampilkan tombol filter anak dan pemilih daftar anak untuk Staff Admin **hanya** ketika layar dibuka tanpa `childId` tetap pada route (mis. dari hub umum). Ketika layar dibuka dengan `childId` tetap (mis. dari Profil Anak/detail anak), konteks anak sudah pasti sehingga tombol filter, pemilih anak, maupun BottomSheet filter tidak ditampilkan sama sekali — bukan hanya disembunyikan dari tampilan tetapi juga tidak dapat dipicu.
- Tombol **Tetapkan Goal** memakai floating action button pada layar Goal ketika dibuka dengan `childId` tetap (Staff Admin atau Staff dengan hak tulis pada anak tersebut); ini menggantikan floating action "Tambah Template" Staff Admin pada konteks tersebut, karena menetapkan Goal ke anak yang sedang dilihat adalah aksi utama layar dalam konteks itu. Ketika layar dibuka tanpa `childId` tetap (anak dipilih dari daftar dan Goal-nya dibuka lewat BottomSheet), tombol Tetapkan Goal tetap inline di dalam BottomSheet, dan floating action Staff Admin tetap "Tambah Template" seperti semula.
- Penetapan menyimpan `curriculumProgramId` pada Goal Anak, serta menghasilkan tanggal mulai dan target selesai. API menolak Program Kurikulum yang tidak aktif, milik tenant lain, atau pasangan Program Perkembangan yang tidak ditautkan. Program Perkembangan yang sama tidak boleh menghasilkan lebih dari satu Goal aktif untuk anak yang sama.
- Goal Anak yang dibuat sebelum penyimpanan sumber Program Kurikulum tetap bernilai sumber `null`. Sistem tidak menebak atau memigrasikan sumber historis; UI menandainya sebagai data lama tanpa sumber.
- Staff Admin dan Staff aktif dalam scope dapat mencatat satu hasil `Yes`/`No` per indikator per hari dan menyimpulkan Goal secara manual dengan ringkasan wajib.
- UI harian menahan pilihan `Yes`/`No` sebagai draf lokal sampai Staff menekan **Simpan hasil hari ini**. Sebelum penyimpanan berhasil, draf tidak membentuk check-in, tidak mengubah Rekam Hasil Harian Goal, tidak mengubah persentase/streak, dan tidak terlihat oleh Parent atau pengguna lain.
- Penyimpanan harian mengirim satu batch atomik untuk satu Goal dan tanggal. API hanya menerima tepat satu hasil untuk **setiap** indikator aktif Goal saat itu; batch kosong, parsial, duplikat, atau indikator dari Goal lain ditolak tanpa menyimpan hasil mana pun. Setelah berhasil, setiap hasil tetap dapat diubah beserta catatan, foto, atau audio melalui check-in indikator yang sudah tersimpan.
- **Simpan hasil hari ini** bukan **Simpulkan Goal**. Simpulan adalah tindakan terminal terpisah yang menutup Goal aktif dan selalu memerlukan hasil akhir serta ringkasan Staff; menekan simpulan tidak boleh menyimpan atau melengkapi draf check-in harian.
- Hanya Staff Admin **aktif** yang dapat memakai **Koreksi Kesimpulan Goal** pada Goal berstatus `COMPLETED`. Koreksi bukan pembukaan kembali Goal: ia hanya dapat mengganti hasil akhir dan ringkasan Staff saat ini, wajib menyertakan alasan, dan tidak boleh mengubah check-in, indikator, Program sumber, target, tanggal, status `COMPLETED`, atau waktu finalisasi awal.
- Setiap Koreksi Kesimpulan Goal menyimpan rekam append-only berisi hasil/ringkasan sebelum dan sesudah, alasan, Staff Admin pelaku, serta waktu koreksi, dan juga membuat `AuditLog`. Kesimpulan terkoreksi menjadi kesimpulan saat ini yang dibaca Staff dan Parent, sedangkan riwayat koreksi dan alasannya hanya dikirim serta ditampilkan untuk Staff Admin aktif. Tidak ada API atau UI yang dapat menghapus maupun mengubah entri riwayat koreksi.
- Satu hari dianggap berhasil bila semua indikator aktif bernilai `Yes`. Hari tanpa catatan tidak mengurangi persentase `Yes`, tetapi memutus streak berturut-turut.
- Parent hanya dapat membaca Goal, hasil harian, progres terhitung, dan kesimpulan akhir saat ini anak yang terhubung sebagai walinya; Parent tidak menerima riwayat maupun alasan Koreksi Kesimpulan Goal.
- Setiap Goal Anak menampilkan visual read-only **Rekam Hasil Harian Goal** untuk Staff yang berwenang dan Parent terkait, bukan grafik garis. Visual ini hanya memakai check-in indikator yang sudah tersimpan dan menampilkan setiap tanggal yang memiliki setidaknya satu hasil indikator aktif: nama indikator, penanda hijau `Ya`, penanda merah `Tidak`, atau penanda abu-abu `Belum dicatat`, serta ringkasan `{tercatat} dari {aktif} indikator · {Ya} Ya · {Tidak} Tidak`. Bila belum ada check-in tersimpan sama sekali, visual tetap menampilkan semua indikator aktif dengan penanda abu-abu dan ringkasan `0 dari {aktif}` tanpa menciptakan tanggal atau hasil fiktif. Dengan demikian, hari parsial tetap dapat dipahami tanpa dipalsukan sebagai hari lengkap. Visual tidak membuat penilaian, indikator, skor, maupun data Platform Knowledge baru.
- Perhitungan target sistem tetap terpisah dari visual: satu hari baru menambah `recordedDays`, persentase `Yes`, dan streak bila semua indikator aktif pada Goal memiliki hasil tersimpan untuk tanggal tersebut. Bila belum ada satu hari lengkap, UI tidak boleh menampilkan `Ya 0/0 · 0%`; UI wajib menyatakan bahwa belum ada hari dengan hasil indikator lengkap. Kesimpulan manual terminal wajib dilabeli **Kesimpulan Staff** agar tidak terlihat sebagai hasil perhitungan target sistem.
- Goal yang telah selesai tetap dipertahankan sebagai riwayat.

### 6.4 Aktivitas Kurikulum Harian

- Saat Platform Admin membuat tenant baru, sistem membuat 14 `CurriculumActivity` aktif milik tenant untuk rutinitas harian, dari **Morning circle** sampai **Persiapan pulang**, beserta deskripsi operasionalnya.
- Aktivitas default ini bukan kurikulum global dan bukan Program Perkembangan. Staff Admin dapat mengubah atau mengarsipkannya sesuai operasional tenant setelah provisioning selesai.
- Provisioning hanya berlaku pada tenant baru; tenant yang telah ada tidak menerima backfill otomatis.

## 7. Platform Knowledge dan pembentukan template global

Bagian ini adalah **aturan target**. Pipeline agregasi, schema provenance, job evaluasi, API review, dan UI Admin belum dianggap tersedia sampai dicatat sebagai selesai dan terverifikasi pada `docs/changes/`.

### 7.1 Sumber knowledge dan privasi

- Platform Knowledge hanya mengolah Program Kurikulum tenant dan Program Perkembangan tenant: kelompok usia/tingkatan, topik, nama dan deskripsi, kategori, indikator, serta metadata struktur yang diperlukan untuk pengelompokan.
- Program Kurikulum global yang hanya ditautkan tenant, Program Pendampingan Anak, Goal Anak, check-in indikator, dan hasil perkembangan individual tidak menjadi sumber knowledge baru.
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
4. Persetujuan mengubah kandidat menjadi `APPROVED`; publikasi membuat satu
   **template release** berstatus `PUBLISHED` serta membuat Program Kurikulum
   global dan Program Perkembangan global yang tersedia langsung bagi seluruh
   tenant. `PUBLISHED` adalah status release Platform Knowledge, bukan kolom
   status Program Perkembangan pada flow §6.
5. Kandidat yang ditolak berstatus `REJECTED` dan menyimpan alasan. Kelompok yang sama tidak dibuat ulang sampai komposisi sumber atau hasil normalisasinya berubah secara material.
6. Template yang tidak lagi ditawarkan berstatus `ARCHIVED`. Relasi dan riwayat yang sudah ada tetap dipertahankan.

Status minimum lifecycle Platform Knowledge adalah `CANDIDATE`, `APPROVED`, `PUBLISHED`, `REJECTED`, dan `ARCHIVED`. Setiap kandidat atau versi template global menyimpan provenance agregat: versi algoritma, konfigurasi ambang, jumlah tenant berbeda, jumlah tenant relevan, waktu evaluasi, dan referensi versi sebelumnya tanpa menyimpan identitas tenant pada kontrak lintas tenant.

## 8. Perkembangan, notifikasi, dan pengingat

- Catatan perkembangan memakai kategori bawaan maupun kategori tenant yang aktif. Staff hanya dapat menulis dalam scope anaknya. Setiap catatan pada satu kategori dapat memiliki tepat nol atau satu foto bukti opsional (kolom lama, tetap dipertahankan untuk catatan lama); Staff memilih foto dari galeri atau mengambilnya dengan kamera. Foto hanya menerima JPEG/PNG sampai 5 MB, disimpan bersama catatan, dan tidak dikirim pada respons daftar riwayat.
- Selain foto tunggal lama, catatan perkembangan baru dapat memiliki beberapa lampiran foto (JPEG/PNG, 5 MB) dan/atau satu rekaman audio (M4A/MP4, 10 MB) melalui tabel lampiran terpisah. Respons daftar riwayat hanya membawa metadata lampiran (jenis, tipe, durasi); isi biner selalu diambil satu per satu lewat endpoint terpisah dengan otorisasi yang sama seperti catatan itu sendiri. Video belum didukung — menyimpan video sebagai bytea di database transaksional utama dianggap tidak tepat untuk produksi; dukungan video menunggu keputusan penyimpanan objek (mis. S3) secara terpisah.
- Staff Admin, Staff dalam scope anak, dan Parent yang terhubung dapat membaca foto/lampiran melalui catatan perkembangan anak yang sama. Otorisasi foto/lampiran wajib memakai tenant dan scope anak yang sama seperti daftar catatan; media tidak dapat dibaca hanya dengan mengetahui ID catatan atau ID lampiran.
- Setiap notifikasi inbox disimpan per penerima dan tetap tersedia walaupun push perangkat dimatikan.
- Pengajuan anak tidak masuk mengirim notifikasi inbox, invalidasi realtime, dan push Expo native bila perangkat penerima terdaftar: Parent memberi tahu Staff Admin dan Staff yang berada dalam scope anak; keputusan Staff memberi tahu seluruh wali anak yang terhubung; pembatalan Parent memberi tahu pihak operasional yang sama.
- Daftar pengajuan anak tidak masuk untuk `STAFF_ADMIN` memakai tab cabang horizontal yang langsung menerapkan filter; daftar tersebut tidak menggunakan filter draft atau Bottom Sheet. Tab hanya mempersempit data yang sudah diizinkan backend.
- Staff aktif dapat membuat pengajuan `LEAVE` atau `SICK` untuk dirinya sendiri dari Profile. Alasan dan rentang tanggal (mulai hari ini atau masa depan) wajib diisi; satu gambar bukti JPEG/PNG maksimal 5 MB bersifat opsional. Rentang tanggal inklusif yang bertumpang tindih dengan pengajuan milik Staff yang masih `PENDING` atau `APPROVED` ditolak. Staff hanya dapat membatalkan pengajuannya sendiri selama masih `PENDING` dan tidak dapat mengubah pengajuan yang sudah dikirim.
- Semua Staff Admin aktif tenant dapat melihat daftar pengajuan `PENDING` dari menu Kelola dan menyetujui atau menolak. Penolakan wajib menyimpan alasan; keputusan membuat `APPROVED` atau `REJECTED` dan tidak dapat diubah melalui flow ini. Bukti hanya dapat dibaca oleh pemohon atau Staff Admin pada tenant yang sama.
- Pengajuan cuti/sakit bersifat informatif: tidak membuat atau mengubah jadwal, penugasan anak, kapasitas staf, booking, maupun kehadiran secara otomatis. Pengajuan baru memberi notifikasi inbox/push dan realtime kepada seluruh Staff Admin aktif; keputusan memberi notifikasi inbox/push dan realtime kepada pemohon; pembatalan dan keputusan juga menginvalidasi daftar Staff Admin secara realtime.
- Pengaturan notifikasi hanya menunda push Expo pada perangkat native saat ini atau membisukan notifikasi browser secara lokal. Pengaturan itu tidak menghentikan realtime invalidation dan tidak menyembunyikan inbox.
- Pengingat Staff dijadwalkan lokal pada perangkat Android/iOS. API menyimpan rule dan acknowledgement instalasi; push fallback hanya dikirim bila instalasi belum mengakui rule terbaru. Pengingat yang terlewat tidak diputar ulang.

## 9. Pembatasan data dan lifecycle aman

- Data historis operasional dipertahankan melalui archive/deactivate/void, bukan hard delete, bila data sudah dapat memengaruhi riwayat atau pembayaran.
- Seluruh endpoint backend melakukan otorisasi berdasarkan token, tenant, role,
  status membership, capability, dan scope anak/cabang bila berlaku. Mutasi
  operasional biasa membutuhkan membership aktif; endpoint yang melayani grant
  read-only/aksi terbatas harus secara eksplisit memvalidasi resource grant,
  action, tanggal efektif, dan retensi sesuai §1 serta §13—bukan menganggap
  membership nonaktif sebagai aktif.
- Profil keluarga Parent adalah data sensitif global: hanya pemilik akun
  `registrationRole=PARENT` yang dapat membaca atau mengubah profil penuh.
  Satu-satunya pengecualian adalah projection/snapshot minimum pada pengajuan
  Parent yang diizinkan §1 dan hanya dapat dibaca `STAFF_ADMIN` scoped terhadap
  pengajuan tersebut. Data tidak tersedia bagi Staff biasa, Platform Admin,
  daftar tenant, atau endpoint profil tenant umum dan tidak boleh dipakai untuk
  kandidat/template global.
- Filter cabang, tingkatan, dan rombel hanya mempersempit hasil yang sudah diizinkan. Backend tetap memvalidasi seluruh identifier dan relasi hierarkinya.
- Export PDF/XLSX selalu dibangun backend dari data yang telah terotorisasi. Client tidak boleh mengirim baris data atau template laporan untuk menghasilkan file.

## 10. Kesehatan anak, insiden, dan analitik tenant

- **Catatan kesehatan** (`ChildHealthRecord`) adalah profil tunggal per anak (bukan log berjalan seperti catatan perkembangan) — golongan darah, alergi, kondisi medis, obat-obatan, dan instruksi darurat, semua opsional. Pada flow saat ini, Staff Admin dan Staff dalam **child scope** (penugasan langsung atau melalui rombel aktif, sesuai `ChildScopeService.requireStaffManagedChild`) dapat mengisi/mengubahnya; Parent yang terhubung sebagai wali hanya bisa membaca. Setiap perubahan tercatat di audit log karena data ini sensitif. Model target least-privilege, medication order, dan log pemberian obat diatur pada §13.13.
- **Laporan insiden** (`ChildIncidentReport`) dicatat oleh Staff/Staff Admin dalam scope anak: tingkat keparahan (`MINOR`/`MODERATE`/`SERIOUS`), kategori (`INJURY`/`ILLNESS`/`BEHAVIOR`/`OTHER`), deskripsi wajib, tindakan opsional, dan foto opsional (aturan JPEG/PNG 5 MB yang sama seperti catatan perkembangan). Ini bukan alur persetujuan seperti pengajuan absen — setiap Parent/wali penerima hanya menandai acknowledgement miliknya sendiri (idempotent, tidak bisa dibatalkan setelah ditandai), bukan menyetujui/menolak atau mengubah acknowledgement wali lain.
- Insiden baru selalu menotifikasi seluruh wali anak yang terhubung. Insiden dengan `severity = SERIOUS` **juga** menotifikasi seluruh Staff Admin aktif tenant; insiden `MINOR`/`MODERATE` tidak mengeskalasi ke Staff Admin di luar wali.
- **Analitik tenant** (`AnalyticsService`) hanya untuk Staff Admin, dan sepenuhnya terpisah dari sistem Platform Knowledge lintas-tenant di §7 (yang masih aturan target, belum diimplementasikan). Analitik ini mencakup: okupansi per cabang (anak aktif vs kapasitas harian cabang), retensi Parent (jumlah Parent aktif saat ini, plus jumlah yang nonaktif per bulan — bukan rekonstruksi penuh "aktif di akhir bulan X" karena `Membership` tidak menyimpan `createdAt`), dan tren pencapaian Goal bulanan (rata-rata persentase Ya lintas Goal yang dimulai bulan itu, memakai aturan perhitungan yang sama seperti Goal individual: satu hari dihitung Ya hanya jika semua indikator aktif bernilai Ya).
- `Membership` memiliki `deactivatedAt` (nullable) yang diisi setiap kali `active` berubah menjadi `false`, dan dikosongkan lagi saat membership diaktifkan ulang. Ini murni untuk mendukung metrik retensi di atas; tidak mengubah logika otorisasi mana pun yang sudah ada berdasarkan `active`.

## 11. Dokumentasi perubahan

Ketika flow, aturan bisnis, kontrak API, konfigurasi, atau verifikasi berubah:

1. Perbarui dokumen ini bila aturan lintas modul berubah.
2. Perbarui `README.md` bila ringkasan produk, flow utama, atau cara operasi berubah.
3. Tambahkan catatan pada `docs/changes/YYYY-MM-DD/` dengan perilaku, dampak, verifikasi, dan tindak lanjut.

## 12. Target: platform multi-jenjang yang aman dan dapat dipakai ulang

Bagian ini adalah **aturan target dan prioritas produk**. Ia merangkum hasil
perbandingan model saat ini dengan operasi yang lazim pada penitipan,
pendidikan usia dini, sekolah dasar, dan sekolah menengah. Tidak ada capability, role, screen, API, atau migrasi baru yang
boleh dianggap tersedia hanya karena tercantum di bagian ini. Setiap tahap
implementasi harus tetap mempertahankan histori dan perilaku Daycare yang
sudah berjalan.

### 12.0 Prioritas aturan dan batas wiring UI

- §1–§11 adalah perilaku yang berlaku saat ini, **kecuali** bagian yang secara
  eksplisit ditandai sebagai target (misalnya §7). §12 menjadi aturan yang
  berlaku untuk modul baru **hanya setelah** capability, kontrak server,
  migrasi data, dan penawaran cabangnya tersedia. Sampai saat itu, UI tidak
  boleh menampilkan flow target sebagai flow yang dapat digunakan.
- UI wajib menentukan penawaran cabang dan capability lebih dahulu, kemudian
  memilih satu flow yang sesuai. Flow Daycare memakai §3–§4; flow penerimaan
  sekolah, akademik, dan kesiswaan memakai §12. UI tidak boleh mencampurkan
  `planId`/booking Daycare ke pengajuan sekolah, atau nilai sekolah ke Goal
  perkembangan.
- Aturan target yang secara eksplisit membedakan lifecycle sekolah menggantikan
  aturan Daycare yang sama **hanya dalam scope capability sekolah tersebut**.
  Contohnya, katalog `PUBLISHED` di §12.3 menggantikan katalog Daycare pada §3
  hanya sesudah model penawaran baru diimplementasikan; sebelum itu, §3 tetap
  menjadi sumber perilaku katalog yang aktif.
- Feature gate UI bukan kontrol keamanan. Setiap route dan mutasi target tetap
  wajib ditolak server bila tenant/cabang tidak memiliki capability yang sesuai,
  meskipun client salah menampilkan entry point.

### 12.1 Gap yang harus diselesaikan sebelum mengklaim dukungan SD/SMP

| Area | Aturan saat ini | Risiko bila langsung dipakai untuk sekolah | Aturan target |
| --- | --- | --- | --- |
| Jenis lembaga | Capability operasional hanya dibedakan untuk Daycare serta kurikulum PAUD/TK. | Menambah `RA`, `SD`, `MI`, `SMP`, `MTS`, `SMA`, `MA`, atau `SMK` ke katalog saja menghasilkan tenant tanpa alur inti. | Jenis pendidikan usia dini atau sekolah hanya boleh ditawarkan setelah capability yang eksplisit tersedia dan diaktifkan per penawaran cabang. |
| Penerimaan | Enrollment Parent dimulai dari paket Daycare, entitlement, dan booking. | Sekolah reguler tidak selalu menjual kredit layanan atau booking harian. | Penerimaan sekolah dipisahkan dari enrollment Daycare; masing-masing memiliki status, kuota, dokumen, dan tagihan sendiri. |
| Penempatan | `Classroom` dan `ChildPlacement` sudah dapat menyimpan tahun ajaran, tetapi flow saat ini masih membatasi satu penempatan aktif per anak secara global. | Kenaikan kelas, tinggal kelas, mutasi, dan layanan Daycare paralel akan mengubah atau mengaburkan riwayat. | Penempatan akademik terikat unit pendidikan dan tahun ajaran; riwayat tidak pernah ditimpa. |
| Perkembangan dan nilai | Goal menggunakan indikator harian `Yes`/`No`. | Nilai mapel, rubrik, remedial, dan rapor tidak dapat diperlakukan sebagai Goal perkembangan. | Pendidikan usia dini (`KB`, `SPS`, `PAUD`, `TK`, `RA`) memakai portofolio perkembangan; sekolah (`SD`, `MI`, `SMP`, `MTS`, `SMA`, `MA`, `SMK`) memakai mata pelajaran, asesmen, dan rapor yang terbit terpisah. |
| Kehadiran | Daycare mensyaratkan booking terkonfirmasi; PAUD/TK dapat hadir tanpa booking. | Absensi sekolah, keterlambatan, dan kehadiran per mata pelajaran tidak mempunyai sumber kebenaran yang jelas. | Kehadiran sekolah berasal dari kalender/jadwal dan direkonsiliasi oleh sekolah; izin Parent tidak langsung mengganti catatan aktual. |
| Keuangan | Paket, entitlement, kredit, dan invoice Daycare menjadi pusat alur. | SPP bulanan, uang pangkal, kegiatan, serta diskon/beasiswa sekolah tidak memiliki lifecycle yang tepat. | Produk keuangan sekolah menggunakan kewajiban per tahun ajaran/semester/bulan, terpisah dari kredit Daycare. |
| Perlindungan anak | Catatan kesehatan dan insiden tersedia, tetapi penjemput, persetujuan, dan kontak darurat belum menjadi model lintas layanan. | Check-out atau tindakan darurat dapat dilakukan tanpa otorisasi yang cukup. | Otorisasi penjemputan, kontak darurat, consent, dan jejak audit menjadi fondasi bersama semua jenjang. |

### 12.2 Prinsip model lembaga dan capability

- Tenant tetap merupakan batas data dan penagihan. Satu tenant dapat menawarkan
  lebih dari satu jenis lembaga yang sesuai dengan matriks §12.2.2, tetapi **penawaran aktif** harus
  dikonfigurasi per cabang dan per jenis lembaga. Memilih jenis lembaga pada
  tenant tidak berarti semua cabang otomatis menyelenggarakannya.
- Platform Admin dapat menambah jenis lembaga pada tenant yang telah ada. Penambahan hanya
  membuat jenis tersebut tersedia sebagai kandidat offering dan tidak mengaktifkan capability,
  menu, atau operasi apa pun. Jenis lembaga tidak dapat dihapus dari tenant selama ada satu pun
  record offering dengan jenis tersebut, termasuk offering yang sudah ditutup atau diarsipkan;
  riwayat offering tetap mempertahankan identitas jenis lembaganya.
- Untuk endpoint legacy yang datanya belum membawa `offeringId`, capability agregat tenant tetap
  dipakai sebagai compatibility guard **tambahan**, tetapi server juga wajib menemukan minimal satu
  offering `PUBLISHED` dengan capability yang sama. Operasi yang telah membawa cabang/anak wajib
  memeriksa offering `PUBLISHED` pada cabang sumber daya itu sendiri; contoh saat ini adalah
  attendance dan pickup Daycare. Compatibility guard ini tidak mengubah target scope kanonis pada
  §13 dan tidak mengizinkan offering cabang lain memperluas resource anak/cabang yang sudah
  memiliki scope eksplisit.
- Katalog enrollment Parent Daycare hanya boleh memuat tenant aktif dan cabang aktif yang masing-masing
  memiliki offering `PUBLISHED` ber-capability `DAYCARE_OPERATIONS`. Persetujuan enrollment, jam
  operasional, overtime, serta notifikasi overtime untuk anak/cabang tersebut juga wajib memeriksa
  offering cabang yang sama; offering Daycare pada cabang lain tidak dapat menjadi pengganti.
- `DAYCARE_OPERATIONS` tetap khusus bagi layanan penitipan: paket/entitlement,
  booking, check-in/out, jam operasional, penjemputan, dan overtime. Capability
  ini tidak menjadi prasyarat pendidikan usia dini atau sekolah yang tidak menawarkan
  penitipan.
- **Target:** `EARLY_CHILDHOOD_EDUCATION` mencakup kurikulum dan portofolio
  perkembangan untuk `KB`, `SPS`, `PAUD`, `TK`, dan `RA`; `SCHOOL_ACADEMICS`
  mencakup tahun ajaran, mata pelajaran, jadwal, asesmen, dan rapor untuk
  `SD`, `MI`, `SMP`, `MTS`, `SMA`, `MA`, dan `SMK`; dan
  `EDUCATION_STUDENT_AFFAIRS` mencakup absensi sekolah, izin, mutasi, tata
  tertib, serta komunikasi wali. Penerimaan dan tagihan sekolah memakai
  `EDUCATION_ADMISSIONS` dan `EDUCATION_BILLING` secara terpisah. Kode target
  pada §13.4 adalah **nama kanonis yang dicadangkan**; implementasi pertama
  wajib menambahkannya persis sekali di `packages/core` sebelum digunakan oleh
  API atau UI. Tidak boleh ada string alias per modul.
- **Target:** `CLASS_FUND_OPERATIONS` adalah capability opsional khusus
  penawaran pendidikan dengan `enrollmentMode=SCHOOL_ADMISSION`. Ia mengelola
  kas kolektif per rombel/tahun ajaran melalui ledger dan custody policy yang
  terpisah. Ia bukan variasi `EDUCATION_BILLING`, tidak melekat pada Daycare,
  dan tidak boleh diaktifkan hanya karena offering memiliki `SCHOOL_ACADEMICS`
  atau `EARLY_CHILDHOOD_EDUCATION`. Kontrak lengkap, precondition aktivasi,
  serta larangannya ada pada §13.11.1.
- Capability tambahan yang bersifat lintas jenjang, misalnya transport sekolah,
  makan, atau penitipan setelah sekolah, harus merupakan modul opsional dengan
  lifecycle dan penagihan sendiri. Jangan menyamakan layanan tersebut dengan
  rombel atau memasukkannya diam-diam ke paket akademik.
- Istilah tampilan dapat memakai **Peserta Didik** untuk semua jenjang, sambil
  mempertahankan istilah **Anak** pada konteks penitipan dan pendidikan usia dini. Model dan API
  lama bernama `Child` tidak boleh diubah hanya untuk kosmetik; perubahan nama
  data memerlukan rencana kompatibilitas tersendiri.

#### 12.2.1 Matriks visibilitas fitur menurut jenis lembaga

Matriks ini adalah kontrak **saat ini** untuk katalog jenis lembaga bawaan.
Status sebuah kode di master `InstitutionType` bukan izin akses: UI hanya boleh
menampilkan fitur khusus setelah server mengembalikan `UiAccessContext` untuk
offering cabang berstatus `PUBLISHED` dengan capability efektif yang sesuai,
serta peran dan scope sumber daya mengizinkannya. Status offering `DRAFT`,
`PAUSED`, `CLOSED`, atau `ARCHIVED` selalu menyembunyikan entry point baru dan
direct link harus gagal tertutup di server. Fitur bersama tidak boleh dipakai
sebagai jalan pintas ke fitur khusus.

**Fitur bersama** di bawah berarti fitur yang tidak membutuhkan capability
jenis lembaga: profil dan notifikasi sesuai peran, tenant/cabang, akun Staff,
data Anak/Peserta Didik, relasi wali, penempatan, kehadiran generik, izin,
catatan perkembangan, kesehatan, dan insiden. Masing-masing tetap tunduk pada
role, membership aktif, assignment Staff, dan kebijakan data yang sudah ada;
"tampil" tidak berarti setiap peran dapat mengubah semua data.

| Jenis lembaga bawaan | Fitur khusus yang boleh tampil saat ini | Fitur yang wajib disembunyikan saat ini |
| --- | --- | --- |
| `DAYCARE` | Fitur bersama; Paket Layanan, entitlement, enrollment Parent Daycare, pembayaran layanan Daycare, booking dan approval booking, QR/check-in/out yang mensyaratkan booking, jam operasional, penjemputan, dan overtime—hanya bila offering memiliki `DAYCARE_OPERATIONS`. | Les privat; **rombel akademik** dan Tingkatan/Program Kurikulum/Program Perkembangan/Goal akademik bila tidak ada offering akademik terpisah; seluruh penerimaan sekolah, mata pelajaran/jadwal/nilai/rapor, tagihan sekolah, dan kas kelas. Kelompok layanan operasional bukan rombel akademik (lihat §12.2.2). |
| `TPA`, `KB`, `SPS` | Fitur bersama saja. Kode ini dapat disimpan/dipilih untuk identitas lembaga dan tidak memberikan capability tambahan. | Seluruh operasi komersial Daycare; les privat; seluruh entry point akademik/kurikulum saat ini; serta seluruh fitur target penerimaan, akademik sekolah, tagihan sekolah, dan kas kelas. Kelompok yang kelak dipakai untuk layanan/belajar tidak boleh disebut rombel akademik sebelum target §12.2.2 tersedia. |
| `PAUD`, `TK` | Fitur bersama; Tingkatan, **kelas/kelompok belajar legacy**, Program Kurikulum, Program Perkembangan, Goal, dan aktivitas kurikulum; serta les privat. Semua entry point ini hanya tampil bila ada offering `PUBLISHED` dengan `ACADEMIC_CURRICULUM`; les privat dibatasi khusus PAUD/TK sebagaimana §3. | Paket/entitlement, enrollment dan booking Daycare, QR Daycare, jam operasional, penjemputan, dan overtime jika cabang tidak juga memiliki offering `DAYCARE_OPERATIONS`; serta penerimaan sekolah, portofolio/rapor pendidikan usia dini, mata pelajaran/jadwal/nilai/rapor sekolah, tagihan sekolah, dan kas kelas yang masih target. Rombel akademik kanonis menunggu scope target §13.8. |
| `RA`, `BIMBA` | Fitur bersama saja. Walaupun programnya dapat memiliki kemiripan operasional dengan PAUD/TK, kesamaan nama atau kelompok usia bukan dasar pemberian akses. | `ACADEMIC_CURRICULUM` saat ini, termasuk Tingkatan/rombel/Program Kurikulum/Goal dan les privat; seluruh operasi Daycare; serta seluruh fitur target sekolah. Mengaktifkan kurikulum atau les privat untuk salah satu kode ini memerlukan capability, offering, scope data, API, dan perubahan aturan eksplisit terlebih dahulu. §12.2.2 membedakan target RA sebagai pendidikan usia dini dari BIMBA sebagai program pendampingan. |
| `SD`, `MI` | Fitur bersama saja. | Semua operasi Daycare kecuali cabang juga memiliki offering Daycare tersendiri; seluruh entry point kurikulum PAUD/TK dan les privat; serta penerimaan sekolah, tahun ajaran, **rombel akademik**, mata pelajaran, jadwal, asesmen, rapor, absensi sekolah, tagihan sekolah, dan kas kelas sampai capability targetnya benar-benar tersedia. |
| `SMP`, `MTS` | Fitur bersama saja. | Semua operasi Daycare kecuali cabang juga memiliki offering Daycare tersendiri; seluruh entry point kurikulum PAUD/TK dan les privat; serta penerimaan sekolah, tahun ajaran, **rombel akademik**, mata pelajaran, jadwal, asesmen, rapor, absensi sekolah, tagihan sekolah, dan kas kelas sampai capability targetnya benar-benar tersedia. |
| `SMA`, `MA`, `SMK` | Fitur bersama saja. | Semua operasi Daycare kecuali cabang juga memiliki offering Daycare tersendiri; seluruh entry point kurikulum PAUD/TK dan les privat; serta penerimaan sekolah, tahun ajaran, **rombel akademik**, mata pelajaran, jadwal, asesmen, rapor, absensi sekolah, tagihan sekolah, dan kas kelas sampai capability targetnya benar-benar tersedia. |

- `RA`, `BIMBA`, `SD`, `MI`, `SMP`, `MTS`, `SMA`, `MA`, dan `SMK` adalah
  **katalog dan identitas lembaga yang tersedia**, bukan janji bahwa produk
  sekolahnya sudah aktif. UI wajib memakai keadaan kosong yang menjelaskan
  bahwa modul belum tersedia, bukan menampilkan kartu yang berakhir pada error
  atau memakai alur Daycare sebagai pengganti.
- Pada cabang campuran, visibilitas mengikuti **offering yang dipilih/dimiliki
  sumber daya**, bukan urutan kode yang ada pada tenant. Contoh: cabang dengan
  offering Daycare dan PAUD dapat menampilkan kedua kelompok entry point;
  booking tetap hanya untuk layanan Daycare, sedangkan les privat tetap hanya
  pada offering PAUD. Mengaktifkan satu offering tidak memperluas resource,
  invoice, enrollment, atau data akademik offering lain.
- Capability target pada §13.4 (`EARLY_CHILDHOOD_EDUCATION`,
  `EDUCATION_ADMISSIONS`, `SCHOOL_ACADEMICS`,
  `EDUCATION_STUDENT_AFFAIRS`, `EDUCATION_BILLING`, dan
  `CLASS_FUND_OPERATIONS`) belum boleh dimunculkan hanya karena jenis lembaga
  cocok. Entry point baru hanya boleh ditambahkan bersamaan dengan capability
  server, authorization per offering, migrasi scope data, kontrak API, dan
  lifecycle yang tercantum pada bagian terkait.
- Konfigurasi privasi profil keluarga Parent menurut jenis lembaga adalah
  kebijakan Platform Admin tersendiri. Tidak ada tipe lembaga yang otomatis
  boleh melihat tanggal lahir orang tua, pekerjaan, atau rentang penghasilan;
  data itu tetap hanya dapat dibaca/diubah pemiliknya kecuali kebijakan dan
  kontrak khusus yang terdokumentasi secara eksplisit mengubahnya.
- Master jenis lembaga dapat menyimpan `description` opsional maksimal 2.000
  karakter serta field presentasi opsional `logo`, `backgroundColor`,
  `borderColor`, dan `textColor`. Hanya Platform Admin yang dapat membuat atau
  mengubahnya dari katalog; nilai kosong menghapus nilai sebelumnya. Deskripsi
  hanya menjelaskan jenis lembaga di katalog dan tidak mengubah kemampuan
  operasional. `logo` adalah URL HTTPS absolut maksimal 500 karakter; tiga
  field warna adalah string presentasi maksimal 32 karakter. Konfigurasi
  presentasi belum boleh di-wire ke daftar, filter, navigasi, atau kartu tenant
  sampai ada keputusan UI terpisah. Ketika kelak digunakan, nilainya tetap
  presentasi saja: tidak boleh menjadi capability, menentukan route, atau
  menggantikan `UiAccessContext`.
- Katalog built-in memiliki deskripsi awal yang di-seed untuk membantu Platform
  Admin memilih jenis lembaga. Seed hanya mengisi deskripsi yang kosong dan
  tidak pernah menimpa deskripsi yang sebelumnya diubah Platform Admin.
- Setiap jenis lembaga juga memiliki `parameters`: map JSON key–value string
  yang dapat diubah Platform Admin tanpa migrasi schema baru. Maksimal 50
  item; kunci wajib unik, 1–64 karakter, dimulai huruf kecil, dan hanya boleh
  memakai huruf, angka, atau `_`; nilai maksimal 1.000 karakter. UI katalog
  menyediakan tambah/hapus pasangan parameter dan mengirim **seluruh** map
  sebagai snapshot, sehingga menghapus baris menghapus parameter tersimpan.
  Map ini adalah extension point konfigurasi, bukan extension point perilaku:
  parameter tidak boleh langsung mengubah capability, role, authorization,
  route, perhitungan keuangan, lifecycle, atau validasi bisnis. Sebelum code
  menggunakan kunci parameter baru, aturan ini harus mendokumentasikan nama
  kunci, tipe/nilai yang sah, default, owner, scope, efek UI/API, serta
  kompatibilitas ketika nilai diubah atau dihapus.

### 12.2.2 Batas kelompok layanan, kelompok belajar, dan rombel akademik

`Classroom` legacy saat ini adalah wadah kelompok tenant yang masih dipakai
bersama oleh beberapa flow. Ia **bukan** bukti bahwa sebuah lembaga telah
memiliki rombel akademik. Untuk menghindari pengguna, UI, dan API memberi
makna yang berbeda pada data yang sama, istilah berikut bersifat kanonis:

| Istilah tampilan | Makna dan scope | Bukan pengganti |
| --- | --- | --- |
| **Kelompok Layanan** | Pengelompokan operasi penitipan pada satu cabang untuk pembagian pendamping, daftar anak, dan kegiatan harian. Ia tidak memiliki tahun ajaran, mata pelajaran, rapor, atau kuota penerimaan. | Rombel akademik, kapasitas booking harian Daycare, atau Tingkatan pendidikan. |
| **Kelompok Belajar** | Pengelompokan pembelajaran usia dini atau program pendampingan. Pada implementasi legacy dapat memakai `Classroom`, tetapi belum memiliki scope pendidikan lengkap. | Bukti bahwa penempatan akademik, kalender, rapor, atau kas kelas sudah tersedia. |
| **Rombel Akademik** | Unit penempatan pendidikan kanonis pada satu `EducationOffering`, cabang, tahun ajaran, Tingkatan, dan kapasitas. Ia adalah `AcademicClassroom` target pada §13.8 dan hanya dapat digunakan oleh `AcademicPlacement`. | `Classroom` legacy, nama kelas bebas, kelompok layanan, atau kuota penerimaan. |

- Sampai model target §13.8 tersedia, UI yang membaca `Classroom` legacy harus
  memakai label umum **Kelas** atau label kelompok sesuai matriks di bawah.
  Ia tidak boleh memberi label **Rombel** bila record tersebut belum membawa
  scope akademik kanonis. Layar saat ini yang menulis “Rombel” untuk semua
  `Classroom` legacy adalah **gap implementasi**, bukan alasan untuk
  memperlakukan group tersebut sebagai kelas akademik.
- Kontrak legacy masih mewajibkan `learningLevelId` pada `Classroom` dan dapat
  menyimpan `learningPeriodId`. Saat data legacy belum dimigrasikan, keduanya
  hanya metadata kompatibilitas: `learningLevelId` dapat dipakai Daycare
  sebagai **Kelompok usia** untuk menyiapkan Kelas, sedangkan
  `learningPeriodId`, relasi Program Kurikulum, dan label **Tingkatan** hanya
  boleh ditulis melalui capability `ACADEMIC_CURRICULUM`. Metadata ini tidak
  mengubah Kelas menjadi Rombel Akademik, tidak menciptakan tahun ajaran atau
  penempatan akademik, dan tidak boleh di-backfill atau dipetakan otomatis.
  Update non-akademik pada record lama boleh mempertahankan nilai metadata
  lama yang sama persis, tetapi tidak boleh menambah, mengganti, atau
  menghapus relasi akademik tanpa capability tersebut.
- Satu learner boleh berada pada Kelompok Layanan dan Rombel Akademik pada
  tanggal yang sama, misalnya TK pagi dan penitipan setelah sekolah. Kedua
  relasi harus memakai ID serta scope offering sendiri; memindahkan atau
  mengarsipkan satu relasi tidak boleh mengubah relasi lainnya.
- Kapasitas Kelompok Layanan, kapasitas Rombel Akademik, kuota penerimaan, dan
  kapasitas booking harian adalah empat metrik berbeda. Tidak satu pun boleh
  diisi, ditampilkan, atau divalidasi sebagai substitusi bagi yang lain.
- Istilah, visibilitas, dan pilihan kelompok selalu berasal dari `UiAccessContext`
  serta resource scoped server. `institutionType`, nama kelas, umur learner,
  atau urutan data tidak boleh dipakai client untuk menebak kind kelompok.

#### Matriks jenis lembaga dan keberadaan rombel

Status **saat ini** pada tabel menjelaskan yang boleh tampil pada code saat
ini. Kolom **arah target** tidak mengizinkan wiring dini: setiap target tetap
memerlukan offering `PUBLISHED`, capability efektif, migration scope,
authorization server, serta kontrak UI/API sesuai §12.2 dan §13.

| Jenis lembaga | Tujuan utama | Status kelompok saat ini | Label kanonis sekarang | Arah target dan batas rombel |
| --- | --- | --- | --- | --- |
| `DAYCARE` | Penitipan dan perawatan harian. | `DAYCARE_OPERATIONS` tersedia hanya untuk offering Daycare. `Classroom` legacy dapat dipakai sebagai kelompok operasional bila memang dikonfigurasi tenant, tetapi tidak membuka akademik. | **Kelompok Layanan**; gunakan **Kelas** hanya sebagai fallback generik. | **Tidak ada Rombel Akademik** pada offering Daycare. Rombel hanya dapat ada dari offering pendidikan lain yang berdiri sendiri pada cabang yang sama. |
| `TPA` | Penitipan anak. | Katalog-only; belum memiliki capability operasional khusus walaupun domainnya serupa Daycare. | Tidak ada entry point kelompok khusus. | Bila capability layanan penitipan dan offering eksplisit kelak disetujui, gunakan **Kelompok Layanan**; **bukan** rombel akademik. Tidak boleh mewarisi `DAYCARE_OPERATIONS` hanya dari kode atau nama TPA. |
| `KB`, `SPS` | Pendidikan dan stimulasi usia dini berbasis kelompok. | Katalog-only; tidak mendapat kurikulum/rombel dari code saat ini. | Tidak ada entry point kelompok khusus. | Setelah `EARLY_CHILDHOOD_EDUCATION` tersedia, gunakan **Kelompok Belajar**; Rombel Akademik hanya ada bila target `AcademicYear` + `AcademicPlacement` + `AcademicClassroom` diaktifkan untuk offering tersebut. |
| `PAUD`, `TK` | Pendidikan usia dini. | Offering `PUBLISHED` dengan `ACADEMIC_CURRICULUM` boleh memakai Tingkatan dan `Classroom` legacy untuk kurikulum/Goal. | **Kelas** atau **Kelompok Belajar**; istilah “rombel” legacy tidak boleh menyiratkan data §13.8 sudah ada. | Menjadi **Rombel Akademik** setelah capability `EARLY_CHILDHOOD_EDUCATION` dan scope tahun ajaran target tersedia. Portofolio perkembangan tetap terpisah dari nilai sekolah. |
| `RA` | Pendidikan usia dini berciri keagamaan. | Katalog-only; tidak memperoleh capability PAUD/TK otomatis. | Tidak ada entry point kelompok khusus. | Memakai model **Kelompok Belajar/Rombel Akademik pendidikan usia dini** yang sama dengan PAUD/TK hanya setelah capability, offering, dan contract target diaktifkan secara eksplisit. Les privat PAUD/TK tidak ikut terbuka otomatis. |
| `BIMBA` | Program pendampingan minat baca/belajar atau keterampilan dasar. | Katalog-only. | Tidak ada entry point kelompok khusus. | Bila program group-based disetujui, gunakan **Kelompok Program** yang scoped ke offering/program; **tidak ada Rombel Akademik**, rapor sekolah, atau kas kelas hanya karena ada kelompok. |
| `SD`, `MI` | Pendidikan dasar. | Katalog-only; penerimaan, tahun ajaran, dan kelas akademik belum tersedia. | Tidak ada entry point kelas/rombel akademik. | **Rombel Akademik wajib** untuk peserta didik aktif: terikat offering, cabang, tahun ajaran, Tingkatan, kapasitas, dan `AcademicPlacement`. Tidak boleh menggunakan `Classroom` legacy. |
| `SMP`, `MTS` | Pendidikan menengah pertama. | Katalog-only; tidak ada flow sekolah saat ini. | Tidak ada entry point kelas/rombel akademik. | **Rombel Akademik wajib** dengan scope yang sama; jadwal, mata pelajaran, absensi, nilai, rapor, dan kas kelas (bila diaktifkan) selalu scoped ke rombel tersebut. |
| `SMA`, `MA` | Pendidikan menengah atas. | Katalog-only; tidak ada flow sekolah saat ini. | Tidak ada entry point kelas/rombel akademik. | **Rombel Akademik wajib** dengan scope yang sama; peminatan/konsentrasi, bila kelak dipakai, adalah atribut atau scope tambahan dan bukan pengganti rombel. |
| `SMK` | Pendidikan menengah kejuruan. | Katalog-only; tidak ada flow sekolah atau kejuruan saat ini. | Tidak ada entry point kelas/rombel akademik. | **Rombel Akademik wajib**. Program keahlian/konsentrasi keahlian harus menjadi scope terkontrol tambahan sebelum feature kejuruan dipublikasikan; ia tidak boleh disimpan hanya di nama rombel atau mengubah data SMA/MA. |

- `KB`, `SPS`, `RA`, `PAUD`, dan `TK` tidak boleh disamakan dengan Daycare
  hanya karena sama-sama melayani usia dini. Sebaliknya, `DAYCARE` dan `TPA`
  tidak boleh otomatis mendapatkan Tingkatan atau Rombel Akademik hanya karena
  anak dikelompokkan berdasarkan usia.
- `BIMBA` tidak boleh dipaksakan menjadi PAUD/TK atau sekolah reguler untuk
  mendapatkan kurikulum, rombel, admission, atau billing. Jika kebutuhan
  produk BIMBA berkembang, capability tersendiri dan kontrak program/kelompok
  harus didokumentasikan sebelum feature apa pun dibuka.
- Untuk `SD`, `MI`, `SMP`, `MTS`, `SMA`, `MA`, dan `SMK`, Rombel Akademik
  hanya muncul setelah learner memiliki `EducationEnrollment` yang legal dan
  Staff membuat `AcademicPlacement` efektif. Admission `ACCEPTED`, Parent
  membership, invoice, nama tingkatan, atau keberadaan `Classroom` legacy
  tidak cukup untuk membuat atau menampilkan rombel.
- Kas kelas tetap **tidak ada** untuk semua tipe sampai offering pendidikan
  mengaktifkan `CLASS_FUND_OPERATIONS` dan memenuhi seluruh precondition
  §13.11.1. Rombel akademik sendiri tidak memberikan capability kas kelas.
- Data `Classroom`/`ChildPlacement` legacy tidak boleh di-backfill menjadi
  Kelompok Layanan, Kelompok Belajar, atau Rombel Akademik berdasarkan nama,
  usia, atau institution type. Saat target diaktifkan, Staff Admin memilih
  pemetaan yang sah melalui flow teraudit; data yang tidak dipetakan tetap
  berstatus legacy dan read-only untuk scope akademik baru.

### 12.3 Penerimaan, enrollment, dan lifecycle Peserta Didik

- Flow pada §3 tetap menjadi flow **enrollment layanan Daycare**. Ia tidak
  boleh dipaksakan untuk penerimaan pendidikan usia dini atau sekolah yang tidak membeli
  paket penitipan.
- **Target penerimaan sekolah:** Parent/wali memilih penawaran penerimaan yang
  dipublikasikan untuk cabang, jenis lembaga, tahun ajaran, dan tingkatan yang
  tepat. Pengajuan menyimpan snapshot biaya dan pilihan akademik, serta dapat
  memuat checklist dokumen yang dikonfigurasi tenant. Dokumen hanya dapat
  dibaca oleh petugas dengan scope penerimaan dan tidak boleh masuk ke Platform
  Knowledge.
- Status penerimaan dan status peserta didik harus berbeda dari status
  `Membership` Parent. Lifecycle minimum target adalah `DRAFT`, `SUBMITTED`,
  `UNDER_REVIEW`, `WAITLISTED`, `ACCEPTED`, `REJECTED`, `CANCELLED`, dan
  `EXPIRED` untuk pengajuan; lalu `PENDING_PLACEMENT`, `ACTIVE`, `ON_LEAVE`,
  `TRANSFERRED`, `WITHDRAWN`, `GRADUATED`, atau `ALUMNI` untuk status akademik
  peserta didik. Sebelum record enrollment dibuat, UI menerima state turunan
  `NOT_ENROLLED`; ia bukan pengganti status pengajuan. Perubahan status harus
  teraudit dan tidak menghapus catatan historis.
- Kuota penerimaan, kuota rombel, dan kapasitas Daycare adalah tiga konsep
  berbeda. Kuota penerimaan membatasi penerimaan satu tingkatan/tahun ajaran;
  kapasitas rombel membatasi penempatan; kapasitas Daycare membatasi layanan
  harian. Sistem tidak boleh menggunakan salah satunya sebagai pengganti dua
  yang lain.
- Katalog Parent hanya menampilkan penawaran yang benar-benar `PUBLISHED` dan
  dapat diselesaikan: tenant/cabang aktif, capability sesuai, tahun ajaran atau
  paket yang berlaku, kuota/aturan yang relevan, serta instruksi pembayaran
  bila pembayaran diperlukan. Dashboard readiness internal tetap informatif,
  tetapi tidak boleh membuat katalog publik membingungkan dengan pilihan yang
  tidak dapat diajukan.
- Parent/wali, pihak pembayar, dan penjemput yang diotorisasi adalah relasi
  berbeda. Satu orang boleh memegang lebih dari satu relasi, tetapi hak akses
  Parent terhadap data anak tidak boleh diberikan hanya karena ia tercatat
  sebagai pembayar atau penjemput.

### 12.4 Tahun ajaran, penempatan, dan jadwal

- **Target:** setiap operasi pendidikan usia dini atau sekolah yang memakai
  Rombel Akademik memiliki `AcademicYear` dengan
  tanggal mulai/selesai, status, dan satu atau lebih periode/semester. Kalender
  operasional menentukan hari belajar, libur, kegiatan khusus, dan penutupan
  cabang; kalender tidak mengubah riwayat kehadiran yang telah dikunci.
- `LearningLevel` tetap menjadi tingkatan, tetapi penempatan akademik harus
  menyimpan cabang, jenis lembaga, tahun ajaran, tingkatan, dan rombel. Seorang
  peserta didik hanya boleh memiliki satu rombel utama aktif **per penawaran
  akademik dan tahun ajaran**. Layanan Daycare atau after-school yang sesuai
  dapat berjalan bersamaan tanpa menimpa penempatan akademik.
- Kenaikan kelas, tinggal kelas, mutasi masuk/keluar, dan kelulusan harus
  membuat record baru serta menutup record lama dengan alasan dan tanggal
  efektif. Tidak boleh mengedit tingkatan atau rombel historis secara langsung.
- SD/SMP membutuhkan jadwal mata pelajaran per rombel, periode, ruang, dan
  Staff pengajar. Server wajib mencegah benturan Staff, rombel, atau ruang pada
  waktu yang sama. Perubahan jadwal berlaku mulai tanggal efektif dan tidak
  menulis ulang kehadiran atau asesmen yang telah terjadi.

### 12.5 Kehadiran, perkembangan, asesmen, dan rapor

- Kehadiran Daycare tetap menggunakan check-in/check-out dan, bila capability
  Daycare aktif, booking terkonfirmasi sesuai §4. Aturan ini tidak diterapkan
  pada absensi sekolah reguler.
- **Target kehadiran sekolah:** catatan harian memiliki paling sedikit status
  `PRESENT`, `LATE`, `SICK`, `EXCUSED`, dan `UNEXCUSED`; bila sekolah memakai
  jadwal periodik, detail per mata pelajaran dapat ditambahkan tanpa mengganti
  rekap harian. Permohonan izin Parent hanya menjadi konteks yang dapat
  disetujui; Staff/guru tetap merekonsiliasi status aktual melalui mutasi
  kehadiran terpisah. Dengan demikian, aturan §4 bahwa pengajuan izin tidak
  mengubah kehadiran secara otomatis tetap berlaku.
- Goal dan Daily Assessment yang ada tetap cocok untuk observasi perkembangan,
  terutama Daycare dan pendidikan usia dini. Nilai `Yes`/`No`, streak, dan persentase Goal tidak
  boleh dikonversi menjadi nilai mata pelajaran atau menentukan kenaikan kelas.
- **Target pendidikan usia dini:** portofolio perkembangan dapat mengelompokkan observasi,
  karya, foto/media yang disetujui, dan ringkasan periode berdasarkan domain
  perkembangan. Ringkasan Parent hanya terbuka setelah dipublikasikan oleh
  sekolah.
- **Target SD/SMP:** struktur akademik menyimpan mata pelajaran, capaian
  pembelajaran, rencana ajar, komponen asesmen, rubrik, dan nilai. Bobot,
  skala, remedial, serta batas ketuntasan dikonfigurasi pada level
  sekolah/tahun ajaran, bukan di-hardcode di aplikasi.
- Tugas, ujian, dan bahan belajar merupakan bagian dari modul akademik sekolah,
  bukan catatan perkembangan. Publikasi tugas harus memiliki tenggat, audience
  rombel, dan status terbit yang jelas; Parent/wali dapat melihat tugas anaknya
  tetapi tidak dapat melihat pengumpulan atau nilai peserta didik lain.
- Rapor atau laporan periode adalah snapshot yang diterbitkan, bukan query
  langsung atas nilai yang masih diedit. Setelah dipublikasikan, koreksi harus
  menghasilkan revisi teraudit; Parent hanya melihat versi yang telah
  dipublikasikan untuk anaknya.

### 12.6 Keuangan yang sesuai dengan jenis layanan

- Paket, entitlement, kredit, booking, overtime, dan invoice Daycare tetap
  memakai lifecycle yang ada. Kewajiban sekolah tidak boleh mengurangi kredit
  Daycare atau menciptakan booking sebagai efek samping.
- **Target keuangan sekolah:** tenant dapat menerbitkan tagihan satu kali
  (misalnya biaya pendaftaran), per tahun/semester, dan berulang bulanan
  (misalnya SPP), serta tagihan kegiatan yang disetujui. Setiap invoice tetap
  menyimpan snapshot nominal, diskon/beasiswa yang disetujui, jatuh tempo,
  bukti pembayaran, keputusan verifikasi, dan audit perubahan.
- Profil keluarga Parent tetap hanya menjadi pertimbangan manual seperti §1.
  Diskon, beasiswa, atau keringanan harus melalui keputusan Staff Admin yang
  berwenang dan jejak audit eksplisit; tidak boleh dihitung otomatis dari
  pendapatan atau pekerjaan.
- Status finansial tidak boleh menghapus histori pendidikan, data kesehatan,
  notifikasi keselamatan, atau akses Parent terhadap invoice/bukti miliknya.
  Pembatasan operasional akibat tunggakan harus dikonfigurasi tenant, diberi
  alasan yang dapat dilihat Parent, dan tidak boleh diterapkan diam-diam.
- Deaktivasi membership akibat invoice enrollment pada §3 adalah perilaku
  Daycare saat ini. Aturan itu tidak boleh disalin untuk invoice sekolah;
  lifecycle status akademik, status finansial, dan akses Parent sekolah harus
  tetap terpisah sebagaimana §12.3 dan §12.6.
- **Target kas kelas:** iuran kolektif rombel adalah dana sukarela yang
  ditelusuri secara terpisah dari tagihan resmi sekolah. Ia tidak boleh dibuat
  sebagai `SCHOOL_ACTIVITY`, `EducationFinancialObligation`, invoice sekolah,
  credit Daycare, atau tunggakan. Detail ledger, pengeluaran, custody,
  privasi, dan UI yang wajib dipenuhi sebelum capability-nya aktif ada pada
  §13.11.1.

### 12.7 Keselamatan, kesehatan, dan perlindungan anak

- **Target:** setiap peserta didik dapat memiliki satu atau lebih kontak
  darurat dan daftar penjemput yang diotorisasi, masing-masing dengan nama,
  relasi, metode verifikasi, masa berlaku, dan status aktif. Check-out hanya
  boleh berhasil setelah petugas memverifikasi pihak penjemput atau pengecualian
  yang diaudit.
- Persetujuan Parent harus dipisahkan menurut tujuan, minimal: penggunaan
  media/foto, tindakan medis darurat, pemberian obat, perjalanan/kegiatan luar,
  dan akses penjemputan. Persetujuan dapat ditarik untuk masa depan tetapi tidak
  menghapus bukti bahwa persetujuan pernah berlaku pada suatu kejadian.
- Akses catatan kesehatan mengikuti prinsip least privilege: Staff hanya
  melihat informasi yang diperlukan untuk keselamatan anak dalam scope-nya;
  pembaruan, akses, dan tindakan medis penting harus teraudit. Pemberian obat
  adalah log terpisah yang mensyaratkan instruksi/consent yang berlaku, bukan
  sekadar teks pada profil kesehatan.
- Laporan insiden tidak menggantikan tindakan darurat. Insiden serius harus
  menampilkan eskalasi yang dapat dikonfirmasi oleh operasional, waktu kontak
  wali, dan tindak lanjut; Parent tetap hanya dapat membaca/acknowledge, bukan
  mengubah catatan kejadian.

### 12.8 Peran operasional, komunikasi, dan akses peserta didik

- Role keamanan tetap `ADMIN`, `STAFF_ADMIN`, `STAFF`, dan `PARENT` sampai
  model otorisasi baru disetujui. Peran operasional seperti wali kelas, guru
  mata pelajaran, konselor, perawat, pengemudi, dan tutor sebaiknya dimodelkan
  sebagai penugasan/atribut `STAFF` yang scoped, bukan sebagai role keamanan
  baru yang menggandakan izin.
- Pengumuman, kalender kegiatan, persetujuan kegiatan, dan pesan yang ditujukan
  ke rombel harus memiliki audience tenant/cabang/tingkatan/rombel yang
  eksplisit, waktu publish, status read/acknowledgement bila diperlukan, serta
  tidak mengekspos daftar kontak Parent kepada Parent lain.
- Akun `STUDENT` untuk SD/SMP adalah target terpisah, bukan variasi dari akun
  Parent. Jika kelak dibuat, pembuatan dan pemulihannya memerlukan persetujuan
  wali dan kebijakan usia tenant; akun tersebut tidak boleh mengakses kesehatan,
  keuangan, detail wali, atau data peserta didik lain secara default.

### 12.9 Urutan implementasi yang disarankan

1. **Fondasi multi-jenjang:** definisikan capability dan penawaran per
   cabang/jenis lembaga, pisahkan katalog/penerimaan Daycare dari sekolah, dan
   tambahkan tahun ajaran serta penempatan historis. Ini harus selesai sebelum
   `SD` atau `SMP` dipromosikan sebagai fitur produk.
2. **Operasi sekolah inti:** kalender, kuota, mutasi/kenaikan/kelulusan,
   kehadiran sekolah, serta tagihan sekolah dengan lifecycle terpisah.
3. **Pembelajaran dan Parent experience:** jadwal, mata pelajaran, asesmen,
   rapor yang dipublikasikan, portofolio pendidikan usia dini, dan komunikasi ber-audience.
4. **Perlindungan dan layanan tambahan:** penjemputan terotorisasi, consent,
   log obat, transport, makan, dan akun Student bila fondasi aksesnya sudah
   teruji.

Setiap tahap harus mempunyai migration, kontrak API, otorisasi server, audit,
uji regresi Daycare, dan catatan perubahan tersendiri. Tidak ada tahap yang
boleh mengubah status akademik, keuangan, membership Parent, atau data historis
secara massal tanpa aturan migrasi dan rollback yang disetujui.

## 13. Kontrak wiring UI, akses, dan state yang deterministik

Bagian ini adalah kontrak normatif antara UI, typed API client, dan server.
Tujuannya adalah agar setiap screen, tombol, status kosong, deep link, dan
mutasi dapat diputuskan dari data server yang eksplisit—bukan dari nama tenant,
nama rombel, urutan menu, usia yang dihitung di client, atau asumsi bahwa satu
jenis lembaga selalu mempunyai satu flow. Aturan yang memakai entity baru di
bagian ini adalah **target** sampai migrasi dan kontraknya tersedia.

### 13.1 Satu sumber konteks UI

- Setelah login, setelah ganti tenant, dan sebelum membuka route yang scoped,
  client harus memperoleh satu read model versi yang disebut
  `UiAccessContext`. Ini adalah sumber kebenaran untuk visibilitas UI; ia tidak
  menggantikan otorisasi endpoint di server.
- `UiAccessContext` minimal membawa data berikut. Semua ID harus ID stabil dari
  server; UI tidak boleh membentuk ID atau menggabungkan nama untuk menentukan
  scope.

| Bagian | Field minimum | Aturan UI |
| --- | --- | --- |
| Versi | `revision`, `issuedAt` | Client menyimpan revision bersama query scope. Response mutasi yang lebih baru menggantikan context lama; response dengan revision lama tidak boleh membuka aksi yang sudah dicabut. |
| Tenant | `organizationId`, nama tampilan, status langganan, `membership` | Nama dan jenis lembaga hanya untuk tampilan. Akses tidak boleh diturunkan dari salah satunya. |
| Membership | `role`, `active`, `branchScope`, permission tenant, `accessMode` | `active=false` selalu menonaktifkan mutasi biasa. `accessMode` menentukan pengecualian baca yang sempit pada tabel di bawah. |
| Penawaran | daftar `EducationOffering` yang tersedia pada tenant/cabang | Semua menu, katalog, dan route akademik memilih dari `offeringId`, bukan langsung dari `institutionType`. |
| Relasi peserta didik | `learnerId`, relasi, akses tiap relasi, status enrollment yang relevan | UI Parent selalu memfilter anak dari relasi ini; ID anak pada URL tidak cukup sebagai bukti akses. |
| Penugasan Staff | scope tenant/cabang/rombel/peserta didik/mapel dan peran operasional | UI Staff hanya menampilkan data dan mutasi yang terdapat pada scope ini. |
| Grant resource scoped | `GuardianAuthority`, `ClassFundOfficerGrant`, dan grant target lain yang efektif beserta scope/tanggal/action-nya | UI hanya menampilkan action resource yang benar-benar ada pada grant; nama relasi atau jabatan tidak menjadi fallback. |
| Tahun ajaran | `academicYearId`, status, tanggal, dan penawaran pemilik | Selector tahun ajaran tidak boleh menggunakan tahun perangkat atau teks nama tahun sebagai nilai. |
| Kemampuan | capability efektif per `offeringId` | Capability tenant agregat hanya boleh dipakai sebagai ringkasan; gate screen memakai capability penawaran yang dipilih. |

- `accessMode` mempunyai nilai target berikut:

| `accessMode` | Siapa | Route yang boleh dibuka | Mutasi yang boleh dilakukan |
| --- | --- | --- | --- |
| `FULL` | Membership aktif dengan scope operasional valid dan tanpa restriction/grant terbatas, atau Staff dengan scope aktif | Seluruh route yang diizinkan role, capability, dan scope | Hanya mutasi yang diizinkan role/scope. |
| `APPLICATION_SELF_SERVICE` | Parent pemilik draft/application sekolah sebelum offer diterima | Katalog public yang relevan, draft/application sendiri, requirement/dokumen sendiri, dan notifikasi terkait | Simpan draft, submit, batalkan, atau upload dokumen yang masih diizinkan lifecycle; tidak ada route operasi anak, kelas, booking, atau invoice yang belum diterbitkan. |
| `ADMISSION_BILLING_READ_ONLY` | Parent/wali pemohon setelah offer diterima tetapi sebelum enrollment aktif | Pengajuan sendiri, daftar dokumen sendiri, invoice/bukti sendiri, dan notifikasi terkait | Bayar/unggah ulang bukti, respons dokumen, atau batalkan hanya bila lifecycle mengizinkan; tidak ada operasi anak/kelas/booking. |
| `SAFETY_BILLING_READ_ONLY` | Parent/wali dengan enrollment nonaktif tetapi masih berhak atas informasi keselamatan atau kewajiban finansial | Insiden, informasi keselamatan yang relevan, invoice/bukti sendiri, dan riwayat yang secara eksplisit dipertahankan | Hanya acknowledge insiden atau tindakan pembayaran yang masih diizinkan; tidak ada booking, edit anak, atau operasi akademik. |
| `NONE` | Tidak ada membership, relasi, atau grant yang berlaku | Profile global, flow signup/onboarding, katalog publik, dan entry `START_APPLICATION` | Hanya `START_APPLICATION` pada cycle `OPEN`; server membuat draft dan `APPLICATION_SELF_SERVICE` secara atomik. Tidak ada mutasi tenant lain. |

- Grant `APPLICATION_SELF_SERVICE`, `ADMISSION_BILLING_READ_ONLY`, dan
  `SAFETY_BILLING_READ_ONLY` bukan membership aktif terselubung. Server
  menerbitkan `APPLICATION_SELF_SERVICE` bersamaan dengan create draft pertama
  atau application submit dan memvalidasinya per `applicationId`. Saat offer
  diterima, grant itu di-upgrade atau diganti menjadi
  `ADMISSION_BILLING_READ_ONLY`. Semua grant divalidasi per `applicationId`,
  `invoiceId`, atau `learnerId`; grant tidak memberi daftar anak tenant, daftar
  Parent lain, atau data kelas.
- Setiap context aktif membawa `contextId`, `membershipId` atau `grantId`,
  role, `organizationId`, dan `accessMode`. Bila satu akun mempunyai lebih
  dari satu context legal, server mengembalikan `availableContexts`; pengguna
  memilih context secara eksplisit sebelum masuk ke Home berbasis role. Client
  hanya boleh mengingat context terakhir bila context itu masih ada dalam
  response baru; ia tidak boleh memilih tenant, role, anak, atau offering
  pertama secara implisit. Mengganti context menghapus parameter route, cache,
  dan draft context lama sebelum data baru dirender.
- Bila `UiAccessContext` belum selesai dimuat, UI hanya menampilkan loading
  aman dan tidak melakukan redirect role. Bila context gagal dimuat, UI hanya
  menawarkan retry dan sign out; ia tidak boleh menyimpulkan bahwa semua menu
  tidak tersedia atau menandai pekerjaan Staff sebagai terlambat.

### 13.2 Aturan route, deep link, query, dan mutasi

- Setiap route scoped harus memiliki guard yang memeriksa, dalam urutan ini:
  autentikasi, `organizationId`, `offeringId` bila route milik penawaran,
  capability, role, membership/grant akses, lalu scope sumber daya. Kegagalan
  satu pemeriksaan menghasilkan state `not found` atau `not authorized` yang
  tidak membocorkan nama, jumlah, maupun keberadaan resource lintas scope.
- Deep link, push-notification action, dan URL yang dipulihkan dari state lama
  harus menjalankan guard yang sama sebelum layar dirender. Action path dalam
  notifikasi bukan bukti akses.
- Semua query cache scoped menggunakan minimal `organizationId`; query target
  sekolah juga wajib menggunakan `offeringId` dan `academicYearId` bila data
  terikat tahun ajaran. Query peserta didik wajib menggunakan `learnerId`.
  Mengganti tenant, cabang, penawaran, tahun ajaran, atau anak harus menghapus
  pilihan turunan yang tidak kompatibel sebelum query berikutnya dijalankan.
- Satu-satunya exception query lintas-tenant adalah
  `ParentOperatingHoursOverview` pada §1. Cache-nya wajib dikunci ke user
  pemilik, context revision, dan item dengan `organizationId` asal; hasilnya
  read-only, tidak boleh dipakai sebagai input mutasi atau dicampur dengan key
  query tenant biasa.
- Perubahan authority, membership, assignment, guardian grant,
  `ClassFundOfficerGrant`, status/custody fund, atau capability harus
  menghasilkan invalidation context yang scoped. Setelah menerima
  invalidation atau `NOT_AUTHORIZED`, client menghapus cache dan file lokal
  sensitif untuk scope tersebut sebelum redirect. Revocation mengalahkan draft
  lokal: UI tidak menunggu konfirmasi discard sebelum menutup akses yang telah
  dicabut. Logout, session expiry, dan ganti tenant juga menghapus cache scope
  sebelumnya.
- Response list/search/pagination harus menggemakan owner scope, context
  revision, cursor, dan urutan sort. Client membuang response yang tidak lagi
  cocok dengan scope/request aktif. Empty state hanya boleh tampil setelah
  request scope yang cocok selesai; request dibatalkan, stale, atau gagal tidak
  boleh diterjemahkan sebagai `NO_DATA`.
- Client hanya boleh menyembunyikan entry point untuk memperjelas UI. Server
  tetap memvalidasi semua ID, status, capability, role, assignment, relasi
  wali, dan revision pada setiap mutasi. Tidak ada kontrol keamanan yang boleh
  hanya berupa tombol `disabled`.
- Create atau side effect non-idempotent—termasuk pengajuan, invoice,
  reservation, booking, attendance/check-in/out, consent, check-out, upload
  bukti, dan notification-triggering action—wajib membawa `Idempotency-Key`.
  Update, keputusan status, penempatan, penilaian, publish, atau void/cancel
  atas resource yang sudah ada wajib membawa `expectedRevision`. Bila create
  juga bergantung pada resource konfigurasi/kapasitas yang dapat berubah,
  request membawa **keduanya**. Jika server menjawab konflik stale, UI mengambil
  ulang context dan resource, menampilkan alasan inline, dan tidak mencoba
  ulang mutasi secara otomatis.
- Unknown enum, capability baru yang belum dikenali client, atau resource yang
  dikembalikan tanpa scope wajib diperlakukan fail-closed: tampilan baca aman
  bila data memang boleh dibaca, tanpa tombol mutasi, dengan pesan bahwa
  aplikasi perlu diperbarui. UI tidak boleh memberi default `ACTIVE`,
  `PUBLISHED`, atau `FULL`.
- Semua label status, alasan disabled, error validasi, dan aksi harus berasal
  dari enum/kode typed serta i18n. Client tidak boleh menurunkan status dari
  warna, urutan tanggal, atau isi pesan error bebas.

### 13.3 Model target `EducationOffering`

- `EducationOffering` adalah unit komersial dan operasional yang benar-benar
  ditawarkan kepada Parent. Ia memisahkan jenis lembaga tenant dari apa yang
  tersedia pada satu cabang. Model ini diperlukan sebelum katalog multi-jenjang
  atau menu akademik baru boleh di-wire.
- Record offering minimal memuat:

| Field | Aturan |
| --- | --- |
| `id`, `organizationId`, `branchId` | Wajib, immutable setelah publish. Memindahkan penawaran ke cabang lain membuat record baru. |
| `institutionType` | Salah satu jenis lembaga aktif tenant. Jenis ini hanya label domain; capability efektif tetap berasal dari field capability offering. |
| `capabilities` | Set capability eksplisit. Tidak boleh dihitung sendiri oleh UI dari `institutionType`. |
| `enrollmentMode` | `DAYCARE_SERVICE` atau `SCHOOL_ADMISSION`. Satu offering hanya memiliki satu mode utama agar form Parent tidak bercampur. |
| `academicYearScope` | Untuk offering pendidikan usia dini atau sekolah yang memakai Rombel Akademik, hubungan ke tahun ajaran disimpan pada konfigurasi tahun ajaran, cycle, enrollment, placement, dan jadwal; bukan sebagai satu `academicYearId` mutable pada offering. Read model boleh mengirim `activeAcademicYearId` sebagai ringkasan yang tidak dapat ditulis. Daycare dan program pendampingan dapat tidak memiliki scope tahun ajaran. |
| `learningLevelIds` | Superset tingkatan yang secara struktural didukung offering. UI tidak boleh menawarkan tingkatan tenant lain atau tingkatan arsip. Untuk admission, daftar ini bukan authority eligibility/kuota/submit; `AdmissionCycleLevel` pada cycle `OPEN` di §13.7 adalah satu-satunya sumber kebenaran. |
| `catalogAvailability` | Ringkasan kanonis dari server untuk tampilan katalog. Untuk `SCHOOL_ADMISSION`, jendela, biaya, eligibility, dan kuota berasal dari `AdmissionCycle`/level/fee pada §13.7; untuk `DAYCARE_SERVICE`, ia berasal dari kontrak paket/cabang yang berlaku. Tidak ada field offering generik yang menjadi sumber submit kedua. Nilai tanpa batas tetap dikirim dengan policy eksplisit, bukan `null` yang ditafsirkan UI. |
| `status`, `revision` | Menentukan visibilitas dan operasi. Setiap perubahan publish/pause/close mengubah revision. |

- Lifecycle offering adalah `DRAFT`, `PUBLISHED`, `PAUSED`, `CLOSED`, dan
  `ARCHIVED`.

| Status | Visibilitas Parent | Aksi Parent | Aksi Staff Admin | Catatan UI |
| --- | --- | --- | --- | --- |
| `DRAFT` | Tidak tampil di katalog | Tidak ada | Edit, validasi, publish | Tidak boleh bocor melalui pencarian atau deep link Parent. |
| `PUBLISHED` | Tampil bila Parent memenuhi syarat dan jendela aplikasi terbuka | Mulai/lanjutkan pengajuan | Pause atau close | Tombol submit hanya aktif bila semua prerequisite terverifikasi server. |
| `PAUSED` | Tidak tampil untuk pengajuan baru | Baca pengajuan/invoice yang telah dimiliki bila grant berlaku | Publish kembali, close, archive bila aman | UI menampilkan alasan pause yang boleh dilihat Parent; tidak menampilkan detail internal. |
| `CLOSED` | Tidak tampil untuk pengajuan baru | Baca riwayat sendiri sesuai grant | Archive bila aman | Tidak boleh membuat draft baru; draft yang belum submit mengikuti policy expiry yang eksplisit. Periode baru memakai cycle pada offering `PUBLISHED`, bukan mengaktifkan ulang record ini. |
| `ARCHIVED` | Tidak tampil | Baca histori yang telah diizinkan | Baca histori; tidak dapat diaktifkan ulang tanpa policy migrasi | Tidak boleh dipilih oleh kelas, jadwal, atau penempatan baru. |

- Transition offering yang legal hanya `DRAFT → PUBLISHED`, `PUBLISHED →
  PAUSED` atau `CLOSED`, `PAUSED → PUBLISHED` atau `CLOSED`, serta `CLOSED →
  ARCHIVED`. `ARCHIVED` terminal. `CLOSED` tidak diaktifkan ulang; jika tenant
  hendak menawarkan program yang benar-benar baru, ia membuat offering baru
  dengan `programCode` baru. Periode/tahun ajaran atau gelombang penerimaan
  baru dibuat sebagai `AdmissionCycle` baru pada offering yang tetap
  `PUBLISHED`, bukan dengan mengubah offering/riwayat lama.
- Pada offering `PAUSED`, draft sekolah yang belum disubmit tetap private dan
  hanya dapat dibaca; submit, upload yang memicu review, dan perubahan
  eligibility ditolak sampai offering dipublish kembali. Pada `CLOSED`, server
  menerapkan policy expiry/cancellation draft secara eksplisit dan tidak
  menghapusnya otomatis. Application, invoice, dan enrollment yang sudah ada
  tetap mengikuti lifecycle masing-masing.
- Untuk `SCHOOL_ADMISSION`, offering `PUBLISHED` belum cukup menjadi item
  siap-daftar. Katalog Parent hanya memberi action mulai/lanjutkan application
  bila minimal satu `AdmissionCycle` `OPEN` memiliki `AdmissionCycleLevel`
  eligible. Offering yang tidak memiliki cycle seperti itu tidak boleh muncul
  sebagai pilihan submit atau diarahkan ke form kosong.
- Satu cabang tidak boleh mempunyai lebih dari satu offering `PUBLISHED` dengan
  kombinasi `institutionType` dan `enrollmentMode` yang sama kecuali tenant
  menetapkan `programCode` eksplisit. Tahun ajaran dan gelombang penerimaan
  tidak boleh dijadikan alasan membuat offering duplikat; keduanya dikelola
  oleh lifecycle yang terpisah. Tanpa `programCode`, UI tidak dapat membedakan
  dua pilihan yang secara bisnis sama.
- Katalog Parent mengembalikan item per offering, bukan hanya per tenant.
  Pengelompokan visual berdasarkan tenant hanya kosmetik dan tidak mengubah ID
  yang dikirim ketika memilih cabang, paket, atau penerimaan.
- Kontrak katalog lama pada §3 tetap khusus Daycare sampai endpoint versi baru
  menyertakan `offeringId`, `enrollmentMode`, status ketersediaan, dan alasan
  tidak tersedia. Selama masa transisi, UI tidak boleh mencampur dua response
  atau mencoba membuat penerimaan sekolah dari `ParentTenantCatalog` lama.

### 13.4 Capability dan entry point UI

| Capability | Status | Entry point yang boleh tampil | Larangan eksplisit |
| --- | --- | --- | --- |
| `DAYCARE_OPERATIONS` | Berlaku saat ini | Paket layanan, entitlement, booking, check-in/out, jam operasional, overtime | Tidak membuka penerimaan sekolah, rapor, atau absensi mata pelajaran. |
| `ACADEMIC_CURRICULUM` | Berlaku untuk endpoint Program Kurikulum/aktivitas dan les privat, serta untuk entry point mobile yang membaca `UiAccessContext` dari offering published. Migrasi scope `offeringId` pada seluruh record akademik lama tetap pekerjaan lanjutan; sebelum itu server mempertahankan gate capability tenant sebagai compatibility guard dan tidak boleh dianggap sebagai pengganti authorization per offering. | Tingkatan, rombel, Program Kurikulum, Program Perkembangan, Goal, dan aktivitas kurikulum | Tidak dianggap sebagai izin nilai mapel, rapor, atau jadwal SD/SMP. |
| `EDUCATION_ADMISSIONS` | Target | Siklus penerimaan, requirement dokumen, review, waitlist, dan offer sekolah | Tidak membuka paket/entitlement/booking Daycare. |
| `EARLY_CHILDHOOD_EDUCATION` | Target | Portofolio pendidikan usia dini, ringkasan periode, dan penawaran penerimaan untuk `KB`, `SPS`, `PAUD`, `TK`, atau `RA` | Tidak mengaktifkan booking Daycare kecuali offering juga memiliki `DAYCARE_OPERATIONS`. |
| `SCHOOL_ACADEMICS` | Target | Tahun ajaran, mata pelajaran, jadwal, tugas, asesmen, rapor | Tidak mengizinkan pembayaran, penerimaan, atau disiplin tanpa capability masing-masing. |
| `EDUCATION_STUDENT_AFFAIRS` | Target | Kehadiran sekolah, izin, mutasi, kelulusan, pengumuman wali | Tidak mengizinkan perubahan nilai atau konfigurasi kurikulum. |
| `EDUCATION_BILLING` | Target | Kewajiban biaya sekolah, adjustment, invoice sekolah, dan receipt | Tidak membuat entitlement, credit ledger, atau booking Daycare. |
| `CLASS_FUND_OPERATIONS` | Target opsional | Kas kelas: fund register, kontribusi sukarela, proposal/persetujuan pengeluaran, ledger, dan laporan transparansi scoped | Tidak menerbitkan invoice atau tunggakan sekolah, tidak memakai `SCHOOL_ACTIVITY`, tidak membuat entitlement/credit/booking Daycare, dan tidak membatasi akses karena kontribusi belum ada. |
| `TRANSPORT_OPERATIONS` | Target opsional | Rute, daftar penumpang, naik/turun, dan komunikasi transport | Tidak memberikan akses check-out Daycare atau data kesehatan penuh secara otomatis. |

- UI dapat menampilkan satu anak pada lebih dari satu area hanya bila context
  memuat offering dan capability terkait. Contoh: seorang anak yang memakai TK
  dan layanan after-school Daycare melihat kartu akademik dan kartu penitipan
  terpisah, masing-masing dengan status serta aksi yang tidak saling mengubah.
- Menambahkan kode `SD` atau `SMP` ke katalog jenis lembaga tanpa capability
  dan offering `PUBLISHED` tidak boleh memunculkan kartu, tab, atau route baru
  bagi Parent maupun Staff.

### 13.5 Role keamanan, relasi, dan scope operasional

- Role keamanan tetap `ADMIN`, `STAFF_ADMIN`, `STAFF`, dan `PARENT`. Peran
  operasional bukan role keamanan baru; ia adalah assignment scoped yang
  diterbitkan server. Role keamanan menentukan batas maksimum, assignment
  menentukan subset data/aksi yang benar-benar tersedia.

| Subjek | Scope dasar | UI yang boleh tersedia | Tidak pernah otomatis diperoleh |
| --- | --- | --- | --- |
| `ADMIN` | Platform | Tenant lifecycle, katalog jenis lembaga, master global, support readiness | Data kesehatan, media anak, dokumen penerimaan, nilai, atau profil keluarga Parent lintas tenant. |
| `STAFF_ADMIN` aktif | Tenant, lalu cabang/offering yang dipilih | Konfigurasi offering, admissions, billing, penempatan, laporan, dan persetujuan sesuai capability serta baseline grant server | Hak mengubah data global Platform Admin atau melihat tenant lain. |
| `STAFF` aktif | Hanya assignment langsung atau kelas/mapel yang aktif | Daftar tugas, kehadiran, observasi, insiden, atau asesmen yang sesuai assignment | Akses tenant-wide, publish rapor, konfigurasi biaya, atau approval penerimaan kecuali permission target yang eksplisit. |
| `PARENT` sebagai wali | Hanya learner dan offering yang relasinya aktif/grant berlaku | Data anak sendiri, pengajuan sendiri, invoice sendiri, notifikasi sendiri | Data saudara tanpa relasi, data Parent lain, atau data kelas agregat. |
| Pihak pembayar, penjemput, kontak darurat | Relasi non-security | Tidak ada menu tenant hanya karena relasi dicatat | Akses login, data anak, atau mutasi; akses khusus hanya setelah menjadi akun terverifikasi dan grant eksplisit. |
| `STUDENT` | Target terpisah | Hanya tugas/jadwal/rapor miliknya sesuai policy usia dan grant wali | Kesehatan, billing, wali, daftar kelas, atau data peserta didik lain. |

- Assignment `STAFF` target memakai nilai terkontrol seperti `CARE_PROVIDER`,
  `HOMEROOM_TEACHER`, `SUBJECT_TEACHER`, `COUNSELOR`, `NURSE`, `DRIVER`,
  `TUTOR`, `ADMISSIONS_OFFICER`, dan `FINANCE_OFFICER`. Setiap assignment
  menyimpan `organizationId`, `branchId`, `offeringId` bila relevan,
  `classroomId`/`subjectId`/`learnerId` bila relevan, tanggal mulai/selesai,
  active flag, dan grant action yang diterbitkan. UI tidak boleh memberi izin
  hanya karena teks jabatan yang mirip.
- Scope efektif Staff adalah irisan role keamanan, membership aktif, capability
  offering, assignment masih aktif pada tanggal operasional, dan scope resource.
  Bila salah satu bernilai tidak cocok, UI menyembunyikan aksi dan server
  menolak mutasi.
- `STAFF_ADMIN` aktif tidak memerlukan assignment `STAFF` untuk operasi
  administrasi tenant. Server menerbitkan baseline grant scoped pada tenant dan
  capability/cabang/offering yang legal, lalu mengirimkannya di
  `UiAccessContext`/`allowedActions`; grant itu mencakup action administrasi
  seperti review/decision admission, billing adjustment, placement manage, dan
  publish hanya bila capability terkait aktif. Restriksi cabang/offering oleh
  policy tenant harus tercermin sebagai scope baseline yang lebih sempit. UI
  tidak boleh mengasumsikan bahwa nama role saja memberi action tersebut.
- Parent/wali, pembayar, penjemput, dan kontak darurat disimpan sebagai relasi
  yang berbeda. Hanya relasi `GUARDIAN` yang dapat menghasilkan akses Parent
  terhadap perkembangan, kehadiran, atau akademik anak; relasi lain tidak
  boleh dipromosikan menjadi wali oleh UI.
- `STUDENT` target memerlukan `StudentAccessGrant` eksplisit yang mengikat
  user, learner, education enrollment, offering, policy usia/consent wali, dan
  `allowedActions`. Lifecycle minimum grant adalah `PENDING_GUARDIAN_CONSENT`,
  `ACTIVE`, `SUSPENDED`, dan `REVOKED`. Akun Student tidak boleh dibuat atau
  diaktifkan hanya dari nama/tanggal lahir learner, capability sekolah, atau
  akun Parent. Revocation langsung menghapus context/cache Student; Student
  tidak pernah mendapat learner switcher atau akses data wali/siswa lain.

### 13.6 Kontrak UI flow Daycare yang berlaku saat ini

- Sampai `EducationOffering` tersedia, `ParentTenantCatalog` pada §3 adalah
  katalog **Daycare legacy**. Ia tidak boleh dipakai sebagai katalog penerimaan
  sekolah. UI harus menampilkan status item legacy secara deterministik:

| Kondisi item katalog legacy | Terlihat | Dapat dipilih | Pesan UI wajib | Aksi yang dikirim |
| --- | --- | --- | --- | --- |
| Tenant tidak `ACTIVE`/`TRIAL` atau tidak punya `DAYCARE_OPERATIONS` | Tidak | Tidak | Tidak ada, karena item tidak dikirim server | Tidak ada. |
| Cabang aktif belum ada | Ya | Tidak | Cabang belum tersedia | Tidak ada checkout atau pemilihan anak. |
| Cabang ada tetapi Paket Layanan aktif belum ada | Ya | Tidak | Paket layanan belum tersedia | Tidak ada checkout atau pemilihan anak. |
| Cabang dan paket aktif tersedia | Ya | Ya | Harga/snapshot dari server | Hanya ID tenant, cabang, paket, anak, dan data yang diminta kontrak checkout. |
| Response katalog stale atau tidak lengkap | Tidak sebagai pilihan siap pakai | Tidak | Muat ulang katalog | Tidak ada fallback ke cabang atau paket pertama. |

- Lifecycle enrollment Daycare terdiri dari application, invoice, entitlement,
  child enrollment, dan membership Parent yang berbeda. UI tidak boleh memakai
  satu status saja untuk menyimpulkan kelima state tersebut.

| Keadaan kanonis | Child dan relasi | Parent UI | Staff Admin UI | Larangan |
| --- | --- | --- | --- | --- |
| Application `PENDING_APPROVAL` | Anak belum operasional; belum memakai kapasitas kelas | Lihat ringkasan dan batalkan pengajuan sendiri | Approve atau reject; reject wajib mempunyai alasan | Tidak ada QR, booking, placement, atau catatan perkembangan. |
| Application `APPROVED`, invoice `PENDING`, entitlement `PENDING_PAYMENT` | Relasi wali dan membership dibuat sesuai §3, tetapi layanan belum aktif | Lihat instruksi, unggah bukti bila instruksi aktif | Lihat invoice/pengajuan; tidak menyamakan approve enrollment dengan verify pembayaran | Tidak ada booking atau kehadiran Daycare. |
| Invoice `PAYMENT_SUBMITTED` | Sama seperti state sebelumnya | Baca bukti/status; tidak mengirim proof duplikat selama proof aktif direview | Verify atau reject proof dengan outcome yang dapat dibaca Parent | UI tidak menghitung ulang nominal atau membuat invoice kedua. |
| Invoice `PAID`, entitlement `ACTIVE` | Anak operasional untuk layanan yang sesuai | Booking, QR, riwayat, dan aksi Parent lain yang diizinkan | Operasi Daycare sesuai scope | Tidak ada akses ke anak lain atau tenant lain. |
| Application `REJECTED` | Tidak ada layanan aktif dari aplikasi itu | Baca alasan; buat pengajuan baru bila tenant masih tersedia | Baca histori keputusan | Tidak ada retry otomatis atau reuse snapshot harga lama. |
| Application `CANCELLED` | Tidak ada layanan aktif dari aplikasi itu | Baca histori saja | Baca histori saja | Tidak ada edit atau restore dari UI. |
| Invoice enrollment `OVERDUE` dan tidak ada entitlement aktif lain | Mengikuti restriction Daycare legacy §3 | Baca reason; UI saat ini menyimpulkan sendiri dari `status`/`invoiceStatus` mentah kapan menampilkan retry/pengajuan baru (lihat catatan di bawah tabel ini) — bukan dari action code server eksplisit | Kelola pembayaran sesuai scope | Tidak ada booking baru, QR, mutasi operasional, atau asumsi bahwa invoice overdue selalu masih dapat dibayar. |

- Response enrollment Daycare mengirim `accessState` kanonis dan
  `allowedActions`; mobile hanya merender state tersebut dan tidak lagi
  menyimpulkan aksi dari kombinasi `status` dan `invoiceStatus` mentah.
  Nilai saat ini adalah `PENDING_APPROVAL`, `PAYMENT_DUE`, `PAYMENT_REVIEW`,
  `ACTIVE`, `BILLING_LIMITED`, dan `CLOSED`. `BILLING_LIMITED` pada invoice
  enrollment Daycare legacy mengirim `REAPPLY`, bukan
  `UPLOAD_PAYMENT_PROOF`; ia bukan izin implisit untuk membayar invoice yang
  sudah overdue. `PAYMENT_DUE` hanya mengirim `UPLOAD_PAYMENT_PROOF` bila
  invoice masih `PENDING`. `REAPPLY` tersedia pada application yang sudah
  ditutup (`REJECTED`, `CANCELLED`, atau `EXPIRED`) dan pada
  `BILLING_LIMITED`. Ini berbeda dari restriction finance pendidikan §13.11,
  yang default-nya `NONE` dan tidak menonaktifkan enrollment akademik.

- Checkout multi-anak harus mendapat hasil server yang eksplisit untuk setiap
  anak atau diperlakukan atomik seluruhnya. UI tidak boleh menampilkan sukses
  parsial dari optimisme client. Bila contract belum menyediakan hasil per
  anak, satu error berarti seluruh form tetap draft dan Parent perlu memuat
  ulang daftar pengajuan sebelum mencoba lagi.
- Semua harga, diskon, kapasitas, nomor invoice, dan total pada enrollment,
  pembelian paket, serta booking berasal dari snapshot server. Client hanya
  memformatnya; ia tidak boleh menghitung diskon, mengurangi kredit, atau
  menyimpulkan slot masih tersedia.
- Riwayat booking, kartu booking, invoice, dan empty state Parent selalu
  scoped pada `childId` yang sedang dipilih. Mengganti anak membatalkan draft
  tanggal dan tidak boleh menampilkan jumlah booking anak sebelumnya.

#### 13.6.1 Paket, entitlement, booking, dan kehadiran Daycare

- Tiga flow berikut tidak boleh digabung dalam satu tombol atau satu status:
  approval enrollment membuat invoice dan entitlement pending tanpa booking;
  pembelian paket untuk anak yang sudah linked membuat entitlement/invoice;
  pemakaian entitlement aktif membuat booking untuk tanggal tertentu.
- Lifecycle booking Daycare dan affordance UI minimum adalah:

| Status booking | Kapasitas/kredit | Parent | Staff dalam scope | Kehadiran |
| --- | --- | --- | --- | --- |
| `PENDING_PAYMENT` | Dihitung sebagai reservasi sementara hanya bila server menyatakan demikian pada response | Lanjutkan pembayaran atau batalkan bila policy mengizinkan | Baca saja | Tidak boleh check-in. |
| `PENDING_APPROVAL` | Slot tetap ditahan | Baca status dan batalkan bila policy mengizinkan | Approve atau reject sesuai scope | Tidak boleh check-in. |
| `CONFIRMED` | Slot dan kredit berlaku | Baca/batalkan sesuai cutoff server | Baca/operasikan sesuai scope | Boleh check-in pada tanggal operasional. |
| `REJECTED` atau `CANCELLED` | Tidak lagi menahan slot/kredit kecuali response server menyatakan refund/policy lain | Baca alasan/status | Baca keputusan | Tidak boleh check-in. |
| `COMPLETED` | Riwayat final | Baca saja | Baca saja | Check-in/out sudah final kecuali koreksi teraudit. |

- Tanggal booking, cut-off, kapasitas, check-in/out, dan penentuan `today`
  memakai timezone cabang anak. Timezone perangkat hanya untuk tampilan lokal
  yang tidak mengubah tanggal operasional. Hari cabang tidak operasional,
  branch diarsipkan, child nonaktif, entitlement tidak aktif, atau booking tidak
  `CONFIRMED` menghasilkan alasan disabled dari server, bukan inferensi client.
- QR Daycare hanya kredensial kehadiran Parent/anak sesuai §4. QR tersebut
  bukan kredensial penjemputan dan tidak boleh membuka route kesehatan,
  keuangan, atau data akademik.
- Permohonan tidak masuk tetap informatif. `APPROVED` pada permohonan tidak
  membatalkan booking, tidak mengembalikan kredit, dan tidak mencatat check-in
  atau check-out. UI harus menampilkan request dan kehadiran aktual sebagai dua
  timeline terpisah.

#### 13.6.2 Jam operasional dan overtime Daycare

- Konfigurasi jam operasional hanya tersedia pada offering dengan
  `DAYCARE_OPERATIONS`. Payload mingguan selalu berisi tepat tujuh hari. Hari
  nonaktif tidak memiliki `opensAt`/`closesAt`; hari aktif wajib memiliki dua
  nilai `HH:mm` pada timezone cabang dengan `opensAt < closesAt`.
- Kesiapan Daycare mensyaratkan setiap cabang aktif memiliki konfigurasi
  mingguan yang valid: tepat satu record untuk setiap hari, setidaknya satu
  hari aktif, dan waktu valid pada seluruh hari aktif. Blok tarif overtime
  tidak menjadi prasyarat kesiapan karena dapat memang tidak dipakai. Anak
  aktif juga bukan prasyarat; lembaga yang sudah siap harus dapat menerima
  anak pertama.
- Template jam operasional hanya mengganti seluruh **draft lokal**. Memilih
template tidak menyimpan apa pun sampai Staff Admin menekan Simpan. Ketika
template diganti, seluruh hari dan seluruh blok overtime draft lama diganti,
bukan digabung sebagian.
- Setelah simpan jam operasional berhasil, form menampilkan konfirmasi. Ia
  kembali ke layar sebelumnya hanya setelah Staff Admin menekan **OK**. Bila
  simpan gagal, form dan draft tetap terbuka serta menampilkan error; aplikasi
  tidak melakukan kembali atau retry otomatis.
- Blok overtime adalah daftar berurutan dan kumulatif: durasi positif, urutan
  meningkat ketat, dan nominal positif. Blok pertama dapat dihapus; ketika
  tidak ada blok, UI menampilkan bahwa overtime belum dikonfigurasi dan server
  tidak boleh membuat charge overtime.
- Overtime hanya dihitung setelah close time pada hari cabang aktif. Satu anak
  memiliki paling banyak satu charge overtime non-void per tanggal operasional;
  charge hanya dapat diedit atau di-void selama invoice-nya `PENDING`. Waktu
  setelah blok terakhir memakai total kumulatif blok terakhir, tidak membuat
  tier implisit baru.
- Pemilik invoice overtime harus berasal dari `billingGuardianId` yang dibekukan
  pada enrollment/entitlement. Bila belum ada billing guardian, Staff Admin
  wajib memilih wali yang memiliki grant `MANAGE_FINANCE` sebelum charge dibuat;
  sistem tidak boleh memilih wali pertama dari list. Tunggakan/overtime tidak
  pernah menahan check-out anak.

### 13.7 Kontrak target penerimaan sekolah dan lifecycle peserta didik

- Penerimaan sekolah menggunakan `SchoolAdmissionApplication` terpisah dari
  `ParentEnrollment` Daycare. Application menyimpan `offeringId`, cabang,
  tahun ajaran, pilihan tingkatan, `admissionApplicantId`, optional
  `linkedLearnerId` yang sudah direview, snapshot biaya, snapshot requirement,
  dan revision. Ia tidak memiliki `planId`, credit, atau `bookingDates`.
- `AdmissionApplicant` adalah record calon peserta didik pra-enrollment dan
  bukan `Child`/learner operasional. Draft atau submit tidak boleh membuat
  Child, placement, membership operasional, atau roster. `linkedLearnerId`
  hanya boleh diisi setelah reviewer scoped membuat keputusan link yang
  teraudit; nama, tanggal lahir, atau kontak yang sama tidak cukup untuk
  melakukan link otomatis.
- Application dan pembayaran tidak memakai satu enum gabungan. UI membaca
  tiga state yang berbeda: `applicationStatus`, `admissionPaymentStatus`, dan
  `learnerEnrollmentStatus`.

| `applicationStatus` | Pemilik aksi berikutnya | Aksi Parent | Aksi operasional scoped | Invariant |
| --- | --- | --- | --- | --- |
| `DRAFT` | Parent | Edit, discard draft, submit | Tidak melihat kecuali policy draft-sharing kelak disetujui | Tidak memakai kuota atau membuat invoice. |
| `SUBMITTED` | Staff Admin | Lihat; batalkan hanya bila `CANCEL_APPLICATION` ada pada `allowedActions` | Mulai review atau minta dokumen | Snapshot tidak berubah; edit membuat draft/revision baru. |
| `UNDER_REVIEW` | Staff Admin | Lihat permintaan dokumen, upload dokumen yang diminta; batalkan hanya bila `CANCEL_APPLICATION` tersedia | Verify/reject dokumen, waitlist, accept, reject | Semua keputusan/reason teraudit. |
| `WAITLISTED` | Staff Admin | Lihat posisi/status bila tenant memilih menampilkannya; batalkan hanya bila diizinkan | Offer seat atau reject | Tidak membuat invoice atau menahan kapasitas rombel. |
| `ACCEPTED` | Parent bila pembayaran wajib; Staff Admin bila tidak | Lihat offer dan invoice; bayar bila required; cancel bila diizinkan | Server membuat obligation atomik bila diperlukan; Staff hanya dapat membatalkan obligation atau void invoice/payment menurut policy | Seat acceptance mempunyai expiry yang eksplisit. |
| `REJECTED` | Selesai | Baca alasan dan mulai application baru jika offering masih terbuka | Baca histori | Tidak dapat diedit atau restore. |
| `CANCELLED` | Selesai | Baca histori | Baca histori | Tidak dapat diaktifkan ulang. |
| `EXPIRED` | Selesai | Baca alasan expiry dan mulai application baru jika offering terbuka | Baca histori | Seat hold dilepas; obligation/invoice/payment mengikuti mapping terminal eksplisit pada §13.7.2 dan §13.11. |

- Sebelum application `ACCEPTED`, payment field berstatus `NOT_APPLICABLE`.
  Setelah `ACCEPTED`, `admissionPaymentStatus` selalu eksplisit:
  `NOT_REQUIRED` bila payment tidak diwajibkan, atau `PENDING`,
  `PAYMENT_SUBMITTED`, `VERIFIED`, `REJECTED`, `OVERDUE`, atau `VOID` bila
  payment diwajibkan. Verify payment memindahkan application ke state siap
  enrollment; payment reject tidak otomatis menolak application selama waktu
  pembayaran belum habis.
- UI menerima `learnerEnrollmentStatus=NOT_ENROLLED` bila belum ada record
  enrollment pendidikan. Lifecycle record yang sudah ada adalah
  `PENDING_PLACEMENT`, `ACTIVE`, `ON_LEAVE`, `TRANSFERRED`, `WITHDRAWN`,
  `GRADUATED`, atau `ALUMNI`. Hanya Staff Admin dengan baseline grant atau
  Staff scoped dengan `PLACEMENT_MANAGE` yang dapat membuat atau mengubah
  transition ini dengan tanggal efektif dan alasan bila bukan `ACTIVE`.
  Kenaikan kelas/kelulusan tidak boleh berjalan otomatis hanya karena tanggal
  perangkat berubah.
- Ketika application diterima, server meng-upgrade atau mengganti
  `APPLICATION_SELF_SERVICE` menjadi `ADMISSION_BILLING_READ_ONLY` untuk wali
  pemohon. Membership `PARENT` dapat diprovisioning sesuai policy, tetapi akses
  operasi anak hanya dibuat ketika learner enrollment `ACTIVE`; grant terbatas
  tetap memungkinkan pembayaran dan pembacaan pengajuan tanpa mengubah arti
  boolean membership aktif.
- Calon applicant tidak boleh dicocokkan otomatis hanya dari nama dan tanggal
  lahir. Jika tenant telah memiliki record peserta didik yang mungkin sama,
  Staff Admin melakukan keputusan link/duplicate yang teraudit; UI hanya
  menampilkan applicant yang sudah sah berada dalam scope review.
- Dokumen admission mempunyai state `NOT_REQUIRED`, `REQUESTED`, `SUBMITTED`,
  `VERIFIED`, `REJECTED`, `EXPIRED`, atau `WAIVED`. Setiap dokumen menyimpan
  jenis, requirement snapshot, owner, expiry bila relevan, alasan reject/waive,
  dan `revision`. Parent hanya melihat dokumennya sendiri; Staff hanya melihat
  dokumen dalam assignment admissions yang eksplisit.

#### 13.7.1 Siklus penerimaan, persyaratan, dan kuota

- `AdmissionCycle` adalah konfigurasi penerimaan yang benar-benar dapat
  diajukan. Ia membawa `offeringId`, `academicYearId`, `cycleCode` stabil,
  `status`, `opensAt`, `closesAt`, timezone cabang, offer/payment expiry,
  `postCloseDisposition`, revision, dan policy biaya. Statusnya adalah
  `DRAFT`, `OPEN`, `CLOSED`, dan `ARCHIVED`. `postCloseDisposition` adalah
  `CONTINUE_REVIEW` atau `EXPIRE_UNDECIDED`; ia menentukan nasib application
  nonterminal ketika cycle ditutup. Hanya `OPEN` yang dapat menerima submit
  baru; waktu server pada timezone cabang adalah sumber kebenaran untuk
  membuka/menutup cycle.
- Transition cycle yang legal adalah `DRAFT → OPEN` atau `ARCHIVED`,
  `OPEN → CLOSED`, dan `CLOSED → ARCHIVED`. Cycle `CLOSED` tidak dibuka ulang;
  gelombang baru selalu record cycle baru dengan `cycleCode` baru agar snapshot,
  audit, dan eligibility historis tidak berubah.
- Bila satu offering memiliki lebih dari satu gelombang penerimaan pada tahun
  ajaran yang sama, masing-masing wajib memiliki `cycleCode` dan label
  tampilan yang berbeda. Tanpa kode gelombang eksplisit, server hanya boleh
  memiliki satu cycle `OPEN` untuk kombinasi offering, tahun ajaran, dan
  tingkatan. UI tidak boleh mengurutkan atau memilih cycle dari nama gelombang
  atau tanggal perangkat.
- `AdmissionCycleLevel` menyimpan `cycleId`, `learningLevelId`, kuota
  penerimaan, batas usia minimum/maksimum bila berlaku, `ageReferenceDate`,
  `capacityPolicy` (`LIMITED`/`UNLIMITED`), dan `availabilityState`
  (`AVAILABLE`/`FULL`/`PAUSED`/`CLOSED`). Untuk `LIMITED`, kuota wajib bilangan
  positif; untuk `UNLIMITED`, kuota tidak dikirim sebagai `null` yang harus
  ditebak UI. Usia dihitung server sebagai bulan penuh dari tanggal lahir
  terhadap `ageReferenceDate` pada kalender lokal cabang; client hanya
  menampilkan hasil eligibility dan alasan yang diterima. Kuota ini terpisah
  dari kapasitas rombel dan tidak otomatis bertambah saat rombel dibuat.
- `AdmissionDocumentRequirement` adalah requirement versioned per cycle dan
  tingkatan. Ia menyimpan kode jenis dokumen, label i18n, wajib/opsional,
  aturan expiry, batas ukuran/jenis file, urutan tampilan, dan revision.
  Membuka cycle membekukan snapshot requirement untuk application yang
  disubmit; perubahan requirement berikutnya hanya berlaku untuk draft baru
  atau melalui request dokumen/addendum yang beralasan dan teraudit.
- `AdmissionCapacityReservation` menyimpan `applicationId`, `cycleLevelId`,
  `status`, `heldUntil`, actor/system reason, dan revision. Nilainya adalah
  `HELD`, `CONSUMED`, atau `RELEASED`. Hanya `HELD` dan `CONSUMED` yang
  mengurangi kuota. `WAITLISTED`, draft, dan application yang baru disubmit
  tidak menahan kuota.
- Perubahan ke `ACCEPTED` berjalan atomik: server memverifikasi bahwa cycle
  masih `OPEN`, requirement wajib sudah `VERIFIED` atau `WAIVED`, keputusan
  reviewer sah, dan masih ada kuota; kemudian mengunci sumber kuota, membuat
  satu reservation `HELD`, dan—bila perlu—membuat obligation admission.
  Constraint database mencegah lebih dari satu reservation aktif untuk satu
  application dan transaksi paralel tidak boleh dapat melewati kuota.
- Reservation `HELD` memiliki expiry eksplisit. Expiry, cancellation,
  rejection, atau payment gagal/void menurut policy melepaskan reservation
  dalam transaksi yang sama dengan perubahan state terkait. Capacity counter
  bukan angka yang dipercaya UI; daftar review, dashboard kuota, dan submit
  selalu membaca hasil kanonis server sesudah mutasi.

#### 13.7.2 Transition pengajuan dan konfirmasi enrollment

| Dari | Ke | Actor yang diizinkan | Prasyarat/efek atomik |
| --- | --- | --- | --- |
| `DRAFT` | `SUBMITTED` | Parent pemilik draft | Cycle `OPEN`, offering/tingkatan eligible, seluruh field dan dokumen wajib valid; server membekukan snapshot. |
| `SUBMITTED` | `UNDER_REVIEW` | Staff Admin baseline atau Staff scoped dengan `ADMISSIONS_REVIEW` | Reviewer dan waktu tercatat. |
| `SUBMITTED`/`UNDER_REVIEW` | `WAITLISTED` | Staff Admin baseline atau Staff scoped dengan `ADMISSIONS_DECIDE` | Alasan/status komunikasi direkam; tidak ada reservation atau invoice baru. |
| `SUBMITTED`/`UNDER_REVIEW`/`WAITLISTED` | `ACCEPTED` | Staff Admin baseline atau Staff scoped dengan `ADMISSIONS_DECIDE` | Memenuhi aturan §13.7.1; reservation `HELD` dan obligation bila perlu dibuat sekali. |
| `SUBMITTED`/`UNDER_REVIEW`/`WAITLISTED` | `REJECTED` | Staff Admin baseline atau Staff scoped dengan `ADMISSIONS_DECIDE` | Reason code dan catatan aman untuk Parent wajib ada; reservation aktif dilepas bila ada. |
| State nonterminal dengan `CANCEL_APPLICATION` | `CANCELLED` | Parent pemilik atau Staff Admin baseline/scoped | Reason/actor dicatat; reservation `HELD` dilepas, obligation menjadi `CANCELLED`, dan invoice/payment menjadi `VOID` hanya bila policy eksplisit memintanya. |
| `SUBMITTED`/`UNDER_REVIEW`/`WAITLISTED` | `EXPIRED` | Sistem | Cycle ditutup dengan `EXPIRE_UNDECIDED` atau waitlist expiry tercapai; tidak ada invoice/reservation baru. |
| `ACCEPTED` | `EXPIRED` | Sistem atau Staff Admin baseline/scoped menurut policy | Offer/payment deadline berlalu; reservation dilepas, obligation menjadi `CANCELLED`, dan invoice/payment belum dibayar menjadi `VOID` atau `OVERDUE` hanya menurut policy tertulis. |

- `REJECTED`, `CANCELLED`, dan `EXPIRED` adalah terminal untuk application
  itu. Tidak ada tombol reopen, un-reject, atau restore tersembunyi. Bila
  Parent boleh mendaftar lagi, server membuat application baru yang memiliki
  `reappliesFromApplicationId`; UI tidak menyalin snapshot lama atau dokumen
  yang sudah kedaluwarsa tanpa persetujuan ulang.
- `DISCARD_DRAFT` hanya tersedia sebelum submission dan tidak sama dengan
  `CANCELLED`: ia menghapus draft pra-pengajuan sesuai retensi draft tenant,
  tidak membuat reservation/invoice, dan tidak boleh dipakai untuk menghapus
  application yang pernah `SUBMITTED`.
- Server menolak duplicate nonterminal application untuk applicant/learner,
  cycle, dan tingkatan yang sama kecuali Staff Admin baseline atau Staff scoped
  dengan `ADMISSIONS_DECIDE` membuat keputusan exception ber-reason serta
  teraudit. Pencarian duplicate hanya ditampilkan kepada reviewer scoped dan
  tidak pernah membuka data applicant lain kepada Parent.
- Application `ACCEPTED` bukan enrollment pendidikan aktif. Setelah payment
  `VERIFIED` atau `NOT_REQUIRED`, hanya Staff Admin dengan baseline grant atau
  Staff scoped yang memiliki **keduanya** `ADMISSIONS_DECIDE` dan
  `PLACEMENT_MANAGE` dapat menjalankan konfirmasi admission. Aksi itu membuat
  `EducationEnrollment` dengan status `PENDING_PLACEMENT`, mengubah reservation
  dari `HELD` ke `CONSUMED`, lalu membuat atau me-link record learner/guardian
  secara eksplisit. Seluruh langkah tersebut satu transaksi; kegagalan satu
  langkah tidak boleh mengonsumsi kuota atau meninggalkan akun Parent dengan
  akses operasional parsial.
- `PENDING_PLACEMENT` tidak memberi kehadiran, jadwal, nilai, QR, booking, atau
  akses data kelas. Staff Admin baseline atau Staff scoped dengan
  `PLACEMENT_MANAGE` membuat `AcademicPlacement` valid terlebih dahulu lalu
  mengaktifkan enrollment dengan tanggal efektif. Bila policy mengizinkan
  pembatalan sebelum penempatan, enrollment ditutup dengan alasan dan histori;
  ia tidak dihapus.

### 13.8 Tahun ajaran, penempatan, rombel, dan jadwal target

- `AcademicYear` target memiliki lifecycle `DRAFT`, `ACTIVE`, `CLOSED`, dan
  `ARCHIVED`. Satu offering akademik mempunyai paling banyak satu tahun ajaran
  `ACTIVE`; tahun berikutnya boleh `DRAFT` sebelum tahun aktif ditutup. Tahun
  `CLOSED` tidak menerima penempatan, nilai, atau kehadiran baru kecuali
  koreksi yang diberi reason dan audit.
- `AcademicTerm` menyimpan `academicYearId`, urutan, tanggal mulai/selesai,
  status `DRAFT`/`ACTIVE`/`CLOSED`/`ARCHIVED`, dan revision. Term harus berada
  di dalam rentang `AcademicYear` dan tidak boleh tumpang tindih dalam satu
  tahun ajaran tanpa policy multi-term eksplisit. Semua selector mempersempit
  urutan: offering → tahun ajaran aktif/diizinkan → term → tingkatan → rombel.
- `AcademicCalendarEvent` menyimpan offering/tahun ajaran/term bila relevan,
  tanggal atau rentang tanggal lokal cabang, kind
  `INSTRUCTIONAL`/`HOLIDAY`/`CLOSURE`/`EXAM`/`ACTIVITY`, audience, status, dan
  revision. Statusnya adalah `DRAFT`, `PUBLISHED`, `CANCELLED`, `SUPERSEDED`,
  atau `ARCHIVED`; hanya `PUBLISHED` memengaruhi roster. Satu tanggal tidak
  boleh memiliki event yang saling bertentangan tanpa prioritas policy yang
  eksplisit. Mengubah kalender hanya memengaruhi roster/schedule masa depan;
  attendance, invoice, dan report yang sudah terkunci tidak boleh ditulis ulang
  atau dihapus sebagai efek samping.
- `EducationEnrollment` adalah sumber scope pendidikan untuk learner dan
  minimal menyimpan `organizationId`, `branchId`, `learnerId`, `offeringId`,
  `academicYearId`, optional `admissionApplicationId`, tanggal mulai/selesai,
  status, reason, revision, serta event histori immutable. Field legacy seperti
  `Child.branchId` hanya boleh menjadi metadata administratif; ia tidak boleh
  menentukan cabang akademik, placement, roster, jadwal, attendance, atau
  akses UI. Semua query pendidikan memakai `offeringId`,
  `educationEnrollmentId`, dan tahun ajaran/placement yang relevan.
- Server wajib memvalidasi hierarchy lintas-ID pada setiap create/read/mutasi:
  cycle, enrollment, placement, rombel, term, schedule, dan session harus
  memiliki `organizationId`, cabang, `offeringId`, `academicYearId`, dan
  `learningLevelId` yang kompatibel sesuai resource. Secara khusus, application
  cycle/level harus cocok dengan enrollment hasilnya; enrollment dan rombel
  placement harus memiliki offering/tahun/tingkatan yang sama; term harus
  milik tahun ajaran schedule; dan subject/Staff/ruang harus valid untuk
  offering/cabang tersebut. Mencocokkan satu ID saja atau mempercayai header
  tenant tidak cukup.
- Target `AcademicPlacement` terpisah dari `ChildPlacement` legacy Daycare dan
  menyimpan `organizationId`, `branchId`, `learnerId`, `offeringId`,
  `academicYearId`, `learningLevelId`, `classroomId`, tanggal efektif, status,
  dan reason. Satu learner hanya boleh memiliki satu placement akademik utama
  aktif per offering dan tahun ajaran; overlap tanggal pada kombinasi itu
  ditolak server. Placement Daycare atau after-school dapat aktif bersamaan
  karena scope-nya berbeda.
- Rombel akademik wajib menyimpan `organizationId`, `branchId`, `offeringId`,
  `academicYearId`, `learningLevelId`, kapasitas, status, dan revision.
  Kapasitas rombel, kuota admission, dan kapasitas Daycare ditampilkan sebagai
  metrik berbeda dan tidak boleh berbagi field atau label yang sama.
- Mutasi placement selalu menutup record lama dengan tanggal efektif sebelum
  membuat record baru. Same-day correction hanya boleh mengubah record yang
  belum dipakai untuk kehadiran, asesmen, invoice, atau notifikasi; bahkan
  koreksi ini tetap membuat audit event dan revision baru, bukan physical
  overwrite tanpa jejak. Selain itu harus membuat addendum/histori. Parent
  selalu melihat placement aktif dan histori yang diizinkan, tetapi tidak
  menerima tombol mutasi.
- `ScheduleSlot` menyimpan `organizationId`, `branchId`, offering, tahun/term,
  rombel, subject bila ada, Staff assignment, ruang, hari, jam mulai/selesai,
  timezone cabang, tanggal efektif, dan status
  `DRAFT`/`PUBLISHED`/`SUPERSEDED`/`ARCHIVED`. Server menolak overlap Staff,
  rombel, atau ruang pada waktu efektif yang sama. UI hanya menunjukkan jadwal
  `PUBLISHED` kepada Parent/Student dan tidak menulis ulang attendance atau
  assessment historis saat jadwal direvisi.
- `ClassSession` adalah occurrence jadwal yang dimaterialisasi dari
  `ScheduleSlot` untuk tanggal efektif dan menyimpan `scheduleSlotId`, rombel,
  subject, Staff/ruang snapshot, waktu lokal/UTC, dan status
  `SCHEDULED`/`CANCELLED`/`COMPLETED`/`SUPERSEDED`. Hanya session
  `SCHEDULED` atau `COMPLETED` yang dapat menerima `SchoolSessionAttendance`;
  `CANCELLED` tidak membentuk absence. Revisi jadwal hanya membuat/supersede
  session masa depan dan tidak memutasi session yang telah `COMPLETED`.

### 13.9 Kehadiran lintas layanan tanpa collision

**Implementasi Daycare saat ini:** roster Staff dan Staff Admin menerima
`AttendanceContext` dari server. Untuk context Daycare, `attendancePolicy`
adalah `DAYCARE_BOOKING_REQUIRED`, memuat tanggal operasional serta zona waktu
cabang, dan `allowedActions` hanya berisi `CHECK_IN` atau `CHECK_OUT` setelah
server mengevaluasi record hari ini serta entitlement/booking. Tanpa capability
Daycare, policy menjadi `NONE` dan tidak ada action. Mobile memakai
`allowedActions` untuk tombol manual dan menampilkan alasan penolakan dari
server; ia tidak menyimpulkan kelayakan dari timestamp lokal. Validasi final
tetap terjadi kembali pada mutasi check-in/out agar context yang stale tidak
pernah menjadi otorisasi.

**Target lintas layanan berikutnya** (belum diimplementasikan untuk penawaran
pendidikan dan context gabungan):

- Kebijakan kehadiran efektif harus dikembalikan server pada roster dan detail
  peserta didik sebagai `AttendanceContext`. UI tidak boleh menyimpulkan
  kebijakan dari capability tenant gabungan, karena satu tenant dapat memiliki
  Daycare, pendidikan usia dini, dan sekolah sekaligus.

| `attendancePolicy` | Resource sumber kebenaran | UI yang tampil | Prasyarat |
| --- | --- | --- | --- |
| `DAYCARE_BOOKING_REQUIRED` | Attendance Daycare | Check-in/out, QR Daycare, status booking | Booking `CONFIRMED`, entitlement aktif, hari cabang operasional. |
| `EDUCATION_DAILY` | School daily/session attendance | Status hadir sekolah, izin, jadwal/sesi | Enrollment akademik aktif dan hari/sesi instruksional. |
| `COMBINED` | Dua record terpisah yang diikat learner dan tanggal | Dua kartu dengan badge Penitipan dan Sekolah | Masing-masing prasyarat diperiksa sendiri. |
| `NONE` | Tidak ada operasi kehadiran pada context itu | Riwayat baca bila diizinkan | Tidak ada tombol scan atau catat hadir. |

- `AttendanceContext` minimal memuat `learnerId`, `offeringId`, `branchId`,
  `operationalDate`, timezone cabang, `attendancePolicy`, status record
  terkait, `allowedActions`, alasan tidak dapat bertindak, serta revision.
  UI tidak boleh menggunakan `institutionTypes` tenant atau `child.branchId`
  legacy untuk membuat atau memilih record kehadiran pendidikan.
- Target absensi sekolah mempunyai dua resource berbeda:

| Resource | Kunci unik dan data minimum | Pelaku UI |
| --- | --- | --- |
| `EducationAbsenceRequest` | learner enrollment, offering, rentang tanggal, purpose, catatan/bukti, status `PENDING`/`APPROVED`/`REJECTED`/`CANCELLED`, revision | Parent/wali mengajukan dan membatalkan sesuai lifecycle; Staff Admin/Staff dengan grant memutuskan. |
| `SchoolDailyAttendance` | `educationEnrollmentId + attendanceDate`, status `PRESENT`/`LATE`/`SICK`/`EXCUSED`/`UNEXCUSED`, source, recorder, recorded time, `lockedAt`, revision | Staff dengan grant kehadiran mencatat/rekonsiliasi; Parent membaca. |
| `SchoolSessionAttendance` | `educationEnrollmentId + classSessionId`, status yang sama, source, recorder, revision | Subject/homeroom Staff sesuai assignment mencatat; Parent membaca bila policy mengizinkan. |

- Permohonan izin Parent tidak menulis `SchoolDailyAttendance` atau
  `SchoolSessionAttendance` secara otomatis. Setelah request `APPROVED`, UI
  Staff menampilkan konteks izin dan Staff tetap melakukan mutasi attendance
  aktual terpisah. Request `REJECTED` juga tidak membuat status
  `UNEXCUSED` otomatis.
- Hari libur, penutupan cabang, atau sesi `CANCELLED` tidak membuat record
  `UNEXCUSED`. Server tidak boleh menjadwalkan pengisian absent otomatis;
  roster harus diperiksa/finalisasi oleh Staff. Bila rekap harian dan detail
  sesi saling tidak konsisten, server mengembalikan flag konflik dan UI meminta
  Staff berwenang untuk merekonsiliasi, bukan memilih nilai sendiri.
- Perubahan setelah `lockedAt` hanya boleh Staff Admin atau grant override
  eksplisit dengan reason wajib, revision baru, dan audit immutable. Cut-off
  berasal dari policy offering/server; UI tidak meng-hardcode jumlah hari atau
  jam. Tanggal selalu dinilai pada timezone cabang.
- State tombol Daycare minimum adalah belum check-in, check-in sedang dikirim,
  check-in tercatat/belum check-out, check-out sedang dikirim, selesai, dan
  konflik/double scan. Semua state berasal dari response server; UI tidak
  menandai check-in/out berhasil sebelum record kanonis diterima. Implementasi
  saat ini (`apps/mobile/app/attendance-scan.tsx`) menampilkan konflik/double
  scan sebagai `Alert.alert` sekali-tampil, bukan state tombol persisten
  seperti tersirat di atas — gap kecil terhadap target ini.

### 13.10 Portofolio pendidikan usia dini, akademik sekolah, tugas, dan laporan

- Goal dan Daily Assessment yang ada tetap menjadi flow perkembangan generik.
  Mereka tidak menjadi tabel nilai, tugas, mata pelajaran, atau rapor. UI
  harus menampilkan badge domain yang jelas agar Staff tidak memilih flow yang
  salah untuk data yang sama.
- Target portofolio pendidikan usia dini (`KB`, `SPS`, `PAUD`, `TK`, dan `RA`)
  memiliki resource berikut:

| Resource | Scope dan lifecycle | UI/otorisasi |
| --- | --- | --- |
| `EarlyChildhoodPortfolioObservation` | Enrollment, term, domain, tanggal observasi, narasi, evidence media, author, draft revision | Staff dalam scope membuat/edit draft; Parent tidak melihat draft. |
| `EarlyChildhoodProgressReport` | Enrollment + term + revision; `DRAFT`, `READY_FOR_REVIEW`, `PUBLISHED`, `SUPERSEDED`, `VOID` | Staff Admin publish; Staff scoped dapat menyiapkan sesuai grant; Parent hanya melihat `PUBLISHED`. |
| `EarlyChildhoodReportObservation` | Snapshot observasi/ringkasan yang masuk laporan terbit | Tidak berubah ketika observasi draft asal berubah. |

- Target akademik SD/SMP paling sedikit mempunyai `AcademicSubject`,
  `SubjectClassAssignment`, `LearningOutcome`, `GradePolicyVersion`,
  `AssessmentDefinition`, `AssessmentScore`, `AcademicReportCard`, dan
  `AcademicReportCardSubject`. Semua membawa `offeringId`, tahun ajaran/term
  yang relevan, revision, dan audit. Tidak ada screen nilai yang hanya menerima
  `childId` tanpa subject/class/term scope.

| Resource | Status/lifecycle | Aturan UI yang tidak boleh dilanggar |
| --- | --- | --- |
| `AssessmentDefinition` | `DRAFT`, `PUBLISHED`, `CLOSED`, `ARCHIVED` | Hanya definition `PUBLISHED` dapat menerima score; Parent hanya melihat bila `parentVisible=true` dan score juga telah dipublish. |
| `AssessmentScore` | Attempt `ORIGINAL` atau `REMEDIAL`, raw score/rubric/feedback, draft/published revision | Remedial tidak menimpa nilai original. UI menampilkan policy nilai efektif dari server, bukan memilih nilai tertinggi/terakhir sendiri. |
| `GradePolicyVersion` | Version immutable setelah dipakai assessment/report | Bobot, skala, pembulatan, batas ketuntasan, dan policy remedial ditampilkan dari versi yang diikat record. |
| `AcademicReportCard` | `DRAFT`, `READY_FOR_REVIEW`, `PUBLISHED`, `SUPERSEDED`, `VOID` | Parent/Student hanya melihat `PUBLISHED`; publish menjadikan snapshot tidak berubah. |

- Bila suatu policy memakai bobot, server memvalidasi bahwa bobot komponen yang
  dipakai tepat 100 dan menghitung dengan decimal. Pembulatan hanya dilakukan
  saat membuat snapshot laporan menurut `GradePolicyVersion`; client tidak
  menghitung nilai akhir untuk disimpan atau dipublish.
- Koreksi score setelah report `PUBLISHED` membuat revision report baru. Publish
  revision baru secara atomik mengubah report sebelumnya menjadi `SUPERSEDED`.
  UI menampilkan nomor revisi, waktu publish, dan hubungan superseded; tidak
  mengubah angka di report lama secara langsung.
- Tugas dan bahan belajar merupakan `AcademicAssignment` yang scoped pada
  offering, term, subject/classroom, audience, publish state, tanggal mulai,
  tenggat, dan revision. Parent/wali melihat tugas anaknya yang `PUBLISHED`;
  tidak dapat melihat submission, feedback, atau nilai peserta didik lain.
  Tidak ada submission Student/Parent sampai contract akun Student atau
  guardian-submission disetujui secara eksplisit.
- Staff yang memasukkan attendance, observasi, task, score, atau report harus
  memiliki assignment aktif dan action grant yang tepat. `HOMEROOM_TEACHER`
  tidak otomatis menjadi `SUBJECT_TEACHER`; `SUBJECT_TEACHER` tidak otomatis
  berwenang publish rapor. Staff Admin dapat melakukan publish/override hanya
  dengan reason/audit pada action yang sensitif.

### 13.11 Keuangan Daycare dan pendidikan tetap terpisah

- Daycare tetap memakai Paket Layanan, entitlement, booking, credit, overtime,
  dan source invoice Daycare yang ada. Pendidikan target memakai
  `EducationFinancialObligation` terpisah yang terikat application atau
  education enrollment, offering, fee definition snapshot, periode tagihan,
  recipient, due date, status, dan `invoiceId` bila diterbitkan.
- `EducationFeeDefinition` menyimpan offering/cycle/level/tahun ajaran, code,
  nama, kind (`ADMISSION`, `ANNUAL`, `TERM`, `MONTHLY_TUITION`, `ACTIVITY`,
  `OTHER`), nominal, rule jatuh tempo, apakah wajib sebelum konfirmasi, status,
  dan revision. Statusnya `DRAFT`, `PUBLISHED`, atau `ARCHIVED`; perubahan
  definition yang sudah dipakai obligation membuat revision baru. Nilai `null`
  pada kapasitas/nominal/policy tidak boleh diberi makna UI implisit; server
  selalu mengirim enum policy yang eksplisit.
- Lifecycle obligation adalah `SCHEDULED`, `ISSUED`, `SETTLED`, `OVERDUE`,
  atau `CANCELLED`. Invoice terbit adalah snapshot; nominalnya tidak diedit
  langsung. Keringanan membuat `EducationFinancialAdjustment` dengan type
  `DISCOUNT`, `SCHOLARSHIP`, `WAIVER`, atau `CREDIT`, nominal, reason,
  `DRAFT`/`APPROVED`/`REJECTED`/`CANCELLED`, approver, dan audit.
- Istilah terminal tidak boleh tertukar: obligation pendidikan hanya menjadi
  `CANCELLED`; invoice yang dibatalkan menjadi `VOID`; dan payment/proof yang
  dibatalkan menjadi `VOID`. `CREDIT` pada `EducationFinancialAdjustment`
  adalah kredit/kompensasi terhadap obligation pendidikan yang dinyatakan
  eksplisit, **bukan** entri credit ledger atau entitlement Daycare dan tidak
  dapat dipakai booking.
- Creator adjustment tidak boleh menyetujui adjustment miliknya sendiri.
  Approval, cancel obligation, void invoice/payment, atau credit setelah
  invoice diterbitkan membuat event/adjustment baru dengan revision dan reason;
  tidak ada edit nominal historis atau penghapusan invoice. Bila policy tenant
  mewajibkan maker-checker atau batas nominal, server mengembalikan requirement
  itu sebelum tombol submit; UI tidak menebak nilai ambang atau approver dari
  jabatan.
- Invoice pendidikan selalu mempunyai source eksplisit `SCHOOL_ADMISSION`,
  `SCHOOL_TUITION`, atau `SCHOOL_ACTIVITY`. UI menampilkan badge sumber pada
  setiap daftar, detail, push, dan receipt. Kewajiban sekolah tidak boleh
  digabung dengan invoice, entitlement, credit ledger, atau booking Daycare.
- Proof payment dan verifikasi dapat memakai primitive invoice umum, tetapi
  Parent hanya dapat mengunggah/melihat bukti invoice yang relasinya sah.
  Tombol proof disembunyikan bila invoice terminal atau proof aktif sedang
  direview; server tetap menolak upload duplikat/race.
- `OVERDUE` pendidikan hanya mengubah status finansial dan policy restriction
  yang eksplisit. Ia tidak menonaktifkan education enrollment, Child, guardian
  relation, membership Parent, akses report terbit, invoice/receipt sendiri,
  kesehatan, insiden, atau check-out. Default policy restriction adalah `NONE`;
  semua restriction non-keselamatan wajib memiliki kode, tanggal efektif,
  reason yang dapat dilihat Parent, dan jalur penyelesaian.
- `BILLING_LIMITED` tidak boleh diinfer dari `OVERDUE` pendidikan. Server hanya
  menerbitkannya jika resource `EducationFinancialRestriction` policy yang
  eksplisit dan non-`NONE` berlaku untuk learner/invoice tersebut, lengkap
  dengan reason, `allowedActions`, waktu efektif, dan jalur penyelesaian.
- `EducationFinancialRestriction` minimal menyimpan `organizationId`,
  `learnerId`/`educationEnrollmentId`, optional `invoiceId`, policy code,
  `effect` yang terkontrol, `effectiveFrom`, `effectiveUntil`, status,
  issuer, reason, revision, dan audit. Effect tidak boleh mencakup kesehatan,
  insiden, check-out, report terbit, atau penghapusan data. Expiry/revocation
  restriction wajib meng-invalidate context Parent sebelum UI kembali
  menawarkan action normal.
- Profil keluarga Parent tidak boleh dihitung otomatis untuk diskon, SPP, atau
  fee. UI hanya menampilkan keputusan discount/scholarship yang sudah
  diterbitkan server kepada pihak yang memang berhak melihatnya.

#### 13.11.1 Kas kelas target: dana kolektif per rombel, bukan tagihan sekolah

- `CLASS_FUND_OPERATIONS` hanya boleh diaktifkan setelah capability efektif
  tersedia pada satu `EducationOffering` dengan
  `enrollmentMode=SCHOOL_ADMISSION`, serta policy tenant tentang custody,
  penerimaan, pengeluaran, bukti, retensi, dan audit telah dipublikasikan
  server. Sebelum seluruh precondition itu tersedia, route dan kartu **Kas
  kelas** tidak boleh ditampilkan sebagai flow yang dapat digunakan.
- Kas kelas adalah dana kolektif yang **sukarela** untuk kebutuhan rombel
  tertentu. Ia bukan biaya pendidikan resmi dan tidak boleh dibuat, dipetakan,
  atau dimigrasikan otomatis menjadi `SCHOOL_ACTIVITY`,
  `EducationFinancialObligation`, `EducationFinancialAdjustment`, invoice,
  receipt sekolah, entitlement, credit ledger, booking, overtime, maupun
  `EducationFinancialRestriction`. Kontribusi yang belum ada, ditolak, atau
  dikembalikan tidak pernah menghasilkan `OVERDUE`, `BILLING_LIMITED`,
  penurunan status enrollment, pembatasan layanan, atau notifikasi tagihan.
- Resource kanonisnya adalah `ClassFund`. Ia minimal menyimpan `id`,
  `organizationId`, `branchId`, `offeringId`, `academicYearId`, `classroomId`,
  nama, `custodyModel`, status, `revision`, creator, dan audit. Khusus
  `SCHOOL_CUSTODIED`, record juga menyimpan `currencyCode`,
  `contributionPolicy`, `transparencyPolicy` termasuk
  `minimumContributorCount`, dan `custodyAccountableUserId`; field finansial
  tersebut `NOT_APPLICABLE` pada `EXTERNAL_REFERENCE_ONLY`.
  `custodyAccountableUserId` harus user operasional sekolah yang aktif dan
  tidak boleh menunjuk Parent. Seluruh ID scope harus cocok dengan
  `EducationEnrollment`/`AcademicPlacement` dan rombel aktif yang sama;
  `Child.branchId` legacy, label kelas, atau nama tahun tidak boleh menjadi
  dasar query maupun validasi. Satu `ClassFund` kanonis, dari custody apa pun,
  dapat dipublikasikan/beroperasi pada satu kombinasi offering+tahun
  ajaran+rombel; tidak ada dua fund paralel yang dapat dipilih Parent. Untuk
  `SCHOOL_CUSTODIED`, `currencyCode` dipilih dari policy tenant saat draft dan
  immutable setelah `OPEN`; tidak ada dua fund aktif dengan mata uang berbeda,
  konversi kurs, atau transfer lintas mata uang pada contract ini.
- Pengganti `SCHOOL_CUSTODIED` normal hanya dapat dibuat sesudah fund lama
  `CLOSED`, sedangkan pengganti `EXTERNAL_REFERENCE_ONLY` hanya sesudah
  reference lama `RETIRED`; keduanya membawa `replacesFundId` dan tidak boleh
  menyembunyikan histori lama. Satu-satunya pengecualian adalah successor
  `SCHOOL_CUSTODIED` `DRAFT` yang dibuat server ketika predecessor sudah
  `CLOSING` dan mempunyai saldo yang akan ditransfer. Ia menyimpan
  `pendingOpeningTransferFromFundId`, tidak dapat menerima
  contribution/expense atau dipublish, dan baru dapat `OPEN` sesudah server
  mem-posting `TRANSFER_OUT`/`TRANSFER_IN` serta menutup predecessor secara
  atomik. Tidak ada dua fund moneter terbuka untuk rombel yang sama.
- `contributionPolicy` hanya bernilai `VOLUNTARY` atau `SUGGESTED_AMOUNT`.
  Pada policy kedua, `suggestedAmountMinor` adalah informasi sukarela, bukan
  nominal wajib. Tidak ada policy `REQUIRED`, tanggal jatuh tempo, daftar
  tunggakan, atau reminder yang dapat menyiratkan kewajiban. Semua nominal
  uang dikirim/disimpan sebagai integer minor unit bersama `currencyCode`;
  client hanya memformat dan tidak menghitung saldo atau pembulatan sendiri.

| `custodyModel` | Kontrak yang boleh berjalan | Larangan |
| --- | --- | --- |
| `SCHOOL_CUSTODIED` | Sekolah/tenant adalah pihak yang bertanggung jawab atas penerimaan dan pengeluaran. Fund hanya boleh `OPEN` bila `custodyAccountableUserId` aktif, metode penerimaan/pengeluaran yang disetujui, format receipt, policy rekonsiliasi, dan retensi bukti tersedia pada server. | Tidak boleh menandai transfer, uang tunai, atau pengeluaran berhasil hanya dari input Parent/Staff tanpa verifikasi dan audit. |
| `EXTERNAL_REFERENCE_ONLY` | UI boleh menampilkan informasi policy, kontak, dan referensi dokumen eksternal yang telah diotorisasi. | Tidak ada saldo, `availableBalance`, contribution, payment proof, cash receipt, pengeluaran, disbursement, `ClassFundClosingStatement`, officer grant moneter, maupun ledger finansial yang disimpan atau dihitung platform. |

- Model custody lain—termasuk menempatkan platform sebagai pemegang dana atau
  menyimpan dana komite/Parent tanpa contract eksplisit—tidak didukung. Ia
  tidak boleh disamarkan menjadi `SCHOOL_CUSTODIED`; penambahan model baru
  memerlukan keputusan policy, contract, audit, dan migration tersendiri.
- Lifecycle `SCHOOL_CUSTODIED` adalah `DRAFT`, `OPEN`, `PAUSED`, `CLOSING`,
  `CLOSED`, dan `ARCHIVED`. Transition legal hanya `DRAFT → OPEN`, `OPEN →
  PAUSED` atau `CLOSING`, `PAUSED → OPEN` atau `CLOSING`, `CLOSING → CLOSED`,
  lalu `CLOSED → ARCHIVED`. `ARCHIVED` terminal dan `CLOSED` tidak dibuka
  ulang. `PAUSED` menutup kontribusi/pengeluaran baru tetapi mempertahankan
  baca. Bila `custodyAccountableUserId` atau membership/scope-nya dicabut,
  server meng-invalidate context dan menolak semua action moneter. Fund `OPEN`
  dipindahkan ke `PAUSED`; fund `DRAFT` tidak dapat dibuka; fund `CLOSING`
  dibekukan pada statusnya sampai Staff Admin scoped menunjuk accountable user
  aktif secara teraudit. Fund `CLOSED`/`ARCHIVED` tetap read-only dan tidak
  mengalami transition baru karena pencabutan tersebut.
- Pada `SCHOOL_CUSTODIED`, `CLOSING` menutup contribution dan proposal expense
  baru. Ia hanya mengizinkan rekonsiliasi, refund, transfer penutupan, serta
  disburse expense `APPROVED` atau cancel expense `DRAFT`/`SUBMITTED`/
  `APPROVED` yang sudah ada sebelum closing. Settlement yang sudah ada harus
  dieksekusi atau direject; proposal settlement baru hanya boleh untuk
  disposition closing yang diwajibkan. Semua action terakhir tetap tunduk pada
  reservation dan separation-of-duties. Fund tidak otomatis ditutup saat tahun
  ajaran selesai, learner pindah, atau perangkat berganti tanggal.
- Saat `CLOSING` dimulai, server mencatat `closingStartedAt` dan
  menghentikan upload/submit proof baru. Semua `PLEDGED` yang tersisa harus
  menjadi `CANCELLED`; `PENDING_VERIFICATION` harus menjadi `REJECTED` atau
  `CANCELLED`, kecuali bukti/uang dapat dibuktikan telah diterima sebelum
  `closingStartedAt`. Pengecualian terakhir hanya dapat diverifikasi oleh actor
  yang berwenang; server membuat `VERIFIED` dan
  `ClassFundSettlementRequest` `SUBMITTED` untuk refund/transfer yang wajib
  dalam transaksi teraudit yang sama. Settlement tetap memerlukan approval
  actor berbeda dan harus `EXECUTED` sebelum close. Tidak ada late proof
  acceptance atau contribution baru setelah closing dimulai. Dengan demikian
  close tidak dapat tertahan oleh pledge/proof yang tidak mempunyai outcome.
- Lifecycle `EXTERNAL_REFERENCE_ONLY` hanya `DRAFT`, `PUBLISHED`, `RETIRED`,
  dan `ARCHIVED`. Transition legal hanya `DRAFT → PUBLISHED`, `PUBLISHED →
  RETIRED`, lalu `RETIRED → ARCHIVED`; lifecycle ini hanya mempublikasikan atau
  menarik metadata/reference dan tidak memakai `OPEN`, `PAUSED`, `CLOSING`,
  `CLOSED`, saldo, maupun workflow finansial.
- `CLOSING → CLOSED` pada `SCHOOL_CUSTODIED` mensyaratkan tidak ada
  contribution/payment proof, expense request, atau settlement request
  nonterminal, semua reservation pengeluaran selesai/dilepas, serta saldo akhir
  nol **atau** disposition akhir yang menghasilkan ledger offset atomik. Refund harus
  merujuk contributor/receipt asal. Transfer hanya boleh ke successor
  `pendingOpeningTransferFromFundId` dengan `organizationId`, `branchId`,
  `offeringId`, `academicYearId`, `classroomId`, dan `currencyCode` yang sama;
  kedua sisi mencatat acceptance/reference dalam transaksi yang sama. Transfer
  lintas tenant, cabang, offering, tahun ajaran, rombel, atau mata uang ditolak
  sampai ada policy migrasi terpisah yang disetujui. `ClassFundClosingStatement`
  yang memuat saldo awal, total
  masuk/keluar, refund/transfer, saldo akhir, actor, waktu, dan bukti adalah
  snapshot immutable. Untuk fund yang pernah memiliki ledger posted,
  actor `CLASS_FUND_RECONCILE` dan actor `CLASS_FUND_CLOSE` harus dua user
  operasional sekolah yang berbeda; policy tidak boleh menghapus maker-checker
  ini dari UI. Setelah `CLOSED` tidak ada mutasi normal. Koreksi pasca-close hanya melalui
  `ClassFundClosingCorrection` khusus dengan action
  `CLASS_FUND_CLOSING_CORRECTION_PROPOSE` dan
  `CLASS_FUND_CLOSING_CORRECTION_APPROVE` oleh dua actor berwenang berbeda,
  membuat addendum dan `REVERSAL` teraudit, serta tidak mengedit statement atau
  saldo historis; `ARCHIVED` tidak menerima koreksi melalui UI biasa.

##### Kontribusi dan ledger yang append-only

- `ClassFundContribution` terpisah dari invoice. Ia menyimpan `fundId`,
  guardian dan learner yang sah untuk contribution Parent, nominal,
  metode/reference yang diminimalkan, receipt/proof yang diperlukan, status,
  `revision`, dan audit. Contribution dari UI tidak boleh anonim: actor atau
  sumber sekolah yang terotorisasi harus dapat diaudit; dana awal/historis
  memakai `OPENING_BALANCE`, bukan contribution Parent tanpa identitas.
  Statusnya `PLEDGED`, `PENDING_VERIFICATION`, `VERIFIED`, `REJECTED`,
  `CANCELLED`, atau `REFUNDED`. Transition legal hanya `PLEDGED →
  PENDING_VERIFICATION`/`CANCELLED`, `PENDING_VERIFICATION → VERIFIED`/
  `REJECTED`/`CANCELLED`, dan `VERIFIED → REFUNDED`. `PLEDGED` dan
  `PENDING_VERIFICATION` bukan saldo; `VERIFIED` membuat tepat satu entry
  `CONTRIBUTION`, sedangkan `VERIFIED → REFUNDED` membuat tepat satu entry
  `REFUND` dalam transaksi atomik yang sama. Refund parsial tidak didukung
  pada contract pertama ini; `REFUNDED` selalu untuk nominal penuh dan menunjuk
  contribution/ledger entry asal, serta tidak dapat dipakai untuk mengubah
  record pembayaran sekolah.
- Nominal contribution, expense, refund, transfer, dan reversal selalu lebih
  besar dari nol, memakai `currencyCode` fund persis, dan tidak boleh memiliki
  kurs/FX atau pembulatan lintas mata uang. Amount/refund yang tampak sama di
  client tidak cukup; server memverifikasi nominal posted, fund, source, dan
  lifecycle di dalam transaksi.
- Verifikasi contribution pada `SCHOOL_CUSTODIED` membuat tepat satu
  `ClassFundLedgerEntry` bertipe `CONTRIBUTION` dalam transaksi yang sama.
  Receipt uang tunai memerlukan nomor receipt, penerima/verifikator yang
  berbeda, dan bukti yang terotorisasi; policy dapat menambah checker tetapi
  tidak boleh mengizinkan self-verification. Payment reference atau unggahan
  proof tidak boleh otomatis mengubah status menjadi `VERIFIED`. Duplicate
  reference, receipt, atau idempotency key harus ditolak server tanpa membuat
  entry kedua. Actor yang menulis receipt/reference secara manual atau menerima
  uang tunai tidak boleh memverifikasi contribution yang sama; server
  membandingkan identitas user efektif, bukan nama tampilan. Parent boleh
  mengirim proof contribution miliknya, tetapi hanya verifier operasional yang
  berbeda yang dapat menjalankan transition ke `VERIFIED`.
- Ledger menyimpan paling sedikit `id`, `fundId`, `entryType`, nominal minor
  unit positif, arah kredit/debit, waktu efektif, source resource, actor,
  correlation/idempotency key, `revision`, dan audit. `entryType` yang
  diperbolehkan adalah `OPENING_BALANCE`, `CONTRIBUTION`, `EXPENSE`, `REFUND`,
  `TRANSFER_IN`, `TRANSFER_OUT`, dan `REVERSAL`. Baris ledger tidak dapat
  diubah atau dihapus; koreksi selalu membuat `REVERSAL` yang menunjuk entry
  asal, lalu entry pengganti bila diperlukan. `OPENING_BALANCE` hanya tersedia
  melalui import historis yang disetujui sebagaimana aturan migrasi di bawah.
- Saldo total dan `availableBalance` dihitung server dari ledger yang sudah
  posted dan reservation pengeluaran aktif. `availableBalance` tidak boleh
  negatif: persetujuan expense mengunci dana dalam transaksi/row lock yang
  sama, disbursement mengonsumsi reservation dan mem-posting `EXPENSE`, dan
  reject/cancel/expiry melepaskan reservation. Client tidak boleh menyimpan
  saldo optimistis, mengurangi saldo sendiri, atau memakai nominal dari kartu
  stale untuk menyimpulkan bahwa pengeluaran masih dapat diajukan.

##### Refund, transfer, dan rekonsiliasi penutupan

- Refund dan transfer tidak pernah mem-posting ledger langsung dari tombol
  umum. `ClassFundSettlementRequest` bertipe `REFUND` atau `TRANSFER` menyimpan
  fund, source contribution atau successor yang diwajibkan, nominal, reason,
  evidence, requester, approver, status, `revision`, dan audit. Lifecycle-nya
  `DRAFT`, `SUBMITTED`, `APPROVED`, `REJECTED`, `CANCELLED`, dan `EXECUTED`.
  Hanya `CLASS_FUND_REFUND_PROPOSE`/`CLASS_FUND_TRANSFER_PROPOSE`, atau
  pengecualian closing yang dinyatakan di atas, yang dapat membuat request
  `SUBMITTED`; `CLASS_FUND_REFUND_APPROVE`/`CLASS_FUND_TRANSFER_APPROVE` milik
  actor berbeda memutuskan request. Approval yang berhasil atomik dengan
  posting `REFUND` atau pasangan `TRANSFER_OUT`/`TRANSFER_IN` dan menandai
  request `EXECUTED`; tidak ada endpoint eksekusi ulang dari client.
- `REFUND` hanya untuk full amount contribution `VERIFIED` yang masih belum
  direfund. `TRANSFER` hanya mengikuti destination exact pada lifecycle
  closing di atas. Requester, approver, dan actor yang sebelumnya
  memverifikasi contribution atau menulis reconciliation yang sama harus
  berbeda bila request memengaruhi record mereka; server menolak self-approval
  berdasarkan user efektif. `CLASS_FUND_RECONCILE` hanya menyiapkan data/bukti
  rekonsiliasi dan tidak memindahkan saldo.

##### Pengeluaran, pemisahan tugas, dan petugas kas

- `ClassFundExpenseRequest` menyimpan `fundId`, kategori/purpose internal,
  nominal, recipient/payout method yang diminimalkan, evidence/receipt,
  requester, approver/disburser bila ada, `parentPublicationState`, status,
  `revision`, dan audit. Lifecycle-nya `DRAFT`, `SUBMITTED`, `APPROVED`,
  `REJECTED`, `CANCELLED`, dan `DISBURSED`; `parentPublicationState` adalah
  `NOT_APPLICABLE` atau `PUBLISHED_REDACTED`. `NOT_APPLICABLE` berlaku sebelum
  disbursement; transition `DISBURSED` secara atomik membuat proyeksi Parent
  teredaksi dan menetapkan `PUBLISHED_REDACTED`, sehingga tidak ada raw expense
  yang pernah menunggu untuk dirender Parent. `APPROVED` hanya dapat dibuat
  bila saldo tersedia dapat di-reserve; `DISBURSED` memerlukan
  expense tetap `APPROVED`, reservation masih valid, nominal/currency fund
  tepat, recipient/payout policy cocok, dan receipt/evidence akhir yang
  diwajibkan. Tidak ada cash advance atau cash-out tanpa evidence akhir pada
  contract pertama ini. Expense yang sudah `DISBURSED` tidak dihapus/void;
  refund atau koreksi memakai entry/record reversal beralasan.
- Requester tidak boleh menyetujui atau men-disburse expense miliknya sendiri.
  Server membandingkan identitas user efektif, bukan role atau perangkat. Bila
  policy fund mewajibkan `twoPersonDisbursement`, disburser juga harus berbeda
  dari requester dan approver. Batas nominal, jumlah approver, proof wajib,
  dan expiry reservation selalu dikirim server sebagai policy; UI tidak
  meng-hardcode batas atau menganggap `STAFF_ADMIN` dapat melewati pemisahan
  tugas.
- `ClassFundOfficerGrant` hanya tersedia untuk `SCHOOL_CUSTODIED` dan merupakan
  grant scoped per `fundId`, bukan role keamanan baru, bukan assignment
  `FINANCE_OFFICER`, dan bukan perluasan `EDUCATION_BILLING`. Ia dapat diberikan
  hanya kepada user `STAFF` atau `STAFF_ADMIN` dengan membership/scope yang
  masih sah; Parent tidak menerima officer grant atau action yang memindahkan
  uang pada contract pertama ini. `STAFF` grant mengikat `staffAssignmentId`
  yang sesuai, sedangkan `STAFF_ADMIN` grant mengikat membership dan baseline
  scope branch/offering server. Grant menyimpan subject user, fund, jenis,
  tanggal efektif, issuer/revoker, reason, `revision`, dan audit; subject dan
  issuer grant harus user berbeda, termasuk untuk `STAFF_ADMIN`. Tidak ada
  Parent/Staff yang dapat mengangkat diri sendiri atau memperluas scope ke
  rombel lain.
- Grant officer otomatis `SUSPENDED` dan seluruh action moneter ditolak bila
  membership, assignment, capability, custody accountable user, fund, atau
  scope fund tidak lagi aktif. `EXTERNAL_REFERENCE_ONLY` tidak memiliki
  `ClassFundOfficerGrant` maupun action contribution/expense/disbursement;
  Staff Admin hanya dapat mengelola metadata reference melalui action
  nonmoneter yang eksplisit.

| Jenis `ClassFundOfficerGrant` | Action maksimum | Batas wajib |
| --- | --- | --- |
| `TREASURER` | `CLASS_FUND_VIEW`, `CLASS_FUND_CONTRIBUTION_RECORD`, `CLASS_FUND_CONTRIBUTION_VERIFY`, `CLASS_FUND_EXPENSE_PROPOSE` | Hanya fund scoped; tidak dapat approve/disburse expense sendiri. |
| `EXPENSE_APPROVER` | `CLASS_FUND_VIEW`, `CLASS_FUND_EXPENSE_APPROVE` | Tidak dapat approve request miliknya sendiri; tidak mendapat akses billing sekolah. |
| `DISBURSER` | `CLASS_FUND_VIEW`, `CLASS_FUND_EXPENSE_DISBURSE` | Hanya expense approved dan reservation valid; tunduk pada two-person policy. |
| `CUSTODY_CONTROLLER` | `CLASS_FUND_VIEW`, `CLASS_FUND_RECONCILE`, `CLASS_FUND_REFUND_PROPOSE`, `CLASS_FUND_TRANSFER_PROPOSE` | Tidak dapat approve/execute settlement yang diajukannya atau menyelesaikan contribution/expense yang dibuat atau diverifikasinya sendiri. |
| `AUDITOR` | `CLASS_FUND_VIEW`, `CLASS_FUND_AUDIT` | Read-only; tidak dapat mengubah fund, contribution, expense, atau officer grant. |

- Staff Admin hanya dapat memakai action konfigurasi/penutupan yang diterbitkan
  server secara terpisah: `CLASS_FUND_CONFIGURE`, `CLASS_FUND_OPEN`,
  `CLASS_FUND_PAUSE`, `CLASS_FUND_CLOSING_START`, `CLASS_FUND_CLOSE`,
  `CLASS_FUND_OFFICER_GRANT_ISSUE`, `CLASS_FUND_OFFICER_GRANT_REVOKE`,
  `CLASS_FUND_REFUND_APPROVE`, `CLASS_FUND_TRANSFER_APPROVE`,
  `CLASS_FUND_CLOSING_CORRECTION_PROPOSE`, atau
  `CLASS_FUND_CLOSING_CORRECTION_APPROVE`. Masing-masing membawa scope
  offering/rombel/fund dan tidak dapat digantikan oleh grant umum yang lebih
  luas; approval settlement/correction selalu actor berbeda dari proposer
  sesuai resource-nya. Staff Admin tetap tunduk pada
  separation-of-duties pada contribution dan expense. Grant
  `EDUCATION_BILLING_VIEW`, `EDUCATION_BILLING_ADJUST`, atau nama jabatan
  keuangan saja tidak memberi satu pun action kas kelas.
- Parent biasa hanya dapat berkontribusi bila memiliki kedua authority
  `VIEW_CLASS_FUND` dan `CONTRIBUTE_CLASS_FUND`, learner terkait memiliki
  placement aktif pada rombel/fund tersebut, fund `SCHOOL_CUSTODIED` `OPEN`,
  dan context membawa pasangan `guardianAuthorityId` + `academicPlacementId`
  yang masih efektif. Setelah authority/placement berakhir atau learner
  keluar/mutasi, server mencabut action dan meng-invalidate context; kontribusi
  baru ditolak. Akses histori sendiri/final statement hanya dapat dipertahankan
  melalui grant retensi eksplisit. Tidak ada transfer contribution antar anak,
  rombel, tahun ajaran, atau tenant secara otomatis.
- `VIEW_CLASS_FUND` adalah pengecualian sempit terhadap larangan akses data
  kelas agregat pada §13.5: Parent menerima `ClassFundParentStatement`
  teredaksi buatan server, bukan ledger mentah. Statement hanya dapat memuat
  saldo fund, total aggregate yang aman, histori contribution/refund miliknya
  sendiri, dan `expenseSummary` dari expense dengan
  `parentPublicationState=PUBLISHED_REDACTED`. Satu expense summary hanya
  memuat kategori aman, nominal, bucket tanggal, serta state; ia tidak pernah
  memuat raw purpose, internal reason, requester/approver/disburser, recipient,
  rekening, payment reference, receipt, atau evidence.
- Server tidak mengirim baris contribution, nama, learner, nominal, proof,
  contact, rekening, maupun status contribution Parent lain. Bila breakdown
  aggregate pada kelas kecil atau periode tertentu berpotensi mengungkap satu
  contributor, server mengembalikan `REDACTED`/total fund yang lebih kasar
  menurut `minimumContributorCount` policy, bukan daftar atau amount per orang.
  Petugas hanya menerima identitas/contribution minimum yang diperlukan untuk
  tugas grant-nya; setiap sensitive read/download receipt teraudit. Platform
  Admin tidak memperoleh akses fund atau ledger anak lintas tenant.

##### Kontrak UI, API, notifikasi, dan migrasi

- UI memulai context kas kelas secara berurutan: offering pendidikan → tahun
  ajaran → tingkatan → rombel → fund. Kartu dan route hanya ada bila capability
  efektif, fund, placement/authority atau officer grant yang tepat dikirim
  dalam `UiAccessContext`. Kartu Parent menggunakan label **Kas kelas** dan
  **Kontribusi sukarela**, bukan **Tagihan**, **SPP**, **Tunggakan**, atau badge
  overdue. `EXTERNAL_REFERENCE_ONLY` hanya menampilkan referensi yang legal;
  form kontribusi, proof, expense, saldo, closing statement, audit ledger, dan
  tombol disbursement tidak boleh dirender.
- `ClassFundUiContext`/detail fund minimal mengirim scope lengkap, custody
  model, lifecycle/state yang valid untuk custody tersebut, status/revision,
  action state/reason code, dan retention state. `contributionPolicy` hanya
  dikirim untuk `SCHOOL_CUSTODIED`.
  `availableBalance`, approval policy, list ledger/expense, dan closing
  statement hanya dikirim untuk `SCHOOL_CUSTODIED` kepada actor yang berhak;
  `EXTERNAL_REFERENCE_ONLY` mengirim `financialState=NOT_APPLICABLE` tanpa
  field finansial. `ClassFundParentStatement` hanya memuat proyeksi teredaksi
  §13.11.1. Semua list menggemakan scope, cursor, sort, dan revision sesuai
  §13.2/§13.16. UI tidak boleh menyusun fund dari `classroomId` URL, cache
  kelas lama, atau asumsi bahwa semua Parent pada rombel memiliki access yang
  sama.
- Create contribution/proof, verify contribution, submit/approve/disburse
  expense, propose/approve refund atau transfer, close/closing correction, dan
  officer grant issue/revoke memakai `Idempotency-Key`; setiap
  update/transition resource yang sudah ada juga memakai
  `expectedRevision`. Aksi finansial yang timeout atau conflict selalu
  `REFETCH_FIRST`/`DO_NOT_RETRY` sesuai response server; UI tidak memberi
  sukses optimistis atau mengirim ulang tanpa memeriksa ledger/expense
  kanonis.
- Notifikasi/inbox dapat memberi tahu contributor tentang contribution miliknya
  dan wali yang memiliki `VIEW_CLASS_FUND` efektif tentang ringkasan expense
  yang telah `PUBLISHED_REDACTED`/final statement `SCHOOL_CUSTODIED`. Push/
  realtime tidak memuat nominal individu, nama contributor, detail rekening,
  proof, atau saldo yang tidak boleh dilihat; tap selalu me-revalidate
  authority. Revocation guardian/officer/fund capability menghapus cache, file
  bukti lokal, dan action kas kelas sesuai §13.1–§13.2.
- Tidak ada automatic backfill atau konversi dari `SCHOOL_ACTIVITY`, invoice,
  obligation pendidikan, payment proof sekolah, `ParentEnrollment`, credit
  Daycare, booking, atau spreadsheet lama. Bila historical opening balance
  diperlukan, import membuat satu `OPENING_BALANCE` dengan source document,
  nominal/currency, reason, importer dan approver berbeda, audit immutable,
  serta flag manual-import. Import tidak menciptakan contribution individual,
  invoice, tunggakan, atau restriction bagi Parent mana pun.

### 13.12 Matriks akses Parent dan Staff yang tidak ambigu

- Boolean `Membership.active` tidak cukup sebagai kontrak UI Parent. Server
  harus mengembalikan state akses Parent berikut beserta `reasonCode`, tanggal
  efektif, daftar learner/resource yang boleh dibaca, dan `allowedActions`.

| State Parent | Data/route yang boleh dibuka | Aksi yang boleh dilakukan | Yang harus disembunyikan/diblokir |
| --- | --- | --- | --- |
| `NO_MEMBERSHIP` | Profile global, katalog publik, draft/application sendiri melalui `APPLICATION_SELF_SERVICE` | Signup, buat/ubah draft sendiri bila offering terbuka | Data anak tenant, QR, booking, kelas, perkembangan, invoice yang bukan miliknya. |
| `APPLICATION_IN_PROGRESS` | Application, dokumen, decision, invoice/proof sendiri melalui grant application | Submit/batalkan/upload dokumen atau proof sesuai lifecycle | Data operasional anak, placement, QR, booking, attendance, development. |
| `ACTIVE_GUARDIAN` | Semua resource anak yang diizinkan relation, offering, consent, dan capability | Aksi Parent yang diberi grant, mis. booking, izin, upload proof, manage pickup/consent | Data siswa/wali lain, konfigurasi tenant, mutasi operasional Staff. |
| `BILLING_LIMITED` | Invoice/receipt sendiri, safety card, insiden yang ditujukan, status attendance/check-out saat ini sesuai guardian grant | Hanya `allowedActions` per resource—mis. bayar/upload proof jika invoice masih payable, acknowledge insiden, atau tarik pickup/consent untuk masa depan | Booking baru, QR, future service, perubahan finansial selain penyelesaian invoice, activation pickup baru. |
| `GUARDIAN_REVOKED` atau `CHILD_WITHDRAWN` | Invoice/dokumen milik actor menurut retensi eksplisit | Tidak ada kecuali tindakan finance yang masih diizinkan | Data anak baru, attendance, development, health, safety feed baru, pickup, consent. |
| `TENANT_SUBSCRIPTION_RESTRICTED` | Inbox safety yang telah ditujukan dan invoice sendiri sesuai exception server | Tidak ada operasi baru kecuali penyelesaian invoice yang diizinkan | Semua route normal yang tidak berada pada allowlist exception. |

- `GuardianAuthority` target adalah grant terpisah dari `GuardianLink` dan
  `Membership`. Ia memiliki `guardianLinkId`, `learnerId`, scope offering bila
  relevan, `effectiveFrom`, `effectiveUntil`, `status`, issuer/revoker/reason,
  revision, dan action set terkontrol: `VIEW_CHILD`, `VIEW_ACADEMIC`,
  `VIEW_ATTENDANCE`, `VIEW_DEVELOPMENT`, `VIEW_HEALTH`,
  `VIEW_SAFETY_INCIDENT`, `ACKNOWLEDGE_INCIDENT`, `MANAGE_FINANCE`,
  `MANAGE_PICKUP`, `MANAGE_CONSENT`, `SUBMIT_ABSENCE`, serta
  `RECEIVE_SAFETY_ALERTS`, `VIEW_CLASS_FUND`, dan
  `CONTRIBUTE_CLASS_FUND`. Dua action kas kelas terakhir selalu memerlukan
  scope fund/placement yang valid menurut §13.11.1; keduanya tidak membuat
  kewajiban pembayaran dan tidak mengizinkan Parent melihat contribution wali
  lain. Tidak ada action yang diturunkan dari nama hubungan, alamat sama, nama
  keluarga, atau status akun saja.
- Server mengevaluasi authority pada waktu read dan mutasi, termasuk tanggal
  efektif. Perubahan/revocation wajib meng-invalidate `UiAccessContext` dan
  query child terkait; client menghapus cache detail yang tidak lagi legal
  sebelum route berikutnya dirender. Tampilan Parent memakai `allowedActions`
  dari authority efektif, bukan mengasumsikan semua wali memiliki hak identik.
- Event keselamatan menentukan audience dari guardian grant yang berlaku pada
  waktu event dibuat. Grant yang dicabut setelah event tidak mengubah audit
  audience historis, tetapi mencegah akses ke event baru. Retensi histori
  keselamatan setelah `GUARDIAN_REVOKED` harus merupakan policy tertulis, bukan
  akibat samping dari UI cache.
- Staff/Staff Admin dengan membership nonaktif tidak memiliki mutasi apa pun.
  Read-only historis hanya tersedia untuk resource yang secara eksplisit
  mengizinkannya; ia tidak mencakup health detail, medication, pickup
  authorization, live attendance, incident baru, export, kontak guardian, atau
  dokumen admission. UI menampilkan banner read-only dengan reason code, bukan
  sekadar menyisakan tombol yang akan gagal.
- Action grant Staff yang sensitif harus bertipe dan scoped. Minimal target
  grant adalah `CHILD_READ`, `ATTENDANCE_RECORD`, `SCHOOL_ATTENDANCE_RECORD`,
  `DEVELOPMENT_WRITE`, `INCIDENT_CREATE`, `PICKUP_VERIFY`,
  `HEALTH_EMERGENCY_VIEW`, `HEALTH_RESTRICTED_VIEW`, `HEALTH_WRITE`,
  `HEALTH_EMERGENCY_OVERRIDE`, `MEDICATION_ADMINISTER`, `ADMISSIONS_REVIEW`,
  `ADMISSIONS_DECIDE`,
  `EDUCATION_BILLING_VIEW`, `EDUCATION_BILLING_ADJUST`, `PLACEMENT_MANAGE`,
  `ACADEMIC_RECORD`, `ACADEMIC_PUBLISH`, `CLASS_FUND_CONFIGURE`,
  `CLASS_FUND_OPEN`, `CLASS_FUND_PAUSE`, `CLASS_FUND_CLOSING_START`,
  `CLASS_FUND_CLOSE`, `CLASS_FUND_OFFICER_GRANT_ISSUE`,
  `CLASS_FUND_OFFICER_GRANT_REVOKE`, `CLASS_FUND_VIEW`,
  `CLASS_FUND_CONTRIBUTION_RECORD`, `CLASS_FUND_CONTRIBUTION_VERIFY`,
  `CLASS_FUND_EXPENSE_PROPOSE`, `CLASS_FUND_EXPENSE_APPROVE`,
  `CLASS_FUND_EXPENSE_DISBURSE`, `CLASS_FUND_RECONCILE`,
  `CLASS_FUND_REFUND_PROPOSE`, `CLASS_FUND_REFUND_APPROVE`,
  `CLASS_FUND_TRANSFER_PROPOSE`, `CLASS_FUND_TRANSFER_APPROVE`,
  `CLASS_FUND_CLOSING_CORRECTION_PROPOSE`,
  `CLASS_FUND_CLOSING_CORRECTION_APPROVE`, dan `CLASS_FUND_AUDIT`.
  Assignment operasional memetakan grant tersebut; role atau nama rombel saja
  tidak langsung memberi semua grant. Grant
  `ADMISSIONS_DECIDE`, `EDUCATION_BILLING_ADJUST`, `PLACEMENT_MANAGE`,
  `ACADEMIC_PUBLISH`, dan seluruh grant kas kelas harus membawa scope offering
  serta batas cabang/tahun ajaran/rombel atau fund yang eksplisit. Grant kas
  kelas juga selalu mengikuti custody dan separation-of-duties §13.11.1.
- Platform Admin tidak mempunyai support override implisit atas data anak.
  Jika suatu saat diperlukan, override harus berupa grant sementara dengan
  `caseId`, tenant/resource scope, reason, expiry, actor, audit read/write,
  dan banner yang jelas pada UI. Ia tidak boleh diwujudkan sebagai bypass role
  tersembunyi.

### 13.13 Penjemputan, consent, kesehatan, dan insiden

#### 13.13.1 Relasi keselamatan dan check-out

**Implementasi Daycare V1 saat ini:** `PickupAuthorization` tersimpan terpisah
dari `GuardianLink`, membawa identitas penjemput, hubungan, metode verifikasi,
masa berlaku, status, pembuat, verifier/revoker, serta audit immutable. Parent
yang sudah terhubung dapat mengajukan dan mencabut pengajuannya sendiri;
Staff Admin mengaktifkan atau mencabutnya. Staff dalam child scope tidak dapat
mengaktifkan/mencabut, tetapi dapat memilih authorization yang `ACTIVE` pada
check-out. Check-out Daycare menyimpan snapshot authorization, nama penjemput,
metode, operator, dan alasan exception bila dipakai. Tanpa authorization aktif,
check-out ditolak kecuali dilakukan oleh Staff Admin aktif dengan alasan wajib.
QR attendance bukan kredensial penjemput dan batas finansial tidak dipakai untuk
menolak check-out.

**Availability rule implemented:** kartu, halaman, deep link, dan seluruh
endpoint `PickupAuthorization` hanya tersedia bila anak berada pada cabang yang
memiliki sedikitnya satu `EducationOffering` berstatus `PUBLISHED` dengan
capability `DAYCARE_OPERATIONS`. Capability agregat tenant atau offering Daycare
di cabang lain tidak cukup. Server memeriksa cabang anak pada setiap baca,
create, activate, revoke, dan verifikasi check-out; UI memakai `UiAccessContext`
yang sama untuk menyembunyikan entry point. Seluruh akses tersebut juga
memerlukan membership aktif; tidak ada read-only historis untuk penjemputan.

**Fondasi kontak darurat saat ini:** `EmergencyContact` adalah resource terpisah
dari `GuardianLink` dan `PickupAuthorization`, berisi nama, hubungan, nomor
telepon, pembuat, dan audit. Kontak juga membawa `status`
(`ACTIVE`/`EXPIRED`/`REVOKED`) dan `effectiveUntil` opsional: kontak yang masa
berlakunya lewat dilaporkan `EXPIRED` secara otomatis (dihitung saat dibaca,
tanpa job terjadwal) tanpa mengubah data tersimpan, dan wali yang membuat kontak
atau Staff Admin dapat menonaktifkannya secara eksplisit (`REVOKED`) dengan
alasan wajib—sebagai alternatif tidak-destruktif dari menghapus permanen. Parent
terkait dapat membuat, menonaktifkan, atau menghapus kontak yang dibuatnya
sendiri; Staff Admin dapat membaca, menonaktifkan, dan menghapus kontak dalam
child scope. Kontak darurat tidak memberi hak masuk akun, hak pickup, atau hak
consent.

**Target yang belum dibangun:** grant eksplisit `MANAGE_PICKUP`/`PICKUP_VERIFY`,
idempotency key/correlation ID, serta witness atau second approver yang
dikendalikan policy offering. Hingga grant tersedia, Parent terkait menggantikan
`MANAGE_PICKUP` dan child scope Staff menggantikan `PICKUP_VERIFY` untuk V1; ini
tidak boleh diperluas ke child lain atau tenant lain.

- `GuardianLink`, `EmergencyContact`, dan `PickupAuthorization` adalah entity
  berbeda. Satu orang dapat direferensikan oleh lebih dari satu entity, tetapi
  hak tidak diwariskan antar-entity.
- `PickupAuthorization` dan `EmergencyContact` membawa nama, relasi, metode
  verifikasi, status `PENDING_VERIFICATION`/`ACTIVE`/`SUSPENDED`/`EXPIRED`/
  `REVOKED`, `effectiveFrom`, `effectiveUntil`, creator, verifier, revoker,
  reason, dan audit immutable. One-time pickup selalu memiliki `validUntil`
  dan tidak pernah berubah menjadi otorisasi tetap.
- Wali dengan grant `MANAGE_PICKUP` dapat mengajukan atau mencabut penjemput.
  Staff Admin dengan baseline grant memverifikasi/mengaktifkan
  `PickupAuthorization`; Staff tidak dapat membuat approval/activation tersebut
  bagi dirinya sendiri atau pihak lain. Staff scoped dengan `PICKUP_VERIFY`
  tetap dapat memverifikasi authorization yang **sudah aktif** saat check-out.
  Pencabutan berlaku segera untuk check-out baru.
- Check-out Daycare adalah transaksi atomik. Server memvalidasi attendance
  masih open, branch dan tanggal operasional, operator memiliki
  `PICKUP_VERIFY`, authorization aktif pada timestamp cabang, metode verifikasi,
  dan idempotency key. Record menyimpan snapshot `authorizationId`, identitas
  terverifikasi secukupnya, metode, operator, waktu, cabang, dan correlation
  ID; server menolak double check-out.
- QR attendance Parent bukan pickup credential. Pickup QR, bila kelak
  diaktifkan, harus one-time, signed, bound ke child + authorization + expiry,
  dan single-use. Pengecualian check-out hanya Staff Admin aktif dengan reason
  wajib serta witness/second approver bila policy offering memintanya; UI
  mengirim notifikasi keselamatan sesudah transaksi berhasil.
- Invoice, overdue, overtime, atau restriction finansial tidak boleh menahan
  check-out anak. Koreksi check-out adalah addendum/void teraudit, bukan
  overwrite waktu atau pihak penjemput lama.

#### 13.13.2 Consent yang direvisi dan dibekukan

**Implementasi Consent V1 saat ini (Daycare saja):** Staff Admin aktif pada
tenant dengan capability `DAYCARE_OPERATIONS` dapat membuat, merevisi,
mengaktifkan, dan menonaktifkan definisi consent tenant-scoped. Parent yang
terhubung ke anak hanya melihat definisi aktif dan status **keputusannya
sendiri** untuk anak itu; ia dapat memberi, menolak, atau menarik persetujuan
yang sebelumnya diberikan. Layar Parent tidak menerima nama, status, dokumen,
atau keputusan guardian lain. Layar Staff Admin hanya mengelola definisi, bukan
melihat keputusan per guardian/anak.

Layar **Definisi persetujuan** menyediakan action informasi baca-saja di
toolbar untuk Staff Admin yang sama. Halaman ini menjelaskan dengan bahasa
sederhana fungsi pencatatan V1, keputusan yang diambil Parent, revision, cara
memilih purpose, serta batas bahwa V1 belum mengotorisasi tindakan sensitif.
Halaman informasi tidak memuat keputusan, identitas, atau data anak/guardian.

Setiap revisi teks atau perubahan aktif/nonaktif menaikkan `revision` dan
memerlukan `expectedRevision`; keputusan Parent baru selalu disimpan terhadap
revision saat ini. `ConsentRecord` membekukan title dan isi definition; purpose
tidak dapat diubah pada V1. Record juga menyimpan child, guardian, status,
waktu keputusan, serta waktu penarikan. Constraint unik memakai
`child + definition + guardian + revision`, sehingga keputusan revision lama
tetap tersedia sebagai riwayat saat teks direvisi. Create/revise,
aktif/nonaktif, grant/decline, dan withdrawal membuat audit event dasar.

V1 ini **hanya pengumpulan dan pencatatan keputusan**. Ia tidak memberi
otorisasi tindakan medis, pemberian obat, penjemputan, outing, penggunaan
media, check-out, atau emergency override. API tindakan tersebut tidak boleh
memakai `ConsentRecord` V1 sebagai allowlist; tujuan consent di UI hanya
menjelaskan jenis policy yang kelak akan dipasangkan. Dengan demikian tidak ada
putusan Parent yang secara keliru terlihat sebagai izin operasional atau klinis.

**Target yang belum dibangun:** `GuardianAuthority`, scope cabang/offering,
evidence, resolver konflik antar-guardian, idempotency/correlation key formal,
serta `HEALTH_EMERGENCY_OVERRIDE`. Sebelum seluruh target ini dibangun dan
diterapkan pada endpoint tindakan, status consent tidak boleh dipakai untuk
mengizinkan atau menolak tindakan sensitif.

- Kontrak V1 memakai `GET /consent-definitions/manage`, `POST
  /consent-definitions`, `PUT /consent-definitions/{definitionId}`, dan `POST
  /consent-definitions/{definitionId}/active` khusus Staff Admin Daycare.
  Parent memakai `GET /children/{childId}/consents`, `POST
  /children/{childId}/consents`, serta `POST /children/{childId}/consents/
  {definitionId}/withdraw`. Semua route memvalidasi tenant aktif,
  `DAYCARE_OPERATIONS`, role, child/guardian scope, dan status definition di
  server; kontrol UI bukan sumber otorisasi.
- Parent view mengagregasi hanya record actor pada revision definition aktif.
  Tidak ada agregasi "siapa setuju" dan tidak ada policy konflik antar-wali pada
  V1. Setelah reaktivasi atau revisi, revision bertambah dan Parent melihat
  `PENDING` sampai ia mengambil keputusan baru.

- `ConsentDefinition` bersifat tenant-scoped dan membawa revision serta scope
  eksplisit `TENANT`, `BRANCH`, atau `OFFERING`; scope cabang/offering wajib
  diisi bila mode tersebut dipilih. `ConsentRecord` menyimpan child, purpose,
  `definitionRevision` dan text snapshot, guardian yang berwenang, status,
  periode efektif, evidence, actor, serta audit. Server memvalidasi bahwa
  tindakan dan `GuardianAuthority` terjadi dalam scope definition; `null` tidak
  boleh diam-diam berarti tenant-wide.
- Purpose minimum adalah media/foto, tindakan medis darurat, pemberian obat,
  perjalanan/kegiatan luar, dan penjemputan. Consent media marketing tidak
  sama dengan izin foto bukti insiden atau media operasional internal.
- Status consent adalah `PENDING`, `GRANTED`, `DECLINED`, `WITHDRAWN`,
  `EXPIRED`, atau `SUPERSEDED`. Wali dapat menarik consent untuk masa depan,
  tetapi tidak menghapus bukti tindakan saat consent sebelumnya masih berlaku.
  Bila beberapa guardian berwenang memberi keputusan yang berkonflik, policy
  paling restriktif berlaku sampai Staff Admin memverifikasi otoritas/dokumen
  yang relevan. UI menunjukkan konflik dan jalur eskalasi tanpa menampilkan
  keputusan atau dokumen wali lain kepada Parent.
- Setiap tindakan yang memerlukan consent divalidasi server pada waktu tindakan
  dengan purpose, scope, dan `definitionRevision` yang benar. Emergency
  override hanya dapat dilakukan oleh Staff Admin baseline atau Staff scoped dengan
  `HEALTH_EMERGENCY_OVERRIDE` untuk tindakan darurat segera; ia memerlukan
  reason, actor/grant, timestamp, dan follow-up. Override tidak menjadi consent
  obat atau consent berkelanjutan.

#### 13.13.3 Kesehatan dan pemberian obat

**Implementasi saat ini berbeda dari target di bawah ini**: `ChildHealthRecord` (§10) adalah satu record flat per anak (`bloodType`/`allergies`/`medicalConditions`/`medications`/`emergencyInstructions` — semuanya teks bebas, bukan entity terpisah `EmergencyHealthSummary`/`RestrictedHealthDetail`/`MedicationOrder`/`MedicationAdministrationLog`), dan **tidak ada model grant** (`GuardianAuthority`, `VIEW_HEALTH`) sama sekali. Saat ini: Parent yang terhubung sebagai guardian anak (lewat `GuardianLink` biasa) selalu dapat membaca seluruh record kesehatan anaknya; Staff Admin serta **semua** Staff yang di-scope ke anak itu (bukan hanya Staff dengan grant kesehatan khusus) dapat membaca dan menulis — ini keputusan desain yang disengaja, menyamakan pola izin Program Pendampingan Anak (lihat §10), bukan bug. Target di bawah ini (pemisahan entity, grant kesehatan khusus per Staff, `VIEW_HEALTH` sebagai syarat baca Parent) belum dibangun:

- Target data kesehatan dipisah menjadi `EmergencyHealthSummary`,
  `RestrictedHealthDetail`, `MedicationOrder`, dan `MedicationAdministrationLog`.
  UI list/search/card hanya menampilkan safety flag minimum, bukan diagnosis,
  obat, alergi detail, atau file medis.
- `EmergencyHealthSummary` hanya memuat informasi yang diperlukan agar petugas
  bertindak aman; `RestrictedHealthDetail` hanya terbuka bagi Staff Admin atau
  Staff dengan grant kesehatan dan child scope aktif. Parent/wali hanya dapat
  membaca data kesehatan anaknya bila memiliki `GuardianAuthority` efektif
  `VIEW_HEALTH`, serta dapat mengirim permintaan koreksi; ia tidak boleh
  mengedit histori klinis atau audit secara langsung.
- `MedicationOrder` menyimpan sumber instruksi, route, dosis, jadwal, tanggal
  efektif/kedaluwarsa, consent yang diperlukan, dan status. UI tidak boleh
  menghitung dosis atau auto-fill keputusan klinis. Tanpa order dan consent
  valid, tombol pemberian obat tidak tersedia dan server menolak mutasi.
- `MedicationAdministrationLog` bersifat append-only dan menyimpan waktu aktual,
  actor, outcome, refusal/missed reason, witness bila policy memerlukan, serta
  link incident bila terjadi efek samping. Perubahan adalah addendum, bukan
  penghapusan/overwrite log pemberian.

#### 13.13.4 Insiden dan acknowledgement per penerima

- Laporan insiden awal immutable: waktu kejadian, waktu pelaporan, cabang,
  reporter, severity/category, deskripsi, tindakan awal, dan media snapshot.
  Koreksi dan tindak lanjut menjadi addendum dengan actor/waktu/reason, bukan
  edit atau delete record awal.
- Lifecycle target insiden memakai tiga state terpisah agar UI tidak menebak
  cabang transition: `incidentStatus` adalah `OPEN`, `IN_PROGRESS`, atau
  `CLOSED`; `escalationStatus` adalah `NOT_REQUIRED`, `PENDING`, `ESCALATED`,
  atau `RESOLVED`; `guardianContactStatus` adalah `NOT_REQUIRED`, `PENDING`,
  `ATTEMPTED`, atau `CONFIRMED`. `SERIOUS` dibuat dengan escalation/contact
  `PENDING`, lalu mewajibkan checklist tindakan segera, attempt kontak wali
  beserta outcome, layanan darurat/referral bila ada, pemilik follow-up, dan
  tanggal due. `CLOSED` ditolak selama escalation/contact/follow-up yang wajib
  masih pending. Mute push tidak pernah dianggap bukti kontak.
- Acknowledgement Parent disimpan **per recipient guardian** sebagai
  `{incidentId, userId, acknowledgedAt}`. Satu wali yang acknowledge tidak
  boleh menghilangkan indikator belum dibaca/ack bagi wali lain. Parent hanya
  dapat membaca/ack insiden yang ditujukan kepadanya bila memiliki
  `VIEW_SAFETY_INCIDENT`/`ACKNOWLEDGE_INCIDENT` yang efektif; ia tidak dapat
  mengubah detail atau follow-up operasional.

### 13.14 Notifikasi, audit, dan privasi tampilan

- Audience notifikasi dihitung server pada saat event dari scope, capability,
  status membership, dan `GuardianAuthority` yang berlaku. Event payload dan
  audience inbox per penerima bersifat immutable dan memuat event type serta
  reference resource. State delivery/read/ack adalah record penerima terpisah
  yang append-only atau setiap perubahannya teraudit; action path selalu
  direvalidasi ketika dibuka.
- Push dan realtime untuk event sensitif hanya membawa teks generik, misalnya
  “Ada pembaruan keselamatan”. Mereka tidak boleh memuat nama anak, diagnosis,
  deskripsi insiden, kontak, dokumen, nomor invoice penuh, atau URL
  berkredensial. Setelah tap, app mengambil ulang resource dan mengotorisasi
  kembali.
- State delivery dibedakan: `created`, `pushAttempted`, provider receipt/delivery
  bila tersedia, `read`, dan `acknowledged`. Tidak ada state yang sama dengan
  konfirmasi kontak dunia nyata. Mute hanya memengaruhi push attempt, tidak
  menghapus inbox, realtime invalidation, atau kewajiban escalation insiden.
- Audit harus merekam sensitive read, export/download, perubahan consent,
  pickup, health, medication, incident, status, publish, restriction finance,
  dan override; serta konfigurasi/custody fund, contribution verification,
  ledger/reconciliation, expense, settlement refund/transfer, closing
  statement/correction, officer grant, dan sensitive read/download kas kelas.
  Event audit menyimpan actor, role/membership/grant, tenant, branch, learner,
  resource, action, reason, diff teredaksi, UTC timestamp, effective local
  time, serta request/device correlation. Audit tidak dapat diedit oleh actor
  dan tidak boleh menaruh secret atau media biner.
- Detail endpoint menerapkan field minimization. Daftar anak, kartu Home,
  pencarian, log, analytics, export, dan push tidak boleh membocorkan kontak
  wali, health detail, pickup authorization, dokumen, atau media hanya karena
  user dapat melihat nama anak. Download media selalu mengulang scope resource;
  mengetahui ID atau URL lama tidak cukup untuk membacanya.

### 13.15 Operabilitas UI untuk setiap role

- Setiap screen operasional menampilkan konteks aktif yang dapat dibaca:
  tenant, cabang/penawaran bila relevan, tahun ajaran/term bila relevan, serta
  anak atau rombel yang dipilih. Konteks bukan tombol untuk memperluas akses;
  ia hanya membantu pengguna memahami resource yang sedang dikerjakan.
- Bila lebih dari satu context legal tersedia, selector selalu memulai dari
  level paling luas lalu menyempit: tenant → offering/cabang → tahun ajaran →
  term/tingkatan → rombel → anak/tanggal. Mengganti selector induk membatalkan
  draft yang bergantung padanya, mengosongkan selector turunan, dan memuat
  ulang policy server. UI tidak mempertahankan `childId`, filter, atau draft
  tenant sebelumnya secara tersembunyi.
- Form `dirty` membawa context fingerprint minimal user, `contextId`, tenant,
  offering, learner, dan revision. Back, ganti selector induk, atau pindah
  context meminta konfirmasi sebelum draft dibuang. Draft persisten hanya boleh
  menyimpan field non-sensitif; password, token, bukti bayar, media/dokumen
  kesehatan, evidence consent, data obat, dan bukti pickup tidak boleh
  dipersistenkan. Realtime invalidation tidak boleh menimpa form dirty; UI
  menandainya stale dan submit tetap memakai expected revision atau meminta
  reload/discard secara eksplisit.

| Persona/state | Home dan navigasi | Cara kerja yang wajib | State yang dilarang |
| --- | --- | --- | --- |
| `ADMIN` | Tenant, master global, readiness | Memilih tenant hanya untuk support metadata yang diizinkan; tidak membuka operasi anak | Kartu anak, health, incident, dokumen, invoice Parent, atau support override tersembunyi. |
| `STAFF_ADMIN` aktif | Home, Children, Classes, Manage dan target menu per capability | Dapat memilih penawaran/cabang legal; melihat checklist readiness dan alasan action disabled | Mengubah data tenant lain, global master, atau resource di luar capability. |
| `STAFF_ADMIN` nonaktif | Route histori yang diizinkan dengan banner read-only | Dapat kembali ke Home/Profile; semua mutation hilang | Export, health detail, live attendance, approval, publish, atau tombol delete tersisa aktif. |
| `STAFF` aktif | Kartu tugas/anak scope, inbox, route operasional yang assigned | Selalu mulai dari roster/anak assignment; child switcher tidak boleh memperluas scope | Menu tenant-wide, data kelas lain, konfigurasi biaya, atau keputusan yang tidak memiliki grant. |
| `STAFF` nonaktif | Hanya histori secara resource policy dan Profile | Banner reason/read-only; no pending mutation | Kartu kerja yang menyiratkan tugas wajib atau action yang dapat dieksekusi. |
| `PARENT` `NO_MEMBERSHIP`/application | Home onboarding/katalog dan Profile | Memilih application sendiri tanpa data operasi anak | QR, booking, development, class/academic route. |
| `PARENT` guardian aktif | Home per anak dengan badge Penitipan/Sekolah dan inbox | Semua kartu selalu child+offering scoped; invoice membuka sumber invoice yang tepat | Menggunakan anak pertama atau offering pertama secara implisit. |
| `PARENT` billing/safety limited | Kartu reason, invoice, safety/inbox yang legal | Jalur penyelesaian jelas dan tak menutup emergency/check-out information | Redirect loop ke onboarding atau tampilan kosong tanpa alasan. |
| `STUDENT` target | Jadwal/tugas/rapor diri sendiri | Context learner sudah dikunci server, UI tidak menyediakan child switcher | Parent finance, health, contact, roster, atau data siswa lain. |

- Bottom navigation setiap role bersifat fixed dan didefinisikan tunggal di
  `RoleBottomNavigation.tsx` (`navigationByRole`); route di luar daftar berikut
  tidak boleh diklaim sebagai tab role tersebut:
  - `ADMIN`: Home, Tenant (`/platform-tenants`), Master data (`/platform-catalog`).
  - `STAFF_ADMIN`: Home, Children (`/children`), Kelas (`/academic`), Kelola
    (`/staff-admin`).
  - `STAFF`: Home, Aktivitas (`/staff-operations`), Kelas (`/academic`),
    Persetujuan (`/booking-approvals`, hanya tampil bila membership memiliki
    capability `DAYCARE_OPERATIONS`).
  - `PARENT`: Home, QR hadir (`/parent-qr`), Booking (`/booking`), Jam
    operasional (`/operational-hours`) — ketiga menu selain Home hanya tampil
    bila membership memiliki capability `DAYCARE_OPERATIONS`.
  - `PARENT_ONBOARDING` (registrasi Parent belum punya membership aktif):
    Home, Pendaftaran (`/parent-enrollment`).
  - Menekan tab menggunakan `router.replace`, bukan push — tab merepresentasikan
    root, bukan screen yang ditumpuk.
- Route yang bukan tab role aktor tetap dapat diakses lewat `router.push` dari
  layar lain (mis. `STAFF` membuka `/children` dari `/staff-operations`
  walau `/children` adalah tab milik `STAFF_ADMIN`). Untuk kasus ini screen
  wajib merender dirinya sebagai pushed screen bagi role yang bukan pemilik tab
  (`showBottomNavigation={false}`, app bar dengan judul dan back button) dan
  sebagai tab root bagi role pemiliknya (`showBottomNavigation={true}`, tanpa
  app bar/back button, judul dipindah ke body) — `showBottomNavigation` pada
  `AppScreen` tidak otomatis konsisten dengan `header`/`title` dan harus
  disinkronkan manual sesuai role per screen (lihat pola di
  `booking-approvals.tsx` dan `children.tsx`).

- UI Kas kelas memakai context offering → tahun ajaran → tingkatan → rombel →
  fund dan selalu menampilkan custody/status fund. Parent melihat kontribusi
  sendiri serta `ClassFundParentStatement` teredaksi, sementara officer Staff
  melihat toolbar sesuai grant secara terpisah: catat/verifikasi kontribusi,
  ajukan, setujui, disburse, atau audit. Tiap tombol memeriksa
  `allowedActions`, `actionState`, revision, dan reason dari response; tidak
  ada tombol serbaguna "Kelola kas" yang memberi lebih dari grant actor.
  `SCHOOL_CUSTODIED` `PAUSED`, `CLOSING`, `CLOSED`, atau `ARCHIVED` selalu
  menjadi state baca/alasan sesuai action server; `EXTERNAL_REFERENCE_ONLY`
  hanya mengenal tampilan `PUBLISHED`, `RETIRED`, atau `ARCHIVED` metadata dan
  tidak pernah berubah menjadi formulir kontribusi/pengeluaran melalui cache.
- Kas kelas tidak boleh muncul di daftar invoice, kartu tunggakan, checkout,
  atau payment history sekolah/Daycare. Kontribusi sukarela harus memiliki
  wording yang eksplisit dan affordance batal/riwayat sendiri yang sesuai
  lifecycle, tanpa menampilkan daftar Parent yang belum/ sudah berkontribusi.
  Detail expense Parent hanya boleh memakai `expenseSummary`
  `PUBLISHED_REDACTED`; rekening, reference sensitif, bukti, raw purpose, dan
  identitas contributor lain selalu disembunyikan. UI juga membedakan fund
  `EXTERNAL_REFERENCE_ONLY` sebagai informasi read-only, bukan kegagalan
  pembayaran.
- Kartu Home tidak boleh menyembunyikan sumber status. Setiap kartu yang
  merangkum invoice, attendance, Goal, report, task, atau incident selalu
  membawa label child + offering/source + status teks. Warna/badge hanya
  pelengkap dan tidak boleh menjadi satu-satunya pembeda.
- `allowedActions` pada resource menentukan tombol; `state` menentukan apakah
  tombol aktif, disabled dengan reason aman, atau tidak tampil. List kosong
  tidak berarti actor tidak berizin; empty state harus membedakan `NO_DATA`,
  `NOT_CONFIGURED`, `NOT_AVAILABLE`, `NO_SCOPE`, dan `LOADING_ERROR` tanpa
  membocorkan data luar scope.
- Semua form memakai state `idle`, `validating`, `submitting`, `succeeded`,
  `failed`, atau `conflict`. Saat `submitting`, aksi yang sama hanya dapat
  dikirim sekali. Setelah success, UI memakai record kanonis dari server lalu
  invalidate/refetch query context yang terdampak; optimistic update hanya
  boleh untuk mutasi rendah risiko yang dapat di-rollback tanpa perubahan
  financial, status, attendance, health, consent, atau placement.
- Kegagalan jaringan atau timeout pada enrollment, invoice/proof, booking,
  keputusan, check-in/out, check-out penjemputan, consent, medication,
  placement, nilai, atau publish memiliki outcome tidak diketahui. UI tidak
  mencoba ulang otomatis, tidak memberi toast sukses, dan meminta pengguna
  memuat ulang resource sebelum mengirim tindakan baru.
- Konfirmasi eksplisit wajib sebelum terminal/berisiko tinggi: reject/approve,
  cancel/void, deactivate, publish/supersede report, financial adjustment,
  check-out exception, revoke consent/pickup, medication administration, dan
  close incident; serta verify contribution, approve/disburse expense, propose/
  approve refund atau transfer, mulai/close fund, closing correction, dan
  menerbitkan/mencabut officer grant kas kelas. Dialog menyebut resource,
  nominal/scope/dampak, action code, dan revision yang akan dikirim,
  membutuhkan reason bila policy mengharuskan, serta tidak boleh menyembunyikan
  detail penting dalam scroll yang tidak dapat diakses.
- Semua screen harus dapat digunakan keyboard/screen reader: tombol memiliki
  label aksi+resource, status memiliki teks selain warna, disabled reason dapat
  dibaca, modal mempunyai focus yang benar, dan error inline dihubungkan dengan
  input terkait. Wording berasal dari i18n; kode internal hanya dipakai untuk
  telemetry/debug yang tidak terlihat pengguna.
- Perubahan dinamis pada hasil pencarian, loading selesai, error, reason
  disabled, dan konflik harus diumumkan kepada screen reader tanpa memindahkan
  fokus secara tak terduga. Setelah validasi gagal, fokus menuju field invalid
  pertama; setelah modal ditutup fokus kembali ke trigger. Layout wajib tetap
  dapat dipakai pada text scaling platform dan tidak boleh mengandalkan warna,
  icon, atau gesture drag sebagai satu-satunya cara memahami atau menjalankan
  aksi.

### 13.16 Kontrak response resource dan failure handling

- Setiap response detail/list yang dapat menghasilkan aksi menyediakan paling
  sedikit `id`, owner scope (`organizationId`, `branchId`, `offeringId` bila
  relevan), `state`, `revision`, `allowedActions`, dan `reasonCode` bila
  resource terlihat tetapi tidak dapat diubah. `reasonCode` adalah nama
  kanonis untuk resource-level restriction; reason action yang tetap terlihat
  tetapi disabled dikirim sebagai `actionState[actionCode].reasonCode`, bukan
  `readOnlyReasonCode` alternatif. Response tidak perlu dan tidak boleh
  mengirim semua data out-of-scope hanya untuk membuat tombol disabled.
- `allowedActions` adalah daftar action code typed, misalnya
  `SUBMIT_APPLICATION`, `UPLOAD_PAYMENT_PROOF`, `APPROVE_BOOKING`,
  `RECORD_ATTENDANCE`, `PUBLISH_REPORT`, `VERIFY_PICKUP`,
  `CONTRIBUTE_CLASS_FUND`, atau `CLASS_FUND_EXPENSE_APPROVE`. UI memetakan code
  tersebut sekali dalam konfigurasi/translation shared; tidak membangun kondisi
  role/status yang berbeda di setiap screen.
- Semua mutasi mengembalikan resource baru, revision baru, action yang berubah,
  dan event invalidation yang scoped. Response error memakai code stabil:
  `VALIDATION_ERROR`, `NOT_AUTHORIZED`, `NOT_AVAILABLE`, `STALE_REVISION`,
  `CAPACITY_CONFLICT`, `LIFECYCLE_CONFLICT`, atau `DUPLICATE_REQUEST`, beserta
  field error bila aman ditampilkan. UI tidak melakukan branching dari pesan
  bahasa bebas.
- Field sensitif atau conditional membawa state typed `AVAILABLE`,
  `NOT_RECORDED`, `REDACTED`, atau `NOT_APPLICABLE`. `null` tidak boleh dipakai
  UI untuk membedakan data belum diisi, data tidak relevan, dan data yang
  sengaja disembunyikan. Bila `REDACTED`, response tidak mengirim nilai asli
  hanya untuk memungkinkan UI membuat placeholder.
- Error autentikasi/session expiry dibedakan dari `NOT_AUTHORIZED` dan membawa
  `requestId` serta retry disposition `SAFE_RETRY`, `REFETCH_FIRST`, atau
  `DO_NOT_RETRY`. Session expiry membersihkan cache scoped lalu kembali ke
  sign-in; UI tidak menampilkan data cache lama atau mencoba ulang mutasi
  sensitif secara diam-diam.
- `NOT_AUTHORIZED` hanya dikirim bila caller sudah boleh mengetahui resource
  ada. Untuk resource yang tidak boleh dideteksi, server menggunakan
  `NOT_AVAILABLE`/404. Deep link atau query stale harus menuju parent route
  legal setelah menunjukkan pesan netral; tidak boleh menampilkan data cache
  lama selama redirect.
- Attachment/media upload/download membawa parent resource ID dan revision
  yang sama, memeriksa content type/ukuran di server, dan tidak menerima URL
  storage sebagai authority. UI tidak menampilkan thumbnail/audio control
  sebelum metadata dan download scope berhasil diotorisasi.
- Timestamp audit disimpan UTC; tanggal operasional/academic date dihitung di
  timezone cabang. UI menampilkan timezone bila interpretasi tanggal/waktu
  dapat berbeda dari timezone perangkat, khususnya booking, attendance,
  overtime, jadwal, expiry, dan check-out.

### 13.17 Kriteria penerimaan sebelum route baru dipublikasikan

Sebuah route atau capability baru hanya boleh ditampilkan bila seluruh kasus
berikut lulus pada UI dan server. Daftar ini adalah minimum regression matrix,
bukan pengganti test domain yang lebih rinci.

| Kasus | Hasil yang wajib |
| --- | --- |
| Tenant Daycare murni | Tidak melihat entry point penerimaan/akademik sekolah; booking, QR, jam operasional, dan overtime tetap mengikuti §3–§4 serta §13.6. |
| Tenant PAUD/TK tanpa Daycare | Tidak diminta memilih paket/booking untuk attendance pendidikan; hanya capability/offerings yang tersedia tampil. |
| Tenant campuran Daycare + pendidikan | Anak dengan kedua layanan melihat dua context terpisah; check-in Daycare tidak mengubah absensi sekolah atau sebaliknya. |
| Tenant dengan `SD`/`SMP` hanya di katalog jenis | Tidak melihat menu/route sekolah sampai offering published dan capability efektif tersedia. |
| Parent tanpa membership/pending/overdue/revoked | Mendapat persis route dan action pada §13.12; tidak terjadi redirect loop, kebocoran data, atau tombol palsu. |
| Dua wali pada satu anak | Akses, consent, incident acknowledgement, dan notifikasi dihitung per wali; acknowledgement satu wali tidak mengubah wali lain. |
| Payer atau pickup bukan wali | Tidak mendapat data anak atau menu Parent hanya karena relasi dicatat. |
| Staff assignment selesai/nonaktif | Query dan deep link live langsung kehilangan mutation/data sensitif sesuai scope; cache lama tidak tetap terlihat. |
| Tabrakan kapasitas/revision/double submit | Server menang secara atomik; UI menampilkan konflik inline, refresh data, dan tidak membuat success palsu. |
| Capability kas kelas tidak ada atau offering Daycare | Tidak ada route/form/ledger kas kelas yang dapat dimutasi; tidak ada fallback ke invoice atau `SCHOOL_ACTIVITY`. |
| Fund `EXTERNAL_REFERENCE_ONLY` | Hanya reference metadata yang legal dapat dibaca; tidak ada saldo, ledger, officer grant moneter, contribution, expense, closing statement, atau fallback ke invoice. |
| Parent pada rombel dengan kas kelas | Hanya melihat contribution/refund sendiri dan `ClassFundParentStatement` teredaksi; nama, nominal, proof, dan status contributor lain tidak bocor, termasuk pada kelas kecil. |
| Kontribusi kas kelas belum dibayar/ditolak/dikembalikan | Tidak membuat invoice, `OVERDUE`, `BILLING_LIMITED`, restriction, perubahan enrollment, atau kartu tunggakan. |
| Kontribusi/refund kas kelas paralel | Nominal positif/currency fund diverifikasi server; verify/refund mem-posting tepat satu entry atomik, self-verification dan refund parsial ditolak. |
| Expense kas kelas paralel atau self-approval | Reservation/ledger server mencegah saldo negatif dan duplikasi; requester tidak dapat approve/disburse expense sendiri, UI refetch setelah konflik. |
| Refund/transfer/correction atau officer grant kas kelas | Hanya action typed dan scoped yang tepat tampil; proposer/approver berbeda, dialog mengonfirmasi nominal/scope/revision, dan posting ledger hanya terjadi atomik setelah approval. |
| Custody accountable user atau grant officer dicabut | Fund moneter dipause/action moneter langsung hilang, cache/file bukti scoped dibersihkan, dan tidak ada Parent officer fallback. |
| Fund masuk `CLOSING` dengan pledge/proof/expense/settlement tertunda | Server memberi outcome kanonis yang teraudit untuk seluruh record, menolak proof baru, dan tidak membiarkan close deadlock. |
| Closing dengan expense approved atau saldo ditransfer | Hanya expense approved lama yang dapat disburse/cancel; successor `DRAFT` tidak menerima dana baru sampai transfer+close atomik berhasil. |
| Closing/refund/transfer kas kelas | Tidak ada transaksi nonterminal tertinggal; final statement immutable, saldo/disposition kanonis teraudit, dan fund lama tidak dapat dibuka ulang. |
| Perubahan tenant/cabang/offering/tahun/anak | Semua selector turunan, draft, cache, dan allowed action lama di-reset sebelum data baru dirender. |
| Timezone cabang berbeda dengan perangkat | Tanggal booking, attendance, overtime, jadwal, dan expiry mengikuti timezone cabang. |
| Report/publish/finance/health/incident | Hanya actor scoped dengan grant dapat bertindak; record historis, revision, audit, dan Parent view mengikuti lifecycle tepat. |
| Offline/timeout setelah mutasi sensitif | UI tidak retry otomatis; user memuat ulang record dan melihat outcome kanonis sebelum bertindak lagi. |

- Setiap implementasi menambahkan unit test untuk state mapping typed, integration
  test untuk server authorization/transition/capacity, dan UI test untuk guard,
  selector reset, action disabled, error inline, accessibility label, serta
  deep link. Test tidak boleh hanya memeriksa apakah kartu/menu terlihat.
- Sebelum rollout, migration harus menetapkan mapping legacy secara eksplisit:
  `ParentEnrollment`/entitlement/booking tetap Daycare, `ChildPlacement` legacy
  tidak otomatis berubah menjadi `AcademicPlacement`, dan data baru tidak
  di-backfill dari nama tingkatan atau jenis tenant tanpa keputusan Staff Admin
  yang dapat diaudit.
