# Catatan perubahan — 2026-10-09

## Konteks

Menyusun rancangan fitur screening perkembangan anak berbasis kuesioner untuk Parent,
termasuk Parent yang belum memiliki tenant terhubung.

## Perubahan dokumentasi

- Menambahkan [plan screening Parent](../../plans/parent-child-developmental-screening.md).
- Plan menetapkan profil screening global yang terpisah dari `Child` tenant, hasil privat
  hanya untuk Parent pengisi, alur wizard, evaluasi server yang versioned,
  dan batasan bahwa checklist mandiri bukan diagnosis atau screening klinis tervalidasi.
- Riset tambahan dari CDC, AAP, ASHA, Kemenkes, dan WHO menghasilkan 12 daftar usia
  2–60 bulan dengan 166 kandidat butir terpisah pada domain bahasa, motorik kasar,
  motorik halus, kognitif, sosial-emosi, dan adaptif; 10 pertanyaan konteks;
  5 pertanyaan perhatian lintas usia; aturan jawaban `TIDAK_DIAMATI`; serta
  pemetaan alasan hasil dan contoh hasil yang dapat ditelusuri ke jawaban.
- Plan menjelaskan pemisahan checklist Parent dari KPSP, keterbatasan tonggak
  bahasa lintas budaya, kebutuhan memperhatikan prematuritas/pendengaran,
  dan validasi ahli sebelum konten dapat dipublish.
- Jumlah per sesi kini dijelaskan: 10–18 butir sesuai satu daftar usia ditambah
  6 pertanyaan konteks/perhatian, sehingga Parent mengisi 16–24 soal utama.
  Butir perkembangan memakai empat pilihan jawaban tunggal; konteks memakai
  pilihan tetap atau multi-select bila wajar. `ALERT` yang tumpang tindih
  diturunkan dari jawaban yang sama, bukan ditanyakan dua kali.
- Katalog hasil kini ditetapkan secara deterministik: satu dari empat status
  tindak lanjut utama, hingga enam ringkasan area sesuai template usia, serta
  enam kode alasan yang boleh muncul bersama dan menyimpan ID jawaban pemicu.
  Butir `KADANG`/`BELUM` mengarahkan diskusi sesuai area, `TIDAK_DIAMATI`
  berarti data kurang, kehilangan kemampuan mendapat prioritas tertinggi,
  dan tidak ada label diagnosis seperti “speech delay”.
- Seluruh konten kandidat, pilihan, terjemahan, konfigurasi hasil, dan aturan
  pemetaan direncanakan dalam tabel screening khusus. Flyway membuat skema;
  runner batch eksplisit yang idempotent per `seedBatchId` dan checksum
  mengisi katalog sebagai `DRAFT`, sementara publikasi memerlukan review dan
  aksi terpisah. Revisi konten membuat versi baru tanpa mengubah snapshot hasil
  Parent lama.
- Bootstrap awal tetap dijalankan satu kali per database. Protokol batch manual
  ber-ID dan berflag juga mengizinkan dataset besar/terkurasi ditambahkan di
  masa depan; penambahan konten rutin tetap dilakukan Platform Admin melalui
  UI katalog sebagai draft versi baru. Baris seed read-only, template
  terbit/pensiun immutable, dan
  editor draft memiliki preview sintetis, validasi locale screening aktif (`id` dan `en`), kontrol
  revisi, review metadata, serta publish/retire yang diaudit. Perubahan
  jenis aturan hasil yang belum didukung evaluator tidak boleh diterbitkan
  hanya dengan input UI. Keputusan terbaru menetapkan CRUD katalog lengkap
  Platform Admin sebagai bagian rilis awal, bukan fase opsional setelah Parent.
- UI Parent dirinci sebagai halaman pilih subjek/draft/riwayat, wizard enam
  tahap, dan hasil read-only. UI Platform Admin dirinci sebagai daftar,
  detail/riwayat versi, editor draft lima langkah untuk butir, hasil,
  pemetaan bertipe, dan terjemahan, preview/validasi, publish/retire,
  serta hapus draft manual yang belum dipakai. Empat kode status dan enam
  kode alasan tetap sebagai kontrak evaluator. Staff dan Staff Admin tidak
  memiliki layar atau akses screening. Rencana attach/merge, grant berbagi,
  serta endpoint share lama dikeluarkan dari scope; hasil anak yang sudah
  terhubung tenant tetap milik Parent pengisi saja.
- Enam pertanyaan konteks dan konfigurasi hasil yang berlaku lintas usia
  direncanakan sebagai katalog bersama berversi, dengan tab CRUD draft Admin;
  template usia mereferensikan versinya sehingga perubahan redaksi/aturan
  tidak diam-diam memengaruhi 12 template atau hasil yang sudah terbit.
- Keputusan lanjutan menetapkan target produk usia 2 bulan sampai sebelum 18
  tahun, tetapi 166 butir seed awal hanya untuk 2–60 bulan. Usia 61–215 bulan
  perlu bank, review, dan publikasi tersendiri; tidak ada hasil otomatis dari
  pertanyaan balita. Untuk prematuritas, hasil otomatis menunggu kebijakan
  usia koreksi yang disetujui ahli.
- Draft Parent kedaluwarsa tepat 30 × 24 jam sejak dibuat, ditandai
  `EXPIRED`, dan tidak bisa dilanjutkan; hasil `COMPLETED` tidak kedaluwarsa
  setelah 30 hari. Target retensi sampai hapus akun perlu review hukum untuk
  hak penghapusan lebih awal dan pengecualian yang berlaku.
- Ekspor PDF owner-only dari snapshot hasil final ditambahkan sebagai bahan
  konsultasi dokter anak, bukan diagnosis. Hasil dan PDF rilis ini mengikuti
  locale screening aktif (`id` atau `en`), sedangkan shell aplikasi tetap
  memiliki tujuh locale; file yang telah
  dibagikan ke luar aplikasi tidak dapat ditarik kembali.
- Menambahkan [plan penghapusan akun Parent](../../plans/parent-account-deletion.md)
  dengan alur Profil → Privasi & akun → Hapus akun, preflight dampak per
  kategori data, verifikasi ulang identitas, konfirmasi eksplisit, status
  request, gerbang keselamatan anak, dan pemisahan data screening milik
  Parent dari catatan operasional tenant. Privasi, retensi tenant, backup,
  serta handoff sole guardian tetap membutuhkan keputusan sebelum rilis.
- Pemilik produk menyetujui tiga pilihan lanjutan: Parent boleh membatalkan
  permintaan hapus akun sebelum `PROCESSING`; permintaan dari satu-satunya
  wali aktif diterima sebagai `ACTION_REQUIRED` sampai serah-terima aman;
  dan Parent boleh meminta hapus data screening tanpa menutup akun lewat
  kanal bantuan privasi, tanpa tombol hapus hasil individual pada rilis awal.
  Plan screening dan plan penghapusan akun diperbarui konsisten. Persetujuan
  ini belum menggantikan review ahli, privasi, dan prosedur operasional.
- Riset lanjutan menguatkan batas plan: checklist pengamatan bukan alat
  diagnosis, usia koreksi bayi prematur dipakai pada pemantauan hingga sekitar
  2 tahun tetapi aturan aplikasi perlu persetujuan ahli, usia sekolah/remaja
  memerlukan bank dan privasi tersendiri, dan retensi/penghapusan data anak
  tidak boleh ditentukan hanya dari status akun Parent. Kesimpulan yang
  dicatat: keputusan produk yang diketahui cukup jelas untuk desain teknis,
  tanpa menganggap review klinis/privasi sudah selesai atau menjamin tidak
  ada pertanyaan baru setelah validasi.
- Narasi hasil awal kini ditetapkan sebagai rangkaian fakta dari jawaban Parent,
  bukan penilaian perasaan atau diagnosis: judul objektif untuk empat status,
  klausa bersumber untuk enam alasan, tindakan yang sesuai status, disclaimer
  sama di UI/PDF, serta contoh anak 24 bulan dengan ID jawaban yang nyata.
  Redaksi bersumber dari katalog berversi, dapat diaudit ke snapshot, dan
  wajib ditinjau ahli klinis/privasi/bahasa beserta padanan locale screening
  aktif (`id` dan `en`)
  sebelum dipublish. PDF menggunakan narasi sama dan jawaban lengkap.
- Seed katalog screening awal ditetapkan sebagai bootstrap manual satu kali
  per database lingkungan setelah skema tersedia. Startup API, Flyway, deploy
  berikutnya, restart, rollback, dan pipeline rutin tidak menjalankannya.
  Penambahan rutin lewat draft `MANUAL` di UI Platform Admin; batch dataset
  besar/terkurasi baru boleh diterapkan kelak melalui runner manual terpisah,
  bukan otomatis saat deploy.
- Protokol batch masa depan menetapkan ID batch wajib, pratinjau tanpa mutasi,
  dan `SCREENING_SEED_APPLY=true` sementara hanya pada invocation runner
  yang disetujui. Manifest unik per batch menyimpan checksum/aktor/waktu;
  apply ulang yang identik no-op, konflik gagal atomik, dan batch baru hanya
  membuat versi `DRAFT` tanpa menimpa katalog atau hasil Parent lama.
- Fase fondasi dimulai dengan aturan normatif di `docs/business-rules.md`:
  Cek perkembangan tetap non-diagnostik dan privat untuk Parent, sementara
  ADHD tidak menjadi status atau diagnosis pada modul tersebut. Skrining ADHD,
  jika dibangun, harus menjadi modul perhatian/perilaku terpisah dengan
  instrumen tervalidasi/berizin, laporan lintas informan/lingkungan, review
  klinis/privasi, dan keluaran terbatas pada kebutuhan evaluasi profesional
  atau data belum lengkap.
- Keputusan produk ADHD: tidak menjadi kode status atau diagnosis pada
  checklist perkembangan ini. Jika dibangun, ADHD dibuat sebagai modul
  **Skrining perhatian dan perilaku** yang terpisah, memakai instrumen
  tervalidasi/berizin, laporan Parent dan informan lain bila tersedia,
  pertimbangan lintas lingkungan, serta review klinis. Keluaran modul itu
  hanya “perlu evaluasi profesional” atau state data belum lengkap; tidak boleh
  menampilkan “ADHD”, “tidak ADHD”, rekomendasi obat, atau terapi otomatis.

## Dampak implementasi

Fase fondasi teknis sekarang menambahkan migration Flyway `V22__screening_catalog_foundation.sql`
untuk katalog global dan manifest batch, entity/repository JPA, serta
`ScreeningSeedBatchService`. Service hanya menyediakan `preview` dan `apply` untuk
invocation eksplisit; tidak terdaftar sebagai `ApplicationRunner`, tidak dipanggil
oleh startup/deploy/Flyway. Endpoint dan UI ditambahkan pada fase lanjutan setelah
kontrak internal dinyatakan stabil; seed konten tetap terpisah karena memerlukan
review klinis, privasi, dan bahasa.
Model katalog menjaga provenance `SEEDED`/`MANUAL`, versi template, checksum,
optimistic revision, dan relasi terjemahan. Apply memvalidasi referensi, menolak
duplikasi kode/versi, mencatat manifest, serta mengembalikan `ALREADY_APPLIED` hanya
ketika checksum dan jumlah baris katalog sesuai; manifest parsial atau checksum
berbeda ditolak.

Fase lanjutan menambahkan migration Flyway `V23__screening_parent_data_foundation.sql`
untuk profil subjek global milik Parent, sesi berversi dengan masa draft 30 hari,
jawaban mentah, dan snapshot hasil/domain/alasan/item. Repository membatasi query
dasar dengan `ownerUserId`; sesi memakai constraint database bahwa scope global
memiliki `organizationId` dan `childId` sama-sama null atau keduanya terisi.
`ScreeningParentProfileService` sekarang menyediakan operasi internal create/list/update/
archive yang hanya menerima Parent terdaftar, menormalisasi nama, menolak tanggal lahir
masa depan, dan tidak menerima tenant ID. Belum ada endpoint, evaluator, authorization
route, PDF, atau UI yang membuat/membaca data ini.

`ScreeningSessionService` menambahkan lifecycle internal untuk membuat draft dari template
`PUBLISHED`, memilih satu dari locale screening aktif (`id` atau `en`), memeriksa rentang usia dan
usia koreksi prematur, mengatur expiry 30 hari, serta menyimpan jawaban hanya jika
pertanyaan dan pilihan aktif berasal dari template sesi yang sama. Sesi kedaluwarsa
ditutup sebelum jawaban ditolak; penyelesaian sesi kini ditangani service completion
internal terpisah yang mensyaratkan evaluator, rule set reviewed, dan snapshot narasi
lengkap.

`ScreeningEvaluationService` sekarang menjadi evaluator deterministik yang menerima
rule set bertipe, daftar pertanyaan wajib, dan snapshot jawaban. Ia menghasilkan
`incomplete` tanpa status bila ada butir wajib yang belum dijawab, atau tepat satu
status utama dengan alasan yang dapat ditelusuri ketika lengkap. Prioritas perubahan
kemampuan, diskusi, pengamatan, dan kemampuan yang dilaporkan terlihat mengikuti
kontrak empat status; evaluator tidak menghitung skor risiko, membuat diagnosis,
menulis narasi, atau mengenali ADHD. Service ini dipanggil hanya oleh completion
internal setelah snapshot katalog lolos validasi.

Migration `V24__screening_rule_catalog_foundation.sql` dan entity/repository rule set
menyimpan trigger `ANSWER`/`CONTEXT` bertipe tanpa expression bebas. Adapter evaluator
menerima rule set berstatus `PUBLISHED` atau `RETIRED` yang `APPROVED`; draft atau rule
yang belum lolos review tidak dapat menjadi konfigurasi evaluasi. Rule retired hanya
untuk sesi yang sudah dimulai, bukan untuk membuat sesi baru.

Migration `V25__screening_evaluation_links.sql` menghubungkan template ke rule set yang
dipin saat sesi dibuat dan memisahkan `contextCode` dari `answerCode`. Sesi baru menolak
template published yang belum memiliki rule set; ini mencegah draft atau template tanpa
aturan evaluasi menghasilkan sesi yang tampak siap disubmit.

Fase completion internal menambahkan migration `V26__screening_result_narrative_snapshots.sql`
dan `ScreeningCompletionService`. Penyelesaian tetap owner-scoped dan transactional:
template/rule set yang dipin harus published atau retired untuk sesi yang sudah berjalan,
rule set tetap approved, pertanyaan wajib harus lengkap, semua pilihan harus aktif, dan
semua pertanyaan/pilihan/narasi locale sesi harus memiliki teks katalog yang tidak kosong.
Sesi incomplete mengembalikan ID butir yang kurang tanpa membuat hasil. Sesi lengkap
menyimpan snapshot judul status, ringkasan, langkah berikutnya, disclaimer, alasan,
dan seluruh jawaban, beserta ringkasan domain; pengulangan complete mengembalikan
snapshot yang sama tanpa menulis ulang. Controller Parent, export PDF, runner seed,
dan UI publik ditambahkan pada fase implementasi berikutnya dengan gerbang publish
yang tetap tertutup sampai review eksternal.

`ScreeningSessionService` juga menerima batch jawaban draft. Batch memvalidasi seluruh
question/choice/konteks/catatan lebih dulu, menolak question ID duplikat atau satu
pilihan tidak aktif tanpa memanggil `saveAll`, lalu menulis semua jawaban sekaligus dan
baru mengubah sesi `DRAFT` menjadi `IN_PROGRESS`. Aksi batch ini tetap bukan submit dan
tidak menghasilkan status atau notifikasi.

Daftar sesi sekarang juga menormalisasi draft/in-progress yang melewati `expiresAt`
menjadi `EXPIRED` secara owner-scoped; sesi `COMPLETED` tidak ikut berubah.

Kontrak key teks yang dipakai completion dicatat untuk mencegah seed/UI membuat
narasi sendiri: `QUESTION/question.label`, `CHOICE/choice.label`, serta
`TEMPLATE/result.status.<STATUS>.title|summary|next_step`,
`TEMPLATE/result.reason.<CODE>`, dan `TEMPLATE/disclaimer.v1`. Semua key harus
lengkap pada locale sesi; tidak ada fallback bahasa atau string buatan client.

Route/API/UI fase Parent dan katalog Platform Admin kini tersedia: Parent memakai
`/v1/parent/screening` dan `/parent-screening`, sedangkan Platform Admin memakai
`/v1/platform/screening` dan `/screening-catalog`. Seeder awal tidak berjalan saat
startup; operator memakai `scripts/run-screening-seed.sh` dengan preview default dan
flag apply eksplisit. Seed membuat DRAFT kandidat usia 2–60 bulan saja. Publish tetap
terkunci oleh review rule/question, kelengkapan katalog, dan persetujuan eksternal.

## Verifikasi

- Review lokal terhadap `CLAUDE.md` dan `docs/business-rules.md`.
- Sumber primer ditautkan dekat aturan yang didukung dan dikumpulkan pada bagian
  sumber plan. Jumlah ID kandidat serta struktur usia/domain diperiksa secara lokal.
- Matriks status, alasan, urutan prioritas, dan pemetaan jawaban ditinjau terhadap
  batas non-diagnostik pada panduan CDC/ASHA; review ahli lokal tetap diperlukan
  sebelum template atau teks hasil dipublish.
- Pola skema Flyway dan seeder kurikulum opsional di repo diperiksa; rancangan
  screening menggunakan seeder khusus karena konten dan hasilnya tidak sama
  dengan Program Perkembangan tenant.
- Fase implementasi dan kriteria penerimaan dokumentasi diperluas untuk
  provenance seed/manual, CRUD Admin, pemisahan API authoring dari API
  Parent, penolakan akses seluruh role tenant, immutability versi, validasi
  sebelum terbit, dan non-regresi hasil lama.
- Konsistensi plan ditinjau ulang untuk batas usia, masa berlaku draft,
  ekspor PDF, seluruh locale, dan alur penghapusan akun. Tidak ada
  perubahan pada route/UI, data runtime, seed konten, atau aturan normatif
  yang berjalan; migration fondasi katalog ditambahkan terpisah.
- Tiga pilihan produk baru diverifikasi terhadap state lifecycle dan batas
  data Parent/tenant; gerbang persetujuan eksternal tetap ditandai terbuka.
- Narasi ditinjau terhadap panduan CDC mengenai pemisahan checklist
  pengamatan dari skrining tervalidasi; kriteria golden snapshot ditambahkan
  untuk status, alasan, jawaban tidak diamati/tidak pasti, dan PDF.
- Alur deploy yang ada diperiksa: Flyway berjalan saat startup API, sedangkan
  seed kurikulum lain dapat diaktifkan dengan flag. Plan screening sengaja
  tidak mengikuti pola seed startup itu; kriteria penerimaan bootstrap awal,
  batch baru manual berflag, dan deploy tanpa seed tambahan ditambahkan.
- Aturan bisnis screening dan batas modul ADHD tetap menjadi kontrak normatif
  sebelum API, seeder konten, atau UI dibuat. Migration, entity, repository,
  service batch, entity Parent, dan unit test fondasi ditambahkan setelah aturan tersebut disepakati;
  tidak ada data runtime yang di-seed.
- `./apps/api/gradlew -p apps/api compileKotlin --no-daemon` lulus.
- `./apps/api/gradlew -p apps/api test --tests com.daycare.api.service.ScreeningSeedBatchServiceTest --no-daemon` lulus.
- `./apps/api/gradlew -p apps/api test --tests com.daycare.api.service.ScreeningParentProfileServiceTest --tests com.daycare.api.service.ScreeningSeedBatchServiceTest --no-daemon` lulus.
- `./apps/api/gradlew -p apps/api test --tests com.daycare.api.service.ScreeningSessionServiceTest --no-daemon` lulus.
- `./apps/api/gradlew -p apps/api test --tests com.daycare.api.service.ScreeningEvaluationServiceTest --no-daemon` lulus.
- `./apps/api/gradlew -p apps/api test --no-daemon` lulus setelah V24 dan adapter rule catalog ditambahkan.
- `./apps/api/gradlew -p apps/api test --no-daemon` lulus setelah V25 dan link rule set ditambahkan.
- `./apps/api/gradlew -p apps/api test --no-daemon` lulus setelah V23 dan entity Parent ditambahkan.
- `./apps/api/gradlew -p apps/api test --tests com.daycare.api.service.ScreeningCompletionServiceTest --tests com.daycare.api.service.ScreeningEvaluationServiceTest --no-daemon` lulus setelah completion dan snapshot narasi ditambahkan.
- `./apps/api/gradlew -p apps/api test --tests com.daycare.api.service.ScreeningSessionServiceTest --no-daemon` lulus setelah batch draft atomik ditambahkan.
- `./apps/api/gradlew -p apps/api test --no-daemon` lulus setelah reason fallback, snapshot completion, batch draft, normalisasi expiry, controller, export PDF, dan seed runner diperbarui.
- Full backend test dan JaCoCo dijalankan ulang pada 2026-10-10 setelah perluasan
  test layanan. Hasil terbaru: line 92,62% dan branch 80,26%; angka ini belum
  memenuhi gate coverage rilis backend minimal 90% untuk keduanya. Typecheck
  API-client/mobile, verifikasi database lokal, review klinis/hukum,
  device/browser, dan publish katalog tetap merupakan gate terpisah sebelum rilis
  publik.

## Addendum implementasi fase berikutnya — 2026-10-10

- Parent route `/v1/parent/screening` dan `/parent-screening` sekarang mendukung
  profil global, anak tenant yang legal sebagai konteks, draft/resume, multi-select
  konteks, penyimpanan batch, completion snapshot, riwayat privat, dan PDF owner-only.
- Platform Admin memiliki `/v1/platform/screening` dan `/screening-catalog` untuk
  membuat, mengubah, memvalidasi, review, publish, retire, dan menghapus draft
  katalog. Publish memerlukan rule/question review dan seluruh locale yang didukung.
- Seed awal manual menghasilkan 12 template usia 2–60 bulan, 238 pertanyaan
  (166 perkembangan + 72 konteks), 964 pilihan, rule typed, dan teks id/en sebagai
  `DRAFT`. Tidak ada startup/deploy seeder otomatis; `scripts/run-screening-seed.sh`
  wajib dipanggil operator dengan batch ID dan konfirmasi apply.
- CTX-03 dan CTX-04 disimpan sebagai `MULTI_CHOICE`; kode pilihan dinormalisasi
  server dalam urutan katalog, dievaluasi secara fail-closed, dan label snapshot
  digabungkan ke hasil/PDF.
