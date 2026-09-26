# Menjahit alur yang belum terhubung ke aturan bisnis

## Perilaku baru

- **Parent membatalkan pengajuan sendiri (§13.6).** Enrollment Daycare
  `PENDING_APPROVAL` kini mengirim `allowedActions: ["CANCEL"]`. Layar
  **Pendaftaran Parent** menampilkan tombol **Batalkan** hanya bila aksi itu
  ada, lalu meminta konfirmasi (BottomSheet dengan nama anak dan paket) sebelum
  memanggil `POST /parent-enrollment/{id}/cancel`. Server tetap memvalidasi
  pemilik dan status; bila gagal, pesan server ditampilkan dan data dimuat ulang.
- **Staff Admin menghapus Program Perkembangan tenant (§6.3).** Form ubah
  program di layar **Goals** kini punya aksi **Hapus program** dengan
  konfirmasi. Program yang sudah pernah ditetapkan ke anak ditolak server
  dengan pesan terlokalisasi baru `error.developmentProgramAssigned`
  (sebelumnya pesan mentah bahasa Inggris yang jatuh ke `error.request`).
- **Booking terikat ke anak terpilih (§13.6).** Sheet tagihan hanya
  menampilkan invoice anak yang sedang dipilih (kosong →
  `booking.noInvoicesForChild`), dan mengganti anak mereset draft tanggal,
  paket, dan entitlement agar draft tidak terbawa ke anak lain.
- **Tarik persetujuan butuh konfirmasi (§13.15).** Tombol **Tarik** pada
  persetujuan anak membuka BottomSheet konfirmasi yang menjelaskan akibatnya;
  kegagalan kini dilaporkan lewat toast.

## Dampak

- Backend: `ParentEnrollmentAllowedAction.CANCEL`; konstanta
  `DevelopmentProgramError.ASSIGNED` dipakai oleh penghapusan program tenant
  dan global, terdaftar di `ApiExceptionHandler.errorKeys`,
  `errors_id.properties`, dan `errors_en.properties`.
- `packages/api-client`: union `ParentEnrollmentAllowedAction` menambah
  `"CANCEL"`. Method `cancelParentEnrollment` dan `deleteDevelopmentProgram`
  yang sebelumnya tidak dipakai kini punya entry point.
- Mobile: `parent-enrollment.tsx`, `goals.tsx`, `booking.tsx`,
  `child-consents.tsx`; kunci i18n baru di `flowWiringTranslations`
  (7 bahasa).
- Tidak ada migrasi database.

## Verifikasi

- Backend `./apps/api/gradlew -p apps/api test`: 183 test, 0 gagal
  (baru: cancel milik sendiri, tolak cancel milik orang lain/bukan pending,
  hapus program belum ditetapkan, tolak hapus program yang sudah ditetapkan,
  lokalisasi pesan penolakan).
- `corepack pnpm test`: mobile 95, api-client 37, ui 8, core 7 — semua lulus.
- `tsc --noEmit` mobile bersih. `expo lint` tidak menambah temuan selain
  `import/no-unresolved` untuk `@/notify/notify` yang sama dengan 38 file lain
  (resolver tidak mengenali file `.native.ts`/`.web.ts`).

## Tindak lanjut

- Sheet "sisa kredit" di Booking masih menampilkan entitlement semua anak;
  belum diubah karena aturan tidak mewajibkannya secara eksplisit.
- Menghapus program yang menjadi `revised_from_program_id` program lain masih
  bisa gagal karena foreign key tanpa pesan khusus.
