# Umur Emas

Umur Emas is a multi-tenant early-childhood platform for web, iOS, Android, and tablets. The repository contains an Expo Router application, a Kotlin Spring Boot API, shared TypeScript domain logic, UI primitives, and a typed API client.

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

## Product capabilities

- Platform `ADMIN` manages tenant lifecycle, tenant subscriptions, and tenant payments. Tenant `STAFF_ADMIN` (owner/head) manages the tenant's users and operational configuration; `STAFF` (teacher/miss) records attendance and development; `PARENT` accesses only their own children.
- A consistent app bar on every screen and role-specific bottom navigation: Platform Admin has tenant administration; Staff Admin has tenant operations, approval, finance, and account management; Staff has classroom operations and approvals; Parent has development, attendance QR, and booking. Every role has a Profile menu, which is the sole location for signing out. Profile also manages display name and Firebase password; Platform Admin can create another Platform Admin with an email, username, and password.
- Shared mobile UI includes an accessible bottom sheet with a drag handle and close button. Profile uses it to confirm logout before ending the session.
- Child management, manual or QR attendance, and development notes.
- Service-plan purchase, invoice tracking, booking approval, and remaining-credit management.
- Firebase email/password, phone, and Google authentication; Firebase ID tokens secure the API.

## Institution types and shared core

The platform supports one or more institution types per tenant: `DAYCARE`, `PAUD`, and `TK`. The shared core covers tenant management, branches, classrooms, children, guardians, staff roles, attendance, child development, notifications, billing infrastructure, profile management, and reusable mobile UI.

Capabilities are derived from the selected institution types and drive both mobile navigation and backend authorization:

| Capability | Institution type | Scope |
| --- | --- | --- |
| `DAYCARE_OPERATIONS` | `DAYCARE` | Service plans, service purchases, booking, booking approval, and the booking prerequisite for attendance. |
| `ACADEMIC_CURRICULUM` | `PAUD`, `TK` | Academic years and curriculum programs. |

An institution may select more than one type, for example a Daycare that also operates a TK program. Daycare remains the default for legacy tenants so existing operations continue unchanged.
- In-app/native notifications for payment, booking, and development events.

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
| `EXPO_PUBLIC_APP_ENV` | Mobile/web | Simulation only | Set to `simulation` only in `.env.simulation` to enable the local role-preview buttons. |
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
| `FIREBASE_SERVICE_ACCOUNT_JSON` | API | Required to create Platform Admin accounts | Firebase service-account JSON for the same Firebase project. Keep it only in a secret manager or ignored local environment file. |
| `QR_SIGNING_SECRET` | Default API | Recommended | Secret used to sign attendance QR tokens. Use a random value of at least 32 characters outside local-only development. |
| `SIMULATION_DATABASE_URL`, `SIMULATION_POSTGRES_USER`, `SIMULATION_POSTGRES_PASSWORD` | Simulation API | Yes for overrides | Simulation profile database settings. Defaults point to `daycare_simulation` on port `5433`. |
| `SIMULATION_FIREBASE_ISSUER_URI` | Simulation API | Yes | Firebase issuer for simulation; it falls back to `FIREBASE_ISSUER_URI` only when not set. |
| `SIMULATION_FIREBASE_SERVICE_ACCOUNT_JSON` | Simulation API | Required to create Platform Admin accounts in simulation | Service-account JSON for the simulation Firebase project; otherwise it falls back to `FIREBASE_SERVICE_ACCOUNT_JSON`. |
| `SIMULATION_QR_SIGNING_SECRET` | Simulation API | Recommended | QR signing secret used only by the simulation profile. |
| `PLATFORM_ADMIN_EMAILS` | API | Required to bootstrap platform admin access | Comma-separated Firebase email addresses that may manage tenants, subscriptions, and tenant payments. |
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

### Initial tenant data

Flyway creates the schema only; it does not create demo tenant data. A Firebase user is synchronized on its first authenticated request, but receives tenant access only when an existing invitation matches that user's email or phone number.

For a database-only local Platform Admin, set `LOCAL_AUTH_ENABLED=true`, provide a `LOCAL_AUTH_JWT_SECRET` of at least 32 characters, and set `LOCAL_SEED_ENABLED=true`. The local startup then creates or reuses a Platform Admin in PostgreSQL without Firebase. The default local account is email `admin@gmail.com`, username `admin`, and password `123123`; override it with the `LOCAL_SEED_ADMIN_*` values in `.env`. The password is BCrypt-hashed and is only generated when the seeded user has no local password yet, so a password changed through the app is retained after restart. This local-only mode is disabled by default and does not run for the `simulation`, development, or production profiles.

Set `PLATFORM_ADMIN_EMAILS` to the Firebase email address of the platform operator. When that user first calls the API, it is recorded as a platform `ADMIN` and can create a tenant. Platform Admin creates a tenant through a three-step checkout: tenant data (including the initial Staff Admin name, email, and password), subscription/trial selection, and checkout confirmation. A trial is configurable from one to twelve months and disables manual monthly-price input. Without a trial, the Platform Admin must enter the monthly price manually; the new tenant is created with a payment due immediately and remains inactive until paid. Every tenant creation directly provisions one active `STAFF_ADMIN` account and its tenant membership; the account can sign in immediately with the entered email and password.

Platform Admin can manage every tenant from **Tenant**: search and filter the list, open a tenant detail, edit its name/main branch/institution types/plan/monthly fee, create a one-month renewal invoice, mark or void a pending invoice, and suspend or reactivate the subscription. A pending Staff Admin invitation can have its validity extended or be cancelled from the same detail. An expired trial becomes `PENDING_PAYMENT` when the Platform Admin reads the tenant list or details. Payment confirmation remains manual until a verified payment-provider callback is integrated.

Platform Admins create another Platform Admin from Profile with an email, username, and password. The API creates the Firebase email/password account and grants Platform Admin access in one transaction. This requires a service-account credential for the matching Firebase project. Platform administrator records are protected from deletion at the database level, and the API has no delete route for them.

Staff Admins can create additional active `STAFF_ADMIN` and `STAFF` accounts from **Akun tenant** with a name, email, and password; names and emails are required, passwords must contain at least six characters, and email matching is case-insensitive. An already-registered email is rejected. Parent accounts remain invitation-based. From **Akun tenant → Kelola password staf**, Staff Admins can replace the password of active `STAFF_ADMIN` and `STAFF` accounts in their own tenant using the same password rule. Parent accounts are excluded. In Firebase environments this requires the Firebase service-account credential; in local auth the password is stored only as a BCrypt hash in PostgreSQL.

## Simulation environment

The Spring `simulation` profile uses a separate database, `daycare_simulation`, exposed on host port `5433`. It has independent PostgreSQL data and receives the same Flyway migrations as the default local database.

On its first startup, the simulation API seeds a complete demo dataset: an active `DAYCARE` tenant (`Daycare Pelangi`), a `PAUD` tenant awaiting payment (`Daycare Mentari`) with an academic year and curriculum program, a trial `TK` tenant (`Daycare Angkasa`), exactly one protected platform Admin (`admin@simulation.local`), Staff Admin, teacher, parent, branch/classroom, child, subscription payments, service plans, parent invoice/entitlement, booking, attendance, development entry, invitation, and notification. Set `daycare.simulation-seed-enabled=false` in an overriding Spring configuration to disable this seed.

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

   The simulation sign-in screen provides local preview buttons for `ADMIN`, `STAFF_ADMIN`, `STAFF`, and `PARENT`. They only verify role-based navigation and never create a Firebase token, membership, or API access. Use Firebase sign-in with a valid membership to exercise protected API data and mutations.

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
| Local stack | `./run-android-local.sh` | `./run-ios-local.sh` | `./run-web-local.sh` |
| Development | `./run-android-dev.sh` | `./run-ios-dev.sh` | `./run-web-dev.sh` |
| Production services | `./run-android-prod.sh` | `./run-ios-prod.sh` | `./run-web-prod.sh` |
| Simulation | `./run-android-simulation.sh` | `./run-ios-simulation.sh` | `./run-web-simulation.sh` |

`./run-android-local.sh` synchronizes the generated Android project with the Expo native configuration when needed, restores `android/local.properties` from `ANDROID_HOME`, `ANDROID_SDK_ROOT`, or the standard macOS SDK location, then creates or refreshes and installs the Android development build before starting the local API and Metro. It can therefore be used as the one-command local Android launcher, including after an Android application-package or native-plugin change. The other Android launchers start an installed Expo development build using the selected service environment, and rebuild it automatically when the native configuration changes. iOS launchers only build and run on the physical iPhone identified by `IOS_DEVICE_UDID`; simulators are intentionally unsupported. The `prod` scripts point at production services but do not create a signed store/release build and do not deploy the API.

The `local` launchers use `.env` and also start the default local stack for you. They prefer `docker compose up -d postgres` when Docker is available; otherwise they reuse a PostgreSQL server that is already accepting connections on `${POSTGRES_HOST:-localhost}:${POSTGRES_PORT:-5432}`. After the database is available, the launcher starts `gradle -p apps/api bootRun` in the background and waits until `http://localhost:8080/api/v3/api-docs` responds before starting Expo. The launcher must own that backend process so it can stop it on exit; if port `8080` is already occupied by the Java API process from this same repo, the launcher stops it and starts a fresh one. If another process owns port `8080`, the launcher fails and asks you to stop that process first. Backend logs are written to `daycare-api-local.log`, and the background API process is stopped when the launcher exits.

The scripts can install project dependencies, but intentionally do not install system software or provision secrets. Node.js 20+, Android Studio/`adb` for Android, Xcode for iOS, Firebase credentials, and a reachable API must be supplied by the developer or CI environment.

### Native development build

Native Firebase and Google sign-in require a development build; Expo Go is not sufficient. Place the Firebase platform configuration files locally before building:

- `apps/mobile/google-services.json` for Android.
- `apps/mobile/GoogleService-Info.plist` for iOS.

Register the Android SHA-1/SHA-256, iOS bundle ID (`com.children.platform`), authorized web domains, Firebase SMS region policy, and Google OAuth clients in Firebase. `./run-android-local.sh` creates and installs the local Android development build automatically. To create it manually for a non-local Android launcher, run:

```sh
corepack pnpm --filter @daycare/app exec expo run:android
```

For iOS, use `./run-ios-dev.sh` after setting `IOS_DEVICE_UDID`; it runs `expo run:ios --device <UDID>` and deliberately rejects simulators. Native email/password, phone, and Google authentication use React Native Firebase; web uses the Firebase JavaScript SDK.

To identify the connected iPhone UDID, run `xcrun xctrace list devices`, copy the UDID shown for the physical device (not a line marked `Simulator`), and set it as `IOS_DEVICE_UDID` in the matching environment file. The iPhone must be connected, trusted, and enabled for development.

### Audio recording module

`apps/mobile/src/audio` provides a generic `useAudioRecording` hook for Android and iOS. It requests microphone permission, records foreground-only high-quality M4A audio for at most five minutes, and returns a cache-file descriptor (`uri`, duration, MIME type, creation time, and size when available). The caller owns the cache lifecycle: upload or move it as needed, then call `clear`; `cancel` deletes an unfinished recording. No screen, API route, or upload flow is wired yet. Web callers receive an explicit unsupported result.

### Image picker module

`apps/mobile/src/image-picker` provides a generic `useImagePicker` hook for Android and iOS. It can select up to ten images from the gallery or take one photo with the camera, returning local metadata without base64, EXIF, crop UI, upload, or persistent storage. Images use 80% picker compression; callers own any later upload or persistence. The hook restores a pending Android picker result when the activity is recreated. Web callers receive an explicit unsupported result.

## API contract and authentication

All API routes are under `/api/v1` and require a Firebase bearer token except the OpenAPI/Swagger endpoints. With `LOCAL_AUTH_ENABLED=true`, local email/username-and-password login instead returns a local bearer token for the same API routes; Google and phone login remain Firebase-only and are hidden in this local mode. Endpoints that operate on an organization also require `X-Organization-Id`. The mobile app supports Indonesian and English; it saves the chosen language on the device, sends it in `Accept-Language` (`id` or `en`), and the API localizes error details accordingly. Indonesian is the default when the header is absent or unsupported. Firebase account provisioning failures are returned as localized application errors; raw Firebase provider messages and configuration details are not exposed to clients.

| Capability | Endpoint |
| --- | --- |
| Current user and memberships | `GET /api/v1/me` |
| Change platform-admin PIN | `POST /api/v1/platform/pin` |
| List or create platform tenants | `GET` / `POST /api/v1/platform/tenants` |
| Read or update a tenant | `GET` / `PATCH /api/v1/platform/tenants/{organizationId}` |
| Renew, activate, or suspend a tenant subscription | `POST /api/v1/platform/tenants/{organizationId}/subscription/renew`, `POST /api/v1/platform/tenants/{organizationId}/subscription/{ACTIVE\|SUSPENDED}` |
| Mark a tenant subscription payment as paid | `POST /api/v1/platform/tenants/{organizationId}/payments/{paymentId}/mark-paid` |
| Void a pending tenant subscription payment | `POST /api/v1/platform/tenants/{organizationId}/payments/{paymentId}/void` |
| Extend or cancel a pending Staff Admin invitation | `POST /api/v1/platform/tenants/{organizationId}/staff-admin-invitation/{refresh\|cancel}` |
| Create or list tenant accounts | `POST` / `GET /api/v1/tenant-users` |
| Invite a Parent to a tenant | `POST /api/v1/invitations` |
| List or create children | `GET` / `POST /api/v1/children` |
| Read or edit a child | `GET` / `PATCH /api/v1/children/{childId}` |
| Add or remove a child's programs | `POST /api/v1/children/{childId}/programs`, `DELETE /api/v1/children/{childId}/programs/{programId}` |
| Assign or remove a child's Staff Admin, staff, nurse, or miss | `POST /api/v1/children/{childId}/staff-assignments`, `DELETE /api/v1/children/{childId}/staff-assignments/{assignmentId}` |
| Record attendance | `POST /api/v1/children/{childId}/attendance` |
| Issue attendance QR token | `GET /api/v1/children/{childId}/attendance-qr` |
| List or create development entries | `GET` / `POST /api/v1/children/{childId}/development-entries` |
| List or create service plans | `GET` / `POST /api/v1/service-plans` |
| Read or set a branch daily capacity | `GET /api/v1/branch-capacities`, `PUT /api/v1/branches/{branchId}/capacity` |
| List, create, or deactivate a package discount/promo | `GET` / `POST /api/v1/service-plans/{planId}/discounts`, `POST /api/v1/service-plans/{planId}/discounts/{discountId}/deactivate` |
| List or manage package templates | `GET` / `POST /api/v1/service-plan-templates`, `PATCH` / `DELETE /api/v1/service-plan-templates/{templateId}` |
| Purchase a service plan and create its invoice | `POST /api/v1/service-purchases` |
| List parent service entitlements and use remaining credits | `GET /api/v1/service-entitlements`, `POST /api/v1/service-entitlements/{id}/bookings` |
| List bookings or pending branch approvals | `GET /api/v1/bookings`, `GET /api/v1/bookings/pending-approval` |
| Approve or reject a paid booking | `POST /api/v1/bookings/{id}/approval` |
| List invoices or confirm payment | `GET /api/v1/invoices`, `POST /api/v1/invoices/{id}/mark-paid` |
| Create invitation | `POST /api/v1/invitations` |
| List active tenant users and pending invitations | `GET /api/v1/tenant-users` |
| Register device token | `POST /api/v1/device-tokens` |
| List notifications | `GET /api/v1/notifications` |

The mobile app exchanges Firebase ID tokens through `Authorization: Bearer <token>`. Its API client also sends `X-Organization-Id` after a tenant user selects an organization. `ADMIN` is a platform-level role bootstrapped by `PLATFORM_ADMIN_EMAILS`; tenant roles are `STAFF_ADMIN`, `STAFF`, and `PARENT`. The shared policy is defined in `packages/core` and is enforced by the API service layer. Language can only be changed from Login or Profile, and is intentionally stored locally rather than attached to the user account.

`STAFF_ADMIN` uses the Staff Admin center to manage all staff accounts and passwords, confirm parent payments, monitor every child's parent subscription and remaining daily/weekly quota, configure service plans, and handle booking approvals. From **Anak**, a Staff Admin can add or edit a child profile, attach one or more programs, and assign active Staff Admin/staff members with a Staff, Nurse, or Miss responsibility. Programs and assignments are stored in `child_programs` and `child_staff_assignments`. The entitlement list is parent-scoped for `PARENT` and tenant-scoped for `STAFF_ADMIN`; it includes the child and parent identity required for operational management.

### Booking and billing lifecycle

1. A `STAFF_ADMIN` creates a daily, weekly, or monthly service plan, optionally using a system or tenant template, with a daily package capacity and a daily branch capacity when needed.
2. A `PARENT` purchases a plan for a linked child. The API applies the larger valid automatic discount or package promo code, then creates a pending invoice, entitlement, and any requested booking dates.
3. A `STAFF_ADMIN` confirms the payment. The entitlement becomes active and bookings become `PENDING_APPROVAL` or `CONFIRMED` according to the plan policy.
4. A `STAFF_ADMIN` or properly scoped `STAFF` approves or rejects pending bookings. A rejection returns the reserved daily/weekly credit.
5. Attendance check-in requires a confirmed booking unless the child has an active monthly entitlement covering the current operational day.

Weekly plans reserve credits for selected dates. Unused credits either expire with the plan period or carry forward for the configured number of days. Pending payment, approval, and confirmed bookings hold both branch and package capacity; monthly plans hold capacity for each day in their active period. An unpaid invoice releases its slots and promo redemption after its due date. The current payment-confirmation action is manual; a payment-gateway integration must verify a provider callback before marking an invoice paid.

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

## Troubleshooting

| Symptom | Resolution |
| --- | --- |
| Launcher creates an `.env.*` file then stops | Fill all required `EXPO_PUBLIC_*` values with real Firebase and API configuration. Placeholder values cannot authenticate users. |
| iPhone cannot reach the API | Replace `localhost` in `EXPO_PUBLIC_API_URL` with the Mac's LAN address, connect both devices to the same network, and use a reachable API endpoint. |
| iOS launcher rejects the target | Connect and trust the iPhone, enable developer mode, add its real `IOS_DEVICE_UDID`, and provide `apps/mobile/GoogleService-Info.plist`. |
| Android native build fails early | Add `apps/mobile/google-services.json`, confirm Android Studio/SDK and `adb` are available, then recreate the development build. |
| Firebase user has no organization access | Create an invitation or initial membership matching the user's Firebase email/phone; the first sign-in only synchronizes the user profile. |
| Backend test fails before tests start | Confirm JDK 21 is active and Gradle can load its native macOS services. This repository does not contain a Gradle wrapper. |

## Git workflow

The shared branch for this repository is `production`.

```sh
git clone git@github.com:nasiosheva/daycare-react-native-mono-repo.git
cd daycare-react-native-mono-repo
git switch production
```

Before committing, run `pnpm verify`. Keep environment files, Firebase platform configuration, signing keys, and local build artifacts untracked; `.gitignore` already excludes them.

## Current scope

Platform Admins create tenants, their initial subscription payment, and the initial active Staff Admin account. Daycare Staff Admins configure daily, weekly, and monthly service plans; create Staff Admin and teacher/miss accounts; invite parents; and manage tenant operations. A parent purchases a plan for a linked child; this creates an invoice with a manual-payment status. A Staff Admin confirms the payment, then a Staff Admin or staff member for the child's branch approves or rejects each booking. Attendance check-in requires a confirmed booking only for tenants with the `DAYCARE_OPERATIONS` capability. PAUD/TK attendance remains a shared core feature and does not require a Daycare booking.

For `PAUD` and `TK`, Staff Admins manage academic years and curriculum programs from the Akademik menu. This is the initial academic foundation; learning outcomes, assessment, report cards, and academic calendars can be layered on the same academic-year and curriculum-program models.

Weekly plans specify the number of day credits. Parents can initially select fewer dates than the purchased credits, then use the visible remaining credits for a later booking. The Staff Admin chooses whether unused weekly credits expire at the end of the seven-day period or remain transferable for 30 additional days. Rejected bookings return their reserved credit. This first version intentionally uses Staff Admin payment confirmation; connect a payment gateway such as Midtrans or Xendit by replacing that confirmation step with a verified payment callback.

Staff Admins and staff can record activities, meals, naps, and observations for children in their permitted branch. Parents can view development notes for children linked to their account and receive in-app/native push notifications for newly recorded notes.

Photo uploads are intentionally not included. They require separate object storage, consent, retention, access-control, and deletion policies.
