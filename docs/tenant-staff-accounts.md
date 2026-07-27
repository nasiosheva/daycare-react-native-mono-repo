# Tenant Staff Accounts

Dokumen ini menjelaskan kontrak saat ini untuk menu **Kelola → Akun tenant**. Untuk aturan produk lintas modul, gunakan juga [Business rules](business-rules.md). Bila dokumen ini dan aturan bisnis berbeda, `business-rules.md` adalah sumber keputusan produk dan perbedaan harus diselesaikan sebelum mengubah implementasi.

## Tujuan dan batas data

Menu ini dipakai oleh `STAFF_ADMIN` aktif untuk mengelola akses operasional tenaga kerja pada tenant aktif. Ada dua lapisan data yang berbeda.

| Lapisan | Contoh data | Cakupan |
| --- | --- | --- |
| Identitas akun (`UserProfile`) | nama tampilan, email, username, hash password | Global untuk identitas tersebut |
| Keanggotaan (`Membership`) | tenant, role, cabang Staff, status aktif, dua permission Staff | Satu tenant |

Email dan username adalah kredensial global yang unik tanpa membedakan tenant. Karena nilai tersebut tersimpan pada identitas akun, perubahan email, username, atau nama tampilan dari tenant yang berwenang terlihat pada setiap keanggotaan lain milik identitas yang sama. Cabang dan permission tetap hanya berlaku pada membership tenant yang sedang dipilih.

## Peran dan tindakan

| Aktor / data target | Lihat daftar | Buat akun | Edit profil/cabang/permission | Ubah password | Nonaktifkan |
| --- | --- | --- | --- | --- | --- |
| `STAFF_ADMIN` aktif | Semua Staff Admin, Staff, dan undangan Parent dalam tenant | `STAFF_ADMIN` atau `STAFF` | Hanya `STAFF` aktif dalam tenant | `STAFF_ADMIN` dan `STAFF` aktif dalam tenant | `STAFF_ADMIN` dan `STAFF` aktif dengan proteksi yang berlaku |
| `STAFF` | Tidak | Tidak | Tidak | Tidak dari menu ini | Tidak |
| `PARENT` | Tidak | Tidak | Tidak | Tidak | Tidak |
| Platform `ADMIN` | Mengelola Staff Admin dari detail tenant, bukan melalui menu ini | Sesuai detail tenant | Bukan alur menu ini | Bukan alur menu ini | Sesuai detail tenant |

`STAFF_ADMIN` pertama (primary Staff Admin) tidak dapat dinonaktifkan. Staff Admin yang sedang bertindak juga tidak dapat menonaktifkan aksesnya sendiri. Saat tersisa satu Staff Admin aktif, Staff Admin terakhir tidak dapat dinonaktifkan.

Form edit di menu ini sengaja hanya untuk role `STAFF`. Mengubah role dapat mengubah cakupan akses tenant secara material dan belum menjadi bagian dari flow ini. Mengubah password juga tetap memakai layar **Kelola password staf**, agar password tidak muncul atau tersimpan kembali pada form edit umum.

## Flow UI

### Daftar dan filter

1. Screen memuat `GET /api/v1/tenant-users` dengan header `X-Organization-Id` tenant aktif. Respons dapat mencakup membership `ACTIVE` maupun `INACTIVE`, serta undangan Parent `PENDING`.
2. Tab cabang menambahkan filter `branchId` pada request. Filter hanya mempersempit data yang sudah diizinkan.
3. Akun `STAFF_ADMIN` tetap tampil ketika cabang tertentu dipilih karena Staff Admin bersifat tenant-wide dan tidak memiliki cabang penempatan.
4. Setiap kartu menampilkan nama, username bila ada, role, status, dan untuk `STAFF`: nama cabang serta status dua permission.
5. Loading menggunakan shimmer. Kegagalan memuat daftar ditampilkan inline bersama tombol coba lagi.

### Buat akun Staff Admin atau Staff

1. `STAFF_ADMIN` aktif menekan floating action **Buat akun staf**.
2. Bottom sheet meminta nama tampilan, email, password, role, dan username opsional.
3. Bila role adalah `STAFF`, pengguna juga wajib memilih satu cabang aktif dan dapat mengaktifkan dua switch permission.
4. Submit mengirim `POST /api/v1/tenant-users`.
5. Bila sukses, daftar diinvalidate/refetch dan sheet ditutup. Konfirmasi sukses dapat tampil terpisah.
6. Semua kesalahan validasi maupun respons API ditampilkan inline di dalam sheet. Mengubah input yang relevan menghapus pesan error lama.

### Edit akun Staff

1. Pada kartu `STAFF` aktif, `STAFF_ADMIN` menekan **Ubah akun staf**.
2. Bottom sheet diisi dari data akun saat ini.
3. Form dapat mengubah nama tampilan, email, username, cabang aktif, permission Program Anak, dan permission kategori perkembangan.
4. Username yang dikosongkan dikirim sebagai string kosong lalu dinormalisasi backend menjadi `null`; sesudah itu akun hanya dapat masuk menggunakan email dan password.
5. Submit mengirim `PATCH /api/v1/tenant-users/{userId}`. Server memperbarui identitas dan membership dalam satu transaksi.
6. Keberhasilan menutup sheet dan memperbarui daftar. Validasi lokal dan kesalahan API tetap inline di sheet.

### Password dan nonaktifkan

- **Kelola password staf** memakai `POST /api/v1/tenant-users/{userId}/password`; password minimal enam karakter, disimpan sebagai BCrypt hash, dan tidak pernah dikembalikan API.
- **Nonaktifkan akun** memakai `POST /api/v1/tenant-users/{userId}/deactivate`. Aksi ini menonaktifkan membership tenant, bukan menghapus `UserProfile`, data historis, atau identitas global.

## Field dan validasi

| Field | Buat `STAFF_ADMIN` | Buat/Edit `STAFF` | Aturan server |
| --- | --- | --- | --- |
| `displayName` | Wajib | Wajib | Dipangkas, 2–100 karakter pada kontrak request, tidak boleh kosong |
| `email` | Wajib | Wajib | Dipangkas, lower-case, format email, unik global secara case-insensitive |
| `username` | Opsional | Opsional | Dipangkas; kosong disimpan sebagai `null`; bila ada harus unik global secara case-insensitive |
| `password` | Wajib saat buat | Wajib saat buat | Minimal enam karakter; hanya dapat diganti lewat endpoint password |
| `role` | Wajib saat buat | Tetap `STAFF` saat edit | Tidak dapat diubah lewat endpoint edit |
| `branchId` | Tidak digunakan | Wajib | Harus cabang aktif milik tenant aktif |
| `canManageChildPrograms` | Selalu `false` | Dapat diatur | Hanya berlaku pada membership Staff tenant tersebut |
| `canManageDevelopmentCategories` | Selalu `false` | Dapat diatur | Hanya berlaku pada membership Staff tenant tersebut |

## Permission Staff

| Permission | Efek |
| --- | --- |
| `canManageChildPrograms` | Staff dapat menambah dan menghapus Program Anak hanya pada anak dalam penugasan langsung atau rombel aktifnya. Permission tidak memberi akses Goal atau anak di luar scope. |
| `canManageDevelopmentCategories` | Staff dapat menambah kategori perkembangan tenant. Aktivasi/nonaktif kategori tetap hanya untuk Staff Admin. |

Kedua permission default ke `false` saat akun Staff dibuat. Mengubah cabang tidak memperluas scope anak secara otomatis; scope tetap bergantung pada relasi penugasan anak/rombel yang aktif.

## Kontrak API

Semua endpoint berikut memerlukan bearer token dan `X-Organization-Id`. Detail error mengikuti `Accept-Language` (`id` atau `en`).

### List

`GET /api/v1/tenant-users?branchId={optional-uuid}`

Respons membership akun Staff atau Staff Admin memuat, antara lain:

```json
{
  "id": "membership-uuid",
  "userId": "user-uuid",
  "displayName": "Guru Baru",
  "username": "guru.baru",
  "email": "guru@example.test",
  "role": "STAFF",
  "status": "ACTIVE",
  "branchId": "branch-uuid",
  "canManageChildPrograms": true,
  "canManageDevelopmentCategories": false
}
```

Undangan Parent yang masih pending juga dapat muncul dalam daftar dengan `userId`, `displayName`, dan `username` bernilai `null`. Undangan bukan target endpoint edit akun Staff.

### Buat

`POST /api/v1/tenant-users`

```json
{
  "displayName": "Guru Baru",
  "email": "guru@example.test",
  "password": "minimal-enam-karakter",
  "role": "STAFF",
  "username": "guru.baru",
  "branchId": "branch-uuid",
  "canManageChildPrograms": true,
  "canManageDevelopmentCategories": false
}
```

### Edit Staff

`PATCH /api/v1/tenant-users/{userId}`

```json
{
  "displayName": "Guru Diperbarui",
  "email": "guru@example.test",
  "username": "guru.baru",
  "branchId": "branch-uuid",
  "canManageChildPrograms": true,
  "canManageDevelopmentCategories": false
}
```

Endpoint ini hanya menerima target yang memiliki membership `STAFF` aktif pada tenant header. Role, status aktif, dan password tidak dapat diubah oleh payload ini. Responsnya menggunakan bentuk `TenantUser` yang sama dengan list.

### Error yang relevan

| Kondisi | HTTP | Kode respons | Pesan terlokalisasi |
| --- | --- | --- | --- |
| Nama, email, atau format payload tidak valid | 400 | `VALIDATION_ERROR` | Ya |
| Email sudah digunakan | 400 | `VALIDATION_ERROR` | Ya |
| Username sudah digunakan | 400 | `VALIDATION_ERROR` | Ya |
| Target bukan Staff aktif pada tenant | 400 | `VALIDATION_ERROR` | Ya |
| Cabang tidak ada, tidak aktif, atau milik tenant lain | 400 | `VALIDATION_ERROR` | Ya |
| Pemanggil bukan Staff Admin tenant aktif | 403 | `FORBIDDEN` | Ya |

## Implementasi dan verifikasi

| Lapisan | Lokasi utama |
| --- | --- |
| UI dan state sheet | `apps/mobile/app/tenant-users.tsx` |
| Teks Indonesia/Inggris | `apps/mobile/src/i18n/translations.ts` |
| Kontrak HTTP terketik | `packages/api-client/src/index.ts` |
| Route API | `apps/api/src/main/kotlin/com/daycare/api/web/Controllers.kt` |
| Otorisasi, transaction, membership | `apps/api/src/main/kotlin/com/daycare/api/service/AdministrationService.kt` |
| Normalisasi dan unik email/username | `apps/api/src/main/kotlin/com/daycare/api/service/TenantUserAccountService.kt` |
| Error API terlokalisasi | `apps/api/src/main/kotlin/com/daycare/api/web/ApiExceptionHandler.kt`, `apps/api/src/main/resources/i18n/errors*.properties` |

Verifikasi minimum setelah mengubah flow ini:

```sh
corepack pnpm --filter @daycare/api-client test
corepack pnpm --filter @daycare/app typecheck
./apps/api/gradlew -p apps/api test --no-daemon
git diff --check
```

Untuk mencoba lokal, jalankan API melalui `./scripts/run-backend-local.sh`, masuk sebagai `STAFF_ADMIN` aktif, buka **Kelola → Akun tenant**, pilih akun `STAFF` aktif, lalu ubah nama/cabang/permission. Pastikan daftar memantulkan data baru setelah sheet ditutup dan coba username duplikat untuk memverifikasi pesan inline terlokalisasi.
