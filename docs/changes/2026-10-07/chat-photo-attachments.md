# Lampiran foto di chat anak

## Perubahan

- Migrasi `V18__child_message_photos.sql` (aditif): kolom
  `child_messages.photo_content_type` sebagai penanda dan tabel
  `child_message_photos` (byte foto, `ON DELETE CASCADE`). Daftar thread tidak
  memuat byte foto.
- API: `SendChildMessageRequest` menerima `photo { contentType, dataBase64 }`
  opsional; `body` boleh kosong bila ada foto (error baru
  `child_message.content_required`). Validasi JPEG/PNG, ≤ 5 MB, magic byte
  sama dengan foto insiden. Respons pesan dan reply membawa `hasPhoto`.
  Endpoint baru `GET /children/{childId}/messages/{messageId}/photo`.
- Error baru terdaftar di `ChildMessageError`, `ApiExceptionHandler.errorKeys`,
  `errors.properties`, `errors_id.properties`, `errors_en.properties`
  (`errors.properties` juga dilengkapi key reply chat yang sebelumnya belum
  ada).
- Mobile: tombol galeri/kamera di composer, pratinjau + hapus sebelum kirim,
  foto lazy-load di bubble (`src/chat/ChildMessagePhoto.tsx`, tap untuk ukuran
  penuh), ringkasan reply "Foto" untuk pesan tanpa teks. i18n 7 locale.
- Helper bersama `src/image-picker/photoUpload.ts` (`pickedImageUpload`) kini
  dipakai chat, laporan insiden, dan Goals (menggantikan ekspresi yang sama
  yang ditulis ulang di tiap layar).

## Kompatibilitas

Kolom/tabel baru aditif; client lama mengabaikan `hasPhoto` dan tetap mengirim
`body` berisi teks.

## Verifikasi

- `ChildMessageServiceTest`: pesan foto saja menyimpan foto terpisah, pesan
  kosong/foto bukan gambar ditolak sebelum disimpan, foto hanya dilayani dalam
  scope thread.
- Mobile typecheck lulus, 129 test lulus, ESLint file yang diubah bersih
  (selain error lama `import/no-unresolved` untuk modul platform-split).
- Uji perangkat: belum.
