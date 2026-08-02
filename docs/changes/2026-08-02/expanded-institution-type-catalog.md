# Seeder katalog jenis lembaga sampai SMA

## Perubahan

- Menambahkan seed built-in untuk TPA, KB, SPS, RA, BIMBA, SD, MI, SMP, MTs, SMA, MA, dan SMK.
- Menjadikan seluruh kode tersebut built-in sehingga tidak dapat dihapus dari katalog Platform Admin.

## Batas capability

- Seed ini hanya menambah pilihan jenis lembaga. Capability aktif tetap hanya `DAYCARE_OPERATIONS` untuk `DAYCARE` dan `ACADEMIC_CURRICULUM` untuk `PAUD`/`TK`.
- BIMBA, SD sampai SMA, madrasah, dan SMK tidak mendapat menu, route, enrollment, billing, atau akademik sekolah otomatis.

## Verifikasi

- Migration memakai `ON CONFLICT (code) DO NOTHING`, sehingga aman untuk database yang sudah memiliki kode-kode tersebut.
