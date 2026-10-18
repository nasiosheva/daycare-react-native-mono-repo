<!-- Mories Deo Hutapea,S.E.,S.Kom -->
# Banner global untuk Parent

## Why

Parent Home sudah menampilkan pengumuman tenant yang memang ditujukan kepada Parent, tetapi belum ada jalur informasi global dari Platform Admin. Parent yang belum terhubung ke tenant juga perlu dapat menerima informasi umum platform.

## What changes

- Menambahkan `PlatformBanner` terpisah dari `TenantAnnouncement`.
- Platform Admin dapat membuat/mengubah draf, menerbitkan langsung atau menjadwalkan, mengatur expiry opsional, melihat preview Parent yang non-interaktif, dan menutup banner.
- Akun Parent terautentikasi membaca banner yang diterbitkan tanpa syarat membership tenant.
- Banner global adalah promosi visual dengan URL gambar HTTPS wajib, dikelola Platform Admin dan ditampilkan dalam slider gambar Parent Home.
- Pengumuman tenant tetap terpisah dari promosi dan muncul sebagai popup slider yang dapat ditutup, hanya bagi recipient yang terotorisasi. Keduanya dapat memiliki aksi opsional yang dibatasi ke URL HTTPS atau halaman aplikasi allowlist; aksi nonaktif secara default.

## Out of scope

- Acknowledgement untuk promosi global, push notification, targeting promosi per tenant, dan analitik impresi.
- Mengubah atau menghapus pengumuman tenant yang telah ada.
