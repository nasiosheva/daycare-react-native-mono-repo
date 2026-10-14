// Mories Deo Hutapea,S.E.,S.Kom

# Kontrol operasional pengelolaan langganan tenant

## Perubahan

- Menambahkan kontrol pemisahan tugas untuk refund manual: prosedur disetujui fungsi keuangan dan approval dilakukan Platform Admin berizin; pengaju tidak boleh menyetujui refund sendiri, sedangkan penyetuju dan pelaksana transfer harus tercatat terpisah. Pengecualian operasional memerlukan approval kedua dan alasan audit.
- Menambahkan simulasi rollout `GRACE` yang read-only, menampilkan tenant terdampak serta dampak status/akses, tanpa menulis status, menagih, atau mengirim notifikasi.
- Menetapkan peninjauan hasil simulasi dan pembuatan ulang preview bila data sumber berubah sebelum aktivasi; rollout aktual dilakukan bertahap setelah konfirmasi.

## Batas perubahan

- Plan subscription diperbarui; `docs/business-rules.md`, kode, API, skema data, dan perilaku berjalan tidak berubah.
- Kontrol tersebut menjadi persyaratan desain/operasional. Detail normatif harus dimasukkan ke `docs/business-rules.md` sebelum implementasi terkait sesuai Tahap 0.

## Verifikasi

- Meninjau ulang bagian Tahap 0, kriteria penerimaan, operasional, dan keputusan pembayaran/refund agar kontrol saling konsisten.
- Pemeriksaan whitespace pada dokumen yang diubah; tidak menjalankan test kode karena perubahan ini hanya dokumentasi.

## Tindak lanjut

- Saat Tahap 0 dimulai, definisikan kontrak simulasi, pemilik review/konfirmasi rollout, serta role dan audit yang diperlukan untuk pemisahan tugas refund di `docs/business-rules.md`.
