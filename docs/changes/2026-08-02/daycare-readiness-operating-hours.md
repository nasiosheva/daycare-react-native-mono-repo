# Kesiapan Daycare dan jam operasional

## Perubahan

- Menjadikan jam operasional mingguan yang valid sebagai syarat kesiapan untuk
  setiap cabang aktif pada tenant dengan `DAYCARE_OPERATIONS`.
- Menambahkan checklist Kelola yang menggunakan respons readiness server dan
  membuka konfigurasi Cabang, Jam Operasional, Kelas, Paket/Kapasitas, atau
  Instruksi Pembayaran yang sesuai.
- Membatasi syarat Kelas legacy ke tenant dengan `DAYCARE_OPERATIONS` atau
  offering akademik `PUBLISHED`, sehingga tenant katalog-only maupun offering
  akademik draft tidak ditandai belum siap untuk fitur yang belum tersedia.

## Aturan

- Konfigurasi jam operasional siap bila menyimpan tepat tujuh hari unik,
  setidaknya satu hari aktif, dan setiap hari aktif memiliki jam buka sebelum
  jam tutup. Tarif overtime bersifat opsional.
- Anak aktif tidak menjadi syarat readiness; lembaga yang siap harus dapat
  menerima anak pertama.
- Status langganan tetap pemberitahuan non-aksi bagi Staff Admin karena hanya
  Platform Admin yang dapat mengubahnya.

## Verifikasi

- `pnpm typecheck` lulus untuk seluruh workspace TypeScript, termasuk mobile.
- `pnpm test` lulus: `core` (7), `ui` (1), `api-client` (37), dan mobile
  (71 test dalam 28 berkas), termasuk urutan checklist Kelola.
- `JAVA_HOME=$(/usr/libexec/java_home -v 21) ./apps/api/gradlew -p apps/api test --no-daemon`
  lulus, termasuk test jam operasional Daycare dan tenant katalog-only.
