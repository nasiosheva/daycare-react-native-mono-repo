# Kesiapan registrasi push native

## Perubahan

- Menambahkan konfigurasi publik `EXPO_PUBLIC_EXPO_PROJECT_ID` untuk request
  Expo push token pada Android/iOS.
- `NativeNotificationRegistration` sekarang mengirim `projectId` secara
  eksplisit ke `expo-notifications` sebelum mendaftarkan token ke API.
- Launcher native memberi warning dan melewati registrasi Expo bila project ID
  belum ada, sehingga flow WebSocket lokal tetap dapat dijalankan. Web tidak
  memerlukan nilai ini.
- Kegagalan registrasi tetap tidak memblokir aplikasi, tetapi dicatat aman di
  log development tanpa mencetak token atau kredensial.

## Akar masalah dan keputusan transport

Expo SDK 53 mewajibkan EAS/Expo project UUID pada
`getExpoPushTokenAsync`. Sebelumnya aplikasi tidak mengirim UUID dan menelan
exception, sehingga `registerDevice` tidak pernah dipanggil. Konfigurasi ini
tetap diperlukan untuk notifikasi native non-chat yang masih memakai Expo.

Untuk chat, transport default saat ini adalah Expo push bersama invalidation
WebSocket. `CHAT_NOTIFICATION_TRANSPORT=WEBSOCKET` tetap tersedia untuk
lingkungan yang sengaja mematikan push OS; nilai `FIREBASE` masih merupakan
alias kompatibilitas ke jalur token Expo, bukan FCM token mentah.

`EXPO_PUBLIC_EXPO_PROJECT_ID` tetap harus berisi UUID project Expo/EAS yang
nyata bila notifikasi native non-chat digunakan; `project_id` dari Firebase
tidak valid untuk nilai ini. Setelah nilai diisi pada environment native,
build ulang aplikasi diperlukan karena konfigurasi publik dibundel ke binary.

## Verifikasi

- Memeriksa source `expo-notifications` SDK 53 yang mewajibkan `projectId`.
- Memeriksa konfigurasi Expo saat ini yang belum memiliki `extra.eas.projectId`.
- Menetapkan WebSocket sebagai transport chat aktif dan menyediakan switch
  backend `CHAT_NOTIFICATION_TRANSPORT` untuk wiring Firebase di masa depan.
- Backend full test suite lulus; mobile typecheck dan mobile test suite juga
  lulus setelah perubahan transport.
- `git diff --check` lulus. Verifikasi push non-chat end-to-end tetap menunggu
  UUID Expo/EAS dan binary native yang dibangun ulang.

## Tindak lanjut

- Buat atau tautkan project Expo/EAS untuk aplikasi ini dan isi UUID-nya pada
  `.env`, `.env.dev`, `.env.prod`, serta environment CI yang membangun native.
- Saat Firebase Messaging provider siap, implementasikan provider dan token
  contract terlebih dahulu sebelum mengubah `CHAT_NOTIFICATION_TRANSPORT` ke
  `FIREBASE`.
