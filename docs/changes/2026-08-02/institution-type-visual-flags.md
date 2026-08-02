# Field presentasi jenis lembaga

## Perubahan

- Menambah field opsional string `logo`, `backgroundColor`, `borderColor`, dan
  `textColor` pada master jenis lembaga melalui migrasi Flyway `V16`.
- Platform Admin dapat mengubah field tersebut dari form katalog jenis lembaga;
  nilai kosong menghapus nilai yang sebelumnya tersimpan.
- `logo` divalidasi sebagai URL HTTPS absolut (maksimum 500 karakter); setiap
  field warna dibatasi 32 karakter.
- Menambah `parameters` JSON key–value string sebagai extension point
  konfigurasi yang dikelola Platform Admin, sehingga parameter tambahan tidak
  memerlukan migrasi schema baru. Kunci dan nilai tervalidasi serta tidak dapat
  langsung mengubah perilaku bisnis atau authorization.
- Menambah `description` opsional (maksimum 2.000 karakter) melalui migrasi
  `V18`, dapat diisi atau dikosongkan oleh Platform Admin dan hanya ditampilkan
  di katalog jenis lembaga.
- Menambah seed `V19` untuk deskripsi seluruh jenis lembaga built-in. Seed
  hanya mengisi deskripsi yang kosong dan menjaga setiap perubahan Platform
  Admin yang sudah ada.

## Aturan

- Field presentasi belum di-wire ke daftar tenant, filter, navigasi, atau
  kartu mana pun.
- Ketika nanti digunakan, nilainya tetap bukan capability, authorization, atau
  penentu route.
- Akses fitur tetap berasal dari `UiAccessContext`, offering cabang
  `PUBLISHED`, capability efektif, peran, dan scope resource server.

## Verifikasi

- Typecheck dan test frontend/backend dijalankan setelah kontrak field selesai.
