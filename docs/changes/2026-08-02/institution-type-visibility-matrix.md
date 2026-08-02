# Matriks visibilitas jenis lembaga

## Perubahan

- Menambahkan §12.2.1 di `docs/business-rules.md` sebagai matriks eksplisit
  fitur khusus yang boleh tampil dan wajib disembunyikan untuk setiap katalog
  jenis lembaga built-in.
- Menetapkan bahwa `InstitutionType` adalah identitas/master data, bukan izin
  akses. Visibilitas fitur khusus memerlukan offering cabang `PUBLISHED`,
  capability efektif, peran, dan scope resource yang disahkan server.
- Menandai `TPA`, `KB`, `SPS`, `RA`, `BIMBA`, `SD`, `MI`, `SMP`, `MTS`, `SMA`,
  `MA`, dan `SMK` sebagai katalog-only saat ini: tetap memakai fitur bersama,
  tetapi tidak menampilkan modul spesifik sebelum capability dan kontrak
  targetnya tersedia.

## Dampak

- Ini adalah klarifikasi aturan dan tidak mengubah API, database, atau layar
  pada perubahan ini.
- Implementasi UI/API berikutnya wajib mengikuti matriks, terutama tidak
  memunculkan modul akademik atau sekolah hanya berdasarkan kode jenis
  lembaga.

## Verifikasi

- Meninjau konsistensi nama kode `MTS` dengan `InstitutionTypeCodes` backend.
- Menjalankan `git diff --check` untuk perubahan dokumentasi.

## Tindak lanjut

- Modul target untuk PAUD/TK dan sekolah hanya boleh ditambahkan bersama
  capability server, authorization per offering, migrasi scope data, dan
  kontrak API yang dirujuk oleh §12 dan §13.
