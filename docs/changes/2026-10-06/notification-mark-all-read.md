# Tandai semua notifikasi sudah dibaca

## Perubahan

- Menambahkan endpoint tenant-scoped `PATCH /notifications/read-all`.
- Server hanya mengubah notifikasi unread milik recipient yang sedang login pada
  tenant tersebut; notifikasi tidak dihapus dan push mute tidak berubah.
- Inbox Parent yang digabung lintas tenant menjalankan mutasi satu per tenant
  legal. Staff, Staff Admin, dan Parent single-tenant tetap memakai tenant
  context yang sama seperti daftar notifikasi.
- Daftar notifikasi sekarang dipaginasi server-side dengan sepuluh item per
  halaman. Inbox Parent tetap meminta halaman per tenant secara terpisah,
  menggabungkan halaman yang sudah dimuat berdasarkan waktu terbaru, lalu
  menampilkan navigasi halaman gabungan tanpa melemahkan tenant scope. Server
  mengembalikan total dan unread count agar aksi batch tetap tersedia walau
  notifikasi unread berada di halaman lain.
- Halaman `apps/mobile/app/notifications.tsx` menampilkan action **Tandai semua
  sudah dibaca** ketika ada unread. Loading, partial failure, dan invalidasi
  cache per tenant ditangani eksplisit.
- Semua label/action error tersedia pada tujuh locale aplikasi.

## Verifikasi

- API client test untuk request batch mark-read.
- Typecheck dan test workspace mobile.
- Suite test backend Gradle.
