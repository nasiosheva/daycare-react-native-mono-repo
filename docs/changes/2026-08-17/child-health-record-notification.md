# Notifikasi Parent saat catatan kesehatan anak diperbarui

## Perilaku

`ChildHealthService.upsert()` sekarang menotifikasi seluruh wali (guardian) anak
yang terhubung setiap kali Staff Admin atau Staff mengisi/mengubah catatan
kesehatan anak (golongan darah, alergi, kondisi medis, obat-obatan, instruksi
darurat). Notifikasi dikirim lewat jalur yang sama seperti fitur lain
(`NotificationService.notify`): inbox, invalidasi realtime dengan flag baru
`HEALTH`, dan push Expo native bila perangkat penerima terdaftar. Deep-link
notifikasi mengarah ke `/child-health?childId=...`.

Sebelumnya, `upsert()` hanya menulis ke audit log tanpa memberi tahu Parent
sama sekali — perbedaan ini ditemukan saat menjawab pertanyaan pengguna
tentang parity notifikasi antara catatan kesehatan dan laporan insiden
(`ChildIncidentService`, yang sudah lebih dulu menotifikasi guardian).

## Dampak

- Backend: `ChildHealthService` kini bergantung pada `GuardianLinkRepository`
  dan `NotificationService` (constructor injection, auto-wired oleh Spring).
- Realtime: flag `HEALTH` baru ditambahkan di `RealtimeFlag` (backend) dan
  `RealtimeFlag` (mobile, `packages/api-client`), dipetakan ke query key
  `child-health-record` di `apps/mobile/src/realtime/queryInvalidation.ts`.
- Tidak ada perubahan skema database maupun kontrak endpoint — hanya efek
  samping notifikasi setelah `upsert()` berhasil.

## Verifikasi

- Unit test baru `ChildHealthServiceTest` memverifikasi `NotificationService.notify`
  dipanggil dengan judul, isi, deep-link, dan flag realtime yang benar untuk
  setiap guardian yang terhubung ke anak tersebut.
- Suite test backend penuh (`./gradlew test`) dan `tsc --noEmit` + test
  realtime mobile (`queryInvalidation.test.ts`) lulus tanpa regresi.

## Tindak lanjut

- Tidak ada uji visual/manual end-to-end yang dilakukan pada sesi ini —
  perubahan ini murni menambahkan pemanggilan notifikasi yang sudah terbukti
  bekerja di fitur lain (pola identik dengan `ChildIncidentService`).
