# Password reset session security

## Perubahan

- Password Staff Admin dan Staff sekarang divalidasi 6–128 karakter pada DTO dan service; input reset Platform Admin membatasi input hingga 128 karakter.
- Perubahan password mencatat waktu pencabutan sesi pada `UserProfile`, sehingga JWT lokal yang diterbitkan sebelum perubahan ditolak oleh decoder.
- Semua koneksi WebSocket aktif milik pengguna yang password-nya berubah ditutup segera. Pengguna harus login kembali dengan password baru.
- Migrasi additive `V21__revoke_local_user_sessions_on_password_change.sql` menambah kolom `users.sessions_revoked_at`; tidak mengubah atau menghapus data password lama selain hash yang diganti.

## Verifikasi

- Test terarah backend untuk revocation service, local authentication, platform password reset, dan tenant provisioning lulus.
- Full backend suite (`./apps/api/gradlew -p apps/api test --no-daemon`) dan `pnpm verify` lulus.
