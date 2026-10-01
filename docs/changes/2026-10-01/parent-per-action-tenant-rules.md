# business-rules: resolusi tenant per aksi untuk Parent

## Latar belakang

Saat merencanakan inbox notifikasi lintas-tenant, ditemukan bahwa
`docs/business-rules.md` §1 (baris Parent) dan §13.2 menyatakan Parent
**hanya** boleh bertindak pada tenant aktif, dengan satu-satunya exception
query lintas-tenant berupa `ParentOperatingHoursOverview`, dan bahwa "setiap
tap ke detail harus membangun ulang context tenant legal terlebih dahulu".
Aturan ini (ada sejak 2026-08-01) sudah dilanggar oleh pekerjaan yang masuk
production:

- PR #44: agregat anak/tagihan Parent lintas tenant (Home, QR, riwayat
  pembayaran).
- PR #56 (`docs/changes/2026-09-27/parent-cross-tenant-flows.md`): booking,
  les privat, tenant feedback, dan seluruh layar per-anak me-resolve tenant
  dari anak/route param tanpa `selectOrganization()`; `openChild` di Home
  sengaja tidak lagi membangun ulang context; guard `crossTenant`.

Pemeriksaan klausul ini terlewat saat PR #56 dikerjakan, dan komentar di
`booking.tsx`/`private-tutoring.tsx` keliru merujuk "§13.1" sebagai dasar.
Konflik ini dijelaskan ke user beserta dampaknya (otorisasi server tetap
aman karena setiap request divalidasi ulang per `X-Organization-Id`; yang
menyimpang adalah disiplin context client). User memilih opsi **update
business-rules** dari tiga opsi (update dokumen / ubah UI agar patuh /
hybrid agregat read-only).

## Perubahan aturan

- **§1 Parent:** Parent tidak wajib mengganti tenant aktif sebelum bertindak
  atas anak di tenant lain. Aturan resolusi tenant per aksi:
  - tenant berasal dari resource yang dibuka (anak, item agregat, pemilih
    tenant di layar), diteruskan via route param/parameter request; tanpa
    param → tenant aktif;
  - setiap request satu tenant (`X-Organization-Id`), server memvalidasi
    ulang; satu mutasi tidak mencampur ID lintas tenant;
  - layar dengan route param wajib cek membership tenant itu (guard §13.2);
  - agregat hanya di client dari query satu-tenant, cache ber-key
    `organizationId`, item ditandai tenant asal; **target**: kegagalan satu
    tenant tidak menyembunyikan tenant lain (agregat lama anak/tagihan belum
    memenuhi — gap tercatat);
  - layar agregat (booking, QR, les privat) boleh di-gate "minimal satu
    membership memenuhi";
  - tenant aktif tetap default; ganti tenant aktif tetap menghapus cache
    (§13.1); membuka layar dengan `organizationId` eksplisit bukan ganti
    context; Staff/Staff Admin tetap terikat tenant aktif.
  - `ParentOperatingHoursOverview` tetap read model server read-only; tap ke
    detail boleh lewat ganti tenant aktif maupun resolusi per aksi.
- **§13.2:** query lintas tenant kini dibolehkan dalam dua bentuk:
  `ParentOperatingHoursOverview`, dan agregasi client untuk resolusi per aksi
  Parent (query tetap satu tenant, ID item hanya ke tenant asalnya). Bentuk
  lain tetap dilarang.
- Penyesuaian frasa agar konsisten: §6.2 (privasi Program Pendampingan:
  "tenant aktifnya" → tenant tempat relasi wali berlaku) dan §13.13 (route
  consent memvalidasi tenant request, termasuk hasil resolusi per aksi).

## Kode

- Komentar `booking.tsx` dan `private-tutoring.tsx` yang merujuk "§13.1"
  diganti menjadi rujukan ke resolusi tenant per aksi di §1. Tidak ada
  perubahan perilaku.

## Verifikasi

- Perubahan ini dokumentasi + komentar; perilaku production (PR #56) tidak
  berubah dan kini sesuai dokumen.
- `README.md` tidak perlu diubah: kalimat yang ditambahkan di akhir PR #56
  (bagian `PARENT is global`) sudah menjelaskan resolusi tenant per aksi.

## Tindak lanjut

- Gap **target** partial-failure pada `useParentChildrenAcrossTenants` dan
  `useParentInvoicesAcrossTenants` (satu tenant gagal → seluruh daftar error).
- Inbox notifikasi lintas-tenant dibangun di atas aturan ini — lihat
  `parent-cross-tenant-inbox.md` pada folder yang sama.
