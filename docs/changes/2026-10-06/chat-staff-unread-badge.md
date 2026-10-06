# Badge unread chat untuk Staff/Staff Admin

## Keputusan

- Floating action **Pesan** Staff/Staff Admin menampilkan jumlah total pesan
  belum dibaca; daftar pilih anak (mode Pesan) menampilkan jumlah per anak.
- Cakupan mengikuti penerima pesan baru (dipilih user): Staff = anak yang
  di-assign langsung; Staff Admin = anak yang di-assign langsung + anak aktif
  tanpa Staff yang di-assign. Thread lain tetap bisa dibuka Staff Admin untuk
  supervisi tetapi tidak menambah badge.
- Sebelumnya `docs/business-rules.md` §10.1 hanya mendefinisikan badge untuk
  Parent; aturan Staff ditambahkan di bagian yang sama.

## Perubahan

- API: `GET /api/v1/child-messages/unread-summary` →
  `{ totalUnreadCount, children: [{ childId, unreadCount }] }`, hanya anak dengan
  unread > 0. `ChildMessageService.unreadSummary` memakai satu query terkelompok
  `ChildMessageRepository.countUnreadByChild` (aturan "setelah `lastReadAt`"
  sama dengan summary per anak) dan
  `ChildStaffAssignmentRepository.findAllByOrganizationId`. Tanpa migrasi.
- `packages/api-client`: `childMessageUnreadSummary()` dan tipe
  `ChildMessageUnreadSummary`.
- Mobile:
  - `src/chat/ChatFloatingAction.tsx` (baru) menyatukan FAB chat + badge yang
    sebelumnya inline di `parent-child-profile.tsx`; `ChatUnreadBadge` dipakai
    juga oleh daftar anak.
  - `src/chat/useChildMessageUnreadSummary.ts` (baru) untuk query ringkasan
    unread Staff, aktif hanya untuk Staff/Staff Admin aktif.
  - `StaffChatFloatingAction` (Home, Staff Admin, Staff Operations) dan
    `children.tsx` mode Pesan menampilkan badge; label aksesibilitas memuat
    jumlah unread.
  - Flag realtime `CHILD_MESSAGES` kini juga meng-invalidate
    `child-message-unread-summary` milik tenant event; `child-messages.tsx`
    meng-invalidate-nya setelah `markRead`.

## Verifikasi

- `ChildMessageServiceTest`: 3 test baru (scope Staff, scope Staff Admin
  termasuk anak nonaktif/sudah di-assign, ringkasan kosong); suite backend
  penuh lulus. `ApiIntegrationTest` dilewati karena butuh
  `INTEGRATION_DATABASE_URL`; query JPQL divalidasi saat backend lokal start.
- `pnpm --filter @daycare/app typecheck`, `@daycare/api-client typecheck`
  lulus; `pnpm --filter @daycare/app test` 40 file / 124 test lulus (termasuk
  test invalidasi ringkasan unread per tenant).
- ESLint file yang diubah: hanya error lama `import/no-unresolved`
  (`@/notify/notify`, `@/date-picker/DatePicker`).
- Uji perangkat: belum.

## Batasan

Staff yang mengelola anak lewat penempatan kelas (bukan assignment langsung)
tidak menerima event pesan baru dan karenanya tidak dihitung, konsisten dengan
aturan penerima notifikasi.
