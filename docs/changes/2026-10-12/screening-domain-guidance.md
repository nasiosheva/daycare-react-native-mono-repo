# Cek perkembangan anak: langkah pengamatan per domain, bukan hanya per status

## Konteks

User meminta hasil Cek perkembangan anak punya "versi eksplisit yang bisa
langsung dipakai" sekaligus "versi klinis" — yang secara langsung bentrok
dengan aturan non-diagnostik di `docs/business-rules.md:2559-2563` (tidak ada
diagnosis, severity, atau label seperti "speech delay"). Setelah ditunjukkan
bentrokan ini, user memilih jalur yang aman: perkuat ringkasan praktis "Usia
Emas" yang sudah ada tanpa menambah label diagnosis apa pun.

Sebelumnya, "Langkah praktis dari Usia Emas" hanya punya 4 variasi — satu
kalimat generik per status utama (`SEGERA_DISKUSIKAN`,
`DISKUSIKAN_PERKEMBANGAN`, `PENGAMATAN_BELUM_CUKUP`,
`KEMAMPUAN_DILAPORKAN_TERLIHAT`), sama persis untuk Parent yang perhatiannya di
domain bahasa maupun yang di motorik kasar.

## Perubahan

Menambahkan langkah pengamatan **per domain perkembangan yang punya
`attentionCount > 0`** (`BK`, `MK`, `MH`, `KG`, `SE`, `AD`; `CTX` dikecualikan
karena bukan area kemampuan), ditampilkan tambahan di samping kalimat status
yang sudah ada — bukan menggantikannya.

- `apps/mobile/src/screening/resultGuidance.ts` — tambah
  `normalizeDomainCode`, `domainsWithAttention` (group+sum per kode
  ternormalisasi, filter ke 6 domain kemampuan, urutan tetap), serta
  `domainLabelKey`/`domainGuidanceKey`.
- `apps/mobile/src/i18n/translations.ts` — 12 key baru di `screeningTranslations`
  (6 label + 6 teks tips, `id`/`en` saja, mengikuti pola screening yang sudah
  ada).
- `apps/mobile/app/parent-screening.tsx` — render blok tips per domain tepat
  setelah blok guidance status yang sudah ada, pola list yang sama dengan
  `observedItems`/`reasons`.
- `apps/api/.../ScreeningResultExportService.kt` — `domainsWithAttention`
  (private) + `domainGuidance(code, locale)`, disisipkan ke PDF persis setelah
  `productGuidance(result)`, teks identik (diterjemahkan) dengan versi mobile
  supaya UI dan PDF konsisten.
- `docs/business-rules.md:2568-2578` — menambahkan kalimat bahwa langkah
  pengamatan ditampilkan per domain berperhatian, mengunci ini sebagai
  kontrak normatif.

Tidak ada perubahan API/tipe data: `domains`/`attentionCount` sudah ada di
`ScreeningResultResponse`/`ScreeningResult` sejak fase sebelumnya, cuma belum
dipakai untuk guidance. Layer ini (teks app-authored "Usia Emas") berada di
luar gerbang review klinis/publish katalog Platform Admin — gerbang itu hanya
berlaku untuk `statusTitleSnapshot`/`statusSummarySnapshot`/`nextStepSnapshot`/
`reasons`, yang tidak disentuh perubahan ini.

## Verifikasi

- `pnpm --filter @daycare/app typecheck` — lulus.
- `pnpm --filter @daycare/app exec vitest run src/screening/resultGuidance.test.ts` —
  8 test baru lulus (normalisasi kode, sum+filter+urutan domain, pengecualian
  `CTX`/kode tak dikenal, pemetaan label/guidance per domain).
- `./apps/api/gradlew -p apps/api test --no-daemon --tests "*.ScreeningResultExportServiceTest"` —
  lulus, termasuk 2 test baru (`domainsWithAttention`, `domainGuidance`) yang
  memanggil method private lewat reflection mengikuti pola test yang sudah ada
  di file ini.
- `./apps/api/gradlew -p apps/api test --no-daemon` (full suite) — lulus.
- Review manual seluruh 12 teks baru (6 domain × 2 locale, mobile dan backend):
  semua berbentuk "amati/coba X di rumah, lalu bawa contohnya ke tenaga
  kesehatan" — tidak ada kata yang menilai kemampuan, tingkat keparahan, atau
  diagnosis.

## Addendum — tombol "Salin ringkasan"

User lanjut minta cara agar Parent bisa menempel hasil ini ke AI lain untuk
dianalisis sendiri. Ditambahkan tombol **"Salin ringkasan"** di layar hasil,
menyalin ringkasan ringkas (status utama + tips per domain berperhatian, tanpa
daftar butir satu-satu) sebagai teks biasa ke clipboard — bukan PDF. Disclaimer
non-diagnostik tetap disertakan karena wajib ikut ke mana pun hasil ini
berpindah, sama seperti ketentuan untuk UI/PDF.

- Menambah dependency `expo-clipboard` (`npx expo install`).
- `apps/mobile/src/screening/resultGuidance.ts` — `buildCopySummary(...)`
  (pure function: status title+summary, daftar tips domain, disclaimer →
  satu string teks).
- `apps/mobile/app/parent-screening.tsx` — handler `copySummary` memanggil
  `Clipboard.setStringAsync`, tombol baru di baris aksi PDF, toast sukses/gagal.
- `apps/mobile/src/i18n/translations.ts` — 3 key baru (`screening.copySummary`,
  `.copySummaryDone`, `.copySummaryFailed`), `id`/`en` saja.
- Test baru: `buildCopySummary` menyertakan status+tips+disclaimer dan
  menghilangkan baris tips sama sekali ketika tidak ada domain berperhatian.
- Verifikasi: `pnpm --filter @daycare/app typecheck`/`lint`/`test` — lulus
  (177 test, 0 error lint).

## Tindak lanjut

Tidak ada gate baru yang dibuka; teks ini tetap di luar katalog Platform Admin
yang direview klinis. Disarankan tetap direview tenaga kesehatan sebelum rilis
luas, mengikuti disiplin yang sama seperti teks guidance status yang sudah ada
sebelumnya (keduanya sama-sama hardcoded app-authored, bukan konten katalog).

// Mories Deo Hutapea,S.E.,S.Kom
