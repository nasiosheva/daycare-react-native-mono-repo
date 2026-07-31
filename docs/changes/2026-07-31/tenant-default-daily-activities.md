# Default aktivitas harian tenant

## Perubahan

- Menambahkan `TenantDefaultCurriculumActivitySeeder` yang membuat 14 `CurriculumActivity` aktif dan tenant-owned untuk rutinitas harian: Morning circle, Doa pagi, Senam dan gerak lagu, Snack time, Kegiatan tematik, Sensory play, Outdoor play, Story telling, Art & craft, Lunch time, Nap time, Free play, Review kegiatan, dan Persiapan pulang.
- Setiap aktivitas menyimpan nama, deskripsi operasional, `organizationId`, dan status aktif.
- Memanggil seeder tersebut di transaksi pembuatan tenant Platform Admin, setelah organisasi dan cabang utama dibuat.

## Perilaku

- Hanya tenant baru yang menerima katalog ini. Tenant yang telah ada tidak diubah atau di-backfill.
- Katalog aktivitas tetap data operasional milik tenant, bukan tambahan ke seeder kurikulum global dan bukan Program Perkembangan. Staff Admin dapat mengubah atau mengarsipkannya melalui flow aktivitas yang ada.

## Verifikasi

- Unit test memverifikasi katalog berisi tepat 14 aktivitas aktif, seluruhnya terikat pada tenant dan memiliki deskripsi.
- Unit test provisioning tenant memverifikasi seeder aktivitas dipanggil saat tenant dibuat.
