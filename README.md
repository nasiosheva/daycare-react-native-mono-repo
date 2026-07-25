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
- A local PostgreSQL 17 server. Docker Desktop is optional, not required.
- A Firebase project with Email/Password, Phone, and Google providers enabled.
- Xcode for iOS development; Android Studio plus an emulator or device for Android development.

## Repository structure

- `apps/mobile`: Expo Router app for Android, iOS, and web.
- `apps/api`: Kotlin Spring Boot REST API and Flyway schema migrations.
- `packages/core`: roles, permissions, domain types, and Zod validation schemas.
- `packages/ui`: shared React Native UI primitives and design tokens.
- `packages/api-client`: typed API client and OpenAPI generation target.
- `scripts/run-mobile.sh`: shared runner for all mobile/web environment launchers.

## Product capabilities

- Platform `ADMIN` manages tenant lifecycle, tenant subscriptions, tenant payments, and global curriculum programs. Tenant `STAFF_ADMIN` (owner/head) manages the tenant's users and operational configuration; its Home shows linked operational and Daycare-financial summaries for children, staff, approvals, invoices, subscriptions, and credits. `STAFF` (teacher/miss) Home is limited to assigned-child cards. Each card shows whether today's development entry and each active Goal's indicators still need input, and opens that child's daily development flow. `PARENT` Home shows only the linked children with today's attendance and active services, plus pending or payment-proof-under-review invoices; child cards open that child's development or QR flow, while a pending invoice opens payment-proof upload.
- Main role Home layouts have no app bar; child and detail screens use an app bar with a back button. Navigation is role-specific: Staff Admin uses four bottom tabs—Home, Children, Classes, and Manage—and opens Profile or the notification inbox from Home toolbar icons; the inbox icon carries the unread count. The inbox settings can pause native Expo push delivery for the current device for one hour, one week, or one month, or locally mute browser notifications for the same durations; selecting a duration is a draft and it takes effect only after **Apply**. Browser notifications are shown only while the web app remains connected and the browser permission is granted. Neither setting hides persisted inbox items or realtime updates. Development, staff accounts, branches, finance, payments, subscriptions, and booking approvals are grouped in Manage. Platform Admin has tenant administration; Staff has classroom operations, opens **Perkembangan Anak** as a child screen with a toolbar/back button, and opens Profile from the Home toolbar icon. Parent has development, attendance QR, and booking. Every role can access Profile, which is the sole location for signing out. Profile manages display name, gender, date of birth, and Firebase password; Platform Admin can create another Platform Admin with an email, username, and password.
- Shared mobile UI includes an accessible bottom sheet with a drag handle and close button. Operational add, edit, assignment, and password forms begin from an explicit action instead of rendering immediately; short forms open in a Bottom Sheet, while checkout and other larger workflows use dedicated screens. Profile uses it to confirm logout before ending the session.
- Date and time fields use one reusable picker: the platform-native picker on Android and iOS, and the browser's native inputs on web. Its values remain `YYYY-MM-DD` for dates and `HH:mm` for times.
- Child management, manual or QR attendance, development notes, and Goals. Staff Admin adds a child through the reusable Bottom Sheet with a required gender choice; the same required choice applies to Parent enrollment and child-profile updates. The child detail screen is reserved for later profile, program, placement, staff-assignment, and Goal access. Staff Admin creates a Goal template scoped to a learning level and optionally a class group, then assigns it to a child. Every new template receives one active indicator; additional indicators can be added through the Goal-template API. Every Goal-template field has an Info toggle explaining its purpose and unit, including calendar days, percentages, and consecutive days. Staff Admin and active Staff record or amend one daily Yes/No outcome per active indicator and can manually finalize the active Goal with a required conclusion; a day counts as Yes only when every active indicator is Yes. Parent can read the daily history, calculation, and final conclusion only. Missing dates are excluded from the Yes percentage but break a consecutive-Yes streak. On **Children**, **Goals Anak**, Attendance, and Development, Staff Admin can stage filters in order by branch, learning level, and class group/rombel; each subsequent selector only offers compatible active records, and the list changes only after pressing **OK**. Every other Staff Admin operational list that belongs to a branch—class groups, Staff accounts, booking and Parent-enrollment approvals, Parent payments, and Parent subscriptions—has a branch filter with the same draft-and-OK behavior. A selected branch only narrows server-authorized data; Staff and Parent retain their existing scope and receive no tenant-wide filter. Operational child lists and classroom active-child totals count only children whose Parent enrollment has been approved; pending applications do not consume classroom capacity.
- Service-plan purchase, invoice tracking, Parent-uploaded transfer proof, Staff Admin payment verification, booking approval, and remaining-credit management.
- Firebase email/password, phone, and Google authentication; Firebase ID tokens secure the API.
- PDF and XLSX reports are generated by the protected Spring API, never from frontend-provided rows or templates. The mobile/web client reads the scoped data for its view, then downloads the server-built attachment. The initial report is the currently filtered child list; the same report scope and authorization are enforced for preview data and the exported file.

## Institution types and shared core

The platform supports one or more institution types per tenant. Its master catalog initially contains `DAYCARE`, `PAUD`, and `TK`; Platform Admin can add another type without changing source code. The shared core covers tenant management, branches, reusable learning levels, class groups, children, guardians, staff roles, attendance, child development, notifications, billing infrastructure, profile management, and reusable mobile UI. A tenant is the billing and data boundary; it may operate multiple physical branches under the same tenant-wide Staff Admin account and subscription.

Capabilities are derived only from the built-in institution types below and drive both mobile navigation and backend authorization. A catalog type added later is stored and can be assigned to a tenant, but has no special capability until its business rules are explicitly implemented.

| Capability | Institution type | Scope |
| --- | --- | --- |
| `DAYCARE_OPERATIONS` | `DAYCARE` | Service plans, service purchases, booking, booking approval, and the booking prerequisite for attendance. |
| `ACADEMIC_CURRICULUM` | `PAUD`, `TK` | Academic curriculum capability; learning periods and curriculum programs are available to all tenant types through the shared learning structure. |

An institution may select more than one type, for example a Daycare that also operates a TK program. Daycare remains the default for legacy tenants so existing operations continue unchanged.
- In-app inbox and native notifications for payment, booking, and development events. Native iOS/Android devices register their Expo token after notification permission is granted; web users retain the in-app inbox. Active `STAFF` users can also create personal reminders in Profile. A reminder runs primarily as a native local schedule in the device's own time zone and opens the selected operational menu. The API stores the rule and the device's schedule acknowledgement; its minute scheduler sends an Expo fallback only when that installation has not acknowledged the current rule version. Reminder fallback pushes are not stored in the inbox and missed offline schedules are not replayed.

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
| `EXPO_PUBLIC_REALTIME_URL` | Mobile/web | Optional | WebSocket override. When omitted, it is derived from `EXPO_PUBLIC_API_URL` as `/api/v1/realtime`. |
| `EXPO_PUBLIC_APP_ENV` | Mobile/web | Simulation only | Set to `simulation` only in `.env.simulation` to enable the local role-preview buttons. |
| `EXPO_PUBLIC_FIREBASE_API_KEY` | Mobile/web | Yes | Firebase web API key. |
| `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN` | Mobile/web | Yes | Firebase Auth domain. |
| `EXPO_PUBLIC_FIREBASE_PROJECT_ID` | Mobile/web | Yes | Firebase project ID. |
| `EXPO_PUBLIC_FIREBASE_APP_ID` | Mobile/web | Yes | Firebase application ID. |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | Native mobile | Required for Google sign-in | OAuth web client ID consumed by the native Google sign-in SDK. |
| `IOS_DEVICE_UDID` | iOS launcher | Required for iOS launchers | UDID of the connected physical iPhone. Simulators are intentionally rejected. |
| `POSTGRES_DB` | Optional Docker Compose | Optional | Database name used only when the optional Compose PostgreSQL service is created. |
| `POSTGRES_USER`, `POSTGRES_PASSWORD` | API / optional Docker Compose | Yes for local database | Credentials for the default API connection and optional Compose service. |
| `POSTGRES_HOST`, `POSTGRES_PORT` | Local launcher | Optional | Existing PostgreSQL server checked by local launchers; defaults to `localhost:5432`. They do not change Spring's JDBC URL. |
| `DATABASE_URL` | Default API | Optional | JDBC connection URL; set this for a local server that is not `jdbc:postgresql://localhost:5432/daycare`. |
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

3. Ensure PostgreSQL is running locally and create a database and user matching `.env`. The default API connection is database `daycare`, user `daycare`, password `daycare`, on port `5432`; set `DATABASE_URL`, `POSTGRES_USER`, and `POSTGRES_PASSWORD` when your local instance differs. `POSTGRES_DB` is used only by the optional Docker Compose service.

4. Start the API. Spring Boot does not automatically load root `.env` files, so source it in the same command.

   ```sh
   set -a && . ./.env && set +a && pnpm dev:api
   ```

   The API runs at `http://localhost:8080/api`. Flyway applies the schema migrations automatically at startup. Swagger UI is available at `http://localhost:8080/api/swagger-ui/index.html`, and the OpenAPI document is at `http://localhost:8080/api/v3/api-docs`.

5. Start a client. For direct Expo development, `.env` supplies the public configuration.

   ```sh
   pnpm dev:app
   ```

   For platform-specific launchers, follow [Mobile and web launchers](#mobile-and-web-launchers).

### Initial tenant data

Flyway creates the schema only; it does not create demo tenant data. A Firebase user is synchronized on its first authenticated request, but receives tenant access only when an existing invitation matches that user's email or phone number, or after a Parent enrollment is approved by the selected tenant.

For a database-only local Platform Admin, set `LOCAL_AUTH_ENABLED=true`, provide a `LOCAL_AUTH_JWT_SECRET` of at least 32 characters, and set `LOCAL_SEED_ENABLED=true`. The local startup then creates or reuses a Platform Admin in PostgreSQL without Firebase. It also seeds every application table with connected, flow-valid demo data: active, pending-payment, and trial tenants; staff and parent memberships; active and pending Parent enrollments; children, placements, attendance, development, plans, invoices, payment proofs, entitlements, bookings, capacity, discounts, notifications, and audit data. The default local account is email `admin@gmail.com`, username `admin`, and password `123123`; override it with the `LOCAL_SEED_ADMIN_*` values in `.env`. Additional local demo accounts are `owner`, `rani`, `bunda`, and `nadia`, all using password `123123`. The password is BCrypt-hashed and is only generated when the seeded user has no local password yet, so a password changed through the app is retained after restart. This local-only mode is disabled by default and does not run for the `simulation`, development, or production profiles.

Set `PLATFORM_ADMIN_EMAILS` to the Firebase email address of the platform operator. When that user first calls the API, it is recorded as a platform `ADMIN` and can create a tenant. Tenant provisioning requires tenant data (including the initial Staff Admin name, email, and password), subscription/trial selection, and checkout confirmation. A trial is configurable from one to twelve months and disables manual monthly-price input. Without a trial, the Platform Admin must enter the monthly price manually; the new tenant is created with a payment due immediately and remains inactive until paid. Every tenant creation directly provisions one active `STAFF_ADMIN` account and its tenant membership; the account can sign in immediately with the entered email and password.

Platform Admin can manage every tenant from **Tenant**. Its **Tambah lembaga** floating button opens the dedicated **Kelola lembaga** screen; that screen lists the master institution types and provides create, rename, and delete actions. It does not create a tenant, branch, subscription, or Staff Admin. Built-in `DAYCARE`, `PAUD`, and `TK` types cannot be deleted, and a custom type cannot be deleted while a tenant still uses it. The tenant list supports search and filtering from the active master catalog, opens tenant detail, edits the name/institution types/plan/monthly fee, creates a one-month renewal invoice, marks or voids a pending invoice, and suspends or reactivates the subscription. A pending Staff Admin invitation can have its validity extended or be cancelled from the same detail. An expired trial becomes `PENDING_PAYMENT` when the Platform Admin reads the tenant list or details. Payment confirmation remains manual until a verified payment-provider callback is integrated.

Platform Admins create another Platform Admin from Profile with an email, username, and password. The API creates the Firebase email/password account and grants Platform Admin access in one transaction. This requires a service-account credential for the matching Firebase project. Platform administrator records are protected from deletion at the database level, and the API has no delete route for them.

Staff Admins can create additional active `STAFF_ADMIN` and `STAFF` accounts from **Akun tenant** with a name, email, and password; names and emails are required, passwords must contain at least six characters, and email matching is case-insensitive. An already-registered email is rejected. Parent accounts remain invitation-based. From **Akun tenant → Kelola password staf**, Staff Admins can replace the password of active `STAFF_ADMIN` and `STAFF` accounts in their own tenant using the same password rule. Parent accounts are excluded. In Firebase environments this requires the Firebase service-account credential; in local auth the password is stored only as a BCrypt hash in PostgreSQL.

## Simulation environment

The Spring `simulation` profile uses a separate database, `daycare_simulation`, exposed on host port `5433`. It has independent PostgreSQL data and receives the same Flyway migrations as the default local database.

On its first startup, the simulation API seeds a complete demo dataset: an active `DAYCARE` tenant (`Daycare Pelangi`), a `PAUD` tenant awaiting payment (`Daycare Mentari`) with an academic year and curriculum program, a trial `TK` tenant (`Daycare Angkasa`), exactly one protected platform Admin (`admin@simulation.local`), Staff Admin, teacher, parent, branch/classroom, child, subscription payments, service plans, parent invoice/entitlement, booking, attendance, development entry, invitation, and notification. Set `daycare.simulation-seed-enabled=false` in an overriding Spring configuration to disable this seed.

1. Create and fill the shared simulation environment file. Set the Firebase values for the simulation project and a distinct QR signing secret.

   ```sh
   cp .env.simulation.example .env.simulation
   ```

2. Ensure a separate local PostgreSQL database is available for simulation. By default it is `daycare_simulation` on port `5433`; set `SIMULATION_DATABASE_URL`, `SIMULATION_POSTGRES_USER`, and `SIMULATION_POSTGRES_PASSWORD` if your local instance uses another connection. Docker Compose remains an optional alternative.

3. Start the API with the `simulation` Spring profile.

   ```sh
   pnpm dev:api:simulation
   ```

4. Run the simulation client with one of the simulation launchers below.

   The simulation sign-in screen provides local preview buttons for `ADMIN`, `STAFF_ADMIN`, `STAFF`, and `PARENT`. They only verify role-based navigation and never create a Firebase token, membership, or API access. Use Firebase sign-in with a valid membership to exercise protected API data and mutations.

For a physical device, replace `localhost` in `EXPO_PUBLIC_API_URL` with the development machine's LAN address. Ensure the device can reach the API and that the API's CORS/network policy permits the connection.

## Mobile and web launchers

The launchers source the corresponding environment file before starting Expo. They synchronize workspace dependencies from the locked pnpm version whenever the lockfile has changed, so a newly added Expo module is available even when `node_modules` already exists. They also create a missing environment file from its `.example` template, then stop until its required Firebase and API values are filled.

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

The `local` launchers use `.env` and also start the default local stack for you. They first reuse a PostgreSQL server already accepting connections on `${POSTGRES_HOST:-localhost}:${POSTGRES_PORT:-5432}`; when none is available, they can start the optional Docker Compose PostgreSQL service. After the database is available, the launcher starts `gradle -p apps/api bootRun` in the background and waits until `http://localhost:8080/api/v3/api-docs` responds before starting Expo. The launcher must own that backend process so it can stop it on exit; if port `8080` is already occupied by the Java API process from this same repo, the launcher stops it and starts a fresh one. If another process owns port `8080`, the launcher fails and asks you to stop that process first. Backend logs are written to `daycare-api-local.log`, and the background API process is stopped when the launcher exits. `./run-web-local.sh` always starts Expo Web with `http://localhost:8080/api/v1`, independent of a LAN URL in `.env`. For a connected Android device, `./run-android-local.sh` uses `adb reverse`, starts Metro on `localhost`, and explicitly opens the development client with the localhost URL. Its mobile API URL is also `http://localhost:8080/api/v1`, so the API and bundle do not depend on Wi-Fi routing. It also streams the relevant React Native and Android runtime logs into the launcher terminal; this logger stops with the launcher.

Every API request has a 15-second timeout. Login shows a specific unreachable-server or slow-server message, and a signed-in account whose profile cannot be loaded receives explicit **Retry** and **Sign out** actions instead of an indefinite loading state.

Keep the local launcher terminal open while using the mobile application. If the API becomes unreachable during tenant creation, the app does not retry automatically because the request may already have completed; open the tenant list to check the result before submitting again.

The root application stack starts from Home. Root-level navigation effects wait until the navigation container is ready, preventing Android startup redirects from accessing an unavailable router.

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

### Document export module

`apps/mobile/src/document-export` downloads protected, server-built PDF and Excel (`.xlsx`) attachments; it does not send report rows or layout from the client. The initial export is the scoped child list, using the same optional branch, learning-level, and classroom filters as the Children screen. Android and iOS write the downloaded attachment to cache with `expo-file-system` and offer the native share sheet through `expo-sharing`; web downloads the attachment in the browser. `DocumentExportViewer` and `useDocumentExport` remain reusable adapters for future server-backed report types.

## API contract and authentication

Staff Admin's **Kelola** menu opens each operational destination as a dedicated child screen with an app bar and native back button. Their home and Kelola hub remain role-level navigation screens.

All API routes are under `/api/v1` and require a Firebase bearer token except the OpenAPI/Swagger endpoints. With `LOCAL_AUTH_ENABLED=true`, local email/username-and-password login instead returns a local bearer token for the same API routes; Google and phone login remain Firebase-only and are hidden in this local mode. Every self-registration is recorded with the global `PARENT` registration role; this does not grant access to a tenant. A tenant `PARENT` membership is an access link, not the role itself: one Parent can enroll children and hold active access in multiple tenants, while every child and operational record remains tenant-scoped. A tenant membership is created only after the selected tenant's Staff Admin approves the Parent enrollment. Endpoints that operate on an organization also require `X-Organization-Id`. The mobile app supports Indonesian and English; it saves the chosen language on the device, sends it in `Accept-Language` (`id` or `en`), and the API localizes error details accordingly. Indonesian is the default when the header is absent or unsupported. Firebase account provisioning failures are returned as localized application errors; raw Firebase provider messages and configuration details are not exposed to clients.

| Capability | Endpoint |
| --- | --- |
| Current user and memberships | `GET /api/v1/me` |
| Change platform-admin PIN | `POST /api/v1/platform/pin` |
| List or create platform tenants | `GET` / `POST /api/v1/platform/tenants` |
| Read or update a tenant | `GET` / `PATCH /api/v1/platform/tenants/{organizationId}` |
| Manage the current tenant's branches (Staff Admin) | `GET` / `POST /api/v1/branches`, `PATCH /api/v1/branches/{branchId}`, `POST /api/v1/branches/{branchId}/{primary\|archive}` |
| Renew, activate, or suspend a tenant subscription | `POST /api/v1/platform/tenants/{organizationId}/subscription/renew`, `POST /api/v1/platform/tenants/{organizationId}/subscription/{ACTIVE\|SUSPENDED}` |
| Mark a tenant subscription payment as paid | `POST /api/v1/platform/tenants/{organizationId}/payments/{paymentId}/mark-paid` |
| Void a pending tenant subscription payment | `POST /api/v1/platform/tenants/{organizationId}/payments/{paymentId}/void` |
| Extend or cancel a pending Staff Admin invitation | `POST /api/v1/platform/tenants/{organizationId}/staff-admin-invitation/{refresh\|cancel}` |
| Create, list, or deactivate tenant staff accounts | `POST` / `GET /api/v1/tenant-users`, `POST /api/v1/tenant-users/{userId}/deactivate` |
| Grant or revoke a Staff account's child-program or development-category permission | `PATCH /api/v1/tenant-users/{userId}/child-program-permission`, `PATCH /api/v1/tenant-users/{userId}/development-category-permission` |
| Invite a Parent to a tenant | `POST /api/v1/invitations` |
| List or create children | `GET` / `POST /api/v1/children` (`GET` accepts optional `branchId`, `learningLevelId`, and `classroomId` filters) |
| Download the currently scoped child report | `GET /api/v1/reports/children/export?format=PDF\|XLSX` (accepts the same optional child filters) |
| Read or edit a child | `GET` / `PATCH /api/v1/children/{childId}` |
| Deactivate a child without deleting history | `POST /api/v1/children/{childId}/deactivate` |
| List or assign child Goals | `GET` / `POST /api/v1/children/{childId}/goals` |
| Record or finalize a child Goal | `PUT /api/v1/child-goals/{goalId}/check-ins/{date}`, `POST /api/v1/child-goals/{goalId}/finalize` |
| Add or remove a child's programs | `POST /api/v1/children/{childId}/programs`, `DELETE /api/v1/children/{childId}/programs/{programId}` |
| Assign or remove a child's Staff Admin, staff, nurse, or miss | `POST /api/v1/children/{childId}/staff-assignments`, `DELETE /api/v1/children/{childId}/staff-assignments/{assignmentId}` |
| Manage learning levels and templates | `GET` / `POST /api/v1/learning-levels`, `GET /api/v1/learning-level-templates`, `PATCH /api/v1/learning-levels/{id}`, `POST /api/v1/learning-levels/{id}/archive` |
| Manage class groups, class-specific programs, and their staff | `GET` / `POST /api/v1/classrooms`, `PATCH /api/v1/classrooms/{id}`, `POST /api/v1/classrooms/{id}/archive`, `/api/v1/classrooms/{id}/programs`, `/api/v1/classrooms/{id}/staff-assignments` |
| Read or change a child's class placement | `GET` / `POST /api/v1/children/{childId}/placements` |
| Record attendance | `POST /api/v1/children/{childId}/attendance` |
| Issue attendance QR token | `GET /api/v1/children/{childId}/attendance-qr` |
| List or create development entries | `GET` / `POST /api/v1/children/{childId}/development-entries` |
| List, add, or manage development categories | `GET` / `POST /api/v1/development-categories`, `PATCH /api/v1/development-categories/{categoryId}` |
| List or manage Goal templates and indicators | `GET` / `POST /api/v1/goal-templates`, `PATCH /api/v1/goal-templates/{templateId}`, `POST /api/v1/goal-templates/{templateId}/archive`, `POST /api/v1/goal-templates/{templateId}/indicators`, `PATCH /api/v1/goal-templates/{templateId}/indicators/{indicatorId}`, `POST /api/v1/goal-templates/{templateId}/indicators/{indicatorId}/archive` |
| List or create service plans | `GET` / `POST /api/v1/service-plans` |
| Read or set a branch daily capacity | `GET /api/v1/branch-capacities`, `PUT /api/v1/branches/{branchId}/capacity` |
| List, create, or deactivate a package discount/promo | `GET` / `POST /api/v1/service-plans/{planId}/discounts`, `POST /api/v1/service-plans/{planId}/discounts/{discountId}/deactivate` |
| List or manage package templates | `GET` / `POST /api/v1/service-plan-templates`, `PATCH` / `DELETE /api/v1/service-plan-templates/{templateId}` |
| Purchase a service plan and create its invoice | `POST /api/v1/service-purchases` |
| List parent service entitlements and use remaining credits | `GET /api/v1/service-entitlements`, `POST /api/v1/service-entitlements/{id}/bookings` |
| Discover available tenants and read a Parent's enrollment applications | `GET /api/v1/parent-enrollment/catalog`, `GET /api/v1/parent-enrollment` |
| Submit, retry, or cancel a Parent enrollment | `POST /api/v1/parent-enrollment/checkout`, `POST /api/v1/parent-enrollment/{enrollmentId}/retry`, `POST /api/v1/parent-enrollment/{enrollmentId}/cancel` |
| List and decide paid Parent enrollment applications | `GET /api/v1/parent-enrollment/pending-approval`, `POST /api/v1/parent-enrollment/{enrollmentId}/approval` |
| List bookings or pending branch approvals | `GET /api/v1/bookings`, `GET /api/v1/bookings/pending-approval` |
| Approve or reject a paid booking | `POST /api/v1/bookings/{id}/approval` |
| List invoices, upload a proof, review it, or mark it paid | `GET /api/v1/invoices`, `GET /api/v1/invoices/{id}`, `POST /api/v1/invoices/{id}/payment-proof`, `GET /api/v1/invoices/{id}/payment-proof`, `POST /api/v1/invoices/{id}/payment-proof/review`, `POST /api/v1/invoices/{id}/mark-paid` |
| Create invitation | `POST /api/v1/invitations` |
| List active tenant users and pending invitations | `GET /api/v1/tenant-users` |
| Register device token | `POST /api/v1/device-tokens` |
| Read or update temporary device push mute | `GET` / `PATCH /api/v1/device-notification-preference` |
| List or manage personal Staff reminders | `GET` / `POST /api/v1/staff-reminders`, `PATCH` / `DELETE /api/v1/staff-reminders/{reminderId}`, `PATCH /api/v1/staff-reminders/{reminderId}/active` |
| Acknowledge native local reminder schedules | `PUT /api/v1/staff-reminders/local-schedules` |
| List or mark notifications as read | `GET /api/v1/notifications`, `PATCH /api/v1/notifications/{notificationId}/read` |

The mobile app exchanges Firebase ID tokens through `Authorization: Bearer <token>`. Its API client also sends `X-Organization-Id` after a tenant user selects an organization. `ADMIN` is a platform-level role bootstrapped by `PLATFORM_ADMIN_EMAILS`; tenant roles are `STAFF_ADMIN`, `STAFF`, and `PARENT`. The shared policy is defined in `packages/core` and is enforced by the API service layer. Language can only be changed from Login or Profile, and is intentionally stored locally rather than attached to the user account.

### Realtime WebSocket

The mobile and web client connect to `GET ws(s)://<api-host>/api/v1/realtime` after sign-in. The first frame is `{"type":"CONNECT","token":"<JWT>","organizationId":"<tenant UUID>"}`. Platform Admin and a Parent that has not yet been bound to a tenant omit `organizationId`; an unscoped session receives only events explicitly addressed to that user. The server validates the JWT and selected scope before registering the session. It emits transient `EVENT` envelopes with `id`, `organizationId`, `flags`, optional generic `payload`, and `occurredAt`. Flags may be combined in one event: `NOTIFICATIONS`, `PROFILE`, `PARENT_ENROLLMENTS`, `CHILDREN`, `ATTENDANCE`, `DEVELOPMENT`, `DEVELOPMENT_CATEGORIES`, `BOOKINGS`, `INVOICES`, `ENTITLEMENTS`, `SERVICE_PLANS`, `BRANCHES`, `TENANT_USERS`, `LEARNING`, `ACADEMIC`, `TENANTS`, `GLOBAL_CURRICULUM`, `GOALS`, and `STAFF_REMINDERS`.

WebSocket payloads are not an entity source of truth. The client maps flags to React Query invalidations and reloads data from the protected REST API; it reconnects with backoff and refreshes scoped queries after reconnect. Notifications remain persisted and Expo push delivery remains unchanged, so temporary WebSocket disconnection cannot lose application state. `STAFF_REMINDERS` invalidates only the authenticated Staff user's reminder list.

The API test suite includes fast mock-based unit tests and a Spring integration baseline. `ApiIntegrationTest` uses a dedicated local PostgreSQL database, applies Flyway, uses local JWT authentication, and verifies platform-to-tenant HTTP access. It never uses Docker and is skipped unless these variables point to a non-production test database:

```sh
export INTEGRATION_DATABASE_URL='jdbc:postgresql://localhost:5432/daycare_integration'
export INTEGRATION_DATABASE_USERNAME='daycare'
export INTEGRATION_DATABASE_PASSWORD='daycare'
TASK_JAVA_HOME=/Users/morieshutapea/Library/Java/JavaVirtualMachines/jbr-21.0.8/Contents/Home \
  JAVA_HOME=$TASK_JAVA_HOME gradle -p apps/api test --no-daemon
```

Create `daycare_integration` separately from the application database; Flyway owns its schema during the test.

`STAFF_ADMIN` uses the Staff Admin center to manage all staff accounts and passwords, confirm parent payments, monitor every child's parent subscription and remaining daily/weekly quota, configure service plans, plan templates, package discounts/promos, and branch booking capacity, then handle booking approvals. **Paket dan tagihan** is a list and operational overview; creating a plan, template, or discount opens a dedicated child screen with an app bar, while the one-field branch-capacity change uses a bottom sheet. Staff accounts are not deleted: inactive `STAFF` and `STAFF_ADMIN` memberships retain read-only tenant access, while every tenant mutation remains limited to active memberships. An inactive Staff keeps the children already in their assignment scope; an inactive Staff Admin can review tenant-wide operational data. The Staff Admin who performs the action and the last active Staff Admin cannot be deactivated. Platform Admin can add Staff Admin accounts from a tenant detail page; the first Staff Admin created for a tenant is its protected owner and can never be removed, while later Staff Admins can be removed only from that tenant and retain their global account/history. From **Akun tenant**, a Staff Admin can give or revoke a per-account child-program permission for each active `STAFF`; it is disabled by default and allows that Staff to add or remove programs only on children assigned directly or through an active class group. From **Anak**, a Staff Admin can add or edit a child profile, attach one or more programs, and assign active Staff Admin/staff members with a Staff, Nurse, or Miss responsibility. Children are never deleted: a Staff Admin may deactivate a child, which removes the child from operational lists and capacity while retaining its history. Programs and assignments are stored in `child_programs` and `child_staff_assignments`. The entitlement list is parent-scoped for `PARENT` and tenant-scoped for `STAFF_ADMIN`; it includes the child and parent identity required for operational management.

### Booking and billing lifecycle

1. A `STAFF_ADMIN` creates a daily, weekly, or monthly service plan, optionally using a system or tenant template, with a daily package capacity and a daily branch capacity when needed.
2. A `PARENT` purchases a plan for a linked child. The API applies the larger valid automatic discount or package promo code, then creates a pending invoice, entitlement, and any requested booking dates.
3. A `PARENT` uploads or captures one JPEG/PNG transfer proof (maximum 5 MB). The invoice becomes `PAYMENT_SUBMITTED`; the Parent may replace a rejected proof.
4. A `STAFF_ADMIN` reviews the protected proof and accepts or rejects it with a reason. Acceptance activates the entitlement and changes bookings to `PENDING_APPROVAL` or `CONFIRMED` according to the plan policy.
5. A `STAFF_ADMIN` or the `STAFF` explicitly assigned to the child approves or rejects pending bookings. A rejection returns the reserved daily/weekly credit.
6. Attendance check-in requires a confirmed booking unless the child has an active monthly entitlement covering the current operational day.

Weekly plans reserve credits for selected dates. Unused credits either expire with the plan period or carry forward for the configured number of days. Pending payment, proof review, approval, and confirmed bookings hold both branch and package capacity; monthly plans hold capacity for each day in their active period. An unpaid invoice releases its slots and promo redemption after its due date. Payment proofs are currently stored in the protected database record and are accessible only to the invoice payer or a Staff Admin in the same tenant. A payment-gateway integration should replace manual review with a verified provider callback.

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

## GitHub Actions deployment

`Pull request tests` runs only the TypeScript and Kotlin unit suites for pull requests targeting `production`. `Deploy production` runs only after a commit is pushed to `production` (normally the result of merging an approved pull request). Protect `production` in GitHub so pull requests must pass `Pull request tests` and direct pushes are disallowed.

The deployment workflow builds an immutable API JAR and Expo web export on a GitHub-hosted runner, uploads both to a per-commit release directory on the VPS, and atomically changes the active release before restarting the API. It deliberately does not install a self-hosted GitHub runner on the production VPS.

Create a protected GitHub Environment named `production` and configure these values there before enabling the first deployment. Public build settings are preferably Environment Variables; the deployment workflow also accepts an Environment Secret with the same name when a value has been stored there instead.

| Kind | Name | Purpose |
| --- | --- | --- |
| Variable | `PRODUCTION_API_URL` | Public API base URL, including `/api/v1`. |
| Variable | `PRODUCTION_REALTIME_URL` | Optional production WebSocket URL. |
| Variable | `PRODUCTION_FIREBASE_API_KEY`, `PRODUCTION_FIREBASE_AUTH_DOMAIN`, `PRODUCTION_FIREBASE_PROJECT_ID`, `PRODUCTION_FIREBASE_APP_ID`, `PRODUCTION_GOOGLE_WEB_CLIENT_ID` | Public Firebase values compiled into the web app. |
| Variable | `VPS_APP_DIR` | Absolute release root, for example `/opt/umur-emas`. |
| Secret | `VPS_HOST`, `VPS_USER` | SSH host and restricted deployment user. |
| Secret | `VPS_SSH_PRIVATE_KEY` | A dedicated GitHub Actions deployment private key, never the developer's personal SSH key. |
| Secret | `VPS_KNOWN_HOSTS` | Verified host-key line from the VPS; do not generate it in CI with an unverified `ssh-keyscan`. |

Before the workflow can activate a release, provision the VPS with PostgreSQL, Java 21, Caddy, an `umur-emas-api` systemd service, and a non-login deployment user that can run only `/usr/local/sbin/umur-emas-activate-release` through `sudo`. Install [scripts/production/activate-release.sh](scripts/production/activate-release.sh) there as `/usr/local/sbin/umur-emas-activate-release` with root ownership and executable permissions. The API systemd environment file must remain only on the VPS and provide at least `DATABASE_URL`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `FIREBASE_ISSUER_URI`, `FIREBASE_SERVICE_ACCOUNT_JSON`, `CORS_ALLOWED_ORIGINS`, `PLATFORM_ADMIN_EMAILS`, and a strong `QR_SIGNING_SECRET`.

## Git workflow

The shared branch for this repository is `production`.

```sh
git clone git@github.com:nasiosheva/daycare-react-native-mono-repo.git
cd daycare-react-native-mono-repo
git switch production
```

Before committing, run `pnpm verify`. Keep environment files, Firebase platform configuration, signing keys, and local build artifacts untracked; `.gitignore` already excludes them.

## Current scope

Platform Admins create tenants, their initial subscription payment, and the initial active Staff Admin account. The initial branch is the primary branch. Staff Admins manage the branches inside their own tenant: they can add, edit, designate, and archive non-primary branches; adding a branch never creates or consumes another Staff Admin account. Platform Admins retain read-only branch visibility in tenant detail for support, alongside billing and subscription control. A tenant has exactly one active primary branch for defaults, while its Staff Admin membership remains tenant-wide across every branch. Daycare Staff Admins configure daily, weekly, and monthly service plans; create Staff Admin and teacher/miss accounts; invite parents; and manage tenant operations. `PARENT` is global: the same Parent can enroll different children in multiple tenants and switch among approved tenant access links. The new-enrollment selector shows only tenants where the Parent does not already have active access. A Parent can submit up to ten children in one enrollment checkout; each child receives its own tenant-scoped entitlement, invoice, payment proof, and approval status so payment and operational access remain traceable per child. A Parent submits one transfer proof through an image upload or camera capture, and a Staff Admin accepts or rejects it before approving or rejecting the corresponding Parent enrollment. Attendance check-in requires a confirmed booking only for tenants with the `DAYCARE_OPERATIONS` capability. PAUD/TK attendance remains a shared core feature and does not require a Daycare booking.

The **Kelas** menu is a shared learning core for Daycare, PAUD, and TK. Staff Admins create optional learning periods, tenant-owned curriculum programs, reusable levels, and class groups. Platform Admins manage **Kurikulum global** from Home; these programs are shared definitions, appear in every tenant's program selector, and can be linked directly to a tenant level without copying or tenant-side modification. A level represents a tier such as Nursery, Toddler, PAUD, TK A, or TK B; a class group represents a parallel group such as `TK A – Matahari`. System templates are filtered by the tenant's institution types, while custom levels remain allowed. Levels may carry optional age guidance and curriculum-program links. Each class group may also have its own named programs, separate from the level curriculum, plus an optional child capacity and a Staff, Nurse, or Miss roster.

Staff Admins and assigned Staff can place or move a child between active class groups. The previous placement is closed and preserved as history; a child has one active placement at a time. A Staff member can only open and place a child inside their direct or active class-group assignment scope. Age guidance warns instead of blocking a placement. A class-group capacity is checked first, then the configured branch capacity is used when the class group does not have its own limit. Class-group staff receive the same child visibility scope as direct child assignments. Archiving preserves historical placements and never deletes them.

Weekly plans specify the number of day credits. Parents can initially select fewer dates than the purchased credits, then use the visible remaining credits for a later booking. The Staff Admin chooses whether unused weekly credits expire at the end of the seven-day period or remain transferable for 30 additional days. Rejected bookings return their reserved credit. This first version intentionally uses Staff Admin proof review; connect a payment gateway such as Midtrans or Xendit by replacing that review step with a verified payment callback.

Staff Admins can record activities, meals, naps, and observations for every tenant child. Staff can do so only for children explicitly assigned to them through the child's Staff, Nurse, or Miss assignment; the same assignment scope limits the Staff Home list, child list, attendance, development, placement, and booking approval. Staff may approve or reject ordinary assigned-child bookings, while only a Staff Admin decides Parent enrollment binding. Parents can view development notes for children linked to their account and receive in-app/native push notifications for newly recorded notes. A Parent may cancel an unpaid enrollment from the onboarding status list; this voids its invoice and expires the associated entitlement, whereas a paid enrollment continues through Staff Admin approval or rejection.

Payment-proof images are intentionally limited to a single JPEG or PNG of at most 5 MB and are stored in the database with invoice-level authorization. Before adding general photo uploads, move media to dedicated object storage and define consent, retention, access-control, and deletion policies.
