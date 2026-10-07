# Lint bersih dan lint/typecheck di CI

## Perubahan

- `import/no-unresolved` untuk modul platform-split (`@/notify/notify`,
  `@/date-picker/DatePicker`, `@/development/checkInAudioUri`,
  `@/development/encodeLocalFile`, `@/payment-proof/downloadImage`,
  `@/payment-proof/encodeImage`, `@/auth/rememberedCredentialsStorage`)
  diselesaikan dengan file jembatan universal, mengikuti pola
  `src/notifications/browserNotifications.ts`. TypeScript tetap memilih
  `.native` lewat `moduleSuffixes`, Metro tetap memilih file platform.
- `react-hooks/rules-of-hooks` di `booking.tsx` dan `learning-levels.tsx`
  adalah false positive: fungsi biasa bernama `use*`. Diganti nama menjadi
  `applyRemainingCredit` dan `applyTemplate`; perilaku tidak berubah.
- `pull-request-tests.yml` kini menjalankan `pnpm lint` dan `pnpm typecheck`
  sebelum `pnpm test` di job yang sama (nama job tidak diubah agar required
  status check tetap berlaku). README diperbarui.

## Catatan

`expo lint` menyimpan cache di `apps/mobile/.expo/cache/eslint` (gitignored).
Cache lama dapat tetap menampilkan error yang sudah diperbaiki; hapus folder
itu bila hasil lokal berbeda dengan CI.

## Verifikasi

- `pnpm lint` dan `pnpm typecheck` lulus di semua workspace (tersisa 10
  warning lama, 0 error).
