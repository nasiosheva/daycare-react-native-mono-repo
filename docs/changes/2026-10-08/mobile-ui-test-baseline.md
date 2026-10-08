# Baseline UI test mobile

## Tujuan

Menambahkan baseline ringan untuk menguji perilaku komponen React Native tanpa emulator atau device.

## Setup

- Unit/logic test tetap menggunakan Vitest yang sudah dipakai aplikasi.
- UI test menggunakan `jest-expo`, karena preset ini menyiapkan transform React Native/Expo untuk renderer native.
- `@testing-library/react-native` dipakai untuk render dan interaksi berdasarkan perilaku pengguna.
- `jest.ui.config.cjs` hanya menjalankan file `*.ui.test.ts` dan `*.ui.test.tsx`.
- `@testing-library/react-native` membersihkan tree setelah setiap test melalui setup Jest.

## Contoh baseline

`src/ui/navigationCard.ui.test.tsx` memastikan seluruh `NavigationCard` dapat ditemukan sebagai tombol aksesibel dan mengeksekusi callback ketika ditekan.

Jalankan dengan:

```sh
pnpm --filter @daycare/app test:ui
```

Baseline ini belum menjalankan Detox, emulator, atau device. Test screen berikutnya dapat memakai setup yang sama dan tetap memverifikasi perilaku melalui label aksesibilitas, bukan detail style atau struktur internal.
