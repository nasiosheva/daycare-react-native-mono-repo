# Penyederhanaan alur kehadiran Staff dan approval pengecualian penjemput

<!-- Mories Deo Hutapea,S.E.,S.Kom -->

## Perubahan

- Daftar kehadiran menampilkan hanya aksi berikutnya yang relevan untuk status anak: check-in atau check-out.
- Konfirmasi manual tetap wajib. Waktu saat ini ditampilkan sebagai nilai awal; pemilih waktu hanya dibuka bila Staff memilih untuk mengubahnya.
- Untuk check-out Daycare tanpa otorisasi penjemput aktif, Staff mengirim permintaan satu kali dengan identitas penjemput dan alasan. Staff Admin memverifikasi instruksi wali dan menyetujui/menolak dari antrean khusus; persetujuan berlaku 5 menit, sekali pakai, dan hanya Staff yang melakukan check-out.
- Aturan UI ini dicatat pada `docs/business-rules.md` agar konfirmasi dan validasi server tetap terjaga.

## Akses

Pencatatan dan pemindaian kehadiran hanya untuk Staff aktif. Staff Admin tetap memiliki akses ke rekap dan review approval pengecualian, bukan ke aksi pencatatan. UI, guard route, konteks aksi API, dan aturan bisnis mengikuti batas ini.

Pengecualian pickup dibatasi tenant/cabang/anak, hanya tersedia untuk offering Daycare, memerlukan anak yang sedang check-in dan tidak memiliki authorization aktif. Permintaan berlaku 15 menit; Staff Admin wajib mengisi cara serta catatan verifikasi wali; approval berlaku 5 menit, single-use, dan server memeriksa ulang authorization saat dikonsumsi. Approval, penolakan, dan konsumsi memiliki audit; Admin tidak dapat melakukan checkout langsung.

## Implementasi dan verifikasi lanjutan

- API: `PickupExceptionService`, migration `V35__pickup_exception_approval.sql`, API client, screen Staff Admin, dan UI request Staff.
- Test-first: `PickupExceptionServiceTest` membuktikan masa berlaku, scope tenant, hak role, single-use, dan status kedaluwarsa; service Attendance juga memastikan grant exception direkam di attendance.
- Browser/perangkat belum diuji; hasil lokal di bawah hanya untuk tes/typecheck yang benar-benar dijalankan pada sesi ini.

## Verifikasi

- Test-first akses: tes route mobile dan konteks backend gagal sebelum implementasi karena Staff Admin masih diberi akses/aksi; setelah patch seluruh tes fokus lulus.
- `pnpm --filter @daycare/app exec vitest run src/navigation/LegacyDaycareRouteGuard.test.ts src/navigation/notificationRouteAccess.test.ts src/attendance/attendanceRoster.test.ts` — 3 file, 19 tes lulus.
- `pnpm --filter @daycare/app test` — 58 file, 235 tes lulus.
- `pnpm --filter @daycare/app run test:coverage` — lulus; seluruh cabang `attendanceAction` teramati pada coverage report.
- `pnpm --filter @daycare/app test:ui` — 7 suite, 27 tes lulus; ada warning React `act(...)` lama di tes `OfflineProvider`, di luar perubahan ini.
- `pnpm --filter @daycare/app typecheck` — lulus.
- `pnpm --filter @daycare/app exec eslint app/attendance.tsx src/navigation/legacyDaycareRouteAccess.ts src/navigation/notificationRouteAccess.ts src/navigation/LegacyDaycareRouteGuard.test.ts src/navigation/notificationRouteAccess.test.ts src/attendance/attendanceRoster.ts src/attendance/attendanceRoster.test.ts` — lulus.
- `apps/api/gradlew -p apps/api test --no-daemon` — 94 suite, 909 tes lulus; sesudah perubahan terakhir pada visibility pending request, 3 suite terarah (`PickupExceptionServiceTest`, `PickupAuthorizationServiceTest`, `AttendanceServiceTest`) juga dijalankan dan lulus (44 tes).
- `pnpm --filter @daycare/api-client test -- src/index.wrappers.test.ts` — 2 file, 66 tes lulus.
- `pnpm --filter @daycare/app typecheck` dan ESLint terarah pada screen, hook, route policy, guard test, serta translations — lulus.
- `git diff --check` dan `git diff --cached --check` — lulus.
- `git diff --check` — lulus.
