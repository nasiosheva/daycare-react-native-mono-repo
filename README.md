# Daycare Platform

Multi-tenant daycare platform for web, iOS, Android, and tablets. The repository contains an Expo Router application, a Kotlin Spring Boot API, shared TypeScript domain logic, UI primitives, and a typed API client.

## Technology

- Mobile and web: Expo 53, React Native, Expo Router, React Query, and Firebase Authentication.
- API: Kotlin, Spring Boot 3.5, Spring Security OAuth2 Resource Server, JPA, Flyway, and springdoc OpenAPI.
- Database: PostgreSQL 17.
- Workspace: pnpm 10 and Turborepo.

## Prerequisites

- Node.js 20 or newer, Corepack, and pnpm 10.
- JDK 21 and `gradle` available on `PATH` for the API. This checkout does not include a Gradle wrapper.
- Docker Desktop for local PostgreSQL.
- A Firebase project with Email/Password, Phone, and Google providers enabled.
- Xcode for iOS development; Android Studio plus an emulator or device for Android development.

## Repository structure

- `apps/mobile`: Expo Router app for Android, iOS, and web.
- `apps/api`: Kotlin Spring Boot REST API and Flyway migrations.
- `packages/core`: roles, permissions, domain types, and Zod validation schemas.
- `packages/ui`: shared React Native UI primitives and design tokens.
- `packages/api-client`: typed API client and OpenAPI generation target.
- `scripts/run-mobile.sh`: shared runner for all mobile/web environment launchers.

## Environment files

Environment files are local-only and ignored by Git. Start from the corresponding example file; never put secrets in a committed file.

| File | Purpose |
| --- | --- |
| `.env` | Default local stack: Expo public configuration plus local PostgreSQL and API configuration. |
| `.env.dev` | Development services for the mobile launcher scripts. |
| `.env.prod` | Production-service values for the mobile launcher scripts. It does not deploy or build a production app. |
| `.env.simulation` | Isolated mobile and API simulation environment. |

### Variables

| Variable | Used by | Required | Description |
| --- | --- | --- | --- |
| `EXPO_PUBLIC_API_URL` | Mobile/web | Yes | API base URL, including `/api/v1`. This value is bundled into the client and must not contain a secret. |
| `EXPO_PUBLIC_FIREBASE_API_KEY` | Mobile/web | Yes | Firebase web API key. |
| `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN` | Mobile/web | Yes | Firebase Auth domain. |
| `EXPO_PUBLIC_FIREBASE_PROJECT_ID` | Mobile/web | Yes | Firebase project ID. |
| `EXPO_PUBLIC_FIREBASE_APP_ID` | Mobile/web | Yes | Firebase application ID. |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | Native mobile | Required for Google sign-in | OAuth web client ID consumed by the native Google sign-in SDK. |
| `IOS_DEVICE_UDID` | iOS launcher | Required for iOS launchers | UDID of the connected physical iPhone. Simulators are intentionally rejected. |
| `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` | Docker / default API | Yes for local database | Local PostgreSQL database and credentials. |
| `POSTGRES_PORT` | Docker simulation | Simulation only | Host port for the simulation database; default is `5433`. |
| `DATABASE_URL` | Default API | Optional | JDBC connection URL; overrides the default `jdbc:postgresql://localhost:5432/daycare`. |
| `FIREBASE_ISSUER_URI` | Default API | Yes | Firebase token issuer, for example `https://securetoken.google.com/<project-id>`. |
| `QR_SIGNING_SECRET` | Default API | Recommended | Secret used to sign attendance QR tokens. Use a random value of at least 32 characters outside local-only development. |
| `SIMULATION_DATABASE_URL`, `SIMULATION_POSTGRES_USER`, `SIMULATION_POSTGRES_PASSWORD` | Simulation API | Yes for overrides | Simulation profile database settings. Defaults point to `daycare_simulation` on port `5433`. |
| `SIMULATION_FIREBASE_ISSUER_URI` | Simulation API | Yes | Firebase issuer for simulation; it falls back to `FIREBASE_ISSUER_URI` only when not set. |
| `SIMULATION_QR_SIGNING_SECRET` | Simulation API | Recommended | QR signing secret used only by the simulation profile. |
| `EXPO_PUSH_URL` | API | Optional | Expo Push API URL; defaults to Expo's production endpoint. |

`EXPO_PUBLIC_*` values are public client configuration. Do not use that prefix for passwords, signing secrets, private keys, or server credentials.

## Default local setup

1. Enable Corepack and install workspace dependencies.

   ```sh
   corepack enable
   pnpm install
   ```

2. Create the default local environment file and enter the Firebase values.

   ```sh
   cp .env.example .env
   ```

3. Start the default PostgreSQL database.

   ```sh
   docker compose up -d postgres
   ```

4. Start the API. Spring Boot does not automatically load root `.env` files, so source it in the same command.

   ```sh
   set -a && . ./.env && set +a && pnpm dev:api
   ```

   The API runs at `http://localhost:8080/api`. Flyway applies migrations automatically at startup. Swagger UI is available at `http://localhost:8080/api/swagger-ui/index.html`, and the OpenAPI document is at `http://localhost:8080/api/v3/api-docs`.

5. Start a client. For direct Expo development, `.env` supplies the public configuration.

   ```sh
   pnpm dev:app
   ```

   For platform-specific launchers, follow [Mobile and web launchers](#mobile-and-web-launchers).

## Simulation environment

The Spring `simulation` profile uses a separate database, `daycare_simulation`, exposed on host port `5433`. It has independent PostgreSQL data and receives the same Flyway migrations as the default local database.

1. Create and fill the shared simulation environment file. Set the Firebase values for the simulation project and a distinct QR signing secret.

   ```sh
   cp .env.simulation.example .env.simulation
   ```

2. Start the isolated PostgreSQL project.

   ```sh
   docker compose --env-file .env.simulation -p daycare-simulation up -d postgres
   ```

3. Start the API with the `simulation` Spring profile.

   ```sh
   pnpm dev:api:simulation
   ```

4. Run the simulation client with one of the simulation launchers below.

For a physical device, replace `localhost` in `EXPO_PUBLIC_API_URL` with the development machine's LAN address. Ensure the device can reach the API and that the API's CORS/network policy permits the connection.

## Mobile and web launchers

The launchers source the corresponding environment file before starting Expo. They automatically install workspace dependencies with the locked pnpm version when `node_modules` is missing. They also create a missing environment file from its `.example` template, then stop until its required Firebase and API values are filled.

Copy and populate the file before using a launcher, or let the launcher create its local copy on first use:

```sh
cp .env.dev.example .env.dev
cp .env.prod.example .env.prod
cp .env.simulation.example .env.simulation
```

| Environment | Android | iOS | Web |
| --- | --- | --- | --- |
| Development | `./run-android-dev.sh` | `./run-ios-dev.sh` | `./run-web-dev.sh` |
| Production services | `./run-android-prod.sh` | `./run-ios-prod.sh` | `./run-web-prod.sh` |
| Simulation | `./run-android-simulation.sh` | `./run-ios-simulation.sh` | `./run-web-simulation.sh` |

Android launchers start an installed Expo development build using the selected service environment. iOS launchers only build and run on the physical iPhone identified by `IOS_DEVICE_UDID`; simulators are intentionally unsupported. The `prod` scripts point at production services but do not create a signed store/release build and do not deploy the API.

The scripts can install project dependencies, but intentionally do not install system software or provision secrets. Node.js 20+, Android Studio/`adb` for Android, Xcode for iOS, Firebase credentials, and a reachable API must be supplied by the developer or CI environment.

### Native development build

Native Firebase and Google sign-in require a development build; Expo Go is not sufficient. Place the Firebase platform configuration files locally before building:

- `apps/mobile/google-services.json` for Android.
- `apps/mobile/GoogleService-Info.plist` for iOS.

Register the Android SHA-1/SHA-256, iOS bundle ID (`com.daycare.platform`), authorized web domains, Firebase SMS region policy, and Google OAuth clients in Firebase. Then create and install a development build:

```sh
corepack pnpm --filter @daycare/app exec expo run:android
corepack pnpm --filter @daycare/app exec expo run:ios
```

Run the relevant launcher after the build is installed. Native email/password, phone, and Google authentication use React Native Firebase; web uses the Firebase JavaScript SDK.

To identify the connected iPhone UDID, run `xcrun xctrace list devices`, copy the UDID shown for the physical device (not a line marked `Simulator`), and set it as `IOS_DEVICE_UDID` in the matching environment file. The iPhone must be connected, trusted, and enabled for development.

## API contract and authentication

All API routes are under `/api/v1` and require a Firebase bearer token except the OpenAPI/Swagger endpoints. Endpoints that operate on an organization also require `X-Organization-Id`.

| Capability | Endpoint |
| --- | --- |
| Current user and memberships | `GET /api/v1/me` |
| List or create children | `GET` / `POST /api/v1/children` |
| Record attendance | `POST /api/v1/children/{childId}/attendance` |
| Issue attendance QR token | `GET /api/v1/children/{childId}/attendance-qr` |
| List or create development entries | `GET` / `POST /api/v1/children/{childId}/development-entries` |
| List or create service plans | `GET` / `POST /api/v1/service-plans` |
| Purchase a service plan and create its invoice | `POST /api/v1/service-purchases` |
| List parent service entitlements and use remaining credits | `GET /api/v1/service-entitlements`, `POST /api/v1/service-entitlements/{id}/bookings` |
| List bookings or pending branch approvals | `GET /api/v1/bookings`, `GET /api/v1/bookings/pending-approval` |
| Approve or reject a paid booking | `POST /api/v1/bookings/{id}/approval` |
| List invoices or confirm payment | `GET /api/v1/invoices`, `POST /api/v1/invoices/{id}/mark-paid` |
| Create invitation | `POST /api/v1/invitations` |
| Register device token | `POST /api/v1/device-tokens` |
| List notifications | `GET /api/v1/notifications` |

The mobile app exchanges Firebase ID tokens through `Authorization: Bearer <token>`. Its API client also sends `X-Organization-Id` after the user selects an organization. Authorization roles are `ADMIN`, `STAFF`, and `PARENT`; the shared policy is defined in `packages/core` and is enforced by the API service layer.

## Core packages

- `@daycare/core` is the reusable domain boundary for roles, permissions, types, and validation schemas.
- `@daycare/ui` contains `Screen`, `Button`, `AppText`, and shared design tokens.
- `@daycare/api-client` centralizes API URL handling, Firebase bearer tokens, organization headers, response parsing, and API errors.

## Verification

Run the TypeScript checks and tests:

```sh
pnpm verify
```

Run backend tests with JDK 21:

```sh
JAVA_HOME=/path/to/jdk-21 gradle -p apps/api test --no-daemon
```

The API client package includes an OpenAPI generation script. The running API publishes its document at `/api/v3/api-docs`; use that URL when configuring or invoking OpenAPI generation.

## Current scope

Admins configure daily, weekly, and monthly service plans. A parent purchases a plan for a linked child; this creates an invoice with a manual-payment status. An admin confirms the payment, then an admin or staff member for the child's branch approves or rejects each booking. Attendance check-in requires a confirmed booking, except while an active monthly entitlement covers the day.

Weekly plans specify the number of day credits. Parents can initially select fewer dates than the purchased credits, then use the visible remaining credits for a later booking. The admin chooses whether unused weekly credits expire at the end of the seven-day period or remain transferable for 30 additional days. Rejected bookings return their reserved credit. This first version intentionally uses admin payment confirmation; connect a payment gateway such as Midtrans or Xendit by replacing that confirmation step with a verified payment callback.

Admins and staff can record activities, meals, naps, and observations for children in their permitted branch. Parents can view development notes for children linked to their account and receive in-app/native push notifications for newly recorded notes.

Photo uploads are intentionally not included. They require separate object storage, consent, retention, access-control, and deletion policies.
