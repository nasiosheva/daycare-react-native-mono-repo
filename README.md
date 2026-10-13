# Usia Emas

Usia Emas adalah platform multi-tenant untuk Daycare, PAUD, TK, dan layanan
pendukungnya. Monorepo ini berisi aplikasi Expo (Android, iOS, web), API Kotlin
Spring Boot, PostgreSQL/Flyway, serta package TypeScript bersama.

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

## Environment files

Semua file environment bersifat lokal dan di-ignore Git. Mulai dari file contoh;
jangan menyimpan secret di repository.

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
revalidasi profile dan refresh query. Logout, expiry, dan password change menutup
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
| `apps/mobile` | 22.63% | 69.85% | 45.83% | 22.63% |
| `packages/api-client` | 88.19% | 73.81% | 21.62% | 88.19% |
| `packages/core` | 100.00% | 66.67% | 100.00% | 100.00% |
| `packages/ui` | 2.87% | 67.44% | 54.84% | 2.87% |

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
