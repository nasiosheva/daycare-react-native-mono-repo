<!-- Mories Deo Hutapea,S.E.,S.Kom -->
# Chat realtime lintas tenant dan pemulihan thread

## Perubahan

- Event `CHILD_MESSAGES` yang hanya memuat identifier dikirim ke sesi user penerima tanpa bergantung pada tenant aktif socket. Penerima harus memiliki guardian link/assignment yang sesuai dan membership aktif dengan role Parent/Staff pada tenant asal; Staff Admin aktif tetap menjadi fallback untuk pesan Parent bila tidak ada Staff aktif yang di-assign. Event lain tetap memakai tenant-scoped delivery.
- Reconnect menginvalidasi seluruh query thread chat yang sedang diamati. Thread juga dimuat ulang saat screen kembali fokus atau aplikasi kembali ke foreground.
- Isi dan status pesan tetap diambil melalui REST tenant + child-scoped; event WebSocket bukan sumber data.

## Verifikasi

- RED/GREEN refresh realtime: test awal membuktikan thread tidak ter-refresh pada reconnect/focus; invalidasi query dan hook pemulihan menutup kasus tersebut.
- RED/GREEN otorisasi recipient: dua test `ChildMessageServiceTest` gagal sebelum patch karena guardian nonaktif masih menerima event dan Staff nonaktif menghalangi fallback; keduanya lulus setelah filter membership aktif dan role tenant diterapkan.
- RED/GREEN preferensi mute: test `RealtimeConnection` membuktikan preference chat harus dibaca dari tenant asal event, bukan tenant socket aktif. Inbox tetap memakai tenant aktif.
- ESLint resolver mobile kini mengenali suffix `.native` dan `.web`, sehingga import tanpa suffix untuk implementasi platform-spesifik tervalidasi dengan aturan resolver yang sama seperti TypeScript/Metro.
- Backend penuh: `GRADLE_USER_HOME=.gradle-local ./apps/api/gradlew -p apps/api test --no-daemon --max-workers=1` — `BUILD SUCCESSFUL`; JaCoCo 88% line dan 87% branch.
- Mobile penuh: `pnpm --filter @daycare/app test` — 60 file, 242 test lulus; `pnpm --filter @daycare/app typecheck` lulus.
- Full `pnpm --filter @daycare/app lint` lulus tanpa error (16 warning lint yang sudah ada di file lain/test); lint terarah pada file yang berubah juga lulus tanpa error.
- `git diff --check` lulus. Belum ada validasi browser/device, CI, atau live service; status bukti ini dicatat terpisah dan tidak diklaim sebagai pengujian yang sudah dilakukan.

## Catatan

- Belum dilakukan validasi langsung pada perangkat atau server berjalan. Test renderer menampilkan peringatan deprecation yang juga muncul di test realtime lain. Perubahan ini menjaga notification/inbox dan event realtime non-chat tetap terpisah.
