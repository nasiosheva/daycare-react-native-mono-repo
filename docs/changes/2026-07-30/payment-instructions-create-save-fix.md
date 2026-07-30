# Perbaikan simpan instruksi pembayaran

## Perubahan

- Memisahkan status form terbuka dari data instruksi yang sedang diedit pada layar Instruksi pembayaran.
- Aksi **Tambah instruksi** sekarang selalu mengirim `POST /payment-instructions`; sebelumnya ia membuat ID kosong sehingga keliru mengirim `PATCH /payment-instructions/`.
- Menampilkan validasi inline sebelum request bila nama bank/e-wallet, nama penerima, atau nomor rekening/akun belum diisi.
- Memindahkan aksi **Tambah instruksi** ke `FloatingActionButton` agar konsisten dengan daftar pengelolaan Staff Admin lainnya.

## Verifikasi

- Lulus `corepack pnpm --filter @daycare/app typecheck`.
