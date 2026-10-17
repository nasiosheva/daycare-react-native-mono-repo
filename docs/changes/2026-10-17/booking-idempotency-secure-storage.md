# Perbaikan penyimpanan idempotency booking di Android

<!-- Mories Deo Hutapea,S.E.,S.Kom -->

Key idempotency logis untuk pembelian dan booking layanan berisi pemisah seperti
titik dua dan koma. Karakter tersebut tidak diterima sebagai nama key oleh
Android `SecureStore`, sehingga alur gagal sebelum request booking mencapai API.

Helper idempotency kini mengubah key logis menjadi format aman dan deterministik
khusus penyimpanan Android. Operasi baca, tulis, dan hapus menggunakan transformasi
yang sama. Key Web dan key SecureStore iOS tetap tidak berubah agar retry yang
sebelumnya sudah memiliki idempotency key tetap menggunakan nilai yang sama.
Nilai `Idempotency-Key` yang dikirim ke API tetap UUID dan tidak berubah
semantiknya.

Verifikasi melalui unit test helper meliputi kompatibilitas karakter SecureStore
Android, konsistensi key baca/tulis/hapus, penggunaan ulang nilai yang tersimpan,
dan preservasi key iOS untuk retry.
