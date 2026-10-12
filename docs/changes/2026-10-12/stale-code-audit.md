# Audit stale code dan dokumentasi

<!-- Mories Deo Hutapea,S.E.,S.Kom -->

## Status

Audit lokal selesai pada 2026-10-12 di branch `feat/payment-history-flash-list`.
Audit ini hanya mencatat temuan; tidak ada kode atau konfigurasi runtime yang
diubah.

## Temuan

### 1. Panduan migrasi di README sudah stale — prioritas tinggi

README masih menjelaskan bahwa schema memakai satu baseline Flyway
`V1__initial_schema.sql`, database harus di-reset, dan `flyway_schema_history`
harus berisi satu row `V1`.

- `README.md:146` menjelaskan hanya baseline `V1` yang diterapkan saat startup.
- `README.md:162-164` menjelaskan reset database dan verifikasi satu row `V1`.
- `docs/changes/2026-08-02/flyway-migration-chain-documentation.md` juga
  menggambarkan chain lama yang hanya berisi `V1`.

Keadaan source saat ini berbeda: direktori
`apps/api/src/main/resources/db/migration/` berisi migration `V1` sampai `V27`,
termasuk migration screening (`V22`–`V26`) dan idempotency child-care log
(`V27`). README saat ini dapat memberi instruksi operasional yang salah untuk
database yang memakai chain forward migration.

Tindak lanjut: tetapkan satu kebijakan migration yang berlaku untuk branch
production, lalu sinkronkan README dan runbook reset/deploy. Dokumen change lama
boleh dipertahankan sebagai sejarah, tetapi harus diberi penanda bahwa isinya
bukan keadaan repository saat ini.

### 2. Firebase Admin identity service kemungkinan dead code — prioritas sedang

`apps/api/src/main/kotlin/com/daycare/api/service/FirebaseAdminIdentityService.kt`
mendefinisikan `EmailPasswordIdentityProvisioner` dan operasi Firebase
Email/Password (`createEmailPasswordUser`, `updatePassword`, `deleteUser`),
tetapi tidak ada consumer service atau controller yang menginjeksikannya.

Account Staff/Staff Admin saat ini dibuat melalui
`TenantUserAccountService` dengan `local:<uuid>` dan BCrypt hash. README juga
menyatakan bahwa provisioning account tenant tidak membuat Firebase
Email/Password user.

Catatan: `FirebaseIdentityError` masih dipakai oleh `ApiExceptionHandler`, jadi
file tidak boleh dihapus tanpa memindahkan atau menghapus mapping error tersebut
secara sengaja. Dependency `com.google.firebase:firebase-admin` tampak hanya
dibutuhkan oleh service ini dan perlu ditinjau bersama-sama.

Tindak lanjut: putuskan apakah service ini benar-benar akan dipakai untuk flow
Firebase Admin. Jika tidak, hapus service, mapping error yang tidak diperlukan,
konfigurasi `daycare.firebase-service-account-json`, dan dependency Firebase
Admin dalam perubahan terpisah dengan test compile dan API test.

### 3. Locale aplikasi bukan temuan stale terhadap baseline saat ini

Kode dan dokumentasi saat ini konsisten mendukung tujuh locale: `id`, `en`,
`zh`, `fr`, `pt`, `es`, dan `ru`. Ini hanya menjadi stale apabila keputusan
produk dikembalikan menjadi Bahasa Indonesia dan English saja; jika keputusan
itu diambil, `supportedLocales`, `localeTags`, selector Profile, translation
tests, dan dokumentasi harus diubah bersama-sama.

### 4. Tidak ditemukan screen Expo yang jelas orphan

Static route scan tidak menemukan screen utama yang sama sekali tidak
direferensikan. Route Expo yang diregistrasikan otomatis oleh file di
`apps/mobile/app/` tetap dihitung sebagai reachable meskipun tidak selalu
memiliki `router.push` langsung.

## Verifikasi

- `pnpm --filter @daycare/app typecheck` — lulus.
- `GRADLE_USER_HOME=.gradle-local ./apps/api/gradlew -p apps/api compileKotlin --no-daemon --max-workers=1` — lulus.
- Audit route, service declaration, dependency reference, dan migration filename
  dilakukan secara lokal dengan pencarian source; tidak ada live API, database
  production, emulator, atau device yang digunakan.

## Batasan

Audit ini tidak membuktikan bahwa setiap endpoint telah diuji end-to-end dan
tidak mengukur apakah dependency eksternal memiliki versi terbaru. Perubahan
working tree yang sudah ada sebelum audit juga dibiarkan dan tidak disentuh.
