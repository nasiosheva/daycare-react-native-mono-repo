# Pengingat penutupan jam operasional

## Perubahan

- Pengingat lokal native 30 menit sebelum `closesAt` cabang, memakai zona waktu
  cabang dan paling banyak satu jadwal per cabang per hari aktif.
- Hanya untuk Parent dengan anak aktif terhubung dan Staff Admin aktif di
  Android/iOS. Web, Staff biasa, Platform Admin, dan Parent onboarding tidak
  mendapat kontrol ini.
- Switch **Pengingat jam tutup** ada di Bottom Sheet pengaturan Notifikasi,
  default aktif, disimpan per perangkat (SecureStore), terpisah dari jeda push
  dan inbox. Tombol **Terapkan** hanya aktif bila ada perubahan; bila izin OS
  belum diberikan, sheet menampilkan petunjuk tanpa memaksa prompt.
- Sumber jam: Parent memakai `parentOperatingHoursAllTenants`; Staff Admin
  memakai cabang aktif tenant dan `branchOperatingHours` per cabang (cabang
  yang gagal dimuat dilewati).
- Penjadwalan memakai helper bersama `scheduleLocalNotification` /
  `cancelLocalNotification`. Horizon 14 hari dan maksimal 40 jadwal (yang
  paling dekat didahulukan) agar tetap di bawah batas 64 notifikasi terjadwal
  iOS bersama pengingat Staff.
- Logout (`AuthProvider.signOut`) membatalkan seluruh jadwal pengingat
  penutupan di perangkat.
- i18n: objek `operationalCloseReminderTranslations` untuk ketujuh locale
  (label, deskripsi, petunjuk izin, judul, dan isi notifikasi).

## Verifikasi

- `pnpm verify` lulus: lint (0 error), typecheck, dan 141 test mobile, termasuk
  `operationalCloseReminder.test.ts` (zona waktu cabang, dedupe cabang, jam
  tidak valid/lewat, batas jadwal, batas default di bawah limit iOS).
- Uji perangkat: belum.

## Batasan

Jadwal direkonsiliasi saat layar Notifikasi dibuka atau pengaturan diterapkan.
Pengguna yang belum pernah membuka layar Notifikasi setelah memasang versi ini
belum memiliki jadwal walaupun nilai awalnya aktif. Perubahan jam cabang
berlaku pada rekonsiliasi berikutnya. Jika permission OS belum diberikan,
aplikasi tidak membuat jadwal.
