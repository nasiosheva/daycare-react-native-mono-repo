# Local notification untuk notifikasi inbox

## Perubahan

- Mobile native: event realtime `NOTIFICATIONS` (pembayaran, booking, insiden,
  izin, kesehatan, dll.) memunculkan local notification dari item inbox
  tersimpan melalui `presentInboxLocalNotification`
  (`src/notifications/inboxLocalNotification.ts`). Keputusan tampil ada di
  `inboxLocalNotificationPolicy.ts` (pure, teruji): dilewati bila mute aktif,
  item sudah dibaca, atau layar Notifikasi terbuka di foreground
  (`useLocalNotificationScope(inboxNotificationScope)`).
- Dedupe dua arah: `claimNotificationDisplay` di
  `localNotificationContent.ts` memastikan local notification dan push server
  dengan `notificationId` yang sama hanya tampil sekali; handler foreground di
  `_layout.tsx` menyembunyikan push duplikat. Chat memakai `messageId` sebagai
  `notificationId`.
- Backend: `NotificationService.sendPush` menyertakan `notificationId` di data
  push (id item inbox untuk `notify`, id pesan untuk `notifyChat`). Reminder
  dan push-only tetap tanpa id.

## Alasan

Push server belum sampai ke Android karena kredensial FCM V1 belum ada di EAS,
sehingga notifikasi non-chat hanya terlihat di inbox. Web sudah memakai pola
yang sama melalui notifikasi browser.

## Verifikasi

- Backend: `NotificationServiceTest` (test baru: push inbox membawa
  `notificationId`), `ChildMessageServiceTest`, `StaffReminderServiceTest` lulus.
- Mobile: typecheck lulus; 41 file / 129 test lulus, termasuk
  `inboxLocalNotificationPolicy.test.ts` dan test dedupe di
  `localNotificationContent.test.ts`. ESLint file yang diubah bersih.
- Uji perangkat: belum.

## Batasan

Sama seperti chat: hanya selama aplikasi dan WebSocket hidup. Duplikat masih
mungkin bila push server tiba ketika aplikasi berada di background dengan
socket masih hidup, karena push itu ditampilkan OS tanpa melewati handler.
