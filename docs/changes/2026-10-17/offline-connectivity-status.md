# Patch status konektivitas offline

<!-- Mories Deo Hutapea,S.E.,S.Kom -->

## Perubahan

- Status offline kini mengikuti koneksi perangkat yang dilaporkan OS melalui `expo-network`.
- Kegagalan request API ditandai terpisah sebagai `API_UNAVAILABLE`; aplikasi tidak lagi menyimpulkan perangkat offline hanya dari kegagalan menghubungi server.
- Banner dan seluruh terjemahan menampilkan pesan berbeda untuk perangkat offline dan API yang tidak terjangkau.
- Hanya tipe koneksi OS `NONE` dianggap offline; tipe `UNKNOWN`, field yang hilang, atau kegagalan probing tidak dianggap sebagai bukti perangkat offline.

## Perilaku dan batas

`OFFLINE` berarti OS melaporkan tipe jaringan `NONE`. `API_UNAVAILABLE` berarti koneksi perangkat tersedia tetapi endpoint API gagal dijangkau; draft Staff tetap antre dan dicoba kembali saat API pulih atau aplikasi kembali aktif. Status ini tidak menyatakan bahwa internet global tersedia, hanya bahwa OS melaporkan perangkat terhubung ke jaringan.

## Verifikasi

- Regression test memastikan API network error menghasilkan `API_UNAVAILABLE` dan `isOffline: false`.
- Regression test memastikan status `OFFLINE` hanya muncul setelah OS melaporkan tipe jaringan `NONE`.
- Regression test memastikan sinyal pemulihan API, perangkat, dan app resume yang bertumpuk tidak mengirim draft yang sama dua kali.
- UI test memastikan banner API tidak terjangkau berbeda dari banner perangkat offline.
- Final batch before commit: app unit tests 58 files / 235 tests; UI tests 7 suites / 27 tests; app typecheck and targeted ESLint passed; full backend suite 94 suites / 909 tests passed.

## Follow-up

- Uji perilaku konektivitas native pada Android dan iOS nyata sebelum menyatakan verifikasi device-level selesai.
