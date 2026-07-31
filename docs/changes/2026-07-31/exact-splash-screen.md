# Desain splash screen Umur Emas

## Perubahan

- Membuat `BrandedSplash` sebagai layout React Native yang meniru arah desain referensi, bukan menyalin `splash_screen_exact.png`.
- Layout terdiri dari `LinearGradient`, sinar radial `react-native-svg`, emblem Umur Emas yang sudah digunakan aplikasi, serta teks `UMUR EMAS`, `Tumbuh, Main, dan Belajar`, dan hak cipta.
- `expo-splash-screen` native hanya memakai emblem dalam mode `contain`; layout penuh ditampilkan segera setelah React Native mulai dan tetap berada di atas aplikasi sampai autentikasi selesai.
- Memperluas fingerprint launcher native agar perubahan pada aset mobile memicu Expo prebuild otomatis.

## Verifikasi

- Memeriksa layout secara visual melalui komposisi `LinearGradient`, SVG, logo, dan teks yang terpisah.
- Menjalankan Expo prebuild bersih untuk Android dan iOS. iOS sekarang memiliki `SplashScreenLogo.imageset`; Android memiliki resource icon splash pada seluruh density bucket.
- Memeriksa konfigurasi native: Android 12 menggunakan kontrak system splash berupa warna latar dan ikon tengah, sedangkan iOS memuat emblem dari asset catalog yang diregenerasi.
- Menjalankan `corepack pnpm verify` dan `ANDROID_HOME=/Users/morieshutapea/Library/Android/sdk ./gradlew app:assembleDebug`; keduanya berhasil.

## Rilis

- Splash screen native perlu build Android/iOS baru untuk berubah. Setelah React Native mulai, overlay branded mengikuti pembaruan bundle seperti kode aplikasi biasa.
