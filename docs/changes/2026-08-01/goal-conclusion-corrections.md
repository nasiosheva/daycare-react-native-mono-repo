# Koreksi Kesimpulan Goal

## Perubahan

- Menambahkan Koreksi Kesimpulan Goal untuk Goal yang sudah `COMPLETED`.
- Hanya Staff Admin aktif yang dapat melakukan koreksi. Form mewajibkan hasil akhir, ringkasan, dan alasan koreksi.
- Koreksi hanya memperbarui kesimpulan Staff saat ini. Check-in, indikator, Program sumber, target, tanggal, status Goal, dan waktu finalisasi awal tidak dapat diubah atau dibuka kembali.
- API menyimpan setiap koreksi append-only pada `child_goal_conclusion_corrections`, lengkap dengan nilai sebelum/sesudah, alasan, pelaku, dan waktu; tindakan ini juga menulis `AuditLog`.
- Riwayat koreksi dan alasan hanya diberikan kepada Staff Admin aktif. Staff dan Parent tetap hanya menerima kesimpulan terkini.

## API

- `POST /api/v1/child-goals/{goalId}/conclusion-corrections`
- Body: `outcome`, `summary`, dan `reason` wajib diisi.
- Respons `204 No Content`; klien memuat ulang Goal setelah koreksi berhasil.

## Verifikasi

- `corepack pnpm verify`.
- `./apps/api/gradlew -p apps/api test --tests com.daycare.api.service.GoalServiceTest --no-daemon`.
- `git diff --check`.

## Tindak lanjut

- Tidak ada. Koreksi tidak memperluas kemampuan untuk mengubah data penilaian historis.
