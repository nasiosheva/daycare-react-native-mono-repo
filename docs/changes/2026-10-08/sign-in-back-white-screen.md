# Layar putih saat back dari sign-in setelah logout

## Masalah

Setelah logout (dari Profile) atau kehilangan sesi (token tidak valid saat
masih di Home, atau cold boot sudah logout), aplikasi mendarat di
`/sign-in`. Menekan back (hardware Android atau gesture iOS) menampilkan
layar putih kosong, bukan keluar aplikasi atau layar yang masuk akal.

## Akar masalah

`router.replace(href)` di Expo Router hanya mengganti layar paling atas di
riwayat navigasi; layar-layar di bawahnya (mis. `/home`, `/profile`) tetap
tersimpan. Tiga jalur menuju `/sign-in` semuanya memakai `replace` polos:

- `index.tsx` ("/") saat `user` null.
- `home.tsx` saat `user` null (sesi hilang ketika masih di Home).
- `profile.tsx`'s `leave()` setelah menekan **Keluar**.

Karena layar terautentikasi lama masih ada di belakang `/sign-in`, back
memunculkannya kembali dalam keadaan tidak valid (profile/organizationId
sudah null). Di `profile.tsx`, `leave()` juga memanggil `router.replace`
secara sinkron sementara `home.tsx` (bila masih ter-mount di latar
belakang) dapat memicu `router.replace` reaktifnya sendiri lewat
`SafeRedirect` pada saat yang hampir bersamaan — dua `replace` yang
bersaing ke stack yang sama berpotensi meninggalkan entry yang rusak.

## Perbaikan

- `SafeRedirect` mendapat prop opsional `dismissStack`. Bila `true`,
  memanggil `router.dismissAll()` (setara `popToTop`, aman dipanggil
  walau tidak ada yang perlu di-dismiss) sebelum `router.replace(href)`,
  sehingga stack hanya berisi satu entry: tujuan redirect. Prop ini
  opsional dan default `false`, sehingga lima pemakai `SafeRedirect`
  lain (guard akses yang mengarah ke `/home`) tidak berubah perilakunya.
- `home.tsx`: `<Redirect href="/sign-in" dismissStack />`.
- `index.tsx`: hanya cabang `/sign-in` yang memakai `dismissStack`
  (cabang `/sign-up` dan `/home` tidak berubah).
- `profile.tsx`'s `leave()`: memanggil `router.dismissAll()` sebelum
  `router.replace("/sign-in")`, dengan komentar penjelasan.

Urutan `dismissAll()` lalu `replace()` aman dipanggil berulang dari
beberapa pemicu sekaligus (idempotent): panggilan kedua tidak menemukan
apa pun untuk di-dismiss dan hanya me-replace entry `/sign-in` yang sudah
ada dengan dirinya sendiri.

## Verifikasi

- `pnpm --filter @daycare/app typecheck` lulus.
- `pnpm verify` lulus: lint (0 error), typecheck, test (142 test mobile,
  tidak ada yang berubah — `SafeRedirect` tidak punya test sebelumnya,
  dan menguji perilaku navigator Expo Router secara unit tidak sesuai pola
  test navigasi yang sudah ada di repo ini, yang menguji fungsi akses
  murni, bukan komponen router).
- Uji perangkat: **belum**, tidak ada perangkat Android/iOS yang
  terhubung saat perbaikan ini dibuat. Perlu dikonfirmasi: logout dari
  Profile → tekan back di `/sign-in` → aplikasi keluar atau tetap di
  `/sign-in`, bukan layar putih.
