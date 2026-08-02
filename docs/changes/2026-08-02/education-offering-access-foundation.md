# Fondasi akses EducationOffering

## Perubahan

- Menambahkan model dan migrasi `EducationOffering` per tenant, cabang, jenis lembaga, mode enrollment, capability tersimpan, lifecycle, dan revision. Migrasi membuat offering `PUBLISHED` untuk kombinasi cabang aktif dan jenis lembaga yang telah ada.
- Menambahkan endpoint context dan pengelolaan offering untuk Staff Admin. Mobile menggunakan `UiAccessContext` agar menu Akademik dan les privat tidak tampil bagi tenant tanpa offering PAUD/TK published.
- Menegakkan `ACADEMIC_CURRICULUM` pada endpoint Program Kurikulum/aktivitas dan seluruh endpoint les privat. Ini menutup akses Daycare murni melalui UI maupun API.

## Batas kompatibilitas

- Data akademik legacy belum memiliki `offeringId`; migrasi pemetaan Tingkatan, rombel, placement, Goal, dan aktivitas per offering harus dilaksanakan sebelum target §13.1–§13.3 dinyatakan lengkap.
- Karena itu capability tenant tetap dipakai server sebagai compatibility guard tambahan, bukan sumber visibilitas UI baru.

## Verifikasi

- `corepack pnpm typecheck`
- `JAVA_HOME=<JDK 21> ./apps/api/gradlew -p apps/api compileKotlin --no-daemon`
