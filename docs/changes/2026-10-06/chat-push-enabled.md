# Chat native push

## Perubahan

- Chat tetap mengirim invalidation WebSocket `CHILD_MESSAGES`, tetapi sekarang
  juga mengirim push Expo ephemeral kepada penerima yang memiliki device token
  terdaftar dan tidak sedang mute.
- Push chat tidak membuat record inbox, tidak menaikkan unread badge, dan tidak
  ikut aksi mark-all. Action path tetap divalidasi ulang oleh aplikasi sebelum
  thread dibuka.
- `CHAT_NOTIFICATION_TRANSPORT=EXPO` menjadi default. `WEBSOCKET` masih tersedia
  untuk lingkungan yang sengaja hanya membutuhkan realtime; `FIREBASE` menjadi
  alias kompatibilitas ke jalur token Expo yang ada.
- Contoh env lokal/dev/prod diselaraskan ke `EXPO`.
- Permission native diperiksa dan diminta pada route `/sign-in`, `/home`, atau
  `/notifications`
  ketika belum `granted`; registrasi device token tetap menunggu user, tenant,
  subscription, dan Expo project ID tersedia.
- Web tidak memanggil `expo-notifications.requestPermissionsAsync`; web memakai
  `Notification.requestPermission()` melalui aksi user di pengaturan notifikasi
  karena browser biasanya memblokir prompt otomatis tanpa user gesture.
- Permission dan registrasi token native dipusatkan di helper reusable
  `apps/mobile/src/notifications/nativePush.ts`; layout dan layar inbox memakai
  helper yang sama tanpa menggandakan kontrak Expo/device-token.
- Backend sekarang membaca hasil ticket Expo dan mencatat status/message/details
  delivery yang gagal tanpa mencatat token push.

## Verifikasi

- Test `NotificationService` memverifikasi chat default memanggil pengiriman
  push tanpa menyimpan inbox.
- Test `NotificationService` memverifikasi mode `WEBSOCKET` tetap tidak mengirim
  push.
