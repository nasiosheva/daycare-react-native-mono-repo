<!-- Mories Deo Hutapea,S.E.,S.Kom -->

# Usia Emas

Usia Emas adalah platform multi-tenant untuk Daycare, PAUD, TK, dan layanan
pendukungnya. Monorepo ini berisi aplikasi Expo (Android, iOS, web), API Kotlin
Spring Boot, PostgreSQL/Flyway, serta package TypeScript bersama.

Staff mencatat check-in/out anak dari daftar kehadiran atau pemindai QR. Untuk
check-out Daycare tanpa otorisasi penjemput aktif, Staff dapat meminta approval
satu kali yang diverifikasi Staff Admin; hanya Staff yang mencatat kehadiran.
Staff Admin tetap mengakses rekap dan antrean approval, bukan aksi attendance.

> Baca [Business rules](docs/business-rules.md) sebelum mengubah alur bisnis,
> API, data, otorisasi, atau arsitektur. Jika implementasi berbeda dari aturan,
> catat gap-nya; jangan mengubah aturan secara diam-diam.

> `CLAUDE.md` wajib dibaca oleh agen coding. File ini lokal dan diabaikan Git,
> tetapi harus tetap tersedia dan tidak boleh dihapus.

// Mories Deo Hutapea,S.E.,S.Kom

## Technology

- Mobile/web: Expo 53, React Native, Expo Router, React Query, Firebase Auth.
- API: Kotlin, Spring Boot 3.5, Spring Security, JPA, Flyway, springdoc.
- Database: PostgreSQL 17.
- Workspace: pnpm 10, Turborepo, JDK 21.

## Repository structure

| Path | Scope |
| --- | --- |
| `apps/mobile` | Expo Router untuk Android, iOS, dan web |
| `apps/api` | Kotlin API dan migrasi Flyway |
| `packages/core` | Role, permission, tipe domain, schema Zod |
| `packages/ui` | Komponen UI dan design token |
| `packages/api-client` | API client bertipe dan OpenAPI |
| `scripts` | Launcher, test, build, seed, dan deployment |

## Product rules

Aturan role, institution type, tenant scope, consent, billing, kelas, screening,
chat, dan keamanan hanya didefinisikan di [docs/business-rules.md](docs/business-rules.md).
Flow khusus tersedia di [docs/](docs/).
Proposal dan perubahan teknis baru mengikuti workflow OpenSpec di `openspec/`; aturan bisnis tetap bersumber dari `docs/business-rules.md`.

Pengelolaan langganan SaaS tenant dipisahkan dari billing Parent. Aturan, status,
akses, dan tahap implementasi ada di [business rules](docs/business-rules.md#1313-langganan-saas-tenant)
dan [plan langganan tenant](docs/plans/tenant-subscription-management.md). Renewal memakai tanggal preview dari server; invoice tetap menyimpan periode tagihannya, sedangkan coverage aktual dapat dimulai pada tanggal konfirmasi bila pembayaran terlambat. Pembayaran tidak mengaktifkan kembali tenant yang ditangguhkan manual.
Daftar Platform Admin mendukung pencarian, filter status/jenis lembaga, ringkasan jumlah per status, dan pagination melalui `GET /api/v1/platform/tenants/page`.
Staff Admin memiliki self-service subscription melalui `/tenant-subscription`, termasuk renewal idempoten, bukti pembayaran privat maksimal 2 MB, dan pengajuan koreksi. Platform Admin meninjau bukti/koreksi dan melihat reminder H-7/H-3/H-1; upload dan koreksi tetap nonaktif sampai gate kebijakan/keuangan disetujui. Lihat [plan](docs/plans/tenant-subscription-management.md) untuk gap dan syarat rilis.

Billing Parent mengirim `Idempotency-Key` stabil untuk pembelian paket, booking dari sisa kredit, dan upload bukti; retry aman mengembalikan hasil aksi yang sama, sedangkan key dengan payload berbeda ditolak. Paket bulanan yang sama untuk anak yang sama tidak dapat dibeli lagi selama periode layanannya bertumpang tindih; retry atas invoice bulanan yang masih menunggu dengan intent identik memakai invoice yang sama. Semantik invoice Parent tetap terpisah dari langganan SaaS tenant. Pemesanan layanan hanya menampilkan anak dari tenant yang memublikasikan capability Daycare; kegagalan memuat paket, sisa layanan, tagihan, atau riwayat menyediakan aksi coba lagi.

Beranda Parent memiliki dua carousel gambar otomatis dengan indikator dot di atas gambar, navigasi manual dengan swipe kiri/kanan, dan sebagian gambar berikutnya yang terlihat sebagai petunjuk geser. Auto-slide dijeda selama swipe dan hitungannya dimulai ulang setelah dilepas. Gambar memakai rasio lebar 2.4:1 agar banner lebih ringkas. Carousel promosi global Platform Admin dan popup pengumuman tenant memakai data berbeda; popup hanya memuat URL gambar, memiliki tombol X, dan tetap dibatasi recipient tenant. Gambar dapat membuka URL HTTPS atau halaman aplikasi allowlist bila aksi diaktifkan. Promosi global juga terlihat untuk Parent tanpa tenant; siklus hidup dan batas akses ada di [business rules §10.2](docs/business-rules.md#102-operasi-harian-daycare-komunikasi-terarah-dan-tindak-lanjut-keselamatan).

Platform Admin dan Staff Admin membuka pengelolaan banner/popup dari satu hub konten dengan aksi sesuai role. Banner hanya meminta URL gambar dan judul metadata (tanpa pesan); carousel hanya menampilkan gambar. Field judul, URL gambar, dan URL browser dapat dikosongkan langsung dengan ikon X. Platform Admin mengelola banner untuk Parent global, semua Staff Admin, atau Staff Admin pada satu tenant; Staff Admin mengelola popup Parent dalam tenant aktif. Tombol **Buat** pada hub langsung membuka form yang sesuai. Banner tenant hanya terlihat oleh Staff Admin aktif tenant tersebut; rincian audience dan akses ada di [business rules §10.2](docs/business-rules.md#102-operasi-harian-daycare-komunikasi-terarah-dan-tindak-lanjut-keselamatan).

Katalog program perkembangan global mendukung pencarian dan filter gabungan berdasarkan tingkat belajar, domain, dan status aktif/arsip; hasil kosong menyediakan aksi hapus filter.

Indikator koneksi membedakan perangkat yang benar-benar terputus dari server API yang tidak dapat dijangkau. Kegagalan request API saat perangkat masih terhubung ditampilkan sebagai `API_UNAVAILABLE`, bukan status offline.

Event chat lintas tenant hanya dikirim kepada wali atau Staff yang masih memiliki membership aktif dengan role yang sesuai di tenant asal; isi thread tetap dimuat melalui REST yang memeriksa ulang otorisasi.

Setiap branch yang membuka PR/MR wajib menyertakan checklist branch tersendiri dari [template checklist MR](docs/checklists/branch-mr-checklist-template.md), lengkap dengan bukti test/CI dan blocker. Deskripsi PR/MR juga harus memuat tabel ringkasan status sepuluh area review beserta gap/blocker dan tautan bukti checklist branch. Perubahan kode mengikuti test-first: test ditulis dan dibuktikan gagal sebelum implementasi, lalu dijalankan kembali sampai lulus. Sebelum commit, buat/perbarui salinan [checklist kesiapan commit](docs/checklists/pre-commit-readiness-template.md) per branch berdasarkan sepuluh area di checklist code review lokal; tinjau diff, perbaiki semua temuan, dan commit hanya jika checklist menyatakan READY tanpa temuan terbuka.

## Environment files

Semua file environment bersifat lokal dan di-ignore Git. Mulai dari file contoh;
jangan menyimpan secret di repository.
`TENANT_SUBSCRIPTION_GRACE_ENABLED` tetap `false` sampai preview rollout
read-only ditinjau dan rollout dikonfirmasi.

| File | Kegunaan |
| --- | --- |
| `.env` | API, PostgreSQL, dan konfigurasi Expo lokal |
| `.env.dev` | Service development untuk launcher |
| `.env.prod` | Service production untuk launcher; tidak melakukan deploy |

| Variable | Kegunaan |
| --- | --- |
| `EXPO_PUBLIC_API_URL` | Base API publik, termasuk `/api/v1` |
| `EXPO_PUBLIC_REALTIME_URL` | Override WebSocket; default diturunkan dari API URL |
| `EXPO_PUBLIC_EXPO_PROJECT_ID` | UUID project EAS/Expo untuk native push; bukan Firebase project ID |
| `EXPO_PUBLIC_APP_ENV` | `production` untuk build/deploy production |
| `EXPO_PUBLIC_FIREBASE_API_KEY`, `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN`, `EXPO_PUBLIC_FIREBASE_PROJECT_ID`, `EXPO_PUBLIC_FIREBASE_APP_ID` | Konfigurasi Firebase publik |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | Google Sign-In native |
| `EXPO_PUBLIC_GOOGLE_MAPS_GEOCODING_API_KEY` | Geocoding web opsional |
| `IOS_DEVICE_UDID` | Target iPhone fisik; launcher iOS menolak device yang belum terdaftar |
| `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `DATABASE_URL` | PostgreSQL lokal/Compose dan JDBC API |
| `FIREBASE_ISSUER_URI` | Issuer Firebase untuk API |
| `LOCAL_AUTH_JWT_SECRET` | Secret JWT minimal 32 byte |
| `QR_SIGNING_SECRET` | Secret penandatangan QR |
| `PLATFORM_ADMIN_EMAILS` | Email bootstrap Platform Admin |
| `EXPO_PUSH_URL` | Endpoint Expo Push opsional |
| `CHAT_NOTIFICATION_TRANSPORT` | `WEBSOCKET` (default), `EXPO`, atau alias `FIREBASE` |
| `TENANT_SUBSCRIPTION_MAX_PAYMENT_AMOUNT` | Batas maksimum transaksi SaaS tenant dalam IDR bulat; wajib disetel sebelum membuat tagihan |
| `TENANT_SUBSCRIPTION_PAYMENT_PROOF_ENABLED` | `false` (default) sampai kebijakan penyimpanan/retensi bukti pembayaran disahkan |
| `TENANT_SUBSCRIPTION_CORRECTION_ENABLED` | `false` (default) sampai prosedur persetujuan koreksi pembayaran disahkan |
| `TENANT_SUBSCRIPTION_PAYMENT_INSTRUCTIONS` | Instruksi pembayaran SaaS tenant yang ditampilkan ke Staff Admin, dikonfigurasi server-side |

`EXPO_PUBLIC_*` hanya untuk konfigurasi client publik. Jangan gunakan prefix itu
untuk password, private key, signing secret, atau credential server.

## Default local setup

```sh
corepack enable
pnpm install
cp .env.example .env
```

Pastikan PostgreSQL 17 berjalan dan database/user sesuai `.env`, lalu jalankan API:

```sh
set -a && . ./.env && set +a && pnpm dev:api
```

API tersedia di `http://localhost:8080/api`; Swagger di
`/api/swagger-ui/index.html`; OpenAPI di `/api/v3/api-docs`.

Flyway memakai baseline `V1__initial_schema.sql` pada database kosong. Master
data dan curriculum reference di-seed terpisah; gunakan flag/script seed yang
didokumentasikan, bukan menjalankan seed pada setiap startup.

Untuk reset lokal, gunakan database kosong atau reset schema yang memang menjadi
target. Jangan memakai `flyway repair` untuk memaksa history/checksum berbeda.

## Mobile and web launchers

| Target | Command |
| --- | --- |
| Android | `./scripts/run-android.sh` |
| iOS Simulator | `./scripts/run-ios.sh` |
| Web | `./scripts/run-web.sh` |
| API lokal | `./scripts/run-backend-local.sh` |

Launcher memilih environment dengan tombol panah + Enter. Android hanya menargetkan
device fisik, iOS hanya Simulator. Pilihan uninstall default **Yes** dan timeout
5 detik. Saat sesi berjalan: `s` stop, `r` reload frontend, `b` restart backend
(khusus environment local). Web mendukung `s` stop dan `r` rebuild.

Untuk local environment, launcher memakai API `localhost:8080`; Android memakai
`adb reverse`. API yang sudah sehat tidak dihentikan atau diganti. Jalankan API
sendiri bila diperlukan:

```sh
./scripts/run-backend-local.sh
```

`run-logs/` hanya untuk log lokal. Sebelum PR, kosongkan isi log dengan:

```sh
./scripts/clean-run-logs.sh
```

Launcher native menggunakan splash layout berbasis komponen, bukan bitmap layar
penuh. Build Android release memakai `./scripts/build-android.sh` dan konfigurasi
keystore lokal yang di-ignore Git.

## API and authentication

API tersedia di `/api/v1`; endpoint lengkap dan schema tersedia di
`/api/v3/api-docs` dan Swagger UI. Kontrak otorisasi dan scope bisnis mengikuti
[docs/business-rules.md](docs/business-rules.md).

## Realtime WebSocket

Client terautentikasi terhubung ke `ws(s)://<api-host>/api/v1/realtime` dan
mengirim frame `CONNECT` berisi JWT serta organization scope bila diperlukan.
Server memvalidasi token/scope sebelum mendaftarkan sesi. Event hanya invalidation
hint; client tetap mengambil data sumber melalui REST API. Reconnect melakukan
revalidasi profile dan refresh query, termasuk thread chat aktif lintas tenant.
Event chat ditargetkan ke user yang sudah diotorisasi backend, sehingga tetap
sampai walau socket sedang memilih tenant lain; payload membawa tenant/anak agar
invalidasi cache tetap tepat sasaran. Membuka kembali thread atau membawa app ke
foreground juga memuat ulang thread. Logout, expiry, dan password change menutup
sesi realtime.

## Core packages

- `@daycare/core`: policy, role, permission, tipe domain, schema.
- `@daycare/ui`: `Screen`, `Button`, `AppText`, `MultiStepFormWizard`, token.
- `@daycare/api-client`: URL, bearer token, organization header, parsing error.

## Verification

```sh
pnpm verify
pnpm coverage
pnpm --filter @daycare/app test:ui
./scripts/run_full_suite_and_compile_check.sh
```

Latest coverage snapshot dari `pnpm coverage` (2026-10-13):

### Kotlin API — JaCoCo

| Metric | Covered / total | Coverage |
| --- | ---: | ---: |
| Instructions | 89,237 / 100,619 | 88.69% |
| Branches | 5,315 / 5,904 | 90.02% |
| Lines | 8,245 / 8,791 | 93.79% |
| Complexity | 6,281 / 8,741 | 71.86% |
| Methods | 3,973 / 5,907 | 67.26% |
| Classes | 591 / 634 | 93.22% |

### TypeScript — Vitest V8

| Workspace | Statements | Branches | Functions | Lines |
| --- | ---: | ---: | ---: | ---: |
| `apps/mobile` | 27.28% | 76.47% | 53.50% | 27.28% |
| `packages/api-client` | 100.00% | 94.72% | 90.39% | 100.00% |
| `packages/core` | 100.00% | 100.00% | 100.00% | 100.00% |
| `packages/ui` | 58.34% | 92.68% | 80.43% | 58.34% |

`test:ui` adalah Jest smoke test terpisah dari tabel V8. Backend membutuhkan JDK 21.

## Troubleshooting

| Masalah | Tindakan |
| --- | --- |
| Launcher berhenti karena env placeholder | Isi semua `EXPO_PUBLIC_*` dengan nilai Firebase/API nyata |
| Android build gagal | Pastikan Android SDK, `adb`, `google-services.json`, dan JDK sesuai tersedia |
| iOS target ditolak | Gunakan Simulator untuk launcher iOS; device fisik membutuhkan UDID dan konfigurasi native |
| Firebase tidak punya tenant | Buat invitation/membership; sign-in pertama tidak membuat akses tenant otomatis |
| PostgreSQL tidak tersedia | Jalankan PostgreSQL lokal atau Docker Compose opsional |
| Gradle wrapper hilang | Pulihkan `apps/api/gradlew` dan `apps/api/gradle/wrapper/` dari Git |

## GitHub Actions and production

PR ke `production` menjalankan lint, typecheck, dan test TypeScript. Deploy
production berjalan setelah merge/push ke `production`, membangun web dan API
yang berubah, menjalankan health check, serta mendukung rollback release.
Flyway migration berjalan saat API start; migration harus backward-compatible.

Secret/variable utama CI:

| Kind | Name |
| --- | --- |
| Variable | `PRODUCTION_API_URL`, `PRODUCTION_REALTIME_URL`, Firebase public values |
| Variable | `VPS_APP_DIR` |
| Secret | `VPS_HOST`, `VPS_USER`, `VPS_SSH_PRIVATE_KEY`, `VPS_KNOWN_HOSTS` |

Provision VPS baru dengan [scripts/production/provision-vps.sh](scripts/production/provision-vps.sh).
Simpan `/etc/usia-emas/api.env` dan Firebase service account hanya di VPS/secret
store. Jangan commit credential, keystore, APK, `.env`, atau log.

## Git workflow

```sh
git switch production
git pull --ff-only origin production
pnpm verify
git status
```

Sebelum commit, tinjau dokumentasi dan tambahkan/update
`docs/changes/YYYY-MM-DD/<context>.md` bila perubahan memengaruhi behavior,
API, konfigurasi, operasional, atau verification. Jangan commit `run-logs/`,
`docs/local-accounts.md`, secrets, atau build artifacts.

## Related documentation

- [Business rules](docs/business-rules.md)
- [Parent enrollment flow](docs/parent-enrollment-flow.md)
- [Developmental screening plan](docs/plans/parent-child-developmental-screening.md)
- [Android release APK](docs/android-release-apk.md)
- [Tenant staff accounts](docs/tenant-staff-accounts.md)
- [Daily changes](docs/changes/)
