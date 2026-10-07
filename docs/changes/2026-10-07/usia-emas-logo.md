# Logo aplikasi Usia Emas

## Perubahan

Logo lencana navy-emas "USIA EMAS" menggantikan logo lama di semua aset
merek mobile. Nama file dan konfigurasi `app.json` tidak berubah.

| Aset | Ukuran | Isi |
|---|---|---|
| `assets/images/icon.png` | 1024×1024 | lencana dengan margin tipis, latar krem `#FFFDF6` solid (ikon iOS tidak boleh transparan) |
| `assets/images/icon-foreground.png` | 1024×1024 | lencana ±62% kanvas, transparan, agar aman di mask ikon adaptif Android (latar adaptif tetap `#FFFDF6`) |
| `assets/images/login-icon.png` | 1024×1024 | lencana saja, transparan; dipakai layar login, splash native, dan `BrandedSplash` (semua `resizeMode="contain"`) |
| `assets/images/favicon.png` | 512×512 | sama seperti `login-icon.png`, untuk web |

Sumber vektor disimpan sebagai `assets/images/logo-usia-emas.svg` (hasil
trace VTracer, kanvas 2816×1536 berlatar putih; lencana berpusat di
(1408, 767) dengan diameter ±1429).

## Cara regenerasi

PNG dirender dari SVG turunan yang membuang path latar putih pertama dan
memakai `viewBox` persegi di sekitar lencana (skala 1.10 untuk ikon, 1.60 untuk
foreground adaptif, 1.02 untuk login/favicon), lalu digambar dengan AppKit
(`NSImage` → `NSBitmapImageRep` RGBA) agar alpha terjaga. `qlmanage` tidak
dipakai karena selalu meratakan latar menjadi putih.

## Verifikasi

- Ukuran dan kanal alpha diperiksa dengan `sips`; sudut foreground dan
  login/favicon beralpha 0, ikon iOS beralpha 255.
- Pratinjau visual tiap aset diperiksa (lingkaran utuh, teks terbaca).
- Uji perangkat: belum. Ikon launcher dan splash native baru berubah setelah
  build ulang (prebuild menyalin aset ke resource Android/iOS).
