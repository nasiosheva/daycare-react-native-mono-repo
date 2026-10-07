# Badge unread chat Parent di Beranda

## Perubahan

- API: `GET /api/v1/child-messages/unread-summary` kini juga melayani Parent
  aktif; cakupannya anak yang terhubung (`GuardianLink`) di tenant
  `X-Organization-Id`. Staff/Staff Admin tidak berubah.
- Mobile: `useParentChildMessageUnreadAcrossTenants` memakai `useAcrossTenants`
  atas membership Parent yang operasional, dengan query key yang sama seperti
  badge Staff (`child-message-unread-summary`, tenant) sehingga invalidasi
  realtime tetap berlaku untuk tenant aktif.
- Beranda Parent: setiap kartu anak punya aksi **Pesan** dengan badge unread
  (`ChatUnreadBadge`), membuka `/child-messages` dengan `organizationId` anak.
- `docs/business-rules.md` §10.1 dan `README.md` diperbarui.

## Verifikasi

- `ChildMessageServiceTest`: test baru Parent (hanya anak terhubung di tenant
  yang diminta) lulus.
- Mobile typecheck lulus; ESLint `home.tsx` dan `src/chat` bersih.
- Uji perangkat: belum.
