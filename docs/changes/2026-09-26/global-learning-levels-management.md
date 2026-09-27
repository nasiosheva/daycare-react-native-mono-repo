# Layar kelola Tingkatan referensi global (Platform Admin)

## Latar belakang

Audit lanjutan atas alur yang belum terhubung (setelah `flow-wiring-business-rules.md`
di hari yang sama) menemukan bahwa `/v1/platform/learning-levels` sudah punya
`POST`/`PATCH`/`DELETE` lengkap di backend dan di `packages/api-client`
(`createGlobalLearningLevel`, `updateGlobalLearningLevel`,
`deleteGlobalLearningLevel`), tetapi tidak ada layar atau menu di mobile yang
memanggilnya — hanya versi baca (`globalLearningLevels()`) yang dipakai, sebagai
chip pemilih saat membuat Program Kurikulum/Perkembangan global. Platform Admin
tidak bisa menambah tingkatan referensi baru tanpa migrasi database.

## Perilaku baru

- Menu **Master data global** (`platform-catalog.tsx`) mendapat item baru
  **Tingkatan global**, membuka layar `global-learning-levels.tsx`: daftar
  tingkatan (nama, rentang usia, urutan) dengan FAB tambah, aksi ubah, dan
  aksi hapus dengan konfirmasi yang menyebut nama tingkatan.
- **Perbaikan keamanan data yang ditemukan sekaligus:** `deleteGlobalLevel`
  di backend sebelumnya tidak menjaga referensi ke Program Perkembangan
  global. Kolom `development_programs.learning_level_id` memakai
  `ON DELETE CASCADE` ke `learning_levels`, sehingga menghapus tingkatan yang
  masih dipakai akan diam-diam ikut menghapus Program Perkembangan global di
  bawahnya — melewati validasi "tidak boleh menghapus program yang sudah
  ditetapkan ke anak" yang selama ini hanya ditegakkan di jalur hapus-program
  (`GoalService.deleteProgram`/`deleteGlobalProgram`), bukan di jalur
  hapus-tingkatan. Sekarang `LearningStructureService.deleteGlobalLevel`
  menolak dengan pesan terlokalisasi baru (`error.learningLevelAssigned`)
  bila `DevelopmentProgramRepository.existsByLearningLevelId` masih `true`,
  memaksa Platform Admin menghapus/memindahkan Program Perkembangan di
  tingkatan itu terlebih dahulu. Baris `child_goals.template_id` sendiri
  masih dijaga FK `NO ACTION` bawaan Postgres, jadi Goal Anak yang sudah
  ditetapkan tetap tidak mungkin terhapus lewat jalur ini.

## Dampak

- Backend: `object LearningLevelError { ASSIGNED }` di
  `LearningStructureService.kt`; method baru
  `DevelopmentProgramRepository.existsByLearningLevelId`; registrasi di
  `ApiExceptionHandler.errorKeys`, `errors_id.properties`,
  `errors_en.properties`.
- Mobile: file baru `apps/mobile/app/global-learning-levels.tsx`; route
  ditambahkan ke daftar `animation: "none"` di `_layout.tsx`; menu item baru
  di `platform-catalog.tsx`; kunci i18n baru `globalLearningLevels.*` di 7
  bahasa (`translations.ts`).
- `docs/business-rules.md` §6 menambahkan baris yang mendokumentasikan
  layar ini dan alasan penjagaan aplikasi di atas.
- README.md **tidak diubah** — tabel endpoint README sudah tidak
  mencantumkan endpoint Platform Admin sejenis (`global-development-programs`,
  `global-development-categories` juga tidak ada barisnya), jadi ini
  konsisten dengan cakupan dokumentasi yang sudah ada, bukan celah baru.
- Tidak ada migrasi database baru.

## Verifikasi

- Backend (`./apps/api/gradlew -p apps/api test --no-daemon`): test baru di
  `LearningStructureServiceTest` (create sukses, delete sukses saat tidak
  dipakai, delete ditolak saat masih dipakai Program Perkembangan) dan di
  `ApiExceptionHandlerTest` (lokalisasi pesan baru) — semua lulus bersama
  suite penuh.
- Frontend (`corepack pnpm test`): mobile 95, api-client 37, ui 8, core 7 —
  semua lulus. `tsc --noEmit` mobile bersih (route baru perlu
  `apps/mobile/.expo/types/router.d.ts` diregenerasi lokal — berkas ini
  di-gitignore dan dibangun ulang otomatis oleh Expo CLI, bukan bagian dari
  commit).
- `expo lint`: tidak ada temuan baru di file yang diubah.

## Tindak lanjut

- Tidak ada tingkatan global yang sudah ada di lingkungan ini terhapus atau
  berubah; perbaikan hanya menambah penjagaan pada aksi hapus yang baru
  pertama kali reachable dari UI lewat perubahan ini.
