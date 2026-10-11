# Mode offline Staff dan data anak

<!-- Mories Deo Hutapea,S.E.,S.Kom -->

## Status

Implementasi sudah berjalan sebagian. Draft offline `CHILD_CARE_LOG_CREATE`
sekarang **benar-benar tersambung end-to-end**: `child-care-logs.tsx` memanggil
`useOffline().enqueueChildCareLog` (sebelumnya memanggil `api.createChildCareLog`
langsung, lihat riwayat perbaikan di "Implementasi saat ini"), kunci cache
baca sudah menyertakan `branchId`+`childId`, dan bug purge yang menghapus nama
snapshot salah sudah diperbaiki. `offeringId` dan `contextRevision` pada kunci
cache **sengaja ditunda** — lihat alasannya di "Kesenjangan".

## Keputusan

- Staff dan Staff Admin akan memiliki target draft operasional offline yang
  terenkripsi dan selalu scoped ke tenant, cabang, offering, anak, actor, dan
  context revision.
- Parent hanya mendapat target snapshot anak read-only yang terbatas; mode
  offline tidak memberi Parent hak mutasi atau akses ke data anak lain.
- Pembayaran, approval, consent, akses, kesehatan/obat, penutupan insiden,
  publish, upload bukti, dan penghapusan tetap online-only.
- Server tetap menjadi authority. Sinkronisasi memakai idempotency key dan
  expected revision, sedangkan konflik, revocation, logout, pergantian
  context, dan `NOT_AUTHORIZED` memicu purge atau keputusan eksplisit.

## Dokumentasi yang diperbarui

- `docs/business-rules.md` menambahkan §13.2.1 tentang scope cache anak,
  outbox, state draft, batas mutasi, konflik, retensi, dan pembersihan.
- `README.md` menjelaskan bahwa mode offline belum tersedia sampai kontrak
  tersebut diimplementasikan dan diuji.

## Implementasi saat ini

- **Mobile** (`apps/mobile/src/offline/`): `OfflineProvider` dipasang di
  `_layout.tsx` di dalam `AuthProvider`; `AuthProvider` menyambungkan status
  jaringan (`onNetworkFailure`/`onNetworkResponse`) ke provider ini. Outbox
  mendukung satu jenis task, `CHILD_CARE_LOG_CREATE`, dengan status
  `READY_TO_SYNC | SYNCING | CONFLICT | REJECTED`. Storage native
  (`persistence.native.ts`) memakai `expo-secure-store` (terenkripsi OS
  keychain); storage web (`persistence.web.ts`) memakai `localStorage` biasa
  (belum terenkripsi). `OfflineStatusBanner` menampilkan status dan waktu
  sinkron terakhir lewat modul terjemahan `offlineTranslations` (7 locale),
  tanpa aksi discard/retry manual.
- **Backend**: migrasi `V27__child_care_log_idempotency.sql` menambahkan
  kolom nullable `client_mutation_id` pada `child_care_logs` dengan unique
  index per organisasi. `ChildCareLogService` mengenali `clientMutationId`
  yang sudah pernah dikirim dan mengembalikan record yang sama alih-alih
  membuat duplikat (menolak jika `childId` tidak cocok).
- **api-client**: `createChildCareLog` mengirim `clientMutationId` hanya lewat
  header `Idempotency-Key` (tidak lagi ikut di body JSON). Backend membaca
  dedup key eksklusif dari header itu (`@RequestHeader(value =
  "Idempotency-Key", required = false)` di `Controllers.kt`, diteruskan ke
  `ChildCareLogService.create(..., idempotencyKey)`); `CreateChildCareLogRequest`
  (body DTO) tidak lagi punya field `clientMutationId`.
- **Kunci cache baca** (`OfflineProvider.tsx` `cacheDescriptor`): entri cache
  Staff untuk care-logs sekarang berkunci `care:{branchId}:{childId}` (bukan
  `care:{childId}` saja) — `branchId` diambil dari `useChildProfile(childId)`
  (hook yang sudah ada di `src/children/useChildManagement.ts`, dipakai ulang
  bukan fetch baru) di `child-care-logs.tsx`, lalu diikutkan ke query key
  React Query (`["child-care-logs", organizationId, childId, branchId]`);
  query baru menunggu `branchId` tersedia sebelum jalan. Entri snapshot Parent
  sekarang berkunci `profile:{branchId}:{childId}` — `branchId` diambil
  langsung dari payload `ParentChildProfile.branch.id` tanpa fetch tambahan.
  Query `child-daily-timeline.tsx` yang masih memakai key 3-elemen (tanpa
  `branchId`) sekarang sengaja tidak ikut di-cache offline oleh
  `cacheDescriptor` (butuh elemen ke-4 bertipe string); layar itu tetap
  berfungsi online seperti biasa, hanya tidak mendapat snapshot offline.
- **Bug fix**: `store.ts` `purgeOfflineScope` sebelumnya menghapus
  `.snapshot.child-care-logs` dan `.snapshot.parent-child-profile` — nama yang
  **tidak pernah ditulis**, karena `OfflineProvider` selalu menyimpan satu
  bundle gabungan bernama `.snapshot.cache`. Purge jadi tidak benar-benar
  menghapus cache snapshot sebelumnya. Diperbaiki untuk menghapus
  `.snapshot.cache`.
- **`child-care-logs.tsx` sekarang memanggil `useOffline().enqueueChildCareLog`**
  (sebelumnya memanggil `api.createChildCareLog` langsung, melewati outbox
  sepenuhnya). `enqueueChildCareLog` di `OfflineProvider.tsx` diubah: setelah
  menyimpan task ke outbox, ia langsung memanggil `flush()` (mencoba kirim
  seketika bila online), lalu mengembalikan `{ task, synced }` — `synced`
  dihitung dari `tasksRef.current` (bukan state React yang bisa basi) untuk
  tahu apakah task itu benar-benar terkirim atau masih tertunda. Layar
  menampilkan notifikasi yang jujur sesuai hasil: `operations.careSaved`
  ("tersimpan", tone sukses) hanya bila `synced === true` dan baru memanggil
  `invalidate()` saat itu; bila `synced === false` (offline atau gagal
  kirim), menampilkan `offline.careLogQueued` ("disimpan lokal, akan dikirim
  saat tersambung", tone info) dan **tidak** invalidate query (supaya tidak
  memicu refetch yang pasti gagal saat offline dan menampilkan ErrorState
  yang membingungkan). Ini memenuhi larangan §13.2.1 bahwa draft yang belum
  terkirim tidak boleh diberi status "berhasil".

## Kesenjangan terhadap §13.2.1

- **Draft tertunda belum tampil di daftar catatan.** Saat `enqueueChildCareLog`
  mengembalikan `synced: false` (offline), `child-care-logs.tsx` sengaja tidak
  invalidate query (lihat Implementasi), tapi itu artinya catatan yang baru
  saja dibuat **tidak langsung muncul** di daftar `logs.data` — hanya
  `OfflineStatusBanner` yang menunjukkan ada draft tertunda (`pendingCount`).
  Pengguna harus menunggu sampai sinkron berhasil dan query ter-invalidate
  baru catatannya terlihat di daftar. Memperbaiki ini butuh menggabungkan
  task outbox yang masih tertunda ke tampilan daftar (state terpisah, bukan
  cuma `logs.data` dari server) — di luar lingkup "sambungkan ke
  `enqueueChildCareLog`" yang baru selesai.
- Kunci cache per-entri untuk care-logs Staff dan snapshot Parent sekarang
  menyertakan `branchId` + `childId` (`care:{branchId}:{childId}`,
  `profile:{branchId}:{childId}`) — **selesai pada sesi ini**. `offeringId`
  dan `contextRevision` **sengaja ditunda**, bukan diabaikan: `offeringId`
  tidak punya pemetaan ke anak sama sekali di model data saat ini (`Child`
  tidak punya field `offeringId`; `EducationOffering` sendiri masih berstatus
  "Model target" di §13.3, belum selesai dibangun), dan `contextRevision`
  tidak punya konsep apa pun di backend atau klien manapun di repo ini (sudah
  di-grep, nihil di luar teks aturan itu sendiri). Mengisi dua field ini
  dengan nilai palsu/statis akan memberi ilusi kepatuhan tanpa proteksi nyata
  — keduanya butuh pekerjaan desain+backend terpisah sebelum bisa diisi
  secara jujur.
- Purge baru terpicu saat user/organisasi/role berubah; belum terpicu saat
  ganti cabang/offering/anak, dan belum ada hook untuk purge segera saat
  menerima `NOT_AUTHORIZED`. (Bug purge yang menghapus nama snapshot salah
  sudah diperbaiki pada sesi ini — lihat Implementasi.)
- Storage web belum terenkripsi, berbeda dari storage native.
- State outbox belum mencakup `LOCAL_DRAFT`, `SYNCED`, `DISCARDED`; belum ada
  aksi discard eksplisit untuk draft `REJECTED`/`CONFLICT`.
- Baru 1 dari 4 jenis draft offline yang disebut di §13.2.1 yang
  diimplementasikan.

## Verifikasi

- `./apps/api/gradlew -p apps/api test --no-daemon --tests
  "*.ChildCareLogServiceTest"` — 11 test lolos (8 lama + 3 baru untuk dedup
  `clientMutationId`): replay mengembalikan log yang sama tanpa `save`/audit
  baru saat `clientMutationId` cocok untuk anak yang sama, request ditolak
  (`IllegalArgumentException`) saat `clientMutationId` sudah dipakai untuk
  anak lain, dan `clientMutationId` baru tersimpan di entity saat belum
  pernah dikirim sebelumnya.
- `pnpm --filter @daycare/app typecheck` — lolos. Sebelumnya gagal karena 3
  masalah pra-existing di modul offline (tidak terkait idempotency), sudah
  diperbaiki: import `PropsWithChildren` di `OfflineProvider.tsx` dipindah
  dari `react-native` ke `react`; `persistence.native.ts` memperbaiki
  penyempitan tipe `chunks` (`typeof parsed.chunks === "number"`) sehingga
  tidak lagi `possibly undefined`; dan modul `offlineTranslations` baru
  ditambahkan ke `i18n/translations.ts` (7 locale lengkap: id, en, zh, fr,
  pt, es, ru) untuk 11 key yang dipakai `OfflineStatusBanner.tsx`
  (`offline.onlineTitle`, `offlineTitle`, `syncingTitle`, `conflictTitle`,
  `staleTitle`, `offlineDescription`, `syncing`, `conflict`, `stale`,
  `online`, `lastSync`).
- `pnpm --filter @daycare/app lint` — 0 error, 15 warning (semua pra-existing
  di file lain, tidak terkait perubahan offline mode).
- `pnpm --filter @daycare/app test -- src/offline` — 45 file test, 145 test
  lolos (termasuk `i18n/translations.test.ts` yang memvalidasi kelengkapan
  translation key di semua locale, dan `offline/outbox.test.ts`).
- `pnpm --filter @daycare/api-client typecheck` — lolos.
- `pnpm --filter @daycare/app typecheck`, `lint`, dan `test` dijalankan ulang
  dua kali: setelah perubahan kunci cache, dan setelah menyambungkan
  `child-care-logs.tsx` ke `enqueueChildCareLog` — typecheck lolos tiap kali,
  lint tetap 0 error/15 warning pra-existing, dan 45 file/145 test tetap
  lolos.
- `apps/mobile/src/offline/outbox.test.ts` ada 3 kasus dasar (pembuatan task
  dan `clientMutationId`, pending count mengecualikan `REJECTED`, klasifikasi
  status retryable) — belum menutup skenario scope key, expiry, duplicate
  event, conflict, atau purge yang disyaratkan §13.2.1.

## Tindak lanjut

- Tampilkan draft outbox yang masih tertunda di daftar `child-care-logs.tsx`
  (bukan cuma lewat `OfflineStatusBanner`), supaya pengguna langsung melihat
  catatan yang baru dibuat meski belum sinkron.
- Desain konsep `contextRevision` di backend (versi akses per
  membership/assignment yang naik saat revocation/reassignment) sebelum
  mengisi field itu di kunci cache/draft.
- Putuskan bagaimana menangani `offeringId` pada kunci cache: tunggu
  `EducationOffering` (§13.3) selesai dibangun, atau revisi §13.2.1 agar
  tidak mensyaratkan `offeringId` untuk app ini bila model data anak memang
  tidak akan terikat ke offering tertentu.
- Tambahkan trigger purge untuk pergantian cabang/offering/anak dan untuk
  respons `NOT_AUTHORIZED` langsung.
- Perluas test outbox mobile untuk scope key, expiry, duplicate event,
  conflict, dan purge (test dedup `clientMutationId` backend sudah selesai,
  lihat Verifikasi).
- Putuskan jalur enkripsi untuk storage web sebelum draft offline diaktifkan
  di platform web, atau nonaktifkan draft mutasi offline untuk web sampai
  itu selesai.
- Implementasikan jenis draft offline berikutnya (development notes,
  handover, attendance check-in/out) setelah kesenjangan di atas selesai.
