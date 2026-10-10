# Plan: Cek Perkembangan Anak — Katalog Platform Admin dan Hasil Parent

Status: rancangan produk dan teknis yang sudah memiliki implementasi fondasi bertahap,
belum merupakan kuesioner klinis tervalidasi. Bank butir dan narasi di bawah tetap
kandidat yang harus direview ahli tumbuh kembang, privasi/hukum, dan diuji bersama
keluarga Indonesia sebelum dipublish.

Dokumen ini merancang fitur screening anak berbasis kuesioner yang dapat dipakai Parent
meskipun belum memiliki tenant terhubung. Aturan yang disetujui sudah dicatat di
`docs/business-rules.md`; kontrak backend, `packages/api-client`, dan UI mengikuti
aturan tersebut dengan gate publish eksternal tetap aktif.

## 1. Tujuan dan batasan

Fitur membantu Parent melakukan pemantauan awal perkembangan anak secara terstruktur,
menyimpan riwayat pengisian, dan menjelaskan langkah berikutnya dengan bahasa sederhana.
Nama pada UI: **Cek perkembangan anak**. Istilah “screening klinis” hanya
boleh dipakai bila instrumen, cara administrasi, bahasa, dan interpretasinya
sudah tervalidasi untuk populasi sasaran. **Target produk** mencakup usia
2 bulan sampai sebelum ulang tahun ke-18 (`2 <= usiaBulan < 216`), sedangkan
**dataset awal** baru memiliki kandidat butir usia 2–60 bulan. Anak di luar
usia/template yang sudah direview dan dipublish boleh memiliki profil tetapi
tidak diberi hasil kuesioner otomatis. Perluasan usia 61–215 bulan harus
memakai bank dan aturan yang sesuai tahap sekolah/masa remaja, tidak
memperpanjang butir balita atau hasilnya secara otomatis.
Fokus awal:

- Bahasa dan komunikasi, termasuk sinyal yang mungkin berkaitan dengan keterlambatan bicara.
- Motorik kasar.
- Motorik halus.
- Sosial dan emosi.
- Kognitif.
- Kemandirian/adaptif.

Screening bukan diagnosis, bukan pengganti dokter/psikolog/terapis, dan tidak boleh
menjanjikan bahwa seorang anak normal atau mengalami gangguan. Hasil hanya menjadi
sinyal pemantauan dan bahan diskusi dengan tenaga profesional. Jangan menyalin instrumen
klinis berlisensi (misalnya alat yang memiliki hak cipta) sebelum ada review lisensi,
validasi klinis, dan persetujuan hukum.

Non-goals untuk rilis awal:

- Menetapkan diagnosis, severity klinis, atau rekomendasi terapi otomatis.
- Membuat Child tenant, enrollment, invoice, entitlement, booking, atau QR hadir.
- Membagikan jawaban/hasil ke tenant, Staff, Staff Admin, atau Platform Admin,
  baik otomatis maupun melalui tombol Parent; tidak ada fitur share pada scope ini.
- Mengubah akses Parent hanya karena hasil screening.
- Menggabungkan riwayat screening antar-tenant atau memberi tenant akses ke
  profil screening global.
- Menganggap PDF hasil sebagai diagnosis atau sebagai pengganti pemeriksaan
  dokter anak; ekspor PDF hanya bahan konsultasi yang dipilih Parent.

## 2. Aturan akses dan subjek screening

### Parent belum memiliki tenant terhubung

Parent yang sudah login dapat membuat **profil subjek screening global** miliknya sendiri.
Profil minimal berisi nama panggilan/nama, tanggal lahir, dan data opsional yang memang
diperlukan untuk memilih kelompok usia. Profil ini bukan `Child` tenant dan tidak membuat
relasi ke lembaga mana pun. Hasil hanya terlihat oleh Parent pemilik.

Parent dapat menyimpan draft, melanjutkan di perangkat lain selama tepat
30 × 24 jam sejak `createdAt` menurut waktu server UTC, mengulang pemeriksaan
dengan versi kuesioner yang berlaku,
dan melihat riwayat hasilnya sendiri. Setelah 30 hari draft menjadi `EXPIRED`
secara atomik dan tidak dapat dilanjutkan atau disubmit; ia tidak dihapus
otomatis. UI menawarkan memulai sesi baru, bukan menghidupkan draft lama.
Hasil yang selesai
tidak kedaluwarsa dalam 30 hari dan tetap merupakan catatan pada tanggal
pengisian, bukan penilaian keadaan anak saat ini. Jika kemudian mendaftar ke
tenant, proses enrollment tetap terpisah. Profil screening global tidak otomatis
disatukan dengan `Child` tenant, termasuk bila nama/tanggal lahir mirip;
fitur attach/merge tidak termasuk scope yang disetujui.

### Parent dengan anak yang sudah terhubung

Parent dapat memilih profil screening global atau anak yang sudah terhubung di tenant.
Daftar lintas tenant harus menampilkan nama tenant/cabang dan `organizationId` sumber.
Parent tidak perlu berpindah active tenant hanya untuk melihat daftar tersebut.

Untuk anak tenant, sesi dan hasil tetap dimiliki Parent pengisi. `childId` dan
`organizationId` hanya menjadi referensi otorisasi/konteks; keduanya tidak
memberi tenant akses baca. Parent hanya memilih anak, mengisi kuesioner,
menyimpan/melanjutkan draft, lalu melihat hasil dan riwayat miliknya. Tidak ada
tombol **Bagikan ke lembaga** atau aksi mengubah hasil setelah submit.

### Role dan batas UI

| Role | UI yang tersedia | Akses data dan aksi yang dilarang |
| --- | --- | --- |
| `PARENT` login, dengan atau tanpa tenant | **Cek perkembangan anak**: pilih/buat profil subjek atau pilih anak terhubung yang legal, isi dan lanjutkan draft, submit, lihat hasil/riwayat sendiri, dan ekspor PDF hasil miliknya. Dari Profil, Parent juga dapat meminta penghapusan akun. | Tidak membuat/mengubah template, butir, pilihan, pemetaan hasil, atau hasil final; tidak membagikan hasil ke tenant melalui aplikasi. |
| Platform `ADMIN` | **Master data → Cek perkembangan anak**: CRUD katalog template/versi, butir, pilihan, terjemahan, pratinjau sintetis, validasi, publish/retire, dan audit katalog. | Tidak membuka profil screening, draft jawaban, catatan, atau hasil Parent melalui katalog maupun endpoint hasil. |
| Tenant `STAFF_ADMIN`, `STAFF`, dan role lain | Tidak ada menu/route screening pada scope ini. | Tidak membaca atau mengubah katalog global, profil, sesi, jawaban, atau hasil Parent. |

Server menegakkan matriks ini pada setiap endpoint; menyembunyikan menu saja
tidak cukup. Tidak ada tampilan Staff/Staff Admin untuk hasil, sekalipun anak
tersebut terdaftar pada tenant yang mereka kelola. Jika kelak berbagi hasil
diusulkan lagi, itu memerlukan keputusan produk dan aturan privasi baru,
bukan mengaktifkan endpoint/grant tersembunyi dari rencana lama.

Data screening yang selesai serta draft yang aktif/kedaluwarsa tidak dihapus
otomatis berdasarkan usia data; retensi targetnya sampai penghapusan akun
Parent pemilik selesai. PDF sementara server dibersihkan segera setelah
ekspor sesuai kebijakan keamanan, bukan disimpan sebagai riwayat. Parent
tidak mendapat tombol hapus hasil individual dalam rilis ini. Kebijakan
produk yang disetujui menyediakan **kanal bantuan privasi untuk meminta
penghapusan data screening tanpa menghapus akun**; ini permintaan yang
ditinjau, bukan penghapusan otomatis atau tombol hapus hasil individual.
Kebijakan akhir tetap memerlukan review privasi/hukum atas cara menangani
permintaan itu dan pengecualian retensi yang berlaku. Alur akun terpisah
dijabarkan pada [plan penghapusan akun Parent](parent-account-deletion.md).

## 3. Model kuesioner

Kuesioner harus versioned dan dipilih server berdasarkan usia anak dalam bulan pada tanggal
pengisian. Client tidak boleh memilih age band secara bebas atau menyimpan aturan evaluasi
sebagai satu-satunya sumber kebenaran.

**Keputusan penyimpanan:** seluruh konten kuesioner dan konfigurasi hasil rilis
disimpan di tabel screening khusus, bukan di `DevelopmentProgramItem` atau
konstanta UI. Seeder awal memasukkan 12 template usia, 166 butir kandidat, enam
pertanyaan konteks utama beserta cabang kondisional, opsi jawaban, teks per
locale, pemetaan domain/subdomain, empat status hasil, enam kode alasan,
prioritas, dan redaksi tindak lanjut. Angka kandidat ini harus diverifikasi
kembali terhadap daftar final sebelum seed produksi. Identitas butir dan kode
hasil tetap stabil; konten berikutnya ditambah melalui UI katalog Platform
Admin, atau melalui batch seed baru yang **dijalankan manual dan eksplisit**
menurut §3.7 untuk dataset besar/terkurasi. Tidak ada seed yang otomatis
berjalan saat deploy. Konten yang direvisi diterbitkan sebagai versi baru.

Setiap template memiliki:

- `templateId`, `version`, status (`DRAFT`, `PUBLISHED`, `RETIRED`), dan tanggal berlaku.
- Rentang usia dalam bulan serta locale yang tersedia.
- Domain, subdomain, urutan pertanyaan, tipe jawaban, aturan kelengkapan,
  kondisi penayangan, dan teks rekomendasi. Bobot/ambang klinis hanya boleh
  ditambahkan setelah validasi, bukan diasumsikan dari jumlah jawaban.
- Penanda item wajib, item opsional, item `NOT_OBSERVED`, dan item yang membutuhkan
  penjelasan tambahan atau kesempatan melakukan aktivitas.
- Metadata sumber, status review ahli, status uji pemahaman per locale, dan catatan
  bahwa template tidak bersifat diagnostik.
- `seedBatchId`/`seedVersion` dan checksum konten untuk membuktikan baris seed
  pada setiap lingkungan berasal dari batch dan revisi yang sama.

Setiap butir perkembangan memakai **pilihan ganda satu jawaban** (radio/card),
bukan kolom teks bebas. Pilihan tetapnya:

- `YA_SUDAH` — perilaku biasanya sudah terlihat.
- `KADANG` — baru terlihat sesekali atau perlu bantuan.
- `BELUM` — belum terlihat.
- `TIDAK_DIAMATI` — Parent belum punya kesempatan mengamati.

Hanya satu pilihan dapat dipilih per butir; urutan pilihan tidak mengubah hasil.
Parent dapat menambah contoh singkat secara opsional, tetapi hasil tidak
bergantung pada catatan teks. Pertanyaan konteks menggunakan pilihan tetap yang
sesuai tipenya; daftar bahasa dan area kekhawatiran boleh memilih lebih dari satu.

Bahasa pertanyaan harus konkret dan dapat diamati, bukan istilah klinis. Pertanyaan harus
age-appropriate, tidak menyalahkan Parent, dan menyediakan contoh aktivitas sehari-hari.
Untuk rilis saat ini, terjemahan seluruh locale screening aktif (`id` dan `en`)
wajib tersedia sebelum template berstatus `PUBLISHED`; fallback ke locale lain
tidak boleh membuat pertanyaan kosong. Shell aplikasi tetap mendukung tujuh
locale, tetapi locale screening baru harus ditambahkan melalui versi katalog
yang diterjemahkan dan direview secara khusus. Terjemahan yang lengkap secara
teknis belum berarti valid secara budaya/klinis: setiap locale memerlukan review
makna butir dan pengujian pemahaman tersendiri.

### 3.1 Dasar riset dan batas inferensi

Bank kandidat memakai tonggak usia 2, 4, 6, 9, 12, 15, 18, 24, 30, 36, 48,
dan 60 bulan dari [CDC Learn the Signs. Act Early.](https://www.cdc.gov/act-early/milestones/)
sebagai kerangka observasi, serta domain motorik dan bahasa dari
[AAP](https://www.healthychildren.org/English/ages-stages/toddler/pages/Assessing-Developmental-Delays.aspx)
dan [ASHA](https://www.asha.org/public/developmental-milestones/communication-milestones/).
CDC menjelaskan bahwa checklist tonggak perkembangan **bukan** pengganti alat
screening terstandar dan tervalidasi. AAP merekomendasikan screening perkembangan
formal pada 9, 18, dan 30 bulan serta screening autisme pada 18 dan 24 bulan;
aplikasi harus mengingatkan pemeriksaan tersebut, bukan menyatakan telah melakukannya.

Di Indonesia, [pedoman Kemenkes tentang KPSP](https://repositori-ditjen-nakes.kemkes.go.id/100/2/02Buku-KIA-06-10-2015-small.pdf)
memiliki jadwal usia 3–72 bulan dan pelaksanaan oleh petugas/guru terlatih pada
jenjang yang ditetapkan. Bank mandiri di dokumen ini **bukan formulir KPSP**,
tidak menggunakan jumlah jawaban/ambang kategori KPSP, dan tidak boleh diberi
label “hasil KPSP”. Integrasi KPSP kelak perlu review instrumen terkini,
izin penggunaan digital, alat pemeriksaan, pelaksana, serta jalur rujukan.

ASHA mencatat bahwa ambang tonggak komunikasinya berbasis anak yang memakai
bahasa Inggris Amerika; hasil tidak boleh memakai jumlah kata bahasa Inggris
sebagai cutoff otomatis untuk anak Indonesia atau keluarga multibahasa. Anak
boleh menjawab/menunjukkan kemampuan pada **bahasa apa pun yang digunakan di
rumah**. Penggunaan lebih dari satu bahasa sendiri bukan alasan memberi label
keterlambatan. Lihat [batasan sumber ASHA](https://www.asha.org/public/developmental-milestones/creation-of-ashas-developmental-milestones/)
dan [panduan keluarga multibahasa](https://www.asha.org/public/developmental-milestones/communication-milestones/).

### 3.2 Data pendahuluan yang dibutuhkan untuk menafsirkan jawaban

Pertanyaan konteks ini tampil sebelum item perkembangan. Data sensitif hanya
dikumpulkan bila memengaruhi pemilihan butir atau tindak lanjut; pilihan “tidak
tahu” tersedia dan tidak diperlakukan sebagai jawaban negatif.

| ID | Pertanyaan untuk Parent | Pengaruh pada hasil |
| --- | --- | --- |
| `CTX-01` | Kapan tanggal lahir anak? | Wajib; hitung usia dalam bulan pada tanggal mulai sesi. |
| `CTX-02` | Apakah anak lahir sebelum 37 minggu? Jika ya, usia kehamilan berapa minggu saat lahir? | Catat usia kalender dan data untuk usia koreksi; sebelum aturan ahli disetujui, jangan pilih band atau hasil otomatis untuk anak prematur. |
| `CTX-03` | Bahasa apa saja yang biasa digunakan anak dan orang yang berinteraksi dengannya? | Pertanyaan bahasa dinilai lintas bahasa yang dikenal anak; hasil tidak membandingkan jumlah kata antarbahasa tanpa validasi. |
| `CTX-04` | Apakah Parent saat ini khawatir pada bicara, pemahaman, pendengaran, gerak, interaksi, belajar, atau kegiatan sehari-hari? Mana yang paling mengganggu? | Kekhawatiran Parent selalu muncul di hasil dan mengarahkan diskusi profesional meskipun checklist tampak lengkap. |
| `CTX-05` | Apakah ada kemampuan yang dahulu bisa dilakukan anak lalu hilang atau jelas berkurang? Sejak kapan, kemampuan apa? | Tanda perhatian mandiri; jangan ditutupi skor domain lain. |
| `CTX-06` | Apakah anak sering tidak menanggapi suara/panggilan, atau pernah dinyatakan memiliki gangguan pendengaran? Apakah pernah menjalani tes pendengaran? | Jalur diskusi dokter/tes pendengaran bila ada kekhawatiran bahasa atau respons suara. |
| `CTX-07` | Apakah ada kekhawatiran penglihatan, penggunaan alat bantu, atau kondisi yang membuat aktivitas tertentu sulit diamati? | Tampilkan keterbatasan observasi; jangan otomatis mengubahnya menjadi “belum bisa”. |
| `CTX-08` | Apakah anak sudah mendapat evaluasi perkembangan atau sedang mengikuti dukungan/terapi? | Hasil menjadi catatan pemantauan untuk dibawa ke profesional; jangan memberi label baru atau menyuruh menghentikan layanan. |
| `CTX-09` | Siapa yang mengamati anak dan dalam rentang waktu kapan? Apakah anak memiliki kesempatan mencoba aktivitas yang ditanyakan? | `TIDAK_DIAMATI` jika belum ada kesempatan; tanggal/peran pengisi disimpan untuk audit hasil. |
| `CTX-10` | Apakah kondisi hari ini (sakit, sangat lelah, atau situasi lain) berbeda dari biasanya? | Minta jawaban berdasar kebiasaan beberapa minggu terakhir; bila tidak mungkin, simpan draft dan ulangi observasi. |

**Beban pertanyaan yang benar-benar tampil:** tanggal lahir (`CTX-01`) adalah
field profil anak, bukan pertanyaan yang diulang. Pada setiap sesi Parent
menjawab **6 pertanyaan konteks/perhatian**: prematur (`CTX-02`), bahasa di
rumah (`CTX-03`), area kekhawatiran (`CTX-04`), kehilangan kemampuan
(`CTX-05`), respons pendengaran (`CTX-06`), dan gerak kanan-kiri yang tampak
berbeda (`ALERT-02`). Masing-masing memakai pilihan ganda; `CTX-03` dan
`CTX-04` boleh pilih lebih dari satu. Jawaban yang berubah menurut waktu
ditinjau ulang pada sesi berikutnya walaupun profil anak sudah ada.

`CTX-07` (penglihatan/alat bantu) dan `CTX-08` (evaluasi/dukungan yang sudah
ada) ditanyakan hanya bila Parent memilih area terkait atau membuka detail
konteks tambahan. `CTX-09` diisi otomatis dengan identitas pengisi dan waktu;
kesempatan mencoba dijawab lewat `TIDAK_DIAMATI` pada item terkait. `CTX-10`
menjadi pertanyaan kondisional bila Parent menyatakan pengamatan hari itu tidak
mewakili kebiasaan anak; sesi dapat disimpan sebagai draft. Tidak ada sepuluh pertanyaan konteks
yang wajib diulang semuanya.

Pilihan konteks yang perlu disiapkan:

| ID | Pilihan utama | Lanjutan bila relevan |
| --- | --- | --- |
| `CTX-02` | Ya / Tidak / Tidak tahu | Jika Ya: pilih minggu kehamilan; jika tidak diketahui, tampilkan usia kalender tetapi jangan buat interpretasi otomatis yang bergantung pada usia koreksi. |
| `CTX-03` | Bahasa Indonesia / bahasa daerah / bahasa lain / tidak tahu (multi-select) | Nama bahasa lain opsional; nilai bahasa tidak dipakai sebagai cutoff kosakata. |
| `CTX-04` | Tidak ada / Bicara / Memahami ucapan / Pendengaran / Gerak / Interaksi / Belajar / Aktivitas sehari-hari (multi-select) | Pilihan “Tidak ada” saling eksklusif dengan area lain; contoh kekhawatiran opsional. |
| `CTX-05` | Tidak / Ya / Tidak yakin | Jika Ya: pilih kemampuan yang berubah dan perkiraan kapan, dengan contoh opsional. |
| `CTX-06` | Biasanya merespons / Kadang tidak merespons / Sering tidak merespons / Tidak yakin | Jika ada kekhawatiran: pernah tes pendengaran? Ya / Tidak / Tidak tahu. |
| `ALERT-02` | Gerak kanan-kiri tampak serupa / Ada perbedaan yang mengganggu / Tidak yakin | Jika berbeda: bagian tubuh/aktivitas yang terlihat berbeda, opsional. |

Pertanyaan tambahan mengikuti jawaban, sehingga panjang aktual dapat bertambah
sedikit. UI harus menampilkan jumlah **butir utama** sejak awal dan memperbarui
jumlah lanjutan secara dinamis tanpa membuat Parent kehilangan progress.

Untuk anak yang lahir prematur, [panduan checklist CDC](https://www.cdc.gov/act-early/digital-online-checklist/2-years.html)
menggunakan usia koreksi dan memilih checklist usia lebih muda bila usia anak berada
di antara dua daftar. Aturan perhitungan, batas masa penggunaan usia koreksi,
dan kasus data kehamilan tidak lengkap harus dikonfirmasi ahli sebelum produksi.
**Sampai kebijakan ini disetujui, server tidak membuka sesi/hasil otomatis
untuk anak yang dilaporkan prematur**; UI menjelaskan alasannya dan menyarankan
Parent membahas pengamatan dengan dokter anak. Jangan diam-diam memakai usia
kalender atau umur yang dibulatkan ke atas sebagai pengganti usia koreksi.

### 3.3 Aturan penyajian butir

Semua kalimat di bank berikut diawali konteks: **“Dalam beberapa minggu terakhir,
pada saat anak sehat dan punya kesempatan mencoba, apakah anak…”**. Satu ID adalah
satu jawaban terpisah; tanda titik koma tidak boleh menggabungkan beberapa
kemampuan menjadi satu skor. Parent memilih satu dari empat opsi perkembangan
di atas pada setiap ID, lalu dapat menambah contoh singkat jika ingin.
`YA_SUDAH` berarti kemampuan tampak dengan kondisi yang disebutkan, bukan sekali
karena ditebak atau dibantu penuh.

Kode domain: `BK` bahasa/komunikasi (reseptif, ekspresif, gestur), `MK` motorik
kasar, `MH` motorik halus, `KG` kognitif/bermain, `SE` sosial-emosi, dan `AD`
kemandirian/adaptif. Angka pada ID menunjukkan daftar usia **yang dicapai**.
Butir `AD` untuk bayi muda adalah observasi partisipasi kebutuhan harian,
bukan tuntutan mandiri dan tidak diberi hasil domain tersendiri sebelum cukup
butir yang relevan usia. Semua item berikut adalah redaksi kandidat orisinal
untuk review, bukan salinan atau skor dari instrumen klinis.

### 3.4 Bank kandidat pertanyaan menurut usia

Hanya **satu** daftar usia ditampilkan dalam satu sesi. **Dataset awal usia
2–60 bulan** berisi 166 butir kandidat; belum ada butir untuk usia 61–215
bulan. Parent tidak pernah diminta mengisi semua butir dalam bank.
Jumlah butir utama adalah 6 konteks/perhatian ditambah butir pada daftar usia:

| Daftar usia | Butir perkembangan | Total butir utama per sesi |
| --- | ---: | ---: |
| 2 bulan | 10 | 16 |
| 4 bulan | 12 | 18 |
| 6 bulan | 12 | 18 |
| 9 bulan | 12 | 18 |
| 12 bulan | 13 | 19 |
| 15 bulan | 14 | 20 |
| 18 bulan | 14 | 20 |
| 24 bulan | 15 | 21 |
| 30 bulan | 15 | 21 |
| 36 bulan | 17 | 23 |
| 48 bulan | 18 | 24 |
| 60 bulan | 14 | 20 |

Pada dataset awal ini Parent mengisi **16–24 pertanyaan pilihan ganda utama**, sesuai usia
anak, ditambah pertanyaan lanjutan kondisional bila diperlukan. Field profil
anak dan persetujuan bukan bagian dari hitungan soal. Apabila jumlah butir
berubah setelah review ahli, tabel dan estimasi UI harus dihasilkan dari
template yang dipublish, bukan angka yang di-hardcode di client.

**2 bulan — `B02`, untuk usia 2 sampai sebelum 4 bulan**

- `B02-BK1` Apakah anak mengeluarkan suara lain selain tangisan? `B02-BK2` Apakah anak tampak bereaksi saat mendengar suara orang di dekatnya?
- `B02-MK1` Apakah anak mengangkat kepalanya sebentar saat tengkurap dengan pengawasan? `B02-MK2` Apakah kedua lengan dan kakinya aktif bergerak?
- `B02-MH1` Apakah telapak tangannya kadang terbuka, tidak selalu mengepal?
- `B02-KG1` Apakah anak mengikuti gerak wajah orang di dekatnya dengan pandangan? `B02-KG2` Apakah anak menatap benda menarik selama beberapa saat?
- `B02-SE1` Apakah anak menatap wajah pengasuh saat diajak berinteraksi? `B02-SE2` Apakah anak sesekali membalas senyum atau sapaan dengan senyum?
- `B02-AD1` Apakah suara lembut atau dipeluk membantu anak menjadi lebih tenang? *(Konteks saja; bukan skor kemandirian.)*

**4 bulan — `B04`, untuk usia 4 sampai sebelum 6 bulan**

- `B04-BK1` Apakah anak membuat bunyi vokal saat nyaman? `B04-BK2` Apakah anak membalas suara ketika diajak bicara? `B04-BK3` Apakah anak menoleh ke arah suara pengasuh?
- `B04-MK1` Apakah kepala anak relatif tegak saat digendong tegak? `B04-MK2` Saat tengkurap, apakah ia bertumpu pada lengan bawah?
- `B04-MH1` Apakah anak memegang mainan aman yang diletakkan di tangannya? `B04-MH2` Apakah ia mencoba meraih atau menyentuh mainan di dekatnya?
- `B04-KG1` Apakah anak memperhatikan tangannya sendiri? `B04-KG2` Apakah ia tampak mengenali isyarat rutin menjelang diberi minum/makan?
- `B04-SE1` Apakah anak tersenyum untuk mengajak berinteraksi? `B04-SE2` Apakah ia tertawa kecil saat diajak bermain?
- `B04-AD1` Apakah anak memberi isyarat berbeda ketika lapar dan ketika sudah cukup? *(Konteks saja.)*

**6 bulan — `B06`, untuk usia 6 sampai sebelum 9 bulan**

- `B06-BK1` Apakah anak bergantian bersuara dengan orang yang mengajaknya bicara? `B06-BK2` Apakah ia membuat beberapa jenis suara selain menangis?
- `B06-MK1` Apakah anak dapat berguling dari tengkurap ke telentang? `B06-MK2` Apakah ia bisa menopang badan dengan kedua lengan saat tengkurap? `B06-MK3` Apakah ia mulai duduk dengan bertumpu pada tangan?
- `B06-MH1` Apakah anak mengulurkan tangan untuk mengambil mainan? `B06-MH2` Apakah ia mempertahankan pegangan sebentar saat mainan sudah diraih?
- `B06-KG1` Apakah anak mencari dan meraih benda yang menarik perhatiannya? `B06-KG2` Apakah ia mengeksplorasi benda aman dengan tangan atau mulut?
- `B06-SE1` Apakah anak mengenali pengasuh yang akrab? `B06-SE2` Apakah ia tertawa saat bermain interaktif?
- `B06-AD1` Apakah anak menunjukkan isyarat jelas saat ingin berhenti makan/minum? *(Konteks saja.)*

**9 bulan — `B09`, untuk usia 9 sampai sebelum 12 bulan**

- `B09-BK1` Apakah anak membuat rangkaian bunyi berulang yang bervariasi? `B09-BK2` Apakah ia mengangkat tangan atau memakai gestur lain untuk meminta digendong? `B09-BK3` Apakah ia menoleh ketika namanya dipanggil dalam suasana tenang?
- `B09-MK1` Apakah anak berpindah ke posisi duduk sendiri? `B09-MK2` Apakah ia duduk tanpa ditopang?
- `B09-MH1` Apakah anak memindahkan benda dari satu tangan ke tangan lain? `B09-MH2` Apakah ia memakai jari untuk mendekatkan potongan makanan aman yang sesuai usianya?
- `B09-KG1` Apakah anak mencari benda yang terlihat jatuh atau tertutup? `B09-KG2` Apakah ia mencoba membenturkan dua benda saat bermain?
- `B09-SE1` Apakah anak menunjukkan ekspresi berbeda saat senang atau kecewa? `B09-SE2` Apakah ia tertarik bermain cilukba atau permainan balas-balasan?
- `B09-AD1` Apakah anak ikut mengambil makanan aman dengan jari saat diberi kesempatan? *(Dicatat sebagai partisipasi, bukan tuntutan makan mandiri.)*

**12 bulan — `B12`, untuk usia 12 sampai sebelum 15 bulan**

- `B12-BK1` Apakah anak memakai panggilan khusus untuk orang yang akrab? `B12-BK2` Apakah ia melambaikan tangan atau gestur lain untuk menyampaikan maksud? `B12-BK3` Apakah ia berhenti sejenak ketika diberi larangan sederhana?
- `B12-MK1` Apakah anak menarik badan untuk berdiri dengan berpegangan? `B12-MK2` Apakah ia bergerak menyusuri perabot sambil berpegangan?
- `B12-MH1` Apakah anak mengambil benda kecil yang aman dengan ibu jari dan telunjuk? `B12-MH2` Apakah ia memasukkan benda ke dalam wadah saat bermain?
- `B12-KG1` Apakah anak mencari mainan yang disembunyikan di depan matanya? `B12-KG2` Apakah ia mencoba memakai wadah untuk memasukkan atau mengeluarkan benda?
- `B12-SE1` Apakah anak menikmati permainan bergantian dengan pengasuh? `B12-SE2` Apakah ia mencari respons pengasuh setelah melakukan sesuatu yang menarik?
- `B12-AD1` Dengan gelas yang dipegang orang dewasa, apakah anak ikut minum dari gelas terbuka? `B12-AD2` Apakah anak mencoba mengambil makanan aman sendiri dengan jari?

**15 bulan — `B15`, untuk usia 15 sampai sebelum 18 bulan**

- `B15-BK1` Apakah anak mencoba mengucapkan satu atau lebih kata bermakna selain panggilan orang tua, dalam bahasa apa pun yang dikenalnya? `B15-BK2` Apakah ia melihat benda yang akrab saat bendanya disebut? `B15-BK3` Apakah ia mengikuti permintaan yang disertai kata dan gestur? `B15-BK4` Apakah ia menunjuk untuk meminta bantuan atau benda?
- `B15-MK1` Apakah anak melangkah beberapa langkah tanpa pegangan? `B15-MK2` Apakah ia berpindah dari duduk ke berdiri dan mulai bergerak mengeksplorasi ruang dengan aman?
- `B15-MH1` Apakah anak memakai jari untuk mengambil makanan kecil yang aman? `B15-MH2` Apakah ia menyusun dua benda ringan di atas satu sama lain?
- `B15-KG1` Apakah anak mencoba memakai benda sesuai fungsi sederhananya, misalnya gelas untuk minum? `B15-KG2` Apakah ia meniru tindakan sederhana orang dewasa saat bermain?
- `B15-SE1` Apakah anak menunjukkan benda yang menarik kepadanya kepada pengasuh? `B15-SE2` Apakah ia meniru permainan anak lain atau pengasuh?
- `B15-AD1` Apakah anak mulai ikut saat berpakaian atau diberi makan, misalnya mengulurkan tangan atau memegang alat makan? `B15-AD2` Apakah ia memberi isyarat ketika membutuhkan bantuan?

**18 bulan — `B18`, untuk usia 18 sampai sebelum 24 bulan**

- `B18-BK1` Apakah anak mencoba memakai beberapa kata bermakna selain panggilan orang tua? `B18-BK2` Apakah ia mengikuti satu instruksi sederhana tanpa perlu gestur? `B18-BK3` Apakah ia menunjuk untuk menunjukkan sesuatu yang menarik, bukan hanya meminta?
- `B18-MK1` Apakah anak berjalan tanpa berpegangan? `B18-MK2` Apakah ia memanjat naik atau turun kursi rendah dengan pengawasan?
- `B18-MH1` Apakah anak membuat coretan dengan alat tulis yang sesuai dan diawasi? `B18-MH2` Apakah ia mencoba memegang dan memakai sendok?
- `B18-KG1` Apakah anak meniru aktivitas rumah sederhana saat bermain? `B18-KG2` Apakah ia menggunakan mainan secara sederhana sesuai kegunaannya?
- `B18-SE1` Apakah anak menjelajah sebentar lalu memastikan pengasuh masih dekat? `B18-SE2` Apakah ia melihat buku bersama pengasuh beberapa halaman?
- `B18-AD1` Apakah anak ikut memasukkan tangan/kaki saat dipakaikan baju? `B18-AD2` Apakah ia minum dari gelas terbuka dengan tumpahan yang masih wajar? `B18-AD3` Apakah ia mencoba makan sendiri dengan jari atau sendok?

**24 bulan — `B24`, untuk usia 24 sampai sebelum 30 bulan**

- `B24-BK1` Apakah anak menggabungkan sedikitnya dua kata bermakna untuk menyampaikan maksud, dalam bahasa yang ia pakai? `B24-BK2` Apakah ia menunjuk benda pada buku saat diminta? `B24-BK3` Apakah ia menunjukkan sedikitnya dua anggota tubuh ketika diminta? `B24-BK4` Apakah ia menggunakan beberapa gestur untuk berkomunikasi selain menunjuk?
- `B24-MK1` Apakah anak berlari? `B24-MK2` Apakah ia menendang bola? `B24-MK3` Apakah ia menaiki beberapa anak tangga dengan bantuan/pegangan bila diperlukan?
- `B24-MH1` Apakah anak memegang satu benda sambil memakai tangan lain untuk membuka atau memindahkan sesuatu? `B24-MH2` Apakah ia mencoba memakai tombol, sakelar, atau putaran pada mainan aman?
- `B24-KG1` Apakah anak memakai dua mainan bersama dalam permainan sederhana, misalnya piring dan makanan mainan? `B24-KG2` Apakah ia mencoba cara lain ketika mainan tidak langsung bekerja?
- `B24-SE1` Apakah anak memperhatikan ketika orang lain tampak sedih atau terluka? `B24-SE2` Apakah ia melihat reaksi pengasuh saat menghadapi situasi baru?
- `B24-AD1` Apakah anak makan sebagian makanan dengan sendok? `B24-AD2` Apakah ia membantu membereskan benda dengan arahan sederhana?

**30 bulan — `B30`, untuk usia 30 sampai sebelum 36 bulan**

- `B30-BK1` Apakah anak sering menggabungkan dua kata atau lebih, termasuk kata kerja, untuk bercerita atau meminta? `B30-BK2` Apakah ia menamai benda yang ditunjuk pada buku? `B30-BK3` Apakah ia memakai kata ganti diri yang dikenal dalam bahasa yang digunakannya? `B30-BK4` Apakah ia mengikuti dua instruksi sederhana yang berurutan?
- `B30-MK1` Apakah anak melompat sehingga kedua kaki terangkat dari lantai? `B30-MK2` Apakah ia dapat bergerak cepat dan berhenti saat bermain dengan pengawasan?
- `B30-MH1` Apakah anak membuka tutup wadah atau memutar bagian mainan dengan tangan? `B30-MH2` Apakah ia membalik halaman buku satu per satu?
- `B30-KG1` Apakah anak bermain pura-pura dengan mengganti fungsi suatu benda? `B30-KG2` Apakah ia menemukan cara sederhana untuk mencapai benda yang tidak langsung terjangkau? `B30-KG3` Apakah ia menunjukkan satu warna yang diminta bila warna tersebut sudah dikenalkan?
- `B30-SE1` Apakah anak bermain dekat anak lain dan sesekali terlibat bersama? `B30-SE2` Apakah ia menunjukkan hasil permainannya kepada pengasuh?
- `B30-AD1` Apakah anak melepas sebagian pakaian sederhana sendiri? `B30-AD2` Apakah ia mengikuti rutinitas membereskan mainan setelah diingatkan?

**36 bulan — `B36`, untuk usia 36 sampai sebelum 48 bulan**

- `B36-BK1` Apakah anak melakukan percakapan timbal balik lebih dari satu giliran? `B36-BK2` Apakah ia bertanya tentang orang, benda, tempat, atau alasan? `B36-BK3` Apakah ia menyebut tindakan pada gambar? `B36-BK4` Apakah orang yang tidak serumah biasanya memahami sebagian besar ucapannya?
- `B36-MK1` Apakah anak dapat melompat di tempat dengan kedua kaki? `B36-MK2` Apakah ia menaiki tangga dengan pegangan bila perlu? `B36-MK3` Apakah ia melempar bola ringan ke arah orang lain saat bermain?
- `B36-MH1` Apakah anak meniru gambar lingkaran setelah dicontohkan? `B36-MH2` Apakah ia meronce benda besar yang aman atau memasukkan tali ke lubang besar?
- `B36-KG1` Apakah anak memasangkan benda/gambar yang serupa? `B36-KG2` Apakah ia memahami arahan sederhana tentang bahaya setelah dijelaskan? `B36-KG3` Apakah ia mencoba menyelesaikan masalah permainan sederhana sebelum meminta bantuan?
- `B36-SE1` Apakah anak memperhatikan anak lain dan ikut bermain ketika ada kesempatan? `B36-SE2` Apakah ia dapat menenangkan diri secara bertahap dengan bantuan pengasuh setelah berpisah sebentar?
- `B36-AD1` Apakah anak memakai sebagian pakaian sederhana sendiri? `B36-AD2` Apakah ia memakai garpu/sendok saat makan dengan pengawasan? `B36-AD3` Apakah ia mulai menyampaikan kebutuhan ke toilet atau bantuan kebersihan? *(Tidak dipakai sebagai syarat lulus/gagal.)*

**48 bulan — `B48`, untuk usia 48 sampai sebelum 60 bulan**

- `B48-BK1` Apakah anak memakai kalimat beberapa kata untuk menjelaskan kejadian? `B48-BK2` Apakah ia menceritakan sesuatu yang terjadi hari itu? `B48-BK3` Apakah ia menjawab pertanyaan sederhana tentang kegunaan benda? `B48-BK4` Apakah ia mengingat bagian pendek dari lagu atau cerita yang disukai?
- `B48-MK1` Apakah anak menangkap bola besar yang dilempar pelan dari jarak dekat? `B48-MK2` Apakah ia dapat berlari, berhenti, dan mengubah arah saat bermain tanpa sering kehilangan keseimbangan?
- `B48-MH1` Apakah anak memegang pensil/krayon terutama dengan jari dan ibu jari? `B48-MH2` Apakah ia melepas beberapa kancing sederhana? `B48-MH3` Apakah ia menggambar orang dengan beberapa bagian tubuh setelah diberi kesempatan berlatih?
- `B48-KG1` Apakah anak menamai beberapa warna yang dikenal? `B48-KG2` Apakah ia menceritakan apa yang terjadi berikutnya dalam cerita yang akrab? `B48-KG3` Apakah ia mengikuti aturan sederhana saat permainan yang sudah dikenal?
- `B48-SE1` Apakah anak berpura-pura menjadi tokoh lain saat bermain? `B48-SE2` Apakah ia mencari teman bermain saat ada kesempatan? `B48-SE3` Apakah ia mencoba menghibur orang yang sedih dengan caranya sendiri?
- `B48-AD1` Dengan pengawasan, apakah anak mengambil makanan/minuman untuk dirinya sendiri sesuai kemampuan? `B48-AD2` Apakah ia membantu tugas rumah yang aman dan sederhana? `B48-AD3` Apakah ia menyesuaikan perilaku ketika berada di tempat yang berbeda setelah dijelaskan aturannya?

**60 bulan — `B60`, untuk usia 60 sampai sebelum 61 bulan; perluasan batas atas memerlukan review ahli**

- `B60-BK1` Apakah anak menceritakan dua kejadian berurutan dalam satu cerita? `B60-BK2` Apakah ia menjawab pertanyaan sederhana tentang cerita yang baru didengar? `B60-BK3` Apakah ia mempertahankan percakapan beberapa giliran tanpa sering kehilangan topik?
- `B60-MK1` Apakah anak mencoba melompat dengan satu kaki setelah diperagakan? `B60-MK2` Apakah ia bisa mengikuti permainan gerak sederhana yang membutuhkan berhenti dan mulai kembali?
- `B60-MH1` Apakah anak mengancingkan beberapa kancing yang mudah dijangkau? `B60-MH2` Apakah ia menulis beberapa huruf dari namanya setelah punya kesempatan belajar?
- `B60-KG1` Apakah anak menghitung benda dalam jumlah kecil sambil menunjuknya satu per satu? `B60-KG2` Apakah ia memahami urutan sederhana seperti pagi/siang/malam atau kemarin/besok dalam percakapan? `B60-KG3` Apakah ia fokus beberapa menit pada cerita atau kegiatan tangan yang disukainya?
- `B60-SE1` Apakah anak bergiliran dalam permainan bersama anak lain ketika diberi kesempatan? `B60-SE2` Apakah ia mengikuti aturan permainan sederhana yang sudah dijelaskan?
- `B60-AD1` Apakah anak melakukan tugas rumah sederhana sesuai kemampuannya, misalnya memasangkan kaus kaki? `B60-AD2` Apakah ia mencoba menyiapkan sebagian barang pribadi untuk kegiatan dengan pengingat?

Jangan menambah butir sekolah seperti membaca lancar, mengenal seluruh alfabet,
atau menulis nama lengkap sebagai penentu “normal” pada usia dini. Item yang
bergantung pada kesempatan (misalnya tangga, bola, teman sebaya, alat gambar,
huruf) harus memiliki opsi `TIDAK_DIAMATI`; tidak adanya kesempatan tidak
berarti keterlambatan. Detail alat, kondisi observasi, dan batas usia setiap
item harus direview per item sebelum menjadi data seed.

### 3.5 Tanda perhatian lintas usia tanpa pertanyaan berulang

- `ALERT-01` berasal dari jawaban `CTX-05` tentang kemampuan yang hilang.
- `ALERT-02` adalah satu pertanyaan pilihan ganda tentang perbedaan gerak
  kanan-kiri, sebagaimana tercantum pada tabel konteks di atas.
- `ALERT-03` berasal dari `CTX-06` tentang respons suara/pendengaran.
- `ALERT-04` berasal dari pilihan `CTX-04` tentang pemahaman/komunikasi dan
  detail `CTX-05` bila kemampuan itu menurun.
- `ALERT-05` adalah catatan kekhawatiran lain yang opsional, hanya ditawarkan
  bila pilihan `CTX-04` belum menggambarkan kekhawatiran Parent.

Kode `ALERT` adalah alasan tindak lanjut yang diturunkan dari jawaban, bukan
lima pertanyaan tambahan. Kode ini bukan diagnosis atau angka tambahan.
Bila ada kehilangan kemampuan, sarankan Parent
segera menghubungi dokter anak. Bila ada masalah napas, cedera akut, kejang,
atau kondisi gawat lain, tampilkan arahan mencari layanan darurat setempat;
kuesioner ini tidak melakukan triase kegawatdaruratan.

### 3.6 Tata kelola konten setelah seed awal

- Dataset awal masuk melalui batch bootstrap eksplisit **satu kali per database
  lingkungan** saat pemasangan fitur pertama. Batch baru di masa depan boleh
  ditambahkan untuk dataset baru, tetapi setiap batch juga hanya dijalankan
  lewat protokol manual §3.7. Tidak ada batch yang dipanggil oleh startup API,
  Flyway migration, deploy/rollback, atau job CI/CD rutin; deploy berikutnya
  tidak menjalankan seeder walaupun ada rilis kode baru. Penambahan konten
  sehari-hari melalui UI Platform Admin sebagai versi `MANUAL`; batch seed
  baru dikhususkan untuk dataset besar/terkurasi yang disetujui. Baris seed
  berprovenans `SEEDED` dan tetap immutable,
  termasuk saat masih `DRAFT`. Jika butir awal perlu diperbaiki, Platform Admin
  membuat salinan template usia terkait sebagai **draft versi baru** lewat UI;
  salinan tersebut menjadi konten `MANUAL` dengan referensi asal seed dan dapat
  diedit. Butir berikutnya juga dibuat berprovenans `MANUAL` pada draft itu.
  Seeder ulang tidak boleh menimpa draft manual.
- Katalog dikelola hanya oleh Platform Admin tunggal yang sudah ada; Staff
  Admin tenant, Staff, dan Parent tidak memperoleh tombol maupun API mutasi
  katalog. Hak mengelola konten tidak memberi Platform Admin hak membaca
  profil, jawaban, atau hasil privat Parent. Review klinis dilakukan oleh
  pihak kompeten di luar otorisasi login aplikasi; Platform Admin mencatat
  identitas reviewer, tanggal, referensi/versi sumber, locale yang direview,
  dan pernyataan persetujuan saat publikasi. Ini bukan klaim bahwa sistem
  memvalidasi kompetensi reviewer secara otomatis.
- UI **Master data → Cek perkembangan anak** menampilkan daftar template menurut
  usia, versi, status, asal konten, jumlah butir, kelengkapan locale screening aktif,
  tanggal/aktor publikasi, dan riwayat. CRUD lengkap untuk katalog berarti:
  **Create** draft kosong/salin versi dan tambah butir; **Read** daftar/detail,
  riwayat, dan preview sintetis; **Update** isi/urutan/terjemahan pada draft;
  **Delete** hapus butir/pilihan konteks pada draft atau seluruh draft `MANUAL`
  yang belum pernah dipakai, setelah konfirmasi. Empat pilihan perkembangan
  tetap tidak boleh dihapus karena merupakan kontrak evaluator.
  Admin dapat mengubah redaksi hasil dan pemetaan bertipe yang sudah didukung
  evaluator pada draft; empat kode status dan enam kode alasan §5.1 adalah
  kontrak rilis awal, bukan record yang boleh diganti/dihapus sembarang dari UI.
  Enam pertanyaan konteks bersama dan katalog hasil/aturan disimpan sebagai
  versi **bersama** yang direferensikan template usia, bukan disalin 12 kali.
  UI menyediakan tab **Konteks & hasil** untuk membuat/menyalin, membaca,
  mengubah draft, dan menghapus draft bersama yang belum dipakai. Mengubah
  draft bersama tidak mengubah template lain; Admin harus memilih versi
  bersama yang baru pada draft template usia dan melihat daftar usia terdampak
  sebelum publish.
  Pada versi `PUBLISHED`, padanan aman untuk Delete adalah **retire** agar
  riwayat Parent tidak rusak; versi `SEEDED`, `PUBLISHED`, atau `RETIRED` tidak
  dapat dihapus fisik dari UI/API. Admin juga dapat memvalidasi, menerbitkan,
  dan memensiunkan versi dengan audit. Katalog awal dari seed dibuka read-only
  sampai disalin. UI penulisan template/terjemahan panjang memakai wizard
  bersama; edit satu butir yang singkat dapat memakai pola Bottom Sheet yang
  sudah ada. Tidak ada pengetikan SQL/rule bebas.
- Butir perkembangan manual memilih tepat satu domain/subdomain dan memakai
  empat pilihan tetap di §3, sehingga evaluator dapat memakai aturan umum
  §5.1 berdasarkan jawaban. ID stabil butir baru diberikan server; penulis
  tidak mengetik ID atau kode alasan. Pertanyaan konteks baru hanya boleh
  bersifat informasional atau memakai trigger bertipe yang **sudah** didukung
  evaluator. Bila membutuhkan status, kode alasan, logika kondisional, atau
  rekomendasi klinis baru, UI menahan publikasi sampai kontrak evaluator,
  aturan bisnis, review ahli, dan test diperbarui; jangan menafsirkan kode
  baru dengan fallback diam-diam.
- Draft `MANUAL` boleh disimpan sebagian dan diedit dengan kontrol revisi
  optimistis agar dua tab tidak saling menimpa. Setiap perubahan merekam
  aktor, waktu, dan perbedaan field. Template `PUBLISHED` dan `RETIRED`
  tidak dapat diubah/dihapus; koreksi, penambahan, pengurangan, urutan,
  terjemahan, atau aturan hasil menghasilkan versi draft baru. Publikasi
  atomik mengunci checksum konten, versi aturan, dan waktu berlaku; paling
  banyak satu versi `PUBLISHED` dipilih untuk satu rentang usia/locale pada
  satu waktu. Jangan mengubah sesi berjalan atau snapshot hasil lama.
- Tombol **Terbitkan** harus gagal dengan daftar masalah yang spesifik bila
  ada usia tumpang tindih/berlubang, butir tanpa domain, ID duplikat, opsi
  tidak cocok dengan tipe, cabang kondisional tidak valid, locale/teks hasil
  belum lengkap, aturan belum didukung, review belum dicatat, atau uji
  matriks hasil belum lolos. Pratinjau memakai jawaban sintetis, **bukan**
  data Parent sungguhan. Pensiunkan versi hanya menutup sesi baru; sesi
  berjalan tetap memakai versi yang dipin sampai selesai atau kedaluwarsa
  menurut aturan sesi, dan riwayat tetap dapat dibaca pemiliknya. Saat versi
  pengganti dipublish, pemilihan versi aktif berpindah secara atomik sehingga
  dua versi tidak melayani sesi baru pada usia/locale yang sama.

### 3.7 Protokol batch seed baru

Runner seed screening adalah **perintah operasional terpisah**, bukan komponen
startup atau bagian dari pipeline deploy. Antarmuka yang harus disediakan saat
implementasi: pilih `SCREENING_SEED_BATCH_ID=<id-batch>` dan jalankan mode
pratinjau tanpa mutasi terlebih dahulu; eksekusi tulis hanya jika flag
sementara `SCREENING_SEED_APPLY=true` diberikan pada invocation runner yang
sama. Nilai default flag adalah `false`, dan ID batch wajib; flag tidak
disimpan permanen di service environment. Tanpa keduanya, runner menolak
perubahan. Men-deploy kode yang memuat batch baru **tidak** menjalankan batch
tersebut. Nama perintah final dan cara mengirim flag ditetapkan saat implementasi
runbook, tanpa mengubah prinsip ini.

Setiap batch baru memiliki ID unik stabil, versi, checksum paket, daftar
template/katalog yang akan dibuat, sumber/review konten, dan locale. Protokolnya:

1. Siapkan paket data berversi di repo dan uji struktur, ID butir, rentang usia,
   pilihan, aturan evaluator, locale screening aktif (`id` dan `en`), serta referensi versi bersama.
   Perubahan aturan hasil yang tidak didukung evaluator harus diimplementasi
   dan diuji sebelum paket boleh diterapkan.
2. Jalankan pratinjau pada database target; tampilkan jumlah insert dan konflik
   tanpa teks jawaban Parent atau data sensitif. Operator memeriksa batch ID,
   checksum, dampak versi/usia, dan hasil review sebelum memberi flag apply.
3. Apply berjalan dalam satu transaksi dengan kunci untuk mencegah dua runner
   bersamaan. Manifest unik per batch ID menyimpan versi, checksum, waktu,
   aktor operasional, dan hitungan baris. Batch sama dengan checksum dan isi
   yang cocok menghasilkan `ALREADY_APPLIED` tanpa mutasi. Batch ID sama
   dengan checksum berbeda, data parsial, ID/versi bentrok, atau referensi
   hilang harus gagal atomik; jangan memperbaiki diam-diam.
4. Batch baru hanya membuat template/versi **`DRAFT`** dan record baru yang
   direferensikannya. Ia tidak menimpa `SEEDED`/`MANUAL`, mengubah versi
   `PUBLISHED`/`RETIRED`, menghapus data, atau menghitung ulang hasil Parent.
   Jika menambah butir pada kelompok usia yang sudah ada, buat versi draft
   baru; jangan sisipkan ke versi lama. Publikasi tetap aksi terpisah di UI
   Platform Admin setelah review ahli dan validasi locale/aturan.

Jika batch gagal, perbaiki paket lalu gunakan **ID batch baru** hanya setelah
penyebab konflik dan data target ditinjau; jangan reset database atau mengedit
manifest secara manual. Prosedur pemulihan/restorasi data adalah operasi
terpisah dengan backup dan persetujuan, bukan efek samping deploy. Batch yang
sudah diterapkan tidak diulang pada deploy berikutnya.

## 4. Alur UI yang diusulkan

### 4.1 Parent: hanya mengisi dan melihat hasil

Entry point **Cek perkembangan anak** berasal dari Home Parent dan onboarding
Parent tanpa tenant; Profil Parent boleh menyediakan pintasan ke riwayat.
Route berdiri sendiri, misalnya `/parent-screening`, bukan BottomSheet karena
alur pengisian panjang. Parent tidak melihat tombol kelola katalog atau share.
Halaman awal menampilkan profil subjek miliknya/anak terhubung yang legal,
  draft terakhir, dan riwayat hasil miliknya. Jika belum ada anak tenant,
Parent dapat membuat profil subjek global minimal. Jika belum ada template
`PUBLISHED` untuk usia/locale anak, jelaskan mengapa belum bisa mulai dan
beri jalan kembali; jangan tampilkan draft Admin.

Gunakan shared `MultiStepFormWizard` dari `packages/ui` dengan step dinamis:

1. **Pilih atau buat profil anak** — tampilkan label “Belum terhubung ke lembaga” untuk
   profil global dan label tenant/cabang untuk anak terhubung.
2. **Penjelasan dan persetujuan** — jelaskan tujuan, bukan diagnosis, privasi, estimasi
   waktu, dan pilihan untuk berhenti. Persetujuan penggunaan screening dicatat sebelum
   pertanyaan pertama.
3. **Konteks anak** — tampilkan 6 pilihan ganda utama dengan pertanyaan lanjutan
   hanya saat jawaban terkait dipilih. Sebelum membuat sesi dengan template
   yang dipin, server memakai jawaban prematuritas untuk menentukan apakah
   kuesioner otomatis boleh dibuka. Jika belum boleh, tampilkan alasan dan
   jalur diskusi dokter; jangan lanjut ke butir atau menghasilkan hasil.
   Jika boleh, jelaskan jumlah soal perkembangan sesuai usia.
4. **Kuesioner per domain** — satu domain per step atau beberapa domain sesuai jumlah
   pertanyaan; setiap item berupa card/radio dengan satu dari empat pilihan;
   progress, back/next, validasi, simpan draft, dan dukungan keyboard.
5. **Tinjau jawaban** — tampilkan item belum dijawab dan `TIDAK_DIAMATI`; Parent boleh
   kembali mengubah jawaban sebelum submit.
6. **Hasil** — tampilkan ringkasan per domain, kelengkapan, waktu pengisian, versi
   kuesioner, penjelasan hasil, dan langkah berikutnya. Hasil membuka halaman
   detail read-only yang bisa dibuka lagi dari riwayat, bukan form edit hasil.

Pada hasil tampilkan satu status utama dari §5.1, area yang relevan, butir
yang memicu tiap alasan, item belum diamati, dan saran langkah berikutnya
dengan bahasa sederhana. Label “speech delay”/diagnosis/lulus-gagal tidak ada.
Parent boleh mengulang pada sesi baru, tetapi tidak dapat mengubah hasil lama.
Riwayat diurutkan menurut tanggal dan usia saat pengisian, tidak dibuat grafik
skor yang menyamakan versi/usia berbeda.
Pada hasil `COMPLETED`, tombol **Ekspor PDF untuk konsultasi** memulai unduhan
sesudah Parent memilihnya; tombol ini tidak berbagi otomatis dengan tenant,
Staff, atau dokter. UI menjelaskan bahwa file yang telah diunduh/dibagikan
di luar aplikasi berada dalam kendali penerimanya dan tidak dapat dicabut
oleh penghapusan akun di kemudian hari. Gagal ekspor tidak mengubah hasil;
Parent dapat mencoba lagi. Draft yang belum `COMPLETED` tidak dapat diekspor.
Pintasan **Privasi data** pada riwayat/hasil mengarah ke kanal bantuan
privasi untuk permintaan penghapusan data screening tanpa menutup akun;
ini bukan aksi hapus instan atau akses tambahan bagi Platform Admin ke hasil.

### 4.2 Platform Admin: CRUD katalog lengkap

Entry point berada pada tab **Master data → Cek perkembangan anak**, bukan
halaman operasional tenant. Rancangan layar dan aksi:

1. **Daftar template** — filter usia/status/asal, cari kode atau nama, lihat
   versi aktif dan jumlah butir, indikator kelengkapan locale, serta tombol
   **Buat template**. Empty/loading/error/retry berbeda; kegagalan memuat
   tidak boleh ditafsirkan sebagai katalog kosong.
2. **Detail versi** — metadata, daftar butir per domain, opsi, terjemahan,
   versi aturan, checksum, riwayat perubahan, dan status review. Versi seed,
   published, dan retired read-only; tombol **Salin jadi draft** tersedia.
3. **Editor draft** — wizard penuh dengan step **Usia dan identitas**,
   **Butir dan pilihan**, **Hasil dan pemetaan**, **Terjemahan locale aktif**,
   dan **Tinjau**. Admin
   dapat menambah/mengedit/mengurutkan/menghapus butir draft, menyimpan
   sebagian, kembali tanpa kehilangan input, dan melihat peringatan konflik
   revisi. Form butir memakai domain, subdomain, tipe, kewajiban,
   kondisi tampil bertipe, serta contoh observasi; pilihan perkembangan
   tetap empat kode sistem. Pada step hasil Admin memilih versi bersama
   konteks/hasil yang sesuai, atau membuat salinan draft versi bersama untuk
   mengatur redaksi status, alasan, tindak lanjut, dan trigger bertipe yang
   telah didukung evaluator; kode status/alasan tetap dan tidak dapat
   berubah menjadi diagnosis bebas.
4. **Pratinjau dan validasi** — preview mode Parent untuk semua locale/usia
   dengan jawaban sintetis, pratinjau empat status hasil, daftar error tepat
   pada step/butir/locale, serta blokir publish jika tidak lengkap. Data
   Parent sungguhan tidak dapat dipakai sebagai preview.
5. **Keputusan akhir** — **Terbitkan** meminta review metadata dan konfirmasi
   dampak bahwa sesi baru memakai versi tersebut; **Pensiunkan** menutup
   versi dari sesi baru; **Hapus draft** hanya untuk `MANUAL` yang belum
   pernah digunakan, dengan dialog konfirmasi dan penolakan server jika
   masih direferensikan. Tidak ada tombol hapus pada versi seed/terbit/pensiun.

Semua mutasi Admin harus memvalidasi role di server, memakai revisi optimistis
untuk draft, memberi error per field yang bisa diperbaiki, dan mencatat aktor
serta waktu. Admin tidak memiliki daftar profil, sesi, jawaban, atau hasil
Parent pada modul katalog.

Perilaku wajib:

- Draft disimpan secara batch dan dapat dilanjutkan setelah aplikasi ditutup.
- Submit hanya terjadi setelah tombol “Lihat hasil” ditekan pada tahap review; menjawab
  satu pertanyaan tidak membuat hasil final atau notifikasi.
- Loading, kosong, error, retry, disabled, dan submitting state harus jelas.
- Deep link stale, profil terhapus, atau tenant tidak lagi berwenang harus menghasilkan
  state aman (`NOT_AVAILABLE`) tanpa menampilkan data tenant lain.
- Semua tombol, progress, warna, dan hasil memiliki label screen-reader dan kontras yang
  memadai. Jangan menjadikan warna sebagai satu-satunya penanda.

## 5. Hasil dan scoring

Evaluasi authoritative dilakukan server dengan konfigurasi template/version.
Server menyimpan jawaban mentah dan snapshot hasil agar hasil lama tidak berubah
ketika aturan baru diterbitkan. Pada rilis mandiri, evaluasi bersifat **aturan
kelengkapan dan tindak lanjut**, belum menghasilkan skor risiko klinis, persentil,
atau diagnosis.

### 5.1 Katalog hasil yang ditetapkan

Satu sesi yang valid dan selesai memiliki **tepat satu dari empat status utama**
berikut. Ini adalah status **langkah berikutnya**, bukan kategori penyakit,
tingkat risiko klinis, atau pernyataan anak normal/terlambat. Status dihasilkan
server dari jawaban versi template yang dipakai, tidak dipilih oleh client.

| Kode status utama | Judul untuk Parent | Syarat setelah aturan prioritas diterapkan | Langkah berikutnya |
| --- | --- | --- | --- |
| `SEGERA_DISKUSIKAN` | Perubahan kemampuan dilaporkan | Ada kemampuan yang sebelumnya terlihat lalu hilang/jelas berkurang (`CTX-05=Ya`/`ALERT-01`). | Hubungi dokter anak segera; bawa contoh kemampuan dan perkiraan waktunya. Ini bukan klasifikasi gawat darurat. |
| `DISKUSIKAN_PERKEMBANGAN` | Ada jawaban untuk dibahas dengan dokter anak | Tidak ada kehilangan kemampuan, tetapi ada kekhawatiran Parent, perhatian pendengaran/gerak, atau sedikitnya satu butir usia relevan dijawab `KADANG`/`BELUM`. | Bawa butir terkait ke dokter anak; profesional menentukan perlu tidaknya skrining formal, pemeriksaan pendengaran, atau asesmen lain. |
| `PENGAMATAN_BELUM_CUKUP` | Pengamatan belum cukup | Tidak ada pemicu dua status di atas, tetapi sedikitnya satu butir wajib `TIDAK_DIAMATI` atau jawaban perhatian `Tidak yakin`. | Amati aktivitas yang belum sempat dicoba dan perbarui pengisian; jangan mengartikan kekurangan data sebagai kemampuan sudah/belum ada. |
| `KEMAMPUAN_DILAPORKAN_TERLIHAT` | Kemampuan yang ditanyakan dilaporkan terlihat | Semua butir wajib yang relevan dijawab `YA_SUDAH`, tidak ada pemicu perhatian atau ketidakpastian konteks. | Terus pantau dan ikuti kunjungan rutin; hasil ini **tidak** menyatakan perkembangan normal atau menyingkirkan masalah. |

Usia/profil tidak valid, belum ada template sesuai usia, kebijakan usia koreksi
belum memungkinkan pemilihan template, persetujuan belum ada, atau butir wajib
masih kosong berarti **belum ada hasil**, bukan status kelima. Sesi tetap draft
atau masuk state kesalahan yang dapat diperbaiki. `TIDAK_DIAMATI` adalah jawaban
sah dan dapat menghasilkan status `PENGAMATAN_BELUM_CUKUP`; item kosong tidak
boleh diam-diam diubah menjadi jawaban tersebut. Satu Parent hanya melihat satu
status utama, tetapi alasan tindak lanjut dari beberapa area tetap dapat tampil
bersama. Urutan prioritasnya persis seperti urutan empat baris tabel di atas.

Hasil juga menampilkan hingga **enam ringkasan area** sesuai butir yang benar-benar
ada pada template usia: bahasa/komunikasi (`BK`), motorik kasar (`MK`), motorik
halus (`MH`), kognitif/bermain (`KG`), sosial-emosi (`SE`), dan adaptif (`AD`).
Area tanpa butir relevan tidak diberi status atau kesimpulan; ini penting untuk
`AD` pada bayi muda. Setiap area yang ada memakai salah satu dari empat status
yang sama, tetapi hanya untuk jawaban/alert yang dapat diatribusikan ke area
itu. Status keseluruhan bukan rata-rata, jumlah, atau voting status area.
`BK` tetap memperlihatkan subarea memahami ucapan, mengekspresikan diri/bicara,
dan gestur/interaksi, masing-masing dengan butir sumbernya; subarea bukan
diagnosis terpisah.

Katalog **enam kode alasan** di bawah dapat muncul bersama dan menjelaskan
*mengapa* status utama/area muncul. Kode alasan bukan enam hasil tambahan:

| Kode alasan | Pemicu yang dapat diaudit | Area/pesan yang ditampilkan |
| --- | --- | --- |
| `DISKUSIKAN_BUTIR_PERKEMBANGAN` | Setiap butir relevan `KADANG` atau `BELUM`. | Area dan subarea milik butir, ID butir, jawaban, serta kemampuan konkret yang perlu dibahas. |
| `DISKUSIKAN_KEKHAWATIRAN_PARENT` | `CTX-04` memilih area kekhawatiran atau `ALERT-05` mencatat kekhawatiran lain. | Area yang jelas dari pilihan Parent; bila tidak spesifik, tampilkan sebagai perhatian umum tanpa menebak area. |
| `DISKUSIKAN_PENDENGARAN` | `CTX-04=Pendengaran` atau `CTX-06` menyatakan kadang/sering tidak merespons suara (`ALERT-03`). | Perhatian pendengaran terpisah di dekat `BK`; anjuran membicarakan kemungkinan tes pendengaran, **tanpa** menyimpulkan penyebab kesulitan bicara. |
| `DISKUSIKAN_PERBEDAAN_GERAK` | `ALERT-02` menyatakan perbedaan kanan-kiri yang mengganggu. | Perhatian gerak terpisah; atribusi `MK`/`MH` hanya bila aktivitas yang disebut Parent memastikannya, bukan otomatis ke keduanya. |
| `OBSERVASI_BELUM_CUKUP` | Butir `TIDAK_DIAMATI`, `CTX-05`/`CTX-06`/`ALERT-02=Tidak yakin`, atau kesempatan observasi tidak ada. | Area/item atau konteks yang belum pasti; tidak dihitung sebagai `BELUM`. |
| `SEGERA_DISKUSIKAN_KEHILANGAN_KEMAMPUAN` | `CTX-05=Ya` (`ALERT-01`); `ALERT-04` hanya turunan dari jawaban yang sama. | Perubahan kemampuan, waktu, dan area jika dapat diketahui; tidak boleh tertutup oleh jawaban `YA_SUDAH` lain. |

`CTX-04=Bicara` dipetakan ke `BK` ekspresif, `Memahami ucapan` ke `BK`
reseptif, `Interaksi` ke `SE`, `Belajar` ke `KG`, dan `Aktivitas sehari-hari`
ke `AD` hanya jika area itu memiliki butir usia relevan. `Gerak` yang tidak
dirinci dan `Pendengaran` tetap sebagai perhatian umum/khusus, bukan bukti
bahwa kedua domain motorik atau kemampuan bahasa tertentu bermasalah.
`CTX-03` multibahasa, prematuritas, bantuan yang sudah diterima, dan kondisi
observasi adalah konteks interpretasi, bukan kode perhatian otomatis.

Untuk setiap area: kehilangan kemampuan yang jelas pada area itu mengutamakan
`SEGERA_DISKUSIKAN`; jika tidak, kekhawatiran terpetakan atau butir
`KADANG`/`BELUM` memberi `DISKUSIKAN_PERKEMBANGAN`; jika tidak, butir
`TIDAK_DIAMATI` memberi `PENGAMATAN_BELUM_CUKUP`; hanya seluruh butir area
`YA_SUDAH` tanpa perhatian yang memberi `KEMAMPUAN_DILAPORKAN_TERLIHAT`.
Ketika perhatian umum/pendengaran/gerak tidak dapat dipetakan secara aman ke
area, status utama tetap naik sesuai pemicunya dan perhatian ditampilkan
tersendiri; jangan memaksa status area yang tidak didukung jawabannya. Alasan
ketidakcukupan data tetap ditampilkan walau perhatian lain membuat status
utama lebih tinggi. Bila satu sumber memicu dua kode alasan (misalnya
`CTX-04=Pendengaran`), tampilkan satu pesan yang jelas tanpa pengulangan,
tetapi simpan kedua kode dan satu sumbernya dalam snapshot. Label hasil,
pemicu, dan prioritas ini harus direview ahli sebelum rilis; perubahan setelah
review memerlukan versi aturan baru dan tidak menulis ulang snapshot hasil lama.

Gejala akut bukan keluaran empat status perkembangan: tampilkan arahan mencari
layanan darurat setempat secara terpisah tanpa mengklaim kuesioner melakukan
triase. Hasil dapat memuat lebih dari satu pesan: misalnya domain
motorik belum cukup data tetapi ada kekhawatiran bahasa. Domain bahasa memisahkan
kemampuan **memahami**, **mengekspresikan**, dan **gestur/interaksi**;
riwayat respons suara ditampilkan sebagai konteks, bukan penyebab otomatis.

Jangan mengubah satu jawaban `BELUM` menjadi “speech delay”, “autisme”,
“gangguan motorik”, atau “keterlambatan global”. Untuk anak usia 18/24 bulan,
ingatkan bahwa pemeriksaan autisme formal oleh profesional dianjurkan pada
kunjungan sesuai usia; pertanyaan sosial di sini tidak menggantikannya. Untuk
keluarga multibahasa, contoh perilaku pada salah satu bahasa yang biasa dipakai
anak diterima dan bahasa pengamatan dicatat.

Hasil minimum:

- Status kelengkapan keseluruhan dan per domain.
- Ringkasan observasi per domain, bukan label diagnosis.
- Tepat satu kode status utama dan nol atau lebih dari enam kode alasan yang
  ditetapkan di §5.1, masing-masing dengan rujukan ke butir/konteks sumber.
- Penjelasan bahwa satu kali pengisian tidak cukup untuk menyimpulkan kondisi anak.
- Saran aman: amati kembali pada periode yang ditentukan, catat contoh perilaku, atau
  konsultasikan ke tenaga kesehatan/pendidikan yang sesuai.
- Tanggal pengisian, usia anak saat pengisian, template/version, dan tanggal review ulang.
- Item yang dilaporkan terlihat, item yang belum/kadang terlihat, item yang belum
  diamati, kekhawatiran Parent, dan batasan konteks seperti prematuritas atau
  sedikit kesempatan mencoba.

Jangan menampilkan “lulus/gagal”, ranking anak, persentase yang terlihat seperti nilai
ujian, atau rekomendasi terapi otomatis. Bila jawaban belum cukup, hasil harus mengatakan
“belum cukup data” dan tidak memaksakan kesimpulan. Hasil perhatian tidak dikirim melalui
push notification atau judul notifikasi karena termasuk data sensitif.

Riwayat hasil dari usia atau versi template yang berbeda tidak boleh digambar sebagai
grafik skor perkembangan yang seolah sebanding. Tampilkan linimasa tanggal, usia,
ringkasan observasi, dan tindak lanjut; perbandingan antarwaktu hanya untuk item
yang definisi/versinya benar-benar setara.

Contoh komposisi hasil untuk anak 24 bulan dan semua varian status ditetapkan
di §5.2. Redaksi UI dan PDF wajib berasal dari katalog narasi berversi yang
sama, bukan masing-masing disusun ulang oleh client dan backend.

Jika Parent menjawab semua `YA_SUDAH`, tulis kemampuan yang dilaporkan terlihat
serta anjuran kunjungan rutin; jangan memberi sertifikat “tidak ada masalah”.
Jika semua domain berisi `TIDAK_DIAMATI`, tampilkan status pengamatan belum cukup,
daftar aktivitas yang belum sempat dicoba, dan opsi membuat sesi pengamatan baru;
jangan tampilkan hasil yang menenangkan secara keliru. Simpan `questionId`,
answer, dan reason code di hasil agar tiap kalimat
yang tampil dapat ditelusuri ke jawaban dan versi template.

### 5.2 Narasi hasil yang objektif dan dapat ditelusuri

Teks hasil menyatakan **apa yang dijawab Parent**, bukan menyatakan kemampuan,
keadaan medis, atau emosi anak/Parent sebagai fakta yang diverifikasi aplikasi.
Susunan tetap: (1) tanggal pengisian, usia dan versi daftar; (2) judul status;
(3) ringkasan jawaban yang memicu status beserta pertanyaan/ID sumber;
(4) jawaban `TIDAK_DIAMATI` dan batasan konteks; (5) langkah berikutnya;
(6) batasan hasil. Tampilkan detail seluruh jawaban di bagian terpisah yang
dapat dibuka Parent dan selalu lengkap dalam PDF. Status tertinggi tidak
menyembunyikan alasan lain atau item yang belum diamati.

Aturan redaksi dan data:

- Gunakan verba teratribusi: “Parent memilih ...”, “Parent melaporkan ...”,
  atau “Jawaban untuk butir ... adalah ...”. Jangan menulis “anak mengalami
  keterlambatan”, “anak normal”, “Parent merasa ...”, atau menyimpulkan sebab,
  prognosis, tingkat risiko, terapi, dan urgensi gawat darurat dari checklist.
  Hindari pujian, penenangan, rasa takut, dan label “lulus/gagal”.
- Sebut area dan kemampuan dari teks butir yang **dipublish pada versi sesi**;
  sertakan jawaban persis (`YA_SUDAH`, `KADANG`, `BELUM`, `TIDAK_DIAMATI`) dengan
  label locale. `TIDAK_DIAMATI` tidak boleh diparafrase sebagai `BELUM`.
  Jawaban konteks yang tidak pasti juga tidak boleh diparafrase sebagai fakta.
- Teks bebas Parent, termasuk contoh kemampuan dan waktu pada `CTX-05`,
  ditampilkan sebagai kutipan/input Parent, bukan klaim sistem; escape konten
  dan batasi panjang di UI, tetapi PDF tetap menyediakan catatan lengkap yang
  aman dirender. Bila waktu atau rincian tidak diisi, tulis “Waktu/rincian
  tidak dicatat”, jangan mengisi atau menebak sendiri.
- Urutkan alasan menurut prioritas status §5.1, lalu urutan area dan urutan
  butir pada versi template. Gabungkan pesan yang bersumber dari jawaban sama
  tanpa menghapus `reasonCode` atau referensi sumber di snapshot. Tampilkan
  jumlah ringkas bila daftar panjang, tetapi setiap pemicu, terutama `CTX-05`,
  tetap dapat dibuka di UI dan terbaca lengkap dalam PDF.
- Setiap kalimat dinamis diturunkan dari `statusCode`, `reasonCode`,
  `questionId`, `answerId`, `templateVersion`, `ruleVersion`, dan `locale`
  pada snapshot final. Katalog redaksi/terjemahan berversi adalah sumber tunggal
  untuk UI serta PDF. Tidak ada narasi generatif/AI atau redaksi bebas dari
  client. Jika ID, terjemahan, atau referensi snapshot tidak dikenal, jangan
  tampilkan kalimat rekaan: hasil sementara tidak tersedia, catat kesalahan
  teknis tanpa isi sensitif, dan sediakan retry/bantuan.

Klausa berikut adalah **redaksi dasar bahasa Indonesia**. Parameter dalam
kurung siku diisi dari jawaban dan label yang dipublish untuk sesi itu; klausa
yang sumbernya tidak ada tidak ditampilkan. Kode internal tetap sebagaimana
§5.1 dan tidak menjadi label diagnosis untuk Parent.

| Pemicu | Klausa fakta pada hasil |
| --- | --- |
| `DISKUSIKAN_BUTIR_PERKEMBANGAN` | “Untuk [nama butir] ([questionId]), Parent memilih [label jawaban KADANG/BELUM].” |
| `DISKUSIKAN_KEKHAWATIRAN_PARENT` | “Pada pertanyaan area yang ingin dibahas (`CTX-04`), Parent memilih [area].” Untuk `ALERT-05`, tampilkan “Parent menambahkan catatan: [teks Parent].” Jangan menyatakan Parent sedang merasa khawatir. |
| `DISKUSIKAN_PENDENGARAN` | “Pada pertanyaan respons suara (`CTX-06`), Parent memilih [label jawaban].” Bila hanya `CTX-04=Pendengaran`, gunakan klausa `CTX-04` sekali, tanpa mengarang jawaban `CTX-06`. |
| `DISKUSIKAN_PERBEDAAN_GERAK` | “Pada pertanyaan gerak kanan-kiri (`ALERT-02`), Parent memilih [label jawaban].” |
| `OBSERVASI_BELUM_CUKUP` | “Untuk [nama butir/konteks] ([questionId]), Parent memilih [TIDAK_DIAMATI/Tidak yakin].” |
| `SEGERA_DISKUSIKAN_KEHILANGAN_KEMAMPUAN` | “Pada pertanyaan perubahan kemampuan (`CTX-05`), Parent memilih Ya. Kemampuan yang dicatat Parent: [teks Parent atau ‘Tidak dirinci’]. Perkiraan waktu: [input Parent atau ‘Tidak dicatat’].” |

Empat paket judul, ringkasan status, dan langkah berikutnya yang disetujui
untuk versi awal adalah sebagai berikut. Klausa pemicu dari tabel di atas
disisipkan setelah ringkasan; kalimat tidak menyatakan hasil pemeriksaan.

| Status | Ringkasan status | Langkah berikutnya |
| --- | --- | --- |
| `SEGERA_DISKUSIKAN` | “Parent melaporkan perubahan pada kemampuan yang sebelumnya pernah terlihat.” | “Hubungi dokter anak segera dan sampaikan kemampuan yang berubah serta perkiraan waktunya. Jika ada kondisi akut, gunakan layanan darurat setempat; checklist ini tidak menilai kondisi gawat darurat.” |
| `DISKUSIKAN_PERKEMBANGAN` | “Ada jawaban yang dapat dibahas lebih lanjut dengan dokter anak.” | “Bawa jawaban dan contoh pengamatan saat konsultasi. Dokter menentukan apakah diperlukan skrining formal atau pemeriksaan lain.” Jika pemicu pendengaran ada, tambahkan “Tanyakan apakah pemeriksaan pendengaran diperlukan.” |
| `PENGAMATAN_BELUM_CUKUP` | “Sebagian butir atau konteks belum memiliki pengamatan yang cukup.” | “Catat aktivitas yang belum diamati dan isi sesi baru setelah ada kesempatan mengamati. Jawaban ‘Tidak diamati’ bukan jawaban ‘Belum’.” |
| `KEMAMPUAN_DILAPORKAN_TERLIHAT` | “Untuk semua butir yang ditanyakan pada daftar ini, Parent memilih ‘Sudah terlihat’.” | “Lanjutkan pemantauan dan kunjungan rutin. Hasil ini tidak memastikan bahwa tidak ada kondisi perkembangan.” |

Contoh lengkap: untuk anak 24 bulan, jika `B24-BK2=YA_SUDAH`,
`B24-MK1=YA_SUDAH`, `B24-BK1=BELUM`, `B24-KG1=TIDAK_DIAMATI`,
dan `CTX-06=Kadang tidak merespons`, statusnya
`DISKUSIKAN_PERKEMBANGAN`. Teks fakta dapat berbunyi: “Pada daftar usia
24 bulan yang diisi [tanggal], Parent memilih ‘Sudah terlihat’ untuk
menunjuk benda di buku (`B24-BK2`) dan berlari (`B24-MK1`), ‘Belum terlihat’
untuk menggabungkan dua kata (`B24-BK1`), serta ‘Tidak diamati’ untuk
memakai dua mainan bersama (`B24-KG1`). Pada pertanyaan respons suara (`CTX-06`),
Parent memilih ‘Kadang tidak merespons’.” Sesudahnya tampilkan langkah
berikutnya untuk status diskusi, termasuk pertanyaan tentang pemeriksaan
pendengaran. Contoh ini hanya berlaku bila semua jawaban konteks lain tidak
memicu status lebih tinggi; teks butir/label nyata mengikuti versi sesi.

Untuk `CTX-05=Ya`, tampilkan paket perubahan kemampuan walau butir lain
`YA_SUDAH`. Untuk semua butir `TIDAK_DIAMATI` tanpa pemicu lebih tinggi,
tampilkan paket pengamatan dan daftar butir yang belum diamati. Untuk semua
`YA_SUDAH` tanpa pemicu lain, tampilkan paket kemampuan yang dilaporkan
terlihat. Bila beberapa alasan muncul, tampilkan setiap klausa bersumber,
tetapi hanya satu status utama. Draft, profil tidak valid, atau template usia
tidak tersedia tidak menerima salah satu dari empat paket: tampilkan state
“Belum ada hasil” dan alasan operasionalnya, tanpa teks interpretasi.

Disclaimer tetap untuk UI dan PDF: “Laporan ini merangkum jawaban Parent pada
tanggal pengisian. Ini bukan diagnosis atau hasil skrining klinis tervalidasi.
Tenaga kesehatan menentukan apakah diperlukan pemeriksaan lebih lanjut.”
Redaksi dasar, klausa, tindakan, dan disclaimer harus direview ahli klinis,
privasi, dan bahasa sebelum publikasi. Tujuh locale aplikasi memerlukan
padanan lengkap yang disetujui dengan makna sama; jangan menerjemahkan secara
otomatis saat hasil ditampilkan atau memakai fallback diam-diam.

### 5.3 PDF hasil untuk bahan konsultasi dokter anak

Backend menghasilkan PDF **saat diminta** dari snapshot `COMPLETED` yang sudah
tersimpan; ekspor tidak menghitung ulang status dari katalog terkini dan tidak
menyimpan salinan PDF permanen di server. Urutan bagian PDF mengikuti narasi
§5.2, lalu memuat daftar lengkap pertanyaan, jawaban, dan catatan Parent.
Isi minimum: nama subjek pada saat sesi, tanggal lahir/usia saat sesi,
tanggal pengisian, identitas Parent pengisi
yang memang tersimpan untuk sesi, kode/versi template dan aturan, locale,
ringkasan observasi/status/alasan, setiap pertanyaan serta pilihan jawaban
termasuk `TIDAK_DIAMATI`, contoh/catatan Parent bila disertakan, konteks yang
relevan, dan saran tindak lanjut. Beri judul dan disclaimer jelas bahwa ini
**laporan pengamatan Parent, bukan diagnosis atau surat keterangan medis**.
Jangan masukkan data tenant, guardian lain, atau catatan medis lembaga.

Teks statis dan konten template pada PDF memakai **locale sesi** dari tujuh
locale aplikasi (`id`, `en`, `zh`, `fr`, `pt`, `es`, `ru`) yang lengkap dan
direview; tidak boleh mencampur bahasa atau fallback diam-diam. Nama anak,
contoh bebas, dan jawaban bahasa rumah tetap ditampilkan apa adanya.
Server memeriksa owner dan status sebelum streaming, mengirim `Cache-Control:
no-store` serta nama file aman tanpa nama anak, dan tidak mencatat isi PDF
di access log. Penyimpanan/cache sementara yang tak terhindarkan harus
dibersihkan sesuai kebijakan keamanan; file yang diunduh ke perangkat atau
diberikan ke dokter berada di luar kontrol aplikasi.

## 6. Model data dan kontrak API

Skema khusus screening (nama tabel akhir mengikuti konvensi migration/API saat
implementasi) harus memisahkan **katalog global** dari **data Parent**:

- `ScreeningTemplate`: kode stabil, versi, rentang usia, locale yang lengkap,
  `DRAFT`/`PUBLISHED`/`RETIRED`, waktu berlaku, `ruleVersion`, checksum,
  provenans `SEEDED`/`MANUAL`, revisi optimistis, pembuat, publisher, dan
  metadata review. Versi baru memiliki referensi `copiedFrom` opsional dan
  menunjuk versi konteks/hasil bersama yang immutable saat dipublish.
- `ScreeningQuestion`: template/version, ID butir stabil (`B24-BK1` dan
  seterusnya), domain/subdomain, tipe jawaban, wajib/opsional, urutan, dan
  kondisi tampil bertipe. `ScreeningChoice`: kode opsi dan urutan sesuai tipe
  pertanyaan; pilihan perkembangan tetap empat kode pada §3.
- Terjemahan per template, butir, pilihan, judul hasil, alasan, dan saran
  disimpan per locale dengan referensi ke record sumber. Teks tidak digandakan
  dalam business logic; label navigasi/wizard yang bukan konten kuesioner tetap
  mengikuti i18n aplikasi yang sudah ada.
- `ScreeningRuleSet` dan rule/trigger bertipe menyimpan versi evaluasi, urutan
  prioritas empat status, pemicu enam kode alasan pada §5.1, atribusi area,
  serta referensi butir/jawaban/konteks. Backend menjalankan satu evaluator
  tervalidasi yang membaca konfigurasi ini; jangan menyimpan SQL, script,
  ekspresi bebas, atau JSON yang dapat dieksekusi dari DB. Konfigurasi baru
  harus lolos validasi kontrak dan test matriks sebelum dipublish.
- Trigger `ANSWER` dengan `stableQuestionId` kosong hanya berarti fallback
  global yang sudah direview untuk kode jawaban tertentu (`BELUM` atau
  `TIDAK_DIAMATI` pada seed awal); evaluator mencocokkannya ke semua butir
  yang memiliki kode tersebut. Trigger dengan ID stabil tetap scoped ke satu
  butir. Semua bentuk trigger wajib tervalidasi dan tidak boleh menjalankan
  ekspresi bebas.
- Pertanyaan konteks lintas usia, opsi konteks, terjemahan, dan redaksi hasil
  berada dalam katalog versi bersama; satu template usia menunjuk tepat
  satu versi katalog bersama. Revisi katalog bersama tidak mengubah template
  published atau snapshot hasil lama sampai draft template baru diterbitkan.
- `ScreeningSeedManifest`: ID batch unik, `seedVersion`, checksum, waktu/aktor
  penerapan, dan jumlah template/butir/terjemahan **yang dimiliki batch itu**
  untuk audit penerapan per lingkungan. Baris seed menyimpan ID batch asal;
  baris manual tidak dihitung ke checksum manifest batch.

Model data Parent yang disarankan:

- `ScreeningChildProfile`: `id`, `ownerUserId`, nama, tanggal lahir, data opsional,
  status aktif/arsip, timestamps.
- `ScreeningSession`: profile, `templateId/version`, status (`DRAFT`, `IN_PROGRESS`,
  `EXPIRED`, `COMPLETED`, `WITHDRAWN`), `createdAt`, `expiresAt` untuk draft,
  consent timestamp, optional `organizationId/childId`, timestamps. Transisi
  submit setelah `expiresAt` ditolak server meski client masih terbuka.
- `ScreeningAnswer`: session, question/version, answer, note, answeredAt. Jawaban lama
  tidak ditimpa saat template sudah retired.
- `ScreeningResult`: session, snapshot versi template/aturan, satu `mainStatus`,
  status per domain yang berlaku, kelengkapan, per-domain observed/emerging/
  not-yet/not-observed items, daftar `reasonCode` dengan ID butir/jawaban pemicu,
  teks/opsi/konteks dalam locale sesi atau referensi immutable yang terjamin
  tetap tersedia untuk PDF historis, `generatedAt`, `reviewAt`. Nama subjek
  pada saat sesi juga disnapshot agar koreksi profil kelak tidak menulis ulang
  laporan lama.

`organizationId` dan `childId` harus sama-sama null untuk screening global yang belum
terhubung, atau menunjuk relasi tenant yang telah diotorisasi. Constraint service wajib
menolak kombinasi yang tidak konsisten.

Katalog global tidak memiliki `organizationId` dan tidak boleh diedit oleh tenant.
Profil, jawaban mentah, dan hasil tetap dipisahkan serta dilindungi ownership
Parent; tidak ada tabel grant berbagi pada scope ini. Tabel katalog bukan alasan
untuk membuka data hasil Parent kepada tenant atau Platform Admin.

Setiap `ScreeningQuestion` juga perlu `stableQuestionId`, usia minimum/maksimum,
domain/subdomain, `required`, `needsOpportunity`, `informationalOnly`, instruksi
observasi, versi sumber, serta status review konten/locale. `ScreeningSession`
menyimpan tanggal mulai, usia kalender dan usia koreksi yang digunakan,
bahasa pengamatan, versi persetujuan, serta status kelengkapan. Simpan metadata
seperlunya dan batasi catatan bebas agar tidak menjadi rekam medis tanpa kontrol.

Endpoint Parent yang direncanakan:

- `GET /parent/screening/profiles`
- `POST /parent/screening/profiles`
- `PATCH /parent/screening/profiles/{profileId}` hanya untuk koreksi profil
  milik sendiri; hasil historis tidak dihitung ulang diam-diam.
- `POST /parent/screening/questionnaires/eligibility` — periksa subjek,
  usia, locale, dan konteks prematuritas sebelum membuka butir; tidak
  memberikan versi template kepada subjek yang belum memenuhi gerbang.
- `POST /parent/screening/sessions` — server memvalidasi ulang eligibility
  dan mem-pin versi template saat sesi pertama dibuat.
- `PUT /parent/screening/sessions/{sessionId}/answers` (batch/draft)
- `POST /parent/screening/sessions/{sessionId}/complete`
- `GET /parent/screening/sessions?profileId=...` untuk draft/riwayat sendiri.
- `GET /parent/screening/sessions/{sessionId}/result`
- `GET /parent/screening/sessions/{sessionId}/result.pdf` — PDF `COMPLETED`
  owner-only, dihasilkan dari snapshot hasil; error akses harus fail-closed
  tanpa memberi petunjuk tentang hasil milik Parent lain.
- Hasil Parent menampilkan ringkasan produk **Usia Emas**: kemampuan yang
  dilaporkan terlihat, pertanyaan dan jawaban yang perlu dibahas, serta langkah
  pengamatan praktis. Ringkasan ini bukan diagnosis dan tidak menunggu atau
  menggantikan diagnosis medis; seluruh butir tetap bersumber dari snapshot
  jawaban sesi agar PDF historis konsisten.
- Ringkasan domain pada PDF menggabungkan subbutir menjadi nama area yang
  mudah dipahami dan menerjemahkan statusnya; kode domain/status internal
  tidak menjadi copy Parent.
- UI hasil menyediakan tombol Pratinjau PDF yang membuka PDF snapshot dari
  endpoint terotorisasi yang sama sebelum Parent mengunduh atau membagikannya.

Kontrak katalog Platform Admin mengikuti prefix baseline `/v1/platform`
(ditampilkan di sini tanpa prefix `/api`). Subresource butir/terjemahan dapat
ditetapkan saat desain DTO, tetapi aksi UI harus tercakup:

- `GET /v1/platform/screening/templates` dan
  `GET /v1/platform/screening/templates/{templateId}` — list/detail/riwayat.
- `POST /v1/platform/screening/templates` dan
  `POST /v1/platform/screening/templates/{templateId}/copy` — buat draft.
- `PATCH /v1/platform/screening/templates/{templateId}` dan subresource
  butir/pilihan konteks/terjemahan/redaksi hasil/pemetaan bertipe — edit
  atau hapus isi draft `MANUAL`
  dengan `expectedRevision`; empat pilihan perkembangan tidak dapat dihapus.
- `DELETE /v1/platform/screening/templates/{templateId}` — hapus hanya
  draft `MANUAL` yang belum pernah direferensikan, secara atomik.
- `POST /v1/platform/screening/templates/{templateId}/preview`, `/validate`,
  `/publish`, dan `/retire` — pratinjau sintetis, daftar masalah, dan
  transisi lifecycle yang diaudit.
- Subresource `/v1/platform/screening/shared-content` dengan list/detail,
  buat/salin draft, edit konteks/redaksi/aturan bertipe, hapus draft belum
  dipakai, preview, validate, publish, dan retire; template draft memilih
  `sharedContentVersion` secara eksplisit.

Kontrak final harus mengembalikan error per field/butir/locale agar UI
menunjukkan apa yang perlu diperbaiki. API hanya mengizinkan mutasi pada
draft `MANUAL`; versi seed hanya bisa dibaca atau disalin. Hapus draft,
publish, dan retire wajib server-side permission check serta audit; jangan
mengandalkan penyembunyian tombol atau `X-Organization-Id` sebagai otoritas
untuk katalog global. Tidak ada endpoint Platform Admin untuk melihat
profil/sesi/hasil Parent dan tidak ada endpoint share untuk Parent.

Semua endpoint harus memeriksa ownership Parent di server, bukan hanya menyembunyikan
tombol di UI. Query lintas tenant harus mempertahankan konteks sumber per item dan
menoleransi kegagalan satu tenant tanpa membocorkan atau menghilangkan hasil tenant lain.

## 7. Perubahan yang harus ditambahkan ke `docs/business-rules.md`

Sebelum coding, tambahkan bab baru yang setidaknya menetapkan:

1. Definisi screening sebagai alat pemantauan non-diagnostik.
2. Hak Parent tanpa tenant untuk membuat profil screening global.
3. Perbedaan profil global dengan `Child` tenant; tidak ada attach/merge otomatis
   atau manual pada scope ini.
4. Akses lintas tenant, ownership, `organizationId`, dan fail-closed authorization.
5. Hasil private untuk Parent pengisi; tidak ada share/grant atau UI hasil Staff.
6. Status session/result, versioning template, evaluasi server, dan incomplete handling.
   Termasuk CRUD katalog Platform Admin, pembagian seed awal vs konten manual,
   review, publikasi, immutability versi, hapus draft aman, dan pensiun versi.
7. Masa berlaku draft 30 hari, retensi hasil, penghapusan akun Parent,
   ekspor PDF owner-only, logging, dan larangan isi sensitif pada notifikasi.
8. Capability/visibility matrix untuk Parent, Staff, Staff Admin, dan Platform Admin.
9. Locale, accessibility, wording hasil, dan kewajiban review klinis/hukum.

Jika UI yang diinginkan bertentangan dengan bab tersebut, hentikan implementasi dan pilih
secara eksplisit apakah dokumen diubah atau UI mengikuti dokumen. Jangan membuat default
baru di client.

## 8. Tahapan implementasi

### Fase 0 — keputusan produk dan keamanan

- Review klinis/hukum atas setiap butir, instruksi observasi, domain, age band,
  usia koreksi prematur, wording hasil, PDF, dan sumber pertanyaan. Bank
  usia 61–215 bulan memerlukan rancangan serta review tersendiri sebelum dibuka.
- Setujui bab business rules, privacy/retention, dan feature flag.
- Rilis mandiri memakai checklist internal non-diagnostik. Bila kemudian ingin
  instrumen terstandar, lakukan proyek instrumen/validasi terpisah dengan
  kewenangan pelaksana dan izin yang diperlukan.

### Fase 1 — katalog Platform Admin dan dataset awal

- Migration Flyway **additive** untuk tabel katalog dan data Parent, terpisah
  dari file seed konten. Pada deploy pertama, skema dibuat lewat alur Flyway
  biasa, tetapi **operator menjalankan perintah bootstrap screening terpisah
  satu kali** setelah skema tersedia dan sebelum katalog dipublikasikan.
  Perintah ini bukan bagian dari workflow deploy, aktivasi rilis, startup API,
  atau flag seeder startup. Flag apply hanya berlaku untuk invocation runner
  manual §3.7. Pada deploy berikutnya tidak ada pemanggilan bootstrap,
  termasuk setelah restart atau rollback. Catat ID batch, versi/checksum,
  waktu, dan hasil bootstrap di DB untuk audit. Batch awal menuntut katalog
  screening awal masih kosong, berjalan dalam satu transaksi, dan memakai
  unique key untuk `(templateCode, version)`, ID butir per versi, kode opsi,
  dan locale. Jika operator menjalankannya lagi, checksum yang sama memberi
  hasil `ALREADY_APPLIED` tanpa mutasi setelah marker dan isi katalog cocok;
  checksum berbeda, marker tanpa katalog, atau katalog berisi data parsial
  ditolak tanpa perubahan dan memerlukan prosedur pemulihan tersendiri.
  Batch masa depan mengikuti §3.7 dan boleh menambah **versi draft baru**
  tanpa syarat seluruh katalog kosong. Jangan menjadikan deploy berikutnya
  sebagai cara memperbaiki seed.
  Seeder tidak menghapus sesi, jawaban, atau snapshot hasil lama dan tidak
  memerlukan reset DB. Seed awal hanya membuat `DRAFT`; `PUBLISHED` memerlukan
  persetujuan ahli/locale dan aksi publikasi eksplisit setelah pemeriksaan
  kelengkapan serta konsistensi aturan. Rilis awal harus menyediakan **CRUD
  katalog lengkap** pada §4.2, bukan hanya tombol publish atau SQL manual.
- API katalog Platform Admin, editor/preview/validasi/publish/retire/hapus
  draft, audit, kontrol revisi, serta uji izin dan batas versi. Katalog seed
  read-only; penambahan rutin melalui UI draft `MANUAL`, batch baru hanya
  melalui runner manual §3.7.

### Fase 2 — pengisian dan hasil privat Parent

- Backend profil subjek, sesi, jawaban batch, evaluator/snapshot hasil,
  daftar draft dan riwayat; `packages/core` enum/schema, `packages/api-client`
  methods, dan UI Parent §4.1.
- Parent tanpa tenant dan Parent dengan anak terhubung dapat mengisi dari
  subjek yang legal; daftar lintas tenant membawa asal per anak, tetapi
  sesi/hasil hanya dimiliki Parent pengisi. Tidak ada attach, share, atau
  layar hasil untuk Staff/Staff Admin.
- Draft/resume, locale, accessibility, fallback tidak ada template, hasil
  read-only privat, serta ekspor PDF dari snapshot. Fase ini tidak dibuka ke
  Parent sebelum sedikitnya satu template usia/locale yang relevan lolos
  review dan dipublish.
- Draft lewat 30 × 24 jam sejak dibuat menjadi `EXPIRED` tanpa menghapus
  catatannya; hasil final tidak kedaluwarsa 30 hari. Alur hapus akun mengikuti
  [plan penghapusan akun Parent](parent-account-deletion.md) dan harus siap
  sebelum klaim retensi “sampai Parent hapus akun” dipublikasikan.

### Fase 3 — perluasan usia 61–215 bulan

- Platform Admin menambah bank usia sekolah/remaja melalui UI versi `MANUAL`
  setelah desain, izin konten, review ahli per usia/locale, dan tes hasil.
  Sebelum tersedia, layar menampilkan “belum tersedia untuk usia ini”, bukan
  butir balita yang diperluas atau hasil kosong yang tampak normal.
- Untuk usia remaja, pertanyaan sensitif seperti kesehatan mental/perilaku
  tidak otomatis dimasukkan; butuh desain persetujuan, privasi remaja,
  keselamatan, dan rujukan profesional tersendiri.

### Di luar scope rilis yang disetujui

Reminder, direktori profesional, akses lembaga, dan berbagi
hasil memerlukan keputusan produk/privasi serta aturan bisnis tersendiri.
Mereka bukan alasan untuk membuat endpoint atau tombol tersembunyi sekarang.

## 9. Kriteria penerimaan dan pengujian

### Backend/API

- Parent tanpa tenant dapat membuat profil, draft, resume, complete, dan membaca hasilnya.
- Pada detik sebelum `expiresAt` draft masih dapat disimpan sesuai aturan
  server; mulai `expiresAt` submit/resume ditolak dan status `EXPIRED` tampil
  konsisten pada perangkat lain. Sesi `COMPLETED` tidak di-expire 30 hari.
- Usia <2 atau >=216 bulan, serta usia 61–215 bulan sebelum template sesuai
  diterbitkan, tidak mendapat pilihan template/hasil otomatis. Prematuritas
  tidak mendapat hasil otomatis sebelum kebijakan usia koreksi disetujui ahli.
- Parent dengan anak terhubung hanya dapat memakai anak yang memang legal
  untuk akunnya; Parent lain tidak dapat membaca profil/sesi/hasilnya meski
  tahu ID. Koreksi profil tidak mengubah snapshot hasil lama.
- Staff, Staff Admin, dan role tenant lain tidak dapat membaca katalog admin,
  profil/sesi/jawaban/hasil Parent, termasuk anak pada tenant mereka sendiri.
- Platform Admin dapat melakukan CRUD katalog sesuai lifecycle, tetapi tidak
  dapat membaca profil/sesi/jawaban/hasil Parent lewat endpoint katalog atau
  endpoint Parent; tidak ada endpoint share/grant.
- Age-band, version, prioritas tindak lanjut, incomplete, `TIDAK_DIAMATI`,
  kesempatan observasi, dan item wajib diuji pada batas bawah/atas.
- Uji tabel keputusan §5.1: empat status utama saling eksklusif, alasan dapat
  bergabung, `KADANG`/`BELUM` terpetakan ke area butir, Parent tetap didengar
  meski semua butir `YA_SUDAH`, dan perhatian umum tidak dipaksa ke area.
- Uji golden snapshot narasi §5.2 untuk keempat status, enam alasan,
  kombinasi alasan, semua `YA_SUDAH`, semua `TIDAK_DIAMATI`, `CTX-05=Ya`,
  jawaban `Tidak yakin`, item kosong, dan referensi/terjemahan tidak dikenal.
  Setiap klausa harus memiliki sumber jawaban; hasil yang sama pada UI dan PDF
  tidak boleh berbeda makna atau mengandung inferensi diagnosis/emosi.
- Hasil lama tetap konsisten setelah template baru dipublish.
- PDF hanya untuk `COMPLETED` milik pemohon, memuat jawaban/status/versi dari
  snapshot semula, tidak berubah setelah template baru terbit, tidak tersimpan
  permanen di server, dan ditolak untuk draft atau ID Parent lain.
- Batch seed yang sama dengan checksum/isi cocok tidak menduplikasi data;
  checksum berbeda pada ID batch sama ditolak atomik; batch baru membuat
  versi draft baru berdampingan dengan versi lama; template `DRAFT` tidak
  pernah diberikan ke Parent oleh endpoint pengisian.
- Deploy, restart API, dan rollback tidak memanggil runner seed screening.
  Tanpa `SCREENING_SEED_BATCH_ID` dan `SCREENING_SEED_APPLY=true` pada
  invocation manual, tidak ada mutasi. Pratinjau tidak menulis; apply pertama
  mencatat manifest, apply ulang batch sama menghasilkan `ALREADY_APPLIED`
  tanpa mutasi, dan konflik/parsial/checksum berbeda gagal atomik.
- Dua apply serentak untuk ID batch sama menghasilkan tepat satu manifest
  sukses; batch baru pada katalog yang sudah berisi batch lama hanya membuat
  versi draft baru yang tidak berbenturan, sedangkan rollback kode tidak
  menghapus batch yang telah diterapkan. Publikasi tetap memerlukan aksi
  Platform Admin dan tidak terjadi sebagai efek flag apply.
- Seed awal tidak menimpa versi `MANUAL`; published/retired immutable; sesi
  berjalan dan hasil lama tetap memakai versi asal ketika versi baru terbit.
- Endpoint authoring hanya menerima Platform Admin; `expectedRevision` menolak
  edit stale; publish ditolak untuk locale/opsi/domain/age band/review/rule
  yang tidak lengkap dengan detail yang bisa ditindaklanjuti.
- Hapus draft `MANUAL` yang belum dipakai sukses dan teraudit; hapus versi
  `SEEDED`/`PUBLISHED`/`RETIRED` atau draft yang direferensikan ditolak tanpa
  menghapus baris terkait. Retire tidak menghilangkan riwayat hasil Parent.
- Snapshot alasan hasil cocok dengan jawaban: kekhawatiran Parent dan kehilangan
  kemampuan tidak pernah tertutup oleh banyak jawaban `YA_SUDAH`; bahasa yang
  berbeda, prematuritas, dan `TIDAK_DIAMATI` tidak dihitung sebagai kegagalan.

### Mobile

- Wizard dapat dinavigasi dengan keyboard, screen reader, back, retry, dan rotasi/resize.
- Draft tidak hilang saat aplikasi ditutup atau request gagal.
- Profil global diberi label jelas dan tidak menampilkan aksi tenant yang belum tersedia.
- Hasil menampilkan kelengkapan dan disclaimer, termasuk state “belum cukup data”.
- Setiap alasan hasil menampilkan snapshot pertanyaan dan label jawaban Parent;
  kode enum internal tidak pernah dirender sebagai narasi. PDF memakai snapshot
  yang sama agar Parent dan dokter anak melihat butir yang jelas.
- Ekspor PDF hanya muncul pada hasil final; gagal unduh dapat dicoba lagi
  tanpa submit ulang atau perubahan sesi. Parent diberi penjelasan tentang
  file yang telah dibagikan ke luar aplikasi.
- Semua locale memiliki teks pertanyaan, pilihan, error, empty state, dan hasil.
- Uji pemahaman pada Parent Indonesia memastikan contoh aktivitas dapat dipahami
  tanpa petugas, tidak menuntut alat khusus, dan tidak menyudutkan anak/Parent.
- UI admin dapat menyimpan draft parsial, menyalin seed read-only, menambah
  butir manual, mengisi locale screening aktif, mempratinjau dengan jawaban sintetis,
  memahami alasan publish gagal, dan tidak pernah menawarkan edit untuk versi
  yang telah dipublish/retired.
- UI Parent tidak menampilkan kelola katalog/bagikan; UI Admin tidak
  menampilkan profil atau hasil Parent; Staff/Staff Admin tidak memiliki
  entry point screening. Deep link langsung tetap ditolak server.

### Keamanan/regresi

- Uji cross-tenant dan ID tampering pada setiap endpoint.
- Pastikan push/inbox/notification tidak memuat jawaban atau kesimpulan screening.
- Jalankan test unit, API integration, typecheck, lint, dan test UI wizard/result sebelum
  membuka PR. Device/browser verification tetap dicatat terpisah dari test otomatis.

## 10. Keputusan tetap dan gerbang persetujuan eksternal

**Status perencanaan per 9 Oktober 2026:** keputusan produk yang diketahui
sudah cukup jelas untuk melanjutkan desain teknis bertahap; tidak ada
pertanyaan produk tambahan yang perlu diajukan kepada pemilik produk saat ini.
Ini bukan persetujuan klinis, hukum, atau izin publikasi. Temuan baru saat
validasi tetap harus dicatat dan diputuskan, bukan diasumsikan sudah tercakup.
Sebelum coding, aturan yang disetujui tetap harus masuk ke
`docs/business-rules.md`; template dan hasil otomatis tidak boleh tersedia
untuk Parent sebelum gerbang ahli dan privasi di bawah terpenuhi.

- Target usia 2 bulan sampai sebelum 18 tahun; dataset awal 2–60 bulan saja.
  Usia di luar template terbit tidak mendapat hasil otomatis. Perluasan usia
  sekolah/remaja merupakan fase konten tersendiri, bukan perluasan ambang balita.
- Draft kedaluwarsa 30 × 24 jam sejak dibuat; hasil `COMPLETED` tidak ikut
  kedaluwarsa. Retensi produk ditargetkan sampai penghapusan akun Parent
  selesai, dengan pengecualian dan hak penghapusan lebih awal yang harus
  direview menurut aturan privasi/hukum.
- PDF untuk konsultasi dokter anak termasuk scope, tetap non-diagnostik,
  ekspor owner-only. UI shell tetap tersedia dalam tujuh locale, sedangkan
  konten screening rilis ini hanya tersedia dalam `id` dan `en`.
- **Alur privasi yang disetujui:** Parent dapat meminta hapus data screening
  tanpa menutup akun melalui kanal bantuan privasi, tanpa tombol hapus hasil
  individual pada rilis awal. Permintaan hapus akun dapat dibatalkan sebelum
  `PROCESSING`; bila Parent satu-satunya wali aktif, request tetap diterima
  sebagai `ACTION_REQUIRED` sampai serah-terima yang aman selesai. Detailnya
  ada di [plan penghapusan akun Parent](parent-account-deletion.md).
- **Gerbang ahli:** validasi tiap item dan kelompok usia, kebijakan usia
  koreksi prematur, pemaknaan hasil, serta penggunaan istilah “screening”
  tidak boleh diakali dengan konfigurasi admin. Sebelum lolos, UI memakai
  “Cek perkembangan anak” dan kasus prematur tidak mendapat hasil otomatis.
- **Gerbang privasi/hukum:** dasar dan durasi retensi tiap data, cara
  menyelesaikan permintaan hapus screening tanpa menutup akun, data anak
  tenant, tenggat penyelesaian, serah-terima wali, salinan backup/log, dan
  proses ekspor perlu ditetapkan di
  `docs/business-rules.md` sebelum implementasi publik.

## 11. Sumber untuk review konten

- [CDC, tonggak perkembangan usia 2 bulan sampai 5 tahun](https://www.cdc.gov/act-early/milestones/) — kerangka usia dan domain observasi; CDC sendiri menyatakan checklist ini bukan alat screening tervalidasi.
- [CDC, cara memakai checklist saat usia berada di antara dua daftar atau anak lahir prematur](https://www.cdc.gov/wic-guide/php/administer-milestone-checklists/four-simple-steps.html) — referensi operasional awal, perlu adaptasi/validasi untuk aplikasi.
- [AAP, penilaian keterlambatan perkembangan](https://www.healthychildren.org/English/ages-stages/toddler/pages/Assessing-Developmental-Delays.aspx) — domain dan kebutuhan screening formal berkala.
- [AAP, pengamatan motorik anak usia prasekolah](https://www.healthychildren.org/english/ages-stages/preschool/pages/movement-milestones-in-preschoolers.aspx) — contoh gerak kasar usia 3 tahun ke atas.
- [AAP, alat Bright Futures untuk remaja](https://www.aap.org/en/practice-management/bright-futures/bright-futures-materials-and-tools/bright-futures-tool-and-resource-kit/bright-futures-adolescence-tools/) — pengingat bahwa usia sekolah/remaja memerlukan rancangan konten dan privasi tersendiri; bukan izin menyalin formulir.
- [AAP, alat Bright Futures usia sekolah](https://www.aap.org/en/practice-management/bright-futures/bright-futures-materials-and-tools/bright-futures-tool-and-resource-kit/bright-futures-middle-childhood-tools/) — usia sekolah memiliki alur observasi tersendiri; formulir hanya untuk ditinjau, penggunaan di sistem elektronik memerlukan izin.
- [Kemenkes, Buku KIA Khusus Bayi Kecil](https://ayosehat.kemkes.go.id/buku-kia-khusus-bayi-kecil) — memakai usia koreksi sampai usia 2 tahun pada pemantauan bayi prematur; formula dan pemilihan template aplikasi tetap memerlukan persetujuan ahli.
- [CDC, gangguan pendengaran pada anak](https://www.cdc.gov/hearing-loss-children/about/index.html) — alasan pertanyaan respons suara dipisah dari kemampuan bicara.
- [ASHA, tonggak komunikasi dan batasan populasi bahasa](https://www.asha.org/public/developmental-milestones/creation-of-ashas-developmental-milestones/) — alasan tidak memakai cutoff kosakata bahasa Inggris pada anak Indonesia.
- [Kemenkes, jadwal dan pelaksana KPSP dalam Buku KIA](https://repositori-ditjen-nakes.kemkes.go.id/100/2/02Buku-KIA-06-10-2015-small.pdf) — pembanding alur layanan Indonesia, bukan izin menyalin atau menyebut bank ini sebagai KPSP.
- [WHO, batas penggunaan Global Scales for Early Development](https://www.who.int/teams/mental-health-and-substance-use/data-research/global-scale-for-early-development) — contoh penting bahwa skor perkembangan tingkat populasi tidak otomatis sah untuk diagnosis atau screening individu.

## Status implementasi bertahap

Fase fondasi teknis telah menyiapkan migration katalog global `V22`, migration data
Parent `V23`, rule catalog `V24`, link rule `V25`, snapshot narasi `V26`, entity/repository
JPA, dan service batch manual yang memvalidasi checksum, referensi katalog, konflik
kode/versi, serta kesesuaian manifest saat idempotent apply. Service batch tidak dipanggil
oleh startup, Flyway, deploy, restart, rollback, atau CI/CD. Runner terpisah tersedia
melalui `scripts/run-screening-seed.sh`; mode default hanya preview dan mode apply wajib
memakai batch ID serta konfirmasi operator. Dataset awal deterministik membuat 12 template
usia 2–60 bulan, 238 pertanyaan kandidat (166 butir perkembangan dan 72 konteks),
pilihan perkembangan satu jawaban serta konteks multi-select, rule, dan teks id/en sebagai
`DRAFT`; ini bukan persetujuan klinis dan tidak dapat digunakan Parent sebelum review,
pelengkapan locale, dan aksi publish Platform Admin. Service sesi dan completion tetap
owner-scoped serta mem-pin versi template/rule yang digunakan.
Evaluator deterministik internal juga sudah memiliki kontrak typed untuk empat status,
enam alasan, prioritas perubahan kemampuan, dan state incomplete. Migration `V24`
menyimpan rule set dan trigger bertipe; adapter menerima rule `PUBLISHED` atau `RETIRED`
yang sudah `APPROVED` agar sesi yang sudah berjalan tetap dapat diselesaikan, tanpa
expression atau script yang dapat dijalankan dari database. Migration `V25` mem-pin
`ruleSetId` pada template dan menyimpan `contextCode` terpisah dari `answerCode`; sesi
baru tidak dapat dimulai tanpa rule set published.

Fase completion internal kini menyiapkan transaksi penyelesaian owner-scoped: server
memeriksa sesi yang belum kedaluwarsa, versi template/rule yang dipin, pertanyaan wajib,
pilihan aktif, status review, serta teks katalog locale sesi. Bila butir wajib belum
lengkap, service hanya mengembalikan daftar ID yang kurang tanpa menulis hasil. Bila
lengkap dan narasi tersedia, service menyimpan satu hasil, ringkasan domain, alasan
bersumber, dan seluruh item jawaban secara atomik lalu menutup sesi `COMPLETED`.
Judul status, ringkasan, langkah berikutnya, disclaimer, teks butir/pilihan, dan teks
alasan disimpan sebagai snapshot sehingga UI/PDF tidak mengambil ulang redaksi katalog
terbaru. Service ini terhubung ke controller Parent dan export PDF snapshot dengan
`Cache-Control: no-store`; Staff, Staff Admin, serta Platform Admin tidak memiliki route
untuk membaca hasil Parent.

Penyimpanan draft mendukung batch jawaban atomik. Semua question/choice, kode konteks,
dan catatan divalidasi sebelum satu pun baris ditulis; question ID ganda atau satu
pilihan tidak aktif membatalkan seluruh batch. Batch kosong dan batch yang terlalu besar
ditolak, sementara sesi berubah dari `DRAFT` ke `IN_PROGRESS` hanya setelah validasi
lolos. Aksi complete tetap terpisah dari penyimpanan draft.

Daftar sesi owner-scoped menutup draft/in-progress yang sudah melewati `expiresAt`
menjadi `EXPIRED` sebelum dikembalikan, sehingga perangkat lain tidak melihat draft
lama sebagai sesi yang masih dapat dilanjutkan. Sesi `COMPLETED` tidak disentuh oleh
normalisasi expiry.

Konvensi teks katalog yang dipakai service internal harus diperlakukan sebagai kontrak
data, bukan string yang dirakit di client: resource `QUESTION` memakai `question.label`,
resource `CHOICE` memakai `choice.label`, sedangkan resource `TEMPLATE` menyimpan
`result.status.<STATUS>.title`, `.summary`, `.next_step`, `result.reason.<CODE>`, dan
`disclaimer.v1`. Semua key wajib tersedia pada locale sesi sebelum hasil dibuat; tidak
ada fallback bahasa atau kalimat hasil buatan client.

Daftar sumber adalah jejak riset awal per 9 Oktober 2026. Sebelum seed konten
produksi, cek versi terbaru, sumber primer per butir, hak pakai, validitas
bahasa/budaya, dan persetujuan ahli; perubahan sumber harus menghasilkan versi
template baru tanpa mengubah hasil lama.

Implementasi yang tersedia pada fase ini mencakup endpoint Parent owner-scoped,
profil global dan konteks anak tenant yang sudah terhubung, sesi draft 30 hari,
jawaban batch yang atomik termasuk pertanyaan multi-select, evaluator typed,
snapshot hasil, PDF owner-only, endpoint CRUD katalog Platform Admin, validasi
semua locale sebelum publish, serta runner seed manual idempotent. UI Parent
tersedia di `/parent-screening` dan UI katalog di `/screening-catalog`; keduanya
tetap tertutup oleh role server dan tidak membuka data screening ke Staff atau
Staff Admin. Dataset awal tetap `DRAFT` sampai gerbang review eksternal selesai.
Konten usia 61–215 bulan belum di-seed karena memerlukan bank sekolah/remaja,
privacy, dan review ahli tersendiri; infrastrukturnya sudah menerima rentang
usia tersebut melalui katalog Admin.

Ringkasan fase saat ini:

- Fase 0: aturan produk, batas non-diagnostik, dan gate review eksternal terdokumentasi;
  persetujuan klinis/privasi/hukum belum dapat digantikan oleh kode.
- Fase 1: skema, seed manual idempotent, CRUD katalog Platform Admin, validasi,
  review, publish/retire, dan hapus draft aman sudah tersedia.
- Fase 2: profil Parent, konteks anak terhubung, draft/resume, jawaban single/multi-select,
  evaluator, snapshot hasil, riwayat privat, dan PDF owner-only sudah tersedia.
- Fase 3: infrastruktur katalog sudah menerima usia 61–215 bulan, tetapi bank konten
  sekolah/remaja dan gerbang privasinya belum boleh dipublikasikan tanpa rancangan
  serta review terpisah.
