# Backend coverage test batch

## Perubahan

- Menambahkan unit coverage untuk jalur validasi dan akses pada layanan Administration, Attendance, Billing, Child Absence, Child Incident, Child Management, Consent, Development, Goal, Institution Type Catalog, Learning Structure, Overtime, Parent Enrollment, Platform Administration, Private Tutoring, dan Staff Leave Request.
- Menambahkan coverage handler koneksi WebSocket untuk payload malformed, token/tenant tidak valid, koneksi global, koneksi tenant, dan payload lanjutan yang diabaikan setelah koneksi berhasil.
- `docs/local-accounts.md` tetap lokal dan tidak ikut dipublikasikan.

## Verifikasi

- `./apps/api/gradlew -p apps/api test --no-daemon` lulus.
- JaCoCo suite penuh terakhir: line `89.90%`, branch `69.96%`.
- `git diff --check` lulus.

Target 90% line dan branch belum tercapai; angka di atas adalah hasil terukur tanpa mengecualikan package bisnis dari laporan.
