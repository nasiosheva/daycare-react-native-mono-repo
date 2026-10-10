# Plan: Parent menghapus akun

Status: rancangan produk dan teknis, belum perubahan `docs/business-rules.md`,
kontrak API, database, atau UI. Implementasi harus menunggu review privasi,
keamanan anak, dan kewajiban retensi yang berlaku. Plan ini melengkapi
[Cek perkembangan anak](parent-child-developmental-screening.md); seluruh
aturan tenant yang sudah ada di `docs/business-rules.md` tetap berlaku.

## 1. Tujuan dan batas

Parent dapat memulai penghapusan **akun global miliknya sendiri** dari Profil,
termasuk bila ia belum terhubung ke tenant. Penghapusan bukan “keluar dari satu
tenant”, bukan menghapus akun anak milik lembaga, dan bukan menghapus akun Google
atau nomor telepon di penyedia identitas. Jangan tampilkan aksi ini untuk
Staff, Staff Admin, atau Platform Admin tanpa aturan bisnis tersendiri.

Target retensi data screening ialah tetap tersedia sampai penghapusan akun
Parent selesai. Ini **bukan** alasan menolak hak penghapusan data yang mungkin
berlaku lebih awal atau meniadakan pengecualian retensi menurut hukum. Permintaan
privasi di luar alur hapus akun harus memiliki kanal penanganan yang nyata;
Parent dapat mengajukan **permintaan hapus data screening tanpa menghapus
akun** melalui kanal bantuan privasi, bukan tombol hapus hasil individual
pada rilis awal. Status dan pemrosesan permintaan itu harus terlacak secara
internal; jangan menjanjikan penghapusan otomatis saat permintaan dikirim.
Keputusan jenis data, dasar retensi, dan tenggat penyelesaian perlu ditetapkan
oleh penanggung jawab privasi sebelum implementasi. Jangan menjanjikan
“seluruh data hilang seketika” atau masa retensi hukum yang belum disetujui.

## 2. Inventaris dan klasifikasi dampak

Server membuat **preflight owner-only** yang memisahkan tiga kelompok, bukan
sekadar menghitung jumlah baris:

| Kelompok | Rencana pada penyelesaian | Batas yang harus dijelaskan ke Parent |
| --- | --- | --- |
| Data akun global Parent, kredensial aplikasi, sesi/token, preferensi, profil keluarga | Hapus atau anonimisasi sesuai kebutuhan integritas dan kewajiban hukum; cabut akses ke semua tenant. | Akun tidak bisa dipulihkan lewat login biasa setelah `COMPLETED`. Akun Google/nomor di penyedia identitas tidak ikut terhapus. |
| Profil screening global, draft aktif/kedaluwarsa, jawaban, hasil, referensi sesi anak tenant milik Parent | Hapus dari data aktif setelah proses aman; jangan biarkan FK menggantung atau menghapus sesi Parent lain. PDF di server hanya sementara dan dibersihkan. | File PDF yang sudah diunduh/dikirim ke luar aplikasi tidak dapat ditarik kembali. |
| Data operasional tenant: Child, relasi wali, kehadiran, invoice/pembayaran, consent/insiden/riwayat layanan, chat, dan catatan audit | **Tidak otomatis dihapus bersama akun Parent.** Cabut atau de-identifikasi relasi Parent bila aman; tiap record mengikuti otoritas tenant, kebutuhan keselamatan anak, dan kebijakan retensinya. | Penghapusan akun tidak berarti catatan sekolah/daycare atau kewajiban yang sah ikut hilang. Akses Parent ke data ini berakhir; wali/tenant yang berwenang dapat tetap memerlukan catatan sesuai aturan. |

Inventaris tabel, storage, cache, indeks pencarian, file sementara, job,
realtime, Firebase linkage, dan backup harus diverifikasi terhadap implementasi
nyata sebelum kode dibuat. Jangan menghapus `Child` tenant, data guardian lain,
atau histori pembayaran/insiden hanya karena Parent pengisi menghapus akun.
Data screening untuk anak tenant dimiliki Parent pengisi; sesi milik Parent
lain pada anak yang sama tetap utuh.

## 3. Gerbang keselamatan dan hak Parent

Preflight menampilkan status hubungan tenant per sumber tanpa membocorkan data
tenant lain. Ia menandai kebutuhan penanganan seperti Parent satu-satunya wali
aktif untuk anak yang sedang dilayani, otorisasi jemput, kontak darurat, care
aktif, atau kewajiban finansial yang memerlukan identitas/komunikasi. Ini bukan
alasan menyembunyikan tombol penghapusan. **Jika Parent satu-satunya wali aktif**,
request tetap diterima sebagai `ACTION_REQUIRED` sampai serah-terima yang
aman selesai; UI menunjukkan status, langkah konkret, dan jalur kontak aman
kepada tenant/penanggung jawab privasi. Jangan menonaktifkan Parent diam-diam
saat anak belum memiliki pengganti wali yang sah. Risiko lain yang memerlukan
penanganan juga dapat menghasilkan `ACTION_REQUIRED`. Bila hubungan tenant belum bisa
dinilai karena query gagal, preflight menyatakan **belum dapat memastikan**
dan tidak menampilkan keadaan aman palsu.

**Parent dapat membatalkan request berstatus `REQUESTED` atau
`ACTION_REQUIRED` sebelum masuk `PROCESSING`.** Pembatalan tidak menghapus
akun atau data dan harus langsung mengubah status menjadi `CANCELLED` di server.
Kebijakan akhir masih harus menentukan kapan data tenant boleh
dide-identifikasi, cara menangani kebutuhan akses anak/guardian lain, dan
penyelesaian request yang tertahan tanpa waktu tak terbatas. Review
hukum/privasi harus mencakup hak
akses dan penghapusan data pribadi, pengecualian retensi, serta kewajiban
komunikasi; keputusan teknis tidak menggantikan nasihat hukum.
Rujukan awal untuk review Indonesia adalah [UU No. 27 Tahun 2022 tentang
Pelindungan Data Pribadi](https://jdih.komdigi.go.id/produk_hukum/view/id/832/t/undangundang%2Bnomor%2B27%2Btahun%2B2022?search=nanti+kita+harus+tetap+menjaga),
terutama ketentuan penghapusan/pemusnahan dan pengecualiannya; penerapan
spesifik pada seluruh kategori data harus diputuskan oleh penanggung jawab
privasi/hukum, bukan diasumsikan oleh UI.

## 4. Alur UI Parent

Di **Profil → Privasi & akun**, Parent juga melihat **Ajukan permintaan
privasi** untuk meminta penghapusan data screening tanpa menutup akun.
Form bantuan ini menjelaskan bahwa pengajuan akan ditinjau, memberi tanda
terima/status, dan tidak menghapus data saat tombol kirim ditekan. Kanal ini
tidak memberi Platform Admin katalog akses langsung ke hasil Parent.

Entry point **Profil → Privasi & akun → Hapus akun** membuka halaman penuh,
bukan tombol sekali tekan. Gunakan `MultiStepFormWizard` bersama untuk tiga
langkah yang saling bergantung, lengkap dalam tujuh locale aplikasi:

1. **Lihat dampaknya.** Preflight dari server memisahkan data yang akan
   dihapus dari data tenant yang mungkin tetap ada, menunjukkan hal yang
   membutuhkan tindakan, termasuk file PDF yang pernah diunduh. Status
   loading/error/retry tidak disamakan dengan “tidak ada hambatan”.
2. **Verifikasi identitas.** Minta autentikasi ulang yang masih baru melalui
   metode login yang didukung akun; jangan mengandalkan token lama atau
   password yang diketik ulang tanpa verifikasi server. Jika sesi bukan
   milik Parent atau verifikasi gagal, jangan lanjut. Tidak ada autofill
   kata sandi ke log/analytics.
3. **Tinjau dan ajukan.** Jelaskan apa yang langsung berakhir, apa yang
   menunggu proses, dan jalur bantuan. Parent memberi konfirmasi eksplisit
   dengan label yang menyebut **hapus akun**, bukan “Simpan/OK” generik.

Sesudah submit, tampilkan nomor/status request dan apa yang harus dilakukan
jika `ACTION_REQUIRED`. Tawarkan **Batalkan permintaan** hanya sebelum
`PROCESSING`, dengan konfirmasi dan status terbaru dari server; setelah
`PROCESSING` dimulai, aksi itu tidak tersedia. Saat `PROCESSING`, hindari
tombol submit ulang.
Status `COMPLETED` mengakhiri sesi lokal, menutup WebSocket, dan mengarahkan
ke Sign In dengan penjelasan bahwa akun telah dihapus. Pemberitahuan
penyelesaian di luar akun (mis. email) hanya boleh dipakai bila kanalnya
terverifikasi dan kebijakan penyimpanan alamat untuk pemberitahuan disetujui.
Jika gagal, beri status dan jalur dukungan tanpa memperlihatkan rincian data
anak lewat push, email, atau halaman publik. Aksesibilitas, error per langkah,
dan back-navigation mengikuti wizard baseline; tidak ada draft wizard yang
berisi password tersimpan di perangkat.

## 5. Lifecycle, API, dan pemrosesan

Status konseptual: `REQUESTED` → `ACTION_REQUIRED` bila perlu handoff aman,
kemudian `PROCESSING` setelah gerbang diselesaikan; request tanpa hambatan
dapat langsung masuk `PROCESSING` → `COMPLETED`. Kegagalan yang bisa diperbaiki menjadi
`FAILED` dengan alasan internal dan panduan umum bagi Parent. `CANCELLED`
diizinkan dari `REQUESTED` atau `ACTION_REQUIRED` sebelum `PROCESSING`, tidak
dari `PROCESSING`/`COMPLETED`; request yang sudah dibatalkan tidak otomatis
diproses ulang. State dan
transisi authoritative berada di backend, bukan ditentukan UI.

Kontrak konseptual owner-only (prefix akhir mengikuti API baseline):

- `GET /parent/account-deletion/preflight` — ringkasan dampak dan gerbang
  keselamatan berdasarkan seluruh membership yang sah; tidak mengekspos
  informasi anak/tenant di luar otoritas Parent.
- `POST /parent/account-deletion/requests` — membuat request dengan bukti
  re-auth yang masih berlaku, versi pemberitahuan dampak, dan idempotency key.
- `GET /parent/account-deletion/requests/current` — status terbatas milik
  pemohon selama akun masih dapat dipakai; lookup pasca-hapus memakai kanal
  aman terpisah, bukan token akun yang sudah dicabut.
- `POST /parent/account-deletion/requests/{id}/cancel` — owner-only, hanya
  dari `REQUESTED`/`ACTION_REQUIRED`, dengan transisi atomik agar pembatalan
  tidak berlomba dengan job yang mulai `PROCESSING`.

Server harus menolak request pihak lain, memvalidasi ulang seluruh tenant dan
preflight pada saat submit serta tepat sebelum pemrosesan, melindungi dari
double submit/retry dengan idempotensi, rate limit, dan audit minimal.
Permintaan dari web memerlukan perlindungan CSRF sesuai mekanisme auth yang
dipakai. Jangan memproses sebagian lalu menyatakan `COMPLETED`: job harus
resumable/idempotent dengan jejak langkah dan kompensasi yang jelas.

Pada penyelesaian, nonaktifkan identitas aplikasi, cabut seluruh sesi/JWT
termasuk refresh/blacklist yang relevan, tutup koneksi WebSocket dan tolak
request baru. Hapus/anonymize data milik Parent dalam scope yang disetujui,
termasuk screening, lalu verifikasi tidak ada owner-visible record aktif
tersisa. Referensi histori tenant menggunakan tombstone non-PII bila perlu
menjaga FK/audit. Akun provider eksternal tidak dihapus; tautan provider
ke identitas aplikasi dilepas dengan cara yang tidak memungkinkan akun lama
hidup lagi diam-diam saat Parent mendaftar ulang.

Backup dan log tidak dapat diperlakukan seperti tabel aktif: tetapkan umur
backup, pembatasan akses, redaksi log, dan mekanisme agar restore tidak
menghidupkan kembali akun/data terhapus. Jangan masukkan jawaban screening
atau identitas anak ke log, audit, analytics, dan notifikasi. Hapus file PDF
sementara server, tetapi jangan mengklaim bisa menghapus salinan yang sudah
ada di perangkat Parent/dokter.

## 6. Aturan bisnis, fase, dan verifikasi sebelum rilis

Sebelum coding, tambahkan bab **penghapusan akun Parent** ke
`docs/business-rules.md`: kepemilikan data global vs tenant, hak meminta
hapus, status dan SLA yang disetujui, gerbang anak aktif, hasil screening,
retensi/pengecualian, backup, notifikasi, re-auth, serta kemampuan tiap role.
Jika keputusan privasi bertentangan dengan aturan tenant saat ini, minta
keputusan produk eksplisit; plan ini tidak otomatis mengubah hak Staff/Admin.

Urutan implementasi: (0) inventaris data dan review legal/privasi/keselamatan;
(1) kontrak dan migrasi additive untuk request/status/tombstone;
(2) service idempotent, auth revocation, cleanup dan pemulihan kegagalan;
(3) UI wizard Parent dan dukungan status; (4) pengujian/observability
tanpa data sensitif. Jangan rilis tombol sebelum backend dan prosedur
operasional untuk `ACTION_REQUIRED` siap.

Kriteria penerimaan minimum:

- Parent tanpa tenant dan Parent lintas tenant dapat meminta hapus; role lain,
  akun lain, ID tampering, dan token lama ditolak.
- Gagal memuat satu tenant tidak menghasilkan preflight “aman”; sole guardian,
  pickup, care aktif, dan kewajiban yang relevan masuk review aman.
- Double submit, retry job, logout di tengah proses, dan crash pemroses tidak
  membuat state ambigu atau menghapus data Parent lain.
- Pembatalan `REQUESTED`/`ACTION_REQUIRED` berhasil tanpa menghapus data;
  cancel yang berlomba dengan `PROCESSING` ditolak jelas dan tidak menghasilkan
  proses setengah selesai. Request sole guardian tetap terlihat dan tertahan
  sampai handoff aman, bukan ditolak atau diselesaikan diam-diam.
- Akun `COMPLETED` tidak dapat login atau membuka socket; data screening
  miliknya hilang dari DB aktif, sementara Child dan riwayat tenant/guardian
  lain tetap sesuai kebijakan yang disetujui.
- PDF yang dibuat lagi setelah `COMPLETED` ditolak; salinan eksternal tidak
  diklaim terhapus. Backup restore diuji agar tidak menghidupkan data lama.
- Seluruh tujuh locale menjelaskan dampak yang sama dan lulus aksesibilitas;
  test backend/API, UI, dan prosedur manual dilaporkan terpisah.

## 7. Gerbang keputusan yang belum tuntas

Pilihan produk tentang cancel sebelum `PROCESSING`, menerima request sole
guardian sebagai `ACTION_REQUIRED`, dan kanal permintaan hapus screening
terpisah **sudah disetujui**. Tidak ada pertanyaan produk tambahan yang
diketahui saat ini, tetapi persetujuan itu bukan izin untuk mengaktifkan
penghapusan. Penanggung jawab privasi/hukum bersama pemilik
produk masih harus menetapkan dasar retensi setiap kelompok tenant, waktu
penyelesaian, prosedur menilai permintaan hapus data tanpa hapus akun,
kebijakan backup/restore, dan tata cara handoff wali yang aman. Review ini wajib sebelum
`docs/business-rules.md` diubah menjadi aturan final atau tombol diaktifkan.
