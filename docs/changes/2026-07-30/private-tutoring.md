# Les privat berbasis profil anak

## Perubahan

- Menambahkan layanan les privat per cabang yang dikelola `STAFF_ADMIN`: rentang usia, Tingkatan yang sesuai, durasi, harga per sesi, status aktif, dan daftar tutor.
- Tutor mendukung akun `STAFF` tenant aktif atau tutor eksternal. Form dibuat sebagai layar turunan, bukan form inline, sehingga pengelolaan data tetap konsisten dengan navigasi aplikasi.
- Parent membuka **Les privat** dari Home, memilih anak yang terhubung, lalu hanya melihat layanan yang cocok dengan cabang, penempatan Tingkatan aktif, dan usia anak.
- Parent mengirim pengajuan satu sesi dengan waktu pilihan dan catatan opsional. Staff Admin menyetujui dengan tutor dan jadwal, atau menolak dengan alasan wajib.
- Persetujuan membuat invoice `PRIVATE_TUTORING`; alur instruksi transfer, bukti pembayaran, dan verifikasi memakai invoice API yang sama. Pembayaran terverifikasi mengonfirmasi sesi, sedangkan invoice lewat jatuh tempo membatalkan pengajuan.
- Menambahkan tabel Flyway untuk layanan, relasi Tingkatan, tutor, relasi tutor, dan pengajuan, plus endpoint dan API client bertipe.
- Menambahkan invalidasi query realtime untuk flag `PRIVATE_TUTORING` dan melengkapi tipe hasil endpoint seed kurikulum global yang sebelumnya belum didefinisikan di API client.

## Aturan dan dampak

- Les privat tersedia untuk Daycare, PAUD, dan TK tanpa capability `DAYCARE_OPERATIONS` serta tidak mengonsumsi kredit paket atau membuat booking Daycare.
- Jadwal divalidasi terhadap benturan tutor pada sesi yang menunggu pembayaran atau sudah dikonfirmasi. Jadwal ditafsirkan dalam zona waktu cabang.
- Parent dapat membatalkan pengajuan selama invoice belum masuk pemeriksaan bukti. Tidak ada kontak tutor yang diekspos kepada Parent.
- Perubahan status mengirim inbox, Expo push bila perangkat penerima terdaftar, dan invalidasi realtime `PRIVATE_TUTORING`.

## Verifikasi

- Lulus `corepack pnpm verify` (lint, typecheck, dan seluruh test TypeScript/mobile).
- Lulus `JAVA_HOME=$(/usr/libexec/java_home -v 21) gradle -p apps/api compileKotlin --no-daemon`.
- Lulus seluruh test Spring: `JAVA_HOME=$(/usr/libexec/java_home -v 21) gradle -p apps/api test --no-daemon`, termasuk `PrivateTutoringServiceTest` untuk pencocokan usia dan Tingkatan.
