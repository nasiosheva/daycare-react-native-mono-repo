# Batas kelompok dan rombel menurut jenis lembaga

## Perubahan

- Menambah §12.2.2 pada `docs/business-rules.md` untuk membedakan Kelompok
  Layanan, Kelompok Belajar, dan Rombel Akademik.
- Menetapkan matriks eksplisit seluruh jenis lembaga bawaan: status saat ini,
  label kelompok yang benar, arah target, dan larangan rombel yang tidak sesuai.
- Menegaskan bahwa `Classroom`/`ChildPlacement` legacy bukan `AcademicClassroom`/
  `AcademicPlacement`, sehingga tidak boleh di-backfill otomatis berdasarkan
  nama kelompok, usia, atau jenis lembaga.
- Menyelaraskan aplikasi: Staff Admin kini memiliki tab **Home**, **Anak**,
  **Kelas**, dan **Kelola**. Hub Kelas menampilkan Kelas legacy hanya untuk
  scope yang berwenang; menu akademik dan Goal tetap memerlukan offering
  `PUBLISHED` dengan `ACADEMIC_CURRICULUM`.
- Menutup endpoint struktur legacy untuk tenant katalog-only. Endpoint hanya
  menerima `DAYCARE_OPERATIONS` atau `ACADEMIC_CURRICULUM`; daftar Kelas Staff
  juga dibatasi ke penugasan kelasnya sendiri.

## Dampak

- Tidak ada migrasi atau konversi data: `Classroom`/`ChildPlacement` tetap
  netral dan tidak dipetakan menjadi `AcademicClassroom`/`AcademicPlacement`.
- Filter Anak, detail Anak, form les privat, dan deep link kurikulum tidak
  lagi menjalankan request struktur/akademik yang tidak diizinkan. Riwayat
  Parent yang diproyeksikan oleh endpoint profil tetap read-only.

## Verifikasi

- Meninjau matriks visibilitas §12.2.1, model target §13.8, serta capability
  `DAYCARE_OPERATIONS` dan `ACADEMIC_CURRICULUM` yang benar-benar tersedia.
- `pnpm typecheck` lulus untuk seluruh workspace TypeScript, termasuk mobile.
- `pnpm test` lulus: `core` (7), `ui` (1), `api-client` (37), dan mobile
  (70 test dalam 27 berkas).
- `JAVA_HOME=$(/usr/libexec/java_home -v 21) ./apps/api/gradlew -p apps/api test --no-daemon`
  lulus, termasuk cakupan tenant katalog-only dan scope Kelas Staff.
- `git diff --check` lulus tanpa kesalahan whitespace.

## Tindak lanjut

- Sebelum UI mengubah label `Classroom` menjadi Rombel Akademik, implementasi
  harus menyediakan `AcademicYear`, `AcademicClassroom`, `AcademicPlacement`,
  capability per offering, authorization, dan migration yang disebut pada
  §13.8.
