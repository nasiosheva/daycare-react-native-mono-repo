# Chat local notification dari WebSocket

## Latar belakang

Push Android tidak pernah sampai: Expo Push API menolak setiap ticket dengan
`InvalidCredentials` ("Unable to retrieve the FCM server key"), karena project
EAS `8de99fd7…` belum memiliki FCM V1 service account untuk
`com.children.platform`. Diagnosis perangkat (Pixel 3a, Android 12) dan
database lokal menunjukkan permission, channel, token, tenant, penerima, dan
mute semuanya benar; tidak ada pesan FCM yang pernah diterima perangkat.

Keputusan user: notifikasi chat memakai **local notification** yang dipicu oleh
event WebSocket, bukan push server. Ini menggantikan default `EXPO` yang
dicatat di `chat-push-enabled.md` pada hari yang sama.

## Perubahan

- Backend: `ChildMessageRealtimePayload` mendapat field `event`
  (`MESSAGE_CREATED` saat pesan dikirim, `MESSAGE_READ` saat `markRead`).
  Sebelumnya tanda dibaca memakai flag dan bentuk payload yang sama sehingga
  tidak dapat dibedakan dari pesan baru. Field ini aditif; client lama
  mengabaikannya.
- Backend: default `CHAT_NOTIFICATION_TRANSPORT` menjadi `WEBSOCKET`
  (`application.yml`, `NotificationService`, `.env*.example`) agar push server
  tidak menggandakan local notification. `EXPO` tetap tersedia sebagai opsi
  eksplisit.
- Mobile: `RealtimeConnection` memanggil
  `presentChildMessageLocalNotification` untuk event `MESSAGE_CREATED` di
  Android/iOS. Keputusan tampil/tidak ada di
  `src/notifications/childMessageLocalNotificationPolicy.ts` (pure, teruji):
  dilewati bila permission belum `granted`, perangkat mute
  (`pushMutedUntil`), thread yang sama sedang terbuka di foreground, atau
  `messageId` sudah pernah diberitahukan.
- Mobile: `child-messages.tsx` mendaftarkan thread aktif melalui
  `useFocusEffect`.
- Mobile: notifikasi memakai data `{ actionPath, organizationId }` yang sama
  dengan notifikasi server, sehingga tap ditangani `NotificationRouteHandler`
  beserta validasi ulang akses. Channel Android `default` dibuat melalui helper
  bersama `ensureDefaultNotificationChannel` di `nativePush.ts`.
- i18n: `childMessage.localNotificationTitle/Body` untuk ketujuh locale.
- `packages/api-client`: tipe `ChildMessageRealtimePayload` dan
  `ChildMessageRealtimeEvent`.
- Dokumen: `docs/business-rules.md` (bagian notifikasi chat dan transport
  chat) serta `README.md` diperbarui.

## Helper local notification reusable

Local notification dipakai banyak fitur, jadi bagian generiknya dipisahkan dari
chat di `apps/mobile/src/notifications/`:

| Helper | Isi |
|---|---|
| `localNotificationContent.ts` (pure, teruji) | `localNotificationContent({ title, body, actionPath?, organizationId? })` sebagai satu-satunya sumber kontrak `data` notifikasi; `localNotificationScopeKey`, `setActiveLocalNotificationScope`/`isActiveLocalNotificationScope` untuk menahan notifikasi layar yang sedang dibuka; `createLocalNotificationDeduper` untuk mencegah notifikasi ganda. |
| `localNotification.ts` | `presentLocalNotification` (tampil langsung, cek permission, channel Android), `scheduleLocalNotification(input, trigger)`, `cancelLocalNotification`. |
| `useLocalNotificationScope.ts` | Hook layar: `useLocalNotificationScope(scopeKey \| null)` mendaftarkan scope selama layar fokus. |
| `deviceNotificationPreference.ts` | `deviceNotificationPreferenceQuery` (dipakai juga oleh layar Notifikasi) dan `loadDeviceNotificationMutedUntil` (lookup gagal dibaca sebagai tidak mute). |
| `mutePreferences.ts` | `isMuteActive(mutedUntil, now?)`, dipakai chat dan mute browser web. |

Chat hanya menyimpan aturan khususnya (`childMessageLocalNotificationPolicy.ts`:
parsing payload, scope thread, dedupe per `messageId`). Reminder Staff
(`localReminderScheduler.native.ts`) kini memakai `scheduleLocalNotification`
dan `cancelLocalNotification`; satu perbedaan perilaku: reminder Android kini
memakai channel `default` yang sama, bukan channel fallback Expo.

Contoh fitur baru:

```ts
await presentLocalNotification({ title: t("…"), body: t("…"), actionPath: "/route?id=…", organizationId });
```

## Batasan

Local notification hanya muncul selama proses aplikasi dan koneksi WebSocket
hidup. Setelah Android/iOS memutus koneksi di background atau aplikasi mati,
tidak ada pemberitahuan chat. Pemberitahuan dalam kondisi itu membutuhkan push
server (`CHAT_NOTIFICATION_TRANSPORT=EXPO` dengan kredensial FCM V1 di EAS)
beserta deduplikasi terhadap local notification.

## Verifikasi

- `pnpm --filter @daycare/app typecheck` dan
  `pnpm --filter @daycare/api-client typecheck` lulus.
- `pnpm --filter @daycare/app test`: 40 file / 123 test lulus, termasuk
  `childMessageLocalNotificationPolicy.test.ts` dan `localNotificationContent.test.ts`.
- ESLint pada file yang diubah bersih. `expo lint` penuh masih melaporkan error
  `import/no-unresolved` (modul platform-split) dan `react-hooks/rules-of-hooks`
  di `booking.tsx`/`learning-levels.tsx` yang sudah ada sebelum perubahan ini.
- `./apps/api/gradlew -p apps/api test --no-daemon` lulus.
- Uji perangkat (Pixel 3a, Android 12, backend lokal): pesan dari akun Staff
  di tenant yang sama memunculkan local notification di HP Parent.

## Tindak lanjut

- Bila pemberitahuan saat aplikasi tertutup dibutuhkan, unggah FCM V1 ke EAS
  lalu rancang deduplikasi sebelum mengaktifkan `EXPO`.
- File `.env` lokal (gitignored) sudah diselaraskan ke `WEBSOCKET`; environment
  server yang menyetel `CHAT_NOTIFICATION_TRANSPORT=EXPO` secara eksplisit
  perlu disesuaikan manual.
