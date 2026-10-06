# Spinner tombol hanya pada item yang sedang diproses

## Perilaku baru

Beberapa layar daftar memakai satu mutation untuk semua item, lalu
memasang `loading={mutation.isPending}` di tombol setiap item. Akibatnya,
menekan tombol di satu item membuat tombol yang sama di **semua** item ikut
berputar.

Sekarang hanya item yang sedang diproses yang menampilkan spinner. Aksi yang
sama di item lain dinonaktifkan (tanpa spinner) sampai request selesai,
sehingga tetap hanya satu request yang berjalan. Ini sesuai §13.15 ("aksi yang
sama hanya dapat dikirim sekali"), dan baris lain tidak bisa menimpa
`variables` yang sedang dilacak.

Layar yang diubah (sisi Parent dan child-safety):
- `notifications.tsx`: tombol Buka/Tandai dibaca.
- `incident-reports.tsx`: acknowledge insiden.
- `emergency-contacts.tsx`: hapus kontak darurat.
- `pickup-authorizations.tsx`: aktivasi otorisasi penjemputan (Staff Admin).
- `child-consents.tsx`: tombol Setuju/Tolak. Spinner hanya pada tombol yang
  ditekan; tombol pasangannya di kartu yang sama ikut disabled.

## Mekanisme

`src/ui/pendingAction.ts` → `pendingActionState(mutation, isThisAction)`
mengembalikan `{ loading, disabled }` untuk di-spread ke `Button`
(`Button` sudah menganggap `loading` sebagai disabled). Helper ini pure dan
dites (`pendingAction.test.ts`).

## Verifikasi

- `pnpm verify`: exit 0; mobile 38 file / 112 test lulus.
- Belum diverifikasi visual di browser/simulator.
- README dan business-rules tidak perlu diubah: ini detail state tombol,
  sudah sesuai §13.15, tanpa perubahan flow, kontrak, atau aturan.

## Tindak lanjut

Pola yang sama masih ada di 18 tombol pada 13 layar Staff Admin/Platform
Admin, dan sudah dikonfirmasi berada di dalam render daftar:
`billing-admin.tsx` (nonaktifkan diskon, tandai lunas),
`parent-payments.tsx` (review bukti), `tenant-users.tsx` (nonaktifkan akun),
`child-program-templates.tsx` (hapus template), `branches.tsx` (jadikan
utama, arsipkan), `child-detail.tsx` (hapus program, lepas staf, lepas wali,
buat program dari template), `child-program-detail.tsx` (hapus langkah),
`consent-definitions.tsx` (aktif/nonaktif), `education-offerings.tsx` (ubah
status), `overtime-charges.tsx` (void), `platform-tenants.tsx` (tandai
lunas), `tenant-detail.tsx` (tandai lunas, void). Beberapa memanggil mutation
lewat fungsi perantara atau komponen anak, jadi bentuk `variables`-nya perlu
dicek per layar saat diterapkan.
