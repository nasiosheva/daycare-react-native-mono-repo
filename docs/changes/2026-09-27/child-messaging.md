# Pesan langsung Parent-Staff per anak

## Perilaku baru

- Satu thread pesan append-only per anak (bukan per pasangan Parent-Staff).
  Semua wali anak yang terhubung dan semua Staff dalam scope anak itu berbagi
  satu riwayat. Staff Admin selalu punya akses baca-tulis ke thread anak
  manapun (untuk supervisi/komplain) tapi tidak dinotifikasi tiap pesan.
- Notifikasi: pesan dari Parent menotifikasi Staff yang di-assign langsung ke
  anak itu, jatuh ke Staff Admin aktif bila belum ada Staff yang di-assign.
  Pesan dari Staff/Staff Admin menotifikasi seluruh wali anak yang terhubung.
- Tidak ada pengecualian read-only setelah anak nonaktif — mengikuti pola
  Goals/catatan kesehatan/insiden/consent yang sudah ada:
  `ChildScopeService.requireParentLinkedChild`/`requireStaffManagedChild`
  menolak total begitu `Child.active = false`.
- V1 teks saja, maksimum 2.000 karakter, tanpa edit/hapus pesan.
- Entry point: menu **Pesan** di `parent-child-profile.tsx` (Parent) dan
  `child-detail.tsx` (Staff/Staff Admin), membuka layar `child-messages.tsx`.

## Keputusan desain yang sempat diluruskan

Rencana awal menyebut "read-only setelah GUARDIAN_REVOKED/CHILD_WITHDRAWN,
konsisten dengan pola invoice/dokumen di §13" — ternyata itu bagian dari
`GuardianAuthority` **target** (§13.12-13.13) yang belum dibangun sama
sekali di kode; `GuardianLink` tidak punya status revoked, dan satu-satunya
gate nyata yang berjalan adalah `Child.active`, yang langsung memblokir
total (bukan read-only) di semua resource anak lain. Pengguna diminta
memilih ulang dan menyetujui: ikuti pola blokir total yang sudah ada,
bukan membuat pengecualian baru.

## Dampak

- Backend: entity `ChildMessage`/`ChildMessageRead` (migrasi
  `V15__child_messages.sql`); `ChildMessageService` baru (send/list/
  markRead); 3 endpoint baru di `InstitutionController`
  (`/children/{childId}/messages`, `.../messages/read`); `RealtimeFlag.
  CHILD_MESSAGES` baru (backend enum, `packages/api-client` union,
  `queryKeysByFlag`).
- `packages/api-client`: type `ChildMessage` + `childMessages`/
  `sendChildMessage`/`markChildMessagesRead`.
- Mobile: layar baru `child-messages.tsx`; entry point di
  `parent-child-profile.tsx` dan `child-detail.tsx`; route ditambahkan ke
  daftar `animation: "none"` di `_layout.tsx`; i18n `childMessage.*` di 7
  bahasa.
- `docs/business-rules.md` §10.1 baru; `README.md` menambah satu baris
  kapabilitas produk dan satu baris tabel endpoint.
- Tidak ada perubahan pada tabel/entity yang sudah ada.

## Verifikasi

- Backend (`./apps/api/gradlew -p apps/api test --no-daemon`): 192 test,
  0 gagal — 6 test baru di `ChildMessageServiceTest` (kirim Parent→Staff
  ter-assign, fallback ke Staff Admin, kirim Staff→wali, tolak Staff yang
  tidak di-assign, urutan+resolusi nama pengirim di list, markRead
  membuat/memperbarui baris read).
- Frontend (`corepack pnpm test`): mobile 95, api-client 37, ui 8, core 7 —
  semua lulus. `tsc --noEmit` mobile bersih (route baru butuh
  `.expo/types/router.d.ts` diregenerasi lokal — gitignored, dibangun ulang
  otomatis oleh Expo CLI).
- `expo lint`: tidak ada temuan baru di file yang diubah (dua error
  `import/no-unresolved` yang muncul di `child-detail.tsx`/
  `parent-child-profile.tsx` adalah false positive `@/notify/notify` dan
  `@/date-picker/DatePicker` yang sudah ada di puluhan file lain sebelum
  perubahan ini).
- `run-logs/*.txt`: tidak ada yang tersisa.

## Tindak lanjut

- Composer tidak "menempel" di bawah layar (`AppScreen`/`Screen` hanya
  mengekspos `footer` untuk navigasi bawah, bukan slot custom per-layar);
  composer saat ini ikut scroll bersama riwayat pesan. Tidak ada
  auto-scroll ke pesan terbaru. Keduanya bisa diperbaiki di fase 2 kalau
  perlu.
- Badge unread di Home belum dibangun; `child_message_reads` sudah
  menyimpan `last_read_at` per user per anak sehingga badge bisa ditambah
  tanpa migrasi baru.
- Lampiran foto belum ada (sesuai keputusan V1 teks-saja).
