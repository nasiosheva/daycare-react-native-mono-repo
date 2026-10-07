# Tema gelap navy mengikuti logo

## Keputusan

User memilih warna latar lencana logo (navy `#202D41`) sebagai latar seluruh
aplikasi, bukan hanya sebagai warna utama.

## Perubahan

- `packages/ui/src/theme.ts`: palet baru. Latar `#202D41`, kartu `#2B3A52`,
  teks krem `#F7F1E3`, muted `#C3BBA8`, primary emas `#E6BE76` dengan
  `onPrimary` navy `#1A2436`, serta varian status (danger/success/warning/info)
  yang lebih terang beserta latar soft gelap. Gradien latar dan bayangan
  menyesuaikan (bayangan memakai token `shadow` hitam, bukan warna teks).
- Token baru untuk kasus yang harus tetap terang/gelap apa pun temanya:
  `onMedia` (garis/teks di atas kamera), `mediaBackground` (latar kamera),
  `codeSurface` (latar QR agar tetap bisa dipindai).
- `attendance-scan.tsx` dan `parent-qr.tsx` memakai token baru tersebut;
  sebelumnya keduanya memakai `onPrimary`/`text` sebagai "putih"/"hitam".
- `BrandedSplash.tsx`: warna hardcoded diganti token (latar navy, sinar emas
  tipis, teks merek emas, tagline krem).
- `app.json`: `userInterfaceStyle` menjadi `dark`; latar splash native dan
  ikon adaptif Android menjadi `#202D41`. `_layout.tsx` memasang status bar
  `light-content`.
- `icon.png` dirender ulang dengan latar navy agar ikon iOS menyatu dengan
  lencana.

## Verifikasi

- Rasio kontras WCAG dihitung untuk 25 pasangan teks/ikon dan latarnya; semua
  lolos (teks ≥ 4.5:1, kontrol ≥ 3:1; terendah danger di atas kartu 5.29:1).
- Pencarian warna hardcoded di `apps/mobile` dan `packages/ui` (di luar
  `theme.ts`): tidak tersisa.
- `pnpm verify` lulus (lint, typecheck, 187 test).
- Dicek visual di web lokal: login, Home Staff, pemilih anak mode Pesan, dan
  thread chat (bubble, reply, foto, composer).
- Belum dicek di perangkat native; status bar, splash native, dan ikon baru
  berlaku setelah build ulang.
