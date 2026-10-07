# Balasan cepat (quick reply) chat untuk Staff

## Perubahan

- Migrasi `V19__child_message_templates.sql` (aditif): tabel
  `child_message_templates` per tenant.
- API (`ChildMessageTemplateService`):
  - `GET /child-message-templates`: Staff/Staff Admin aktif.
  - `POST`, `PUT /{templateId}`, `DELETE /{templateId}`: Staff Admin aktif dan
    tenant writable. Batas 50 template per tenant, isi ≤ 500 karakter.
  - Error `child_message_template.not_found` dan `.limit_reached` terdaftar di
    handler dan ketiga file `errors*.properties`.
- `packages/api-client`: tipe `ChildMessageTemplate` dan empat method CRUD.
- Mobile:
  - Layar baru `app/child-message-templates.tsx` (daftar inline, FAB tambah,
    Bottom Sheet tambah/ubah/hapus) dari menu Staff Admin; terdaftar di daftar
    route tanpa animasi `_layout.tsx`.
  - Composer chat Staff/Staff Admin punya tombol balasan cepat yang membuka
    Bottom Sheet; memilih template mengisi atau menambah draft, tidak mengirim.
  - Hook `src/chat/useChildMessageTemplates.ts`; i18n 7 locale.

## Verifikasi

- `ChildMessageTemplateServiceTest`: Staff dapat membaca, Staff Admin membuat
  (di-trim), batas tenant, hanya Staff Admin yang mengelola dan hanya template
  tenant yang sama.
- Mobile typecheck lulus; ESLint file yang diubah bersih.
- Uji perangkat: belum.
