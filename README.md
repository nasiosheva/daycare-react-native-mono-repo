# Usia Emas

Usia Emas is a multi-tenant early-childhood platform for web, iOS, Android, and tablets. The repository contains an Expo Router application, a Kotlin Spring Boot API, shared TypeScript domain logic, UI primitives, and a typed API client.

> **Required project context:** Read [Business rules](docs/business-rules.md) before implementing, reviewing, or changing any business flow, API contract, data model, authorization rule, or architecture. It is the normative product-knowledge source for cross-module behavior. When code and the documented target rule differ, record the gap explicitly and do not silently redefine the rule from the current implementation.

Daily implementation history and known implementation gaps remain under `docs/changes/`.

## Technology

- Mobile and web: Expo 53, React Native, Expo Router, React Query, and Firebase Authentication.
- API: Kotlin, Spring Boot 3.5, Spring Security OAuth2 Resource Server, JPA, Flyway, and springdoc OpenAPI.
- Database: PostgreSQL 17.
- Workspace: pnpm 10 and Turborepo.

## Prerequisites

- Node.js 20 or newer, Corepack, and pnpm 10.
- JDK 21 for the API. The tracked API Gradle Wrapper provides Gradle 8.14.2 for local and CI builds.
- A local PostgreSQL 17 server. Docker Desktop is optional, not required.
- A Firebase project with Phone and Google providers enabled. Firebase Email/Password is intentionally disabled because application passwords are stored and verified by the API.
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
- Platform Admin Home also provides a read-only **Tenant readiness** card. It groups ready tenants and tenants needing attention for subscription, active Staff Admin, and active branch; an active legacy class group is required only where `DAYCARE_OPERATIONS` or a published `ACADEMIC_CURRICULUM` offering is available. Daycare tenants additionally require an active service plan, capacity and valid weekly operating hours for every active branch, and an active payment instruction. It is a support dashboard only: it does not change tenant status or Parent catalog visibility.
- Staff Admin Home uses the same readiness rules for its current tenant. When setup is incomplete, it shows a read-only card listing the missing configuration and routes to the Staff Admin management hub; that hub shows a server-driven actionable checklist for branches, operating hours, classes, plans/capacity, and payment instructions. An inactive tenant subscription remains a non-actionable notice because only Platform Admin manages it, and having an active child is not a readiness prerequisite. It does not change access, subscription, or Parent catalog visibility.
- Main role Home layouts have no app bar; child and detail screens use an app bar with a back button. Navigation is role-specific: Staff Admin and Staff open Profile or the notification inbox from Home toolbar icons; the inbox icon carries the unread count. The inbox settings can pause native Expo push delivery for the current device for one hour, one week, or one month, or locally mute browser notifications for the same durations; selecting a duration is a draft and it takes effect only after **Apply**. Browser notifications are shown only while the web app remains connected and the browser permission is granted. Neither setting hides persisted inbox items or realtime updates. Staff Admin uses four bottom tabs—Home, Children, Classes, and Manage; Development, staff accounts, branches, finance, payments, subscriptions, and booking approvals are grouped in Manage. Platform Admin has tenant administration across three bottom tabs—Home, Tenant, and Master data—and opens Profile from the Home toolbar icon; Staff has classroom operations and opens **Perkembangan Anak** as a child screen with a toolbar/back button. Parent has development, attendance QR, and booking bottom tabs; both the active-tenant and onboarding Parent Home expose Profile from a toolbar icon instead. Profile is always a dedicated child screen with an app bar/back button, never a bottom tab. Every role can access it, and it is the sole location for signing out. Profile manages display name, an optional globally unique username, gender, date of birth, and the application password; Platform Admin can create another Platform Admin with an email, username, and password. A globally registered Parent also receives an optional **Informasi keluarga** child screen from Profile after signup—not during signup—to enter husband/wife birth dates, occupation dropdowns, and monthly income ranges for manual school-fee consideration. This sensitive global profile is never used to calculate fees automatically. Staff Admin sees only occupation and/or income ranges explicitly enabled by the Platform Admin for at least one of the tenant's institution types, and only in Parent enrollment approval; Staff, Platform Admin, and other tenants do not receive the fields.
- Shared mobile UI includes an accessible bottom sheet with a drag handle and close button. Operational add, edit, assignment, and password forms begin from an explicit action instead of rendering immediately; short forms open in a Bottom Sheet, while checkout and other larger workflows use dedicated screens. Profile uses it to confirm logout before ending the session.
- **Cabang** dikelola Staff Admin dengan nama, zona waktu, alamat lengkap wajib, dan tautan Google Maps opsional. Lokasi tersimpan per cabang. Parent membuka **Profil Anak** dari Home untuk membaca profil anak, kelas/Tingkatan aktif, Program Pendampingan yang dibagikan, Staff penugasan tanpa kontaknya, serta alamat cabang dan tombol Google Maps bila tersedia.
- Date and time fields use one reusable picker: the platform-native picker on Android and iOS, and the browser's native inputs on web. Its values remain `YYYY-MM-DD` for dates and `HH:mm` for times.
- Child management, manual or QR attendance, development notes, absence requests, Staff leave/sick requests, and Goals. Staff Admin adds a child through the reusable Bottom Sheet with a required gender choice; the same required choice applies to Parent enrollment and child-profile updates. The child detail screen is reserved for later profile, program, placement, staff-assignment, and Goal access. A linked Parent can submit a dated absence request for a child and cancel it while pending; Staff Admin or in-scope Staff approve or reject it with a required rejection reason. Absence requests are informational only: they do not change bookings, attendance records, or service credits. Active Staff submit their own dated leave or sick request from Profile, with a required reason and one optional JPEG/PNG supporting image (maximum 5 MB); they can cancel only while pending. All active Staff Admins approve or reject from Manage, with a required rejection reason. This request is also informational: it never changes schedules, staffing capacity, or attendance automatically. Each relevant submission, decision, and cancellation persists the intended inbox notification, triggers realtime query invalidation, and sends Expo push to eligible registered native devices. A Staff Admin or scoped Staff can add one optional JPEG/PNG photo (maximum 5 MB) from the gallery or camera to each development note; after it is saved, the grouped history loads a tappable thumbnail for that note. The list returns only `hasPhoto`, while the photo is fetched separately with the same child-scope authorization for the Staff Admin, scoped Staff, or linked Parent. To assign a Goal, Staff Admin or scoped active Staff first selects a Program Kurikulum, then one Program Perkembangan linked to that curriculum, and finally assigns that pair to the child. The Goal stores the selected curriculum as its source, while legacy Goals retain an empty source. Every new Program Perkembangan receives one active indicator; additional tenant-owned indicators can be added through the Program Perkembangan API. Every tenant also sees a shared, platform-wide library of age-graded reference Programs (grouped by developmental category, filtered to the child's age when assigning) that Staff Admin can assign but not edit or archive. Every Program Perkembangan field has an Info toggle explaining its purpose and unit, including calendar days, percentages, and consecutive days. Staff Admin and active Staff choose each daily Yes/No outcome locally, then press **Simpan hasil hari ini** to submit one atomic batch containing every active indicator; a partial or duplicate batch is rejected without changing Goal progress. They can amend a saved indicator and manually **Simpulkan Goal** only as a separate terminal action with a required conclusion. A day counts as Yes only when every active indicator is Yes. Parent can read the saved daily history, calculation, and final conclusion only. Missing dates are excluded from the Yes percentage but break a consecutive-Yes streak. On **Children**, **Goals Anak**, Attendance, and Development, Staff Admin can stage filters in order by branch, learning level, and class group/rombel; each subsequent selector only offers compatible active records, and the list changes only after pressing **OK**. Every other Staff Admin operational list that belongs to a branch—class groups, Staff accounts, booking and Parent-enrollment approvals, Parent payments, and Parent subscriptions—has a branch filter with the same draft-and-OK behavior. A selected branch only narrows server-authorized data; Staff and Parent retain their existing scope and receive no tenant-wide filter. Operational child lists and classroom active-child totals count only children whose Parent enrollment has been approved; pending applications do not consume classroom capacity.
- Staff Admin may link an existing globally registered Parent account to a child by exact username or email, including during direct/offline child registration. The target must have `registrationRole=PARENT`; linking creates or reactivates only the tenant Parent membership and guardian relation, never an account, invitation, enrollment application, invoice, entitlement, or booking. Staff Admin Children shows a server-scoped Parent-link status (`LINKED`, `UNLINKED`, or `REVIEW_REQUIRED`) and filters it through the same draft-and-OK flow as other child filters. Legacy non-Parent links are review-only until manually unlinked from child detail.
- Manual check-in/out requires explicit confirmation and may use the Staff-selected event time. The API rejects a future time, a time outside the child's branch operational day (using the branch time zone), or a check-out earlier than the saved check-in.
- Daycare roster actions are server-driven: each Staff/Staff Admin child row includes the operational date, branch time zone, effective attendance policy, allowed actions, and a readable unavailable reason. The app renders those actions but the API reevaluates booking or monthly-entitlement eligibility when recording check-in, so a stale client cannot authorize attendance. Parent enrollment cards likewise render the server's `accessState` and `allowedActions`; an overdue legacy enrollment is `BILLING_LIMITED` with `REAPPLY`, not an assumed payment-upload action.
- Daycare checkout now requires a verified active pickup authorization selected by in-scope Staff. A linked Parent proposes their own pickup people from the child profile, and Staff Admin activates or revokes them. Pickup cards, routes, deep links, and API actions are available only when the child's own branch has a `PUBLISHED` offering with `DAYCARE_OPERATIONS`; a Daycare offering in another branch or an aggregate tenant capability is not sufficient. Only an active Staff Admin may use a checkout exception, with a required reason stored alongside the attendance audit snapshot; billing status and attendance QR never authorize or block pickup.
- Emergency contacts are a separate, audited child resource. They do not grant Parent access, pickup authority, or consent; a linked Parent manages only contacts they created, while Staff Admin has scoped operational visibility and removal authority.
- Daycare Consent V1 is a separate, audited record only. Staff Admin creates, revises, and activates/deactivates tenant-scoped consent definitions; its toolbar opens a read-only, fully localized information page that explains the current recording-only boundary in plain language. A linked Parent sees only their own current decision for a child and can grant, decline, or withdraw it. Every revision requires a new Parent decision and preserves the old snapshot. Consent V1 never authorizes medical care, medication, pickup, outing, media use, checkout, or an emergency override; those actions continue to follow their own independent server rules until the documented target consent model is implemented.
- For Staff leave/sick requests, a new request notifies every active Staff Admin, a decision notifies only the requester, and cancellation only refreshes the Staff Admin approval list through realtime; none of these actions modifies staffing schedules, capacity, or attendance.
- Service-plan purchase, invoice tracking, Parent-uploaded transfer proof, Staff Admin payment verification, booking approval, and remaining-credit management.
- The Staff Admin **Pengajuan tidak masuk** list uses direct horizontal branch tabs, including **Semua cabang**; selecting a tab immediately narrows the server-authorized list and does not open a filter sheet.
- The sign-in screen accepts email or username with a password. Google and phone-number (OTP) identity flows are offered only from **Daftar akun Parent** and act only as Firebase verification. A Google or phone identity without a matching application account is sent to the same Parent registration form to set the required email and password; it never creates a `UserProfile` automatically. A verified Google email is locked to the registration email, while a verified phone number is stored only after the registration succeeds. A known Google identity is returned to password sign-in; a known phone identity may continue through its OTP session. Password validation follows the application account flow documented in [Business rules](docs/business-rules.md).
- PDF and XLSX reports are generated by the protected Spring API, never from frontend-provided rows or templates. The mobile/web client reads the scoped data for its view, then downloads the server-built attachment. The child-list report uses its active optional filters. Staff Admin also has a branch-specific child-attendance recap from Manage: the screen selects an active branch and inclusive date range to produce one row per active operational child, including zero check-in/check-out totals. A zero total is not labelled as absence because it may represent no booking or a non-operational day. The API enforces report scope and authorization independently of the client, including read-only Staff Admin access.
- Each child also has a single-record **health profile** (blood type, allergies, medical conditions, medications, emergency instructions) editable by Staff Admin or any Staff assigned to that child, and readable by the linked Parent; and an **incident report** log (severity, category, description, optional action taken, optional photo) that Staff/Staff Admin create — every incident notifies the linked guardians, and a `SERIOUS` incident additionally notifies every active Staff Admin, while the Parent side only marks an incident as read (not an approve/reject flow). Staff Admin has a tenant-scoped **Analitik** screen (branch occupancy, Parent attrition per month, and monthly average Goal Yes-percentage) — a separate, per-tenant feature from the cross-tenant Platform Knowledge system described in [Business rules](docs/business-rules.md) §7. Development entries can also carry multiple photos and one optional short audio note, in addition to the original single-photo field kept for older entries.

See [Development-entry media](docs/development-entry-media.md) for the per-entry photo flow, API contract, validation, and scope rules.

## Institution types and shared core

The platform supports one or more institution types per tenant. Its built-in catalog covers `DAYCARE`, `TPA`, `KB`, `SPS`, `PAUD`, `TK`, `RA`, `BIMBA`, `SD`, `MI`, `SMP`, `MTS`, `SMA`, `MA`, and `SMK`; Platform Admin can add another type without changing source code. Each catalog type also has two default-off privacy settings: whether Staff Admins of tenants using that type may see Parent occupation and whether they may see Parent monthly-income range. Where a tenant has multiple types, either field is available only when at least one assigned type enables that specific field. The shared core covers tenant management, branches, reusable learning levels, legacy class groups, children, guardians, staff roles, attendance, child development, notifications, billing infrastructure, profile management, and reusable mobile UI. A legacy class group is not automatically an academic **rombel**: the canonical labels, type-by-type boundaries, and target migration rules are in [Business rules §12.2.2](docs/business-rules.md#1222-batas-kelompok-layanan-kelompok-belajar-dan-rombel-akademik). A tenant is the billing and data boundary; it may operate multiple physical branches under the same tenant-wide Staff Admin account and subscription.

Legacy membership capabilities remain derived from the built-in institution types below. The current mobile access gate first loads the server-owned `UiAccessContext`: academic, Goal, and private-tutoring entry points require a published compatible `EducationOffering`, while a legacy class group is visible only for `DAYCARE_OPERATIONS` or that academic capability. The API independently verifies those boundaries and limits a Staff class list to the Staff member's own assignments. Institution-type descriptions, presentation fields, and dynamic string parameters are editable only in the Platform Admin catalog; only the description is shown in that catalog, while presentation values are not wired to tenant lists, filters, navigation, or access. A catalog type added later is stored and can be assigned to a tenant, but has no special capability until its business rules are explicitly implemented.

| Capability | Institution type | Scope |
| --- | --- | --- |
| `DAYCARE_OPERATIONS` | `DAYCARE` | Service plans, service purchases, booking, booking approval, and the booking prerequisite for attendance. |
| `ACADEMIC_CURRICULUM` | `PAUD`, `TK` | Academic curriculum capability; current curriculum, development-program, Goal, and private-tutoring entry points require a compatible published offering. Learning-level and class-group records remain part of the shared core. |

An institution may select more than one type, for example a Daycare that also operates a TK program. Daycare remains the default for legacy tenants so existing operations continue unchanged.
- In-app inbox and native notifications for payment, booking, and development events. Native iOS/Android devices register their Expo token after notification permission is granted; web users retain the in-app inbox. Active `STAFF` users can also create personal reminders in Profile. A reminder runs primarily as a native local schedule in the device's own time zone and opens the selected operational menu. The API stores the rule and the device's schedule acknowledgement; its minute scheduler sends an Expo fallback only when that installation has not acknowledged the current rule version. Reminder fallback pushes are not stored in the inbox and missed offline schedules are not replayed.

## Environment files

Environment files are local-only and ignored by Git. Start from the corresponding example file; never put secrets in a committed file.

| File | Purpose |
| --- | --- |
| `.env` | Default local stack: Expo public configuration plus local PostgreSQL and API configuration. |
| `.env.dev` | Development services for the mobile launcher scripts. |
| `.env.prod` | Production-service values for the mobile launcher scripts. It does not deploy or build a production app. |

### Variables

| Variable | Used by | Required | Description |
| --- | --- | --- | --- |
| `EXPO_PUBLIC_API_URL` | Mobile/web | Yes | API base URL, including `/api/v1`. This value is bundled into the client and must not contain a secret. |
| `EXPO_PUBLIC_REALTIME_URL` | Mobile/web | Optional | WebSocket override. When omitted, it is derived from `EXPO_PUBLIC_API_URL` as `/api/v1/realtime`. |
| `EXPO_PUBLIC_APP_ENV` | Mobile/web | Production only | Set to `production` in the production deploy workflow and `.env.prod`. It is a required precondition checked by the Android release APK build (see [Android release APK guide](docs/android-release-apk.md)); it does not currently change any in-app sign-in behavior. |
| `EXPO_PUBLIC_FIREBASE_API_KEY` | Mobile/web | Yes | Firebase web API key. |
| `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN` | Mobile/web | Yes | Firebase Auth domain. |
| `EXPO_PUBLIC_FIREBASE_PROJECT_ID` | Mobile/web | Yes | Firebase project ID. |
| `EXPO_PUBLIC_FIREBASE_APP_ID` | Mobile/web | Yes | Firebase application ID. |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | Native mobile | Required for Google sign-in | OAuth web client ID consumed by the native Google sign-in SDK. |
| `EXPO_PUBLIC_GOOGLE_MAPS_GEOCODING_API_KEY` | Web | Optional | Google Maps Geocoding API key used only by the web build of the current-location module (`src/location`) to turn coordinates into a human-readable address. Native reverse geocoding needs no key. Leave empty to still get coordinates on web, just without an address. |
| `IOS_DEVICE_UDID` | iOS launcher | Required for iOS launchers | UDID of the connected physical iPhone. Simulators are intentionally rejected. |
| `POSTGRES_DB` | Optional Docker Compose | Optional | Database name used only when the optional Compose PostgreSQL service is created. |
| `POSTGRES_USER`, `POSTGRES_PASSWORD` | API / optional Docker Compose | Yes for local database | Credentials for the default API connection and optional Compose service. |
| `POSTGRES_HOST`, `POSTGRES_PORT` | Local launcher | Optional | Existing PostgreSQL server checked by local launchers; defaults to `localhost:5432`. They do not change Spring's JDBC URL. |
| `DATABASE_URL` | Default API | Optional | JDBC connection URL; set this for a local server that is not `jdbc:postgresql://localhost:5432/daycare`. |
| `FIREBASE_ISSUER_URI` | Default API | Yes | Firebase token issuer, for example `https://securetoken.google.com/<project-id>`. |
| `LOCAL_AUTH_JWT_SECRET` | API | Yes | At least 32 random bytes used to sign and verify the application-password access tokens. Keep it only in ignored local files or the production server environment. |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | API | Not required for password account provisioning | Retained only for any future Firebase Admin operations. The current account and password flows do not create Firebase users. Keep it only in a secret manager or ignored local environment file when needed. |
| `QR_SIGNING_SECRET` | Default API | Recommended | Secret used to sign attendance QR tokens. Use a random value of at least 32 characters outside local-only development. |
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

   The API runs at `http://localhost:8080/api`. At startup, Flyway validates the recorded history and applies the single consolidated baseline `V1__initial_schema.sql` from `apps/api/src/main/resources/db/migration/` to an empty database. Swagger UI is available at `http://localhost:8080/api/swagger-ui/index.html`, and the OpenAPI document is at `http://localhost:8080/api/v3/api-docs`.

5. Start a client. For direct Expo development, `.env` supplies the public configuration.

   ```sh
   pnpm dev:app
   ```

   For platform-specific launchers, follow [Mobile and web launchers](#mobile-and-web-launchers).

### Initial tenant data

Flyway creates the schema only; it does not create demo tenant data. A Firebase identity is first matched to an existing application account by Firebase UID, email, or phone number. It is never synchronized into a new account automatically. A new Google or phone identity must complete Parent registration with an email and password before it can receive tenant access through an existing invitation or a selected tenant's approved Parent enrollment.

### Database reset

The schema is managed by one consolidated Flyway baseline, `V1__initial_schema.sql`. It is intended only for an empty schema. Do not use `flyway repair` to force an existing database with a different Flyway history or checksum to match this baseline; reset the intended database or resolve the mismatch first.

Before a destructive production reset, take an encrypted or access-controlled PostgreSQL dump, stop the API to prevent writes, clear the application `public` schema (or drop and recreate the application database), deploy the API JAR built from the same revision, and start the service. Confirm Flyway records exactly one successful `V1` row and confirm `/api/actuator/health` is `UP`. The reset does not create tenant, staff, Parent, or Platform Admin accounts. A configured Firebase bootstrap email creates its Platform Admin record only after that Firebase identity calls a Platform Admin endpoint; application-password accounts must be provisioned explicitly afterwards.

Flyway provides idempotent master data: built-in institution types and global development categories. The reference global curriculum (age-band levels, Program Perkembangan, and their indicators) is intentionally not part of the schema-building migrations, so a fresh schema starts with zero curriculum data; it is seeded separately, and only when `SEED_GLOBAL_CURRICULUM_ENABLED=true` is set. When `LOCAL_AUTH_ENABLED=true` and `LOCAL_SEED_ENABLED=true` are set in `.env`, a local launcher also creates or updates exactly one Platform Admin from `LOCAL_SEED_ADMIN_EMAIL`, `LOCAL_SEED_ADMIN_USERNAME`, `LOCAL_SEED_ADMIN_DISPLAY_NAME`, and `LOCAL_SEED_ADMIN_PASSWORD`. The configured password is reset on every local startup, so the `.env` value is always the valid local-admin credential. No tenant, membership, or transactional/demo data is created.

Set `PLATFORM_ADMIN_EMAILS` to the Firebase email address of the platform operator. When that user first calls the API, it is recorded as a platform `ADMIN` and can create a tenant. Tenant provisioning requires tenant data (including the initial Staff Admin name, email, and password, plus an optional globally unique username), subscription/trial selection, and checkout confirmation. A trial is configurable from one to twelve months and disables manual monthly-price input. Without a trial, the Platform Admin must enter the monthly price manually; the new tenant is created with a payment due immediately and remains inactive until paid. Every tenant creation directly provisions one active `STAFF_ADMIN` account and its tenant membership; the account can sign in immediately with its entered email or username and password.

Platform Admin can manage every tenant from **Tenant**. Its **Tambah lembaga** floating button opens the dedicated **Kelola lembaga** screen; that screen lists the master institution types and provides create, rename, delete, and per-type Parent-occupation/Parent-income visibility settings. It does not create a tenant, branch, subscription, or Staff Admin. Built-in `DAYCARE`, `PAUD`, and `TK` types cannot be deleted, and a custom type cannot be deleted while a tenant still uses it. The tenant list supports search and filtering from the active master catalog, opens tenant detail, edits the name/institution types/plan/monthly fee, creates a one-month renewal invoice, marks or voids a pending invoice, and suspends or reactivates the subscription. A pending Staff Admin invitation can have its validity extended or be cancelled from the same detail. An expired trial becomes `PENDING_PAYMENT` when the Platform Admin reads the tenant list or details. Payment confirmation remains manual until a verified payment-provider callback is integrated.

Platform Admins create another Platform Admin from Profile with an email, username, and password. From a tenant's detail screen, they can add a non-primary Staff Admin with a display name, required email and password, and an optional globally unique username. The API stores only the BCrypt password hash and grants the requested access in one transaction; it does not create Firebase Email/Password users. A configured username can be used with the same password at sign-in; an omitted username leaves email as the only credential identifier. Platform administrator records are protected from deletion at the database level, and the API has no delete route for them.

Staff Admins can create additional active `STAFF_ADMIN` and `STAFF` accounts from **Akun tenant** with a name, required email and password, and an optional globally unique username. The create action is exposed as a floating button; a Staff account's optional child-program and development-category permissions are selected with switches and default to disabled. The account-list branch filter is staged in a Bottom Sheet and affects the list only after **OK**; closing or cancelling the sheet keeps the current list. Names and emails are required, passwords must contain at least six characters, and email matching is case-insensitive. An already-registered email or username is rejected with a localized inline error. A configured username can be used with the same password at sign-in and is shown on the tenant-account list; an omitted username leaves email as the only credential identifier. Staff Admin can edit an active `STAFF` account's name, email, username, branch, and those two permissions from the same list; role and password are not editable in that form. Parent accounts remain invitation-based. From **Akun tenant → Kelola password staf**, Staff Admins can replace the password of active `STAFF_ADMIN` and `STAFF` accounts in their own tenant using the same password rule. Parent accounts are excluded. Passwords are stored only as BCrypt hashes in PostgreSQL.

The detailed UI, authorization, field-ownership, API, validation, and verification contract is in [Tenant staff accounts](docs/tenant-staff-accounts.md).

## Mobile and web launchers

The launchers source the corresponding environment file before starting Expo. They synchronize workspace dependencies from the locked pnpm version whenever the lockfile has changed, so a newly added Expo module is available even when `node_modules` already exists. They also create a missing environment file from its `.example` template, then stop until its required Firebase and API values are filled.

Copy and populate the file before using a launcher, or let the launcher create its local copy on first use:

```sh
cp .env.dev.example .env.dev
cp .env.prod.example .env.prod
```

| Environment | Android | iOS | Web |
| --- | --- | --- | --- |
| Local stack | `./run-android-local.sh` | `./run-ios-local.sh` | `./run-web-local.sh` |
| Local API | `./scripts/run-backend-local.sh` | `./scripts/run-backend-local.sh` | `./scripts/run-backend-local.sh` |
| Development | `./run-android-dev.sh` | `./run-ios-dev.sh` | `./run-web-dev.sh` |
| Production services | `./run-android-prod.sh` | `./run-ios-prod.sh` | `./run-web-prod.sh` |

`./run-android-local.sh` synchronizes the generated Android project with the Expo native configuration when needed, restores `android/local.properties` from `ANDROID_HOME`, `ANDROID_SDK_ROOT`, or the standard macOS SDK location, then creates or refreshes and installs the Android development build before starting Metro. It can therefore be used as the one-command local Android client launcher, including after an Android application-package or native-plugin change. Before a clean Android prebuild, every Android launcher temporarily preserves the ignored `MYAPP_RELEASE_*` entries and their referenced release keystore, then restores them only into the regenerated local project. The other Android launchers start an installed Expo development build using the selected service environment, and rebuild it automatically when the native configuration changes. iOS launchers only build and run on the physical iPhone identified by `IOS_DEVICE_UDID`; simulators are intentionally unsupported. The `prod` scripts point at production services but do not create a signed store/release build and do not deploy the API.

Android and iOS begin with a native splash screen configured from `apps/mobile/app.json`, then retain the full Usia Emas branded splash layout while authentication state restores. `BrandedSplash` composes that full-screen design from a gradient, SVG rays, the separate emblem asset, and text; it is not a screen-sized bitmap. Android 12 and newer necessarily show only the system-provided background and centered icon before React starts, because that is the Android platform launch-screen contract. Web intentionally does not use this native splash behavior. The launcher fingerprints the complete mobile asset directory, so changing a splash, icon, or other bundled asset automatically triggers Expo prebuild and synchronizes the generated native projects.

Run `./scripts/run-backend-local.sh` in its own terminal before starting a local Web, Android, or iOS launcher. It sources `.env`, validates local backend configuration, reuses PostgreSQL at `${POSTGRES_HOST:-localhost}:${POSTGRES_PORT:-5432}` or starts the optional Docker Compose PostgreSQL service, stops an existing API process only when that process is identified as owned by this repository, then starts a fresh API with Spring profile `local` in the foreground. It never kills an unrelated process that happens to use port 8080. This activates the local-only Platform Admin seeder when `LOCAL_AUTH_ENABLED=true` and `LOCAL_SEED_ENABLED=true`, and resets the configured local-admin password on startup. Stop the backend with Ctrl+C in that terminal.

`./run-web-local.sh`, `./run-android-local.sh`, and `./run-ios-local.sh` no longer start, stop, or replace the API process; they verify that `http://localhost:8080/api/v3/api-docs` is ready and explain how to start it when unavailable. `./run-web-local.sh` always starts Expo Web with `http://localhost:8080/api/v1`, independent of a LAN URL in `.env`. For a connected Android device, `./run-android-local.sh` uses `adb reverse`, starts Metro on `localhost`, and explicitly opens the development client with the localhost URL. Its mobile API URL is also `http://localhost:8080/api/v1`, so the API and bundle do not depend on Wi-Fi routing. It immediately prints the latest 200 API request/response and Android runtime-error records, then continues streaming new logs; this logger stops with the launcher. API diagnostics are active only for the Android local launcher and report method, URL, status or network/timeout outcome, and duration. They never print bearer tokens, request bodies, passwords, OTPs, or uploaded media.

Every API request has a 15-second timeout. Login shows a specific unreachable-server or slow-server message, and a signed-in account whose profile cannot be loaded receives explicit **Retry** and **Sign out** actions instead of an indefinite loading state.

Keep the local launcher terminal open while using the mobile application. If the API becomes unreachable during tenant creation, the app does not retry automatically because the request may already have completed; open the tenant list to check the result before submitting again.

The root application stack starts from Home. Root-level navigation effects wait until the navigation container is ready, preventing Android startup redirects from accessing an unavailable router.

The scripts can install project dependencies, but intentionally do not install system software or provision secrets. Node.js 20+, Android Studio/SDK for Android, Xcode for iOS, Firebase credentials, and a reachable API must be supplied by the developer or CI environment. Android launchers automatically use `adb` from `ANDROID_HOME`, `ANDROID_SDK_ROOT`, or the standard macOS SDK location (`~/Library/Android/sdk`); set one of the SDK variables when the SDK is elsewhere.

### Signed Android release artifacts

Use the dedicated root launcher to build a signed APK for direct Android distribution:

```sh
./build-android-release-apk.sh
```

The launcher loads `.env.prod` and requires `EXPO_PUBLIC_APP_ENV=production`, JDK 21, a local Android SDK, `apps/mobile/google-services.json`, the generated `apps/mobile/android` project, and local release-signing values in `apps/mobile/android/gradle.properties`. It does not create, copy, upload, or commit a keystore. A signing-alias rename must preserve the same private-key certificate in that keystore, otherwise installed Android applications cannot receive a compatible update. On success it verifies the APK signature and writes the signed artifact to `apps/mobile/android/app/build/outputs/apk/release/app-release.apk`. Follow the full [Android release APK guide](docs/android-release-apk.md) for one-time signing setup, verification, and troubleshooting. `run-android-prod.sh` remains a development-client launcher for production services and does not create this APK.

For Google Play distribution, build a signed Android App Bundle instead:

```sh
./build-android-release-aab.sh
```

It writes `apps/mobile/android/app/build/outputs/bundle/release/app-release.aab` and verifies the bundle signature with `jarsigner`. Google Play generates architecture-specific APKs from this AAB, so do not use the APK-only ABI reduction as a substitute for Play delivery.

### Native development build

Native Firebase and Google sign-in require a development build; Expo Go is not sufficient. Place the Firebase platform configuration files locally before building:

- `apps/mobile/google-services.json` for Android. This client configuration is version-controlled; it must never be confused with a Firebase service-account credential.
- `apps/mobile/GoogleService-Info.plist` for iOS. Unlike the Android client configuration, this local iOS configuration remains ignored and must be provided to each iOS build environment.

Each downloaded Firebase platform configuration must belong to the current Android application ID or iOS bundle ID; validate this before replacing an ignored local configuration file. Register the Android SHA-1/SHA-256, iOS bundle ID (`com.children.platform`), authorized web domains, Firebase SMS region policy, and Google OAuth clients in Firebase. `./run-android-local.sh` creates and installs the local Android development build automatically. To create it manually for a non-local Android launcher, run:

```sh
corepack pnpm --filter @daycare/app exec expo run:android
```

For iOS, use `./run-ios-dev.sh` after setting `IOS_DEVICE_UDID`; it runs `expo run:ios --device <UDID>` and deliberately rejects simulators. Native email/password, phone, and Google authentication use React Native Firebase; web uses the Firebase JavaScript SDK.

To identify the connected iPhone UDID, run `xcrun xctrace list devices`, copy the UDID shown for the physical device (not a line marked `Simulator`), and set it as `IOS_DEVICE_UDID` in the matching environment file. The iPhone must be connected, trusted, and enabled for development.

### Audio recording module

`apps/mobile/src/audio` provides a generic `useAudioRecording` hook for Android and iOS. It requests microphone permission, records foreground-only high-quality M4A audio for at most five minutes, and returns a cache-file descriptor (`uri`, duration, MIME type, creation time, and size when available). The caller owns the cache lifecycle: upload or move it as needed, then call `clear`; `cancel` deletes an unfinished recording. No screen, API route, or upload flow is wired yet. Web callers receive an explicit unsupported result.

### Current-location module

`apps/mobile/src/location` provides a generic `useCurrentLocation` hook for Android, iOS, and web. It requests foreground-only location permission (native) or uses the browser Geolocation API (web), fetches the device's current position once per call (never continuous/background tracking), and returns coordinates, accuracy, a timestamp, and a best-effort reverse-geocoded address. Reverse geocoding uses `expo-location`'s on-device geocoder natively (no key needed) and the Google Maps Geocoding API on web (needs `EXPO_PUBLIC_GOOGLE_MAPS_GEOCODING_API_KEY`; omitted or failed geocoding still returns the coordinates, just with `address: null`). No screen is wired to it yet.

### Image picker module

`apps/mobile/src/image-picker` provides a generic `useImagePicker` hook for Android and iOS. It can select up to ten images from the gallery or take one photo with the camera, returning local metadata without base64, EXIF, crop UI, upload, or persistent storage. Images use 80% picker compression; callers own any later upload or persistence. The hook restores a pending Android picker result when the activity is recreated. Web callers receive an explicit unsupported result.

### Document export module

`apps/mobile/src/document-export` downloads protected, server-built PDF and Excel (`.xlsx`) attachments; it does not send report rows or layout from the client. It supports the scoped child list and the Staff Admin child-attendance recap, which requires one active branch plus a date range and returns check-in, check-out, and pending-check-out totals per active child. Android and iOS write the downloaded attachment to cache with `expo-file-system` and offer the native share sheet through `expo-sharing`; web downloads the attachment in the browser. `DocumentExportViewer` and `useDocumentExport` remain reusable adapters for future server-backed report types.

## API contract and authentication

Staff Admin's **Kelola** menu opens each operational destination as a dedicated child screen with an app bar and native back button. Their home and Kelola hub remain role-level navigation screens.

All API routes are under `/api/v1` and require an application or Firebase bearer token except the OpenAPI/Swagger endpoints and the public application-password registration/login routes. Email/username-and-password login always returns an application bearer token for the same protected API routes. Firebase Google and phone tokens are accepted only to verify and match an existing identity, or while submitting Parent registration; they never create an account automatically. Every self-registration is recorded with the global `PARENT` registration role; this does not grant access to a tenant. A Parent without tenant access uses the onboarding navigation (Home, Enrollment, Profile) to choose a tenant, add one or more children, and select a package. This creates a `PENDING_APPROVAL` application with a locked package and price snapshot, but no invoice. After Staff Admin approval, the Parent membership, child, invoice, and pending entitlement are created; the Parent then follows the tenant's transfer instructions and uploads proof. `POST /api/v1/auth/logout` revokes the active bearer token server-side until its natural expiry; only its SHA-256 hash is retained. Mobile logout sends this request best-effort while immediately clearing the local session and returning to Login, so an offline device still exits locally without waiting for a response. Endpoints that operate on an organization also require `X-Organization-Id`. The mobile app supports Indonesian and English; it saves the chosen language on the device, sends it in `Accept-Language` (`id` or `en`), and the API localizes error details accordingly. Indonesian is the default when the header is absent or unsupported. Raw Firebase provider messages and configuration details are not exposed to clients.

For local logout verification, start the API with `./scripts/run-backend-local.sh`, sign out from an Android development build, and confirm the launcher log reports `POST /auth/logout` with `204`. Reusing that same captured bearer token against a protected API endpoint must return `401`.

| Capability | Endpoint |
| --- | --- |
| Read current user and memberships, or update own optional username | `GET /api/v1/me`, `PATCH /api/v1/me/username` |
| Change platform-admin PIN | `POST /api/v1/platform/pin` |
| List or create platform tenants | `GET` / `POST /api/v1/platform/tenants` |
| Read or update a tenant | `GET` / `PATCH /api/v1/platform/tenants/{organizationId}` |
| Manage the current tenant's branches (Staff Admin) | `GET` / `POST /api/v1/branches`, `PATCH /api/v1/branches/{branchId}`, `POST /api/v1/branches/{branchId}/{primary\|archive}` |
| Configure branch operating hours and overtime rates (Staff Admin) | `GET` / `PUT /api/v1/branches/{branchId}/operating-hours` |
| View child-branch operating hours (Parent) | `GET /api/v1/parent/operating-hours` |
| Create, update, or void overtime invoices (Staff Admin) | `GET` / `POST /api/v1/overtime-charges`, `PATCH /api/v1/overtime-charges/{chargeId}`, `POST /api/v1/overtime-charges/{chargeId}/void` |
| Renew, activate, or suspend a tenant subscription | `POST /api/v1/platform/tenants/{organizationId}/subscription/renew`, `POST /api/v1/platform/tenants/{organizationId}/subscription/{ACTIVE\|SUSPENDED}` |
| Mark a tenant subscription payment as paid | `POST /api/v1/platform/tenants/{organizationId}/payments/{paymentId}/mark-paid` |
| Void a pending tenant subscription payment | `POST /api/v1/platform/tenants/{organizationId}/payments/{paymentId}/void` |
| Extend or cancel a pending Staff Admin invitation | `POST /api/v1/platform/tenants/{organizationId}/staff-admin-invitation/{refresh\|cancel}` |
| Create, list, edit, or deactivate tenant staff accounts | `POST` / `GET /api/v1/tenant-users`, `PATCH /api/v1/tenant-users/{userId}`, `POST /api/v1/tenant-users/{userId}/deactivate` |
| Grant or revoke a Staff account's child-program or development-category permission | `PATCH /api/v1/tenant-users/{userId}/child-program-permission`, `PATCH /api/v1/tenant-users/{userId}/development-category-permission` |
| Invite a Parent to a tenant | `POST /api/v1/invitations` |
| List or create children | `GET` / `POST /api/v1/children` (`GET` accepts optional `branchId`, `learningLevelId`, and `classroomId` filters) |
| Download the currently scoped child report | `GET /api/v1/reports/children/export?format=PDF\|XLSX` (accepts the same optional child filters) |
| Download a Staff Admin child-attendance recap | `GET /api/v1/reports/children/attendance/export?format=PDF\|XLSX&branchId={id}&startsOn=YYYY-MM-DD&endsOn=YYYY-MM-DD` |
| Read or edit a child | `GET` / `PATCH /api/v1/children/{childId}` |
| Deactivate a child without deleting history | `POST /api/v1/children/{childId}/deactivate` |
| List or assign child Goals | `GET` / `POST /api/v1/children/{childId}/goals` |
| Record, finalize, or correct a child Goal | `PUT /api/v1/child-goals/{goalId}/check-ins/{date}` for one saved indicator (including its detail), `PUT /api/v1/child-goals/{goalId}/check-ins/{date}/batch` for every active indicator atomically, `POST /api/v1/child-goals/{goalId}/finalize` for the separate terminal conclusion, `POST /api/v1/child-goals/{goalId}/conclusion-corrections` for an active Staff Admin's audited conclusion correction |
| Add or remove a child's programs | `POST /api/v1/children/{childId}/programs`, `DELETE /api/v1/children/{childId}/programs/{programId}` |
| Assign or remove a child's Staff Admin, staff, nurse, or miss | `POST /api/v1/children/{childId}/staff-assignments`, `DELETE /api/v1/children/{childId}/staff-assignments/{assignmentId}` |
| Manage learning levels and templates | `GET` / `POST /api/v1/learning-levels`, `GET /api/v1/learning-level-templates`, `PATCH /api/v1/learning-levels/{id}`, `POST /api/v1/learning-levels/{id}/archive` |
| Manage class groups, class-specific programs, and their staff | `GET` / `POST /api/v1/classrooms`, `PATCH /api/v1/classrooms/{id}`, `POST /api/v1/classrooms/{id}/archive`, `/api/v1/classrooms/{id}/programs`, `/api/v1/classrooms/{id}/staff-assignments` |
| Read a child's class-placement history | `GET /api/v1/children/{childId}/placements` |
| Read server-authorized target class groups for a child placement | `GET /api/v1/children/{childId}/placement-options` |
| Change a child's class placement | `POST /api/v1/children/{childId}/placements` |
| Record attendance | `POST /api/v1/children/{childId}/attendance` |
| Issue attendance QR token | `GET /api/v1/children/{childId}/attendance-qr` |
| List or create development entries | `GET` / `POST /api/v1/children/{childId}/development-entries` |
| Read a development-entry photo | `GET /api/v1/children/{childId}/development-entries/{entryId}/photo` |
| List, add, or manage development categories | `GET` / `POST /api/v1/development-categories`, `PATCH /api/v1/development-categories/{categoryId}` |
| List or manage Goal templates and indicators | `GET /api/v1/goal-templates?search=` (optional name-or-description search), `POST /api/v1/goal-templates`, `PATCH /api/v1/goal-templates/{templateId}`, `POST /api/v1/goal-templates/{templateId}/indicators`, `PATCH /api/v1/goal-templates/{templateId}/indicators/{indicatorId}`, `POST /api/v1/goal-templates/{templateId}/indicators/{indicatorId}/archive` |
| List or create service plans | `GET` / `POST /api/v1/service-plans` |
| Read or set a branch daily capacity | `GET /api/v1/branch-capacities`, `PUT /api/v1/branches/{branchId}/capacity` |
| List, create, or deactivate a package discount/promo | `GET` / `POST /api/v1/service-plans/{planId}/discounts`, `POST /api/v1/service-plans/{planId}/discounts/{discountId}/deactivate` |
| List or manage package templates | `GET` / `POST /api/v1/service-plan-templates`, `PATCH` / `DELETE /api/v1/service-plan-templates/{templateId}` |
| Purchase a service plan and create its invoice | `POST /api/v1/service-purchases` |
| List parent service entitlements and use remaining credits | `GET /api/v1/service-entitlements`, `POST /api/v1/service-entitlements/{id}/bookings` |
| Discover available tenants and read a Parent's enrollment applications | `GET /api/v1/parent-enrollment/catalog`, `GET /api/v1/parent-enrollment` |
| Submit, retry, or cancel a Parent enrollment | `POST /api/v1/parent-enrollment/checkout`, `POST /api/v1/parent-enrollment/{enrollmentId}/retry`, `POST /api/v1/parent-enrollment/{enrollmentId}/cancel` |
| List and decide Parent enrollment applications before payment | `GET /api/v1/parent-enrollment/pending-approval`, `POST /api/v1/parent-enrollment/{enrollmentId}/approval` |
| List or manage a tenant's Parent transfer instructions | `GET /api/v1/payment-instructions`, `GET /api/v1/payment-instructions/manage`, `POST /api/v1/payment-instructions`, `PATCH` / `DELETE /api/v1/payment-instructions/{instructionId}` |
| List bookings or pending branch approvals | `GET /api/v1/bookings`, `GET /api/v1/bookings/pending-approval` |
| Approve or reject a paid booking | `POST /api/v1/bookings/{id}/approval` |
| List invoices, upload a proof, review it, or mark it paid | `GET /api/v1/invoices`, `GET /api/v1/invoices/{id}`, `POST /api/v1/invoices/{id}/payment-proof`, `GET /api/v1/invoices/{id}/payment-proof`, `POST /api/v1/invoices/{id}/payment-proof/review`, `POST /api/v1/invoices/{id}/mark-paid` |
| Manage private tutoring services, tutors, and Parent requests (Staff Admin) | `GET` / `POST /api/v1/private-tutoring/manage/services`, `PATCH /api/v1/private-tutoring/manage/services/{id}`, `GET` / `POST /api/v1/private-tutoring/manage/tutors`, `PATCH /api/v1/private-tutoring/manage/tutors/{id}`, `GET /api/v1/private-tutoring/manage/requests`, `POST /api/v1/private-tutoring/manage/requests/{id}/decision` |
| Browse and request matching private tutoring (Parent) | `GET /api/v1/private-tutoring/parent/services?childId={id}`, `GET /api/v1/private-tutoring/parent/requests`, `POST /api/v1/private-tutoring/parent/services/{id}/requests`, `POST /api/v1/private-tutoring/parent/requests/{id}/cancel` |
| Create invitation | `POST /api/v1/invitations` |
| List tenant users and pending invitations | `GET /api/v1/tenant-users` |
| Register device token | `POST /api/v1/device-tokens` |
| Read or update temporary device push mute | `GET` / `PATCH /api/v1/device-notification-preference` |
| List or manage personal Staff reminders | `GET` / `POST /api/v1/staff-reminders`, `PATCH` / `DELETE /api/v1/staff-reminders/{reminderId}`, `PATCH /api/v1/staff-reminders/{reminderId}/active` |
| Acknowledge native local reminder schedules | `PUT /api/v1/staff-reminders/local-schedules` |
| List or mark notifications as read | `GET /api/v1/notifications`, `PATCH /api/v1/notifications/{notificationId}/read` |

The mobile app sends either an application-password session token or a Firebase identity token through `Authorization: Bearer <token>`. Its API client normally sends `X-Organization-Id` for a tenant selected from the user's returned memberships. A non-platform account with more than one membership must select a tenant explicitly before it opens a tenant-scoped Home or route; direct scoped URLs wait for a loaded profile and are returned to the selector when no context has been chosen. Changing tenant, signing out, every successful profile refresh, and a failed profile refresh clear cached data before the next scoped render; a realtime reconnect revalidates the profile before it accepts events. Native and inbox notification actions are fail-closed against the current role, membership, active status, and Daycare capability policy. They may select a tenant only when that membership still belongs to the current profile. Parent enrollment and payer billing are explicit self-service exceptions for a `registrationRole=PARENT` account: they do not select a tenant, and a payer payment-instruction request carries its explicit enrollment organization while the server independently verifies the payer/enrollment. Legacy Daycare destinations also recheck their current context before rendering. An inactive Parent retains only onboarding and payer-billing self-service; an inactive Staff or Staff Admin lands on a safe read-only Home with Profile access and no operational navigation. Historical read routes require their own resource policy, and inactive Staff/Admin exports are hidden in the client and rejected by the API. `ADMIN` is a platform-level role bootstrapped by `PLATFORM_ADMIN_EMAILS`; tenant roles are `STAFF_ADMIN`, `STAFF`, and `PARENT`. The shared policy is defined in `packages/core` and is enforced by the API service layer. The language switcher is available only from Profile after sign-in; pre-login screens follow the device or stored preference without showing a language control.

### Realtime WebSocket

The mobile and web client connect to `GET ws(s)://<api-host>/api/v1/realtime` after sign-in. The first frame is `{"type":"CONNECT","token":"<JWT>","organizationId":"<tenant UUID>"}`. Platform Admin and a Parent that has not yet been bound to a tenant omit `organizationId`; an unscoped session receives only events explicitly addressed to that user. The server validates the JWT and selected scope before registering the session. It emits transient `EVENT` envelopes with `id`, `organizationId`, `flags`, optional generic `payload`, and `occurredAt`. Flags may be combined in one event: `NOTIFICATIONS`, `PROFILE`, `PARENT_ENROLLMENTS`, `CHILDREN`, `ATTENDANCE`, `DEVELOPMENT`, `DEVELOPMENT_CATEGORIES`, `BOOKINGS`, `INVOICES`, `ENTITLEMENTS`, `SERVICE_PLANS`, `BRANCHES`, `TENANT_USERS`, `LEARNING`, `ACADEMIC`, `TENANTS`, `GLOBAL_CURRICULUM`, `GOALS`, `STAFF_REMINDERS`, and `PRIVATE_TUTORING`.

WebSocket payloads are not an entity source of truth. The client maps flags to React Query invalidations and reloads data from the protected REST API; it reconnects with backoff and refreshes scoped queries after reconnect. Notifications remain persisted and Expo push delivery remains unchanged, so temporary WebSocket disconnection cannot lose application state. `STAFF_REMINDERS` invalidates only the authenticated Staff user's reminder list.

The API test suite includes fast mock-based unit tests and a Spring integration baseline. `ApiIntegrationTest` uses a dedicated local PostgreSQL database, applies Flyway, uses local JWT authentication, and verifies platform-to-tenant HTTP access. It never uses Docker and is skipped unless these variables point to a non-production test database:

```sh
export INTEGRATION_DATABASE_URL='jdbc:postgresql://localhost:5432/daycare_integration'
export INTEGRATION_DATABASE_USERNAME='daycare'
export INTEGRATION_DATABASE_PASSWORD='daycare'
TASK_JAVA_HOME=/Users/morieshutapea/Library/Java/JavaVirtualMachines/jbr-21.0.8/Contents/Home \
  JAVA_HOME=$TASK_JAVA_HOME ./apps/api/gradlew -p apps/api test --no-daemon
```

Create `daycare_integration` separately from the application database; Flyway owns its schema during the test.

`STAFF_ADMIN` uses the Staff Admin center to manage all staff accounts and passwords, confirm parent payments, monitor every child's parent subscription and remaining daily/weekly quota, configure service plans, plan templates, package discounts/promos, and branch booking capacity, then handle booking approvals. **Paket dan tagihan** is a list and operational overview; creating a plan, template, or discount opens a dedicated child screen with an app bar, while the one-field branch-capacity change uses a bottom sheet. Staff accounts are not deleted: inactive `STAFF` and `STAFF_ADMIN` memberships retain read-only tenant access, while every tenant mutation remains limited to active memberships. An inactive Staff keeps the children already in their assignment scope; an inactive Staff Admin can review tenant-wide operational data. The Staff Admin who performs the action and the last active Staff Admin cannot be deactivated. Platform Admin can add Staff Admin accounts from a tenant detail page; the first Staff Admin created for a tenant is its protected owner and can never be removed, while later Staff Admins can be removed only from that tenant and retain their global account/history. From **Akun tenant**, a Staff Admin can give or revoke a per-account child-program permission for each active `STAFF`; it is disabled by default and allows that Staff to add or remove programs only on children assigned directly or through an active class group. From **Anak**, a Staff Admin can add or edit a child profile, attach one or more programs, and assign active Staff Admin/staff members with a Staff, Nurse, or Miss responsibility. Children are never deleted: a Staff Admin may deactivate a child, which removes the child from operational lists and capacity while retaining its history. Programs and assignments are stored in `child_programs` and `child_staff_assignments`. The entitlement list is parent-scoped for `PARENT` and tenant-scoped for `STAFF_ADMIN`; it includes the child and parent identity required for operational management.

### Booking and billing lifecycle

1. A `STAFF_ADMIN` creates a daily, weekly, or monthly service plan, optionally using a system or tenant template, with a daily package capacity and a daily branch capacity when needed.
2. A `PARENT` purchases a plan for a linked child. The API applies the larger valid automatic discount or package promo code, then creates a pending invoice, entitlement, and any requested booking dates.
3. A `PARENT` uploads or captures one JPEG/PNG transfer proof (maximum 5 MB). The invoice becomes `PAYMENT_SUBMITTED`; the Parent may replace a rejected proof.
4. A `STAFF_ADMIN` reviews the protected proof and accepts or rejects it with a reason. Acceptance activates the entitlement and changes bookings to `PENDING_APPROVAL` or `CONFIRMED` according to the plan policy.
5. A `STAFF_ADMIN` or the `STAFF` explicitly assigned to the child approves or rejects pending bookings. The approval screen separates Parent enrollment applications (before invoice/payment) from paid booking requests; it shows the invoice number and locked invoice total for each booking. A rejection returns the reserved daily/weekly credit, and a failed decision is shown inline in its confirmation sheet.
6. Attendance check-in requires a confirmed booking unless the child has an active monthly entitlement covering the current operational day.

Weekly plans reserve credits for selected dates. Unused credits either expire with the plan period or carry forward for the configured number of days. Pending payment, proof review, approval, and confirmed bookings hold both branch and package capacity; monthly plans hold capacity for each day in their active period. An unpaid invoice releases its slots and promo redemption after its due date. Payment proofs are currently stored in the protected database record and are accessible only to the invoice payer or a Staff Admin in the same tenant. A payment-gateway integration should replace manual review with a verified provider callback.

### Branch operating hours and overtime

Each `STAFF_ADMIN` configures every branch's Monday–Sunday operating schedule and ordered overtime blocks. The operating-hours form provides draft templates that immediately replace the full weekly draft, setting Monday–Saturday to either 06:00–13:30 or 07:00–16:00 and closing Sunday; applying one does not save until the Staff Admin selects Save. After a successful save, the form shows a confirmation dialog and returns to its previous screen only when the Staff Admin selects **OK**; a failed save keeps the Staff Admin on the form with an error. Blocks may be added or removed completely; without a block, the branch cannot create an overtime invoice until a valid block is added again. An inactive day is closed and cannot receive an overtime invoice. Staff Admin records the actual pickup time manually; when it is after the configured close time, the system charges every reached block cumulatively (for example, 15 minutes then 20 minutes) and caps time beyond the last block at that final cumulative amount. One child can have one non-void overtime invoice per operational date. Only a `PENDING` overtime invoice may be corrected or voided. The Parent sees their linked child branch's operating hours and overtime rates from a dedicated menu, then pays and uploads proof using the normal invoice flow; paying this invoice never creates or activates a service entitlement.

### Private tutoring

Staff Admin manages optional one-session private-tutoring services from **Kelola les privat** only for PAUD and TK offerings. A service belongs to one branch and defines its age range, matching learning levels, duration, up to three independent optional tariffs (daily, weekly, and monthly), and permitted active tutors. At least one tariff must be greater than zero; an existing service's former single price is preserved as its daily tariff when the pricing migration runs. Tutors are either active tenant Staff or external providers. A Parent opens **Les privat** from Home, selects a linked child, and only sees services matching that child's active branch placement, learning level, and age. The Parent selects an available tariff and submits a request with optional date/time and note; the selected amount and tariff type are copied to the request, so later service-price changes do not alter an existing request. Staff Admin approves it by selecting the provider and branch-local schedule, or rejects it with a reason. Approval creates the `PRIVATE_TUTORING` invoice, so transfer instructions and proof upload follow the standard payment flow. Verified payment confirms the session and notifies the Parent plus any selected internal Staff tutor. Private tutoring does not consume Daycare package credit or create a Daycare booking. UI requires a published compatible `EducationOffering`; API authorization also requires `ACADEMIC_CURRICULUM`. The remaining migration to scope every legacy service and placement by `offeringId` is tracked work, so the tenant capability remains a compatibility guard rather than per-offering authorization.

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
JAVA_HOME=/path/to/jdk-21 ./apps/api/gradlew -p apps/api test --no-daemon
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
| Backend test or local launcher reports a missing Gradle Wrapper | Restore the tracked `apps/api/gradlew` and `apps/api/gradle/wrapper/` files with `git restore apps/api/gradlew apps/api/gradlew.bat apps/api/gradle/wrapper`, then repeat the command. |
| Local backend launcher reports no PostgreSQL service | Start PostgreSQL on `localhost:5432` or install and start Docker Desktop so the launcher can create the optional Compose PostgreSQL service. |

## GitHub Actions deployment

`Pull request tests` runs only the TypeScript/mobile suite for pull requests targeting `production`. `Deploy production` runs only after a commit is pushed to `production` (normally the result of merging an approved pull request). Both workflows use `pnpm/action-setup@v6`, which supports the current GitHub Actions runtime. Protect `production` in GitHub so pull requests must pass `Pull request tests` and direct pushes are disallowed.

The deployment workflow always builds and uploads the Expo web export. It detects changed paths from the pushed commit range: when at least one changed file is under `apps/api/`, it restores the Gradle cache, runs the API test suite, builds the API JAR with the tracked Gradle 8.14.2 wrapper and JDK 21, uploads that JAR into the same immutable release, activates it, restarts `umur-emas-api`, and waits for `/api/actuator/health` to return `UP`. If activation or health verification fails, the workflow switches the VPS back to the immediately preceding release, restarts the prior API artifact, checks its health, then marks the workflow failed. A web-only change preserves the currently active API JAR, does not restart the API, and only switches the web release/reloads Caddy. The workflow does not apply database migrations in a standalone step; Flyway validation and migrations run when the API starts. A rollback cannot reverse an already-applied database migration, so API migrations must remain backward-compatible with the preceding release.

For a private repository on GitHub Free, configure these values as repository-level Actions Variables and Secrets before enabling the first deployment; Environment variables and secrets are not available to those workflow runs. On GitHub Pro, Team, or Enterprise, the same names may instead be scoped to a protected `production` Environment. Public build settings are preferably Actions Variables; the deployment workflow also accepts an Actions Secret with the same name when a value has been stored there instead.

| Kind | Name | Purpose |
| --- | --- | --- |
| Variable | `PRODUCTION_API_URL` | Public API base URL, including `/api/v1`. |
| Variable | `PRODUCTION_REALTIME_URL` | Optional production WebSocket URL. |
| Variable | `PRODUCTION_FIREBASE_API_KEY`, `PRODUCTION_FIREBASE_AUTH_DOMAIN`, `PRODUCTION_FIREBASE_PROJECT_ID`, `PRODUCTION_FIREBASE_APP_ID`, `PRODUCTION_GOOGLE_WEB_CLIENT_ID` | Public Firebase values compiled into the web app. |
| Variable | `VPS_APP_DIR` | Absolute release root, for example `/opt/umur-emas`. |
| Secret | `VPS_HOST`, `VPS_USER` | SSH host and restricted deployment user. |
| Secret | `VPS_SSH_PRIVATE_KEY` | A dedicated GitHub Actions deployment private key, never the developer's personal SSH key. |
| Secret | `VPS_KNOWN_HOSTS` | Verified host-key line from the VPS; do not generate it in CI with an unverified `ssh-keyscan`. |

Before the workflow can activate a release, provision the VPS with PostgreSQL, Java 21, Caddy, an `umur-emas-api` systemd service, and a non-login deployment user that can run only `/usr/local/sbin/umur-emas-activate-release` through `sudo`. Install [scripts/production/activate-release.sh](scripts/production/activate-release.sh) there as `/usr/local/sbin/umur-emas-activate-release` with root ownership and executable permissions. It preserves the existing API JAR for web-only releases, restarts the service only after an API release uploads a new `api.jar`, and supports `--rollback` to swap the current and immediately preceding releases. The API systemd environment file must remain only on the VPS and provide at least `DATABASE_URL`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `FIREBASE_ISSUER_URI`, `FIREBASE_SERVICE_ACCOUNT_JSON`, `CORS_ALLOWED_ORIGINS`, `PLATFORM_ADMIN_EMAILS`, and a strong `QR_SIGNING_SECRET`.

## Git workflow

The shared branch for this repository is `production`.

```sh
git clone git@github.com:nasiosheva/daycare-react-native-mono-repo.git
cd daycare-react-native-mono-repo
git switch production
```

Before committing, run `pnpm verify`. Every change requires a documentation review in the same change set: create or update `docs/changes/YYYY-MM-DD/<context>.md` with the change, affected behavior, verification, and any follow-up; update this README for user flow, business rules, API contracts, configuration, operational procedures, or verification changes; and update relevant module documentation when it exists. If no documentation update is materially required, state the reason explicitly in the handoff. Keep environment files, Firebase platform configuration, signing keys, and local build artifacts untracked; `.gitignore` already excludes them.

For a direct Android distribution APK, use `./build-android-release-apk.sh`. It signs with the ignored local release keystore, packages only `arm64-v8a` by default, and enables R8/resource shrinking. Use `ANDROID_RELEASE_ARCHITECTURES=armeabi-v7a,arm64-v8a` only when 32-bit device support is required; see [Android release APK](docs/android-release-apk.md).

## Current scope

Platform Admins create tenants, their initial subscription payment, and the initial active Staff Admin account from the **Tambah tenant** floating action in Tenant. The adjacent **Tambah lembaga** action opens the independent institution-type catalog and never creates a tenant. On web, validation and submit feedback are shown inline at the top of the current screen; destructive confirmations retain their explicit action buttons. The initial branch is the primary branch. Staff Admins manage the branches inside their own tenant: they can add, edit, designate, and archive non-primary branches; adding a branch never creates or consumes another Staff Admin account. Platform Admins retain read-only branch visibility in tenant detail for support, alongside billing and subscription control. A tenant has exactly one active primary branch for defaults, while its Staff Admin membership remains tenant-wide across every branch. Daycare Staff Admins configure daily, weekly, and monthly service plans; configure at least one transfer instruction; create Staff Admin and teacher/miss accounts; invite parents; and manage tenant operations. `PARENT` is global: the same Parent can enroll different children in multiple tenants and switch among approved tenant access links. A Parent can submit up to ten children in one enrollment checkout; each application locks its package and price snapshot, then waits for Staff Admin approval. Approval activates the Parent link and creates the invoice. The Parent taps **Bayar** to view tenant-specific transfer instructions, then uploads a JPEG/PNG proof. Staff Admin proof verification activates the entitlement. An overdue enrollment invoice removes tenant operational access when the Parent has no other active service there; the Parent returns to onboarding and submits a new application from the beginning. Attendance check-in requires a confirmed booking only for tenants with the `DAYCARE_OPERATIONS` capability. PAUD/TK attendance remains a shared core feature and does not require a Daycare booking.

Collection-list screens and list sheets use the shared `ShimmerList` while their query is loading or refreshing, including a server-side search or a changed branch filter. The existing data is intentionally hidden until the latest response settles, so the visible list never suggests stale filter results. Detail pages, form selectors, and submit actions retain their own loading behavior. When the device's Reduce Motion accessibility setting is enabled, the same skeleton remains static rather than animated.

The detailed Parent application, approval, transfer, proof, and expiry lifecycle is documented in [Parent enrollment and payment flow](docs/parent-enrollment-flow.md).

A completed Child Goal stays closed. Only an active Staff Admin can submit a mandatory-reason correction to its current Staff conclusion; the API records the before/after values, actor, and time append-only, without changing check-ins, targets, dates, status, or original finalization time. Staff and Parents receive the current corrected conclusion only; correction history and its internal reason are restricted to active Staff Admins.

The **Kelas** menu is a shared learning core for Daycare, PAUD, and TK. Staff Admins create optional learning periods, tenant-owned curriculum programs, reusable levels, and class groups. A class-group form labels its branch, level, and optional period selectors; it automatically selects the first active level, directs the Staff Admin to create one when none is active, and lets an existing period be cleared. Class capacity must be a positive whole number when supplied. The curriculum-program list is shown inline, searches global and tenant programs by name or description on the server, and exposes creation through the Staff Admin floating action. The **Tingkatan** action is only shown to Staff Admins; Staff continue with the child, academic-year, curriculum-program, class-group, and curriculum-activity actions within their assignment scope. Every newly created tenant also receives 14 active default curriculum activities for the daily routine: Morning circle through Persiapan pulang. Their names and descriptions are tenant-owned operational data, so Staff Admin can change or archive them after provisioning; existing tenants are not backfilled automatically. A Staff Admin sets an optional age range, explicit non-negative display order, and any visible global or tenant curriculum programs for each level; archiving requires confirmation and preserves existing class groups and placement history. Selecting a child from the Staff Home opens a fixed-child development flow, including that child's Goals, so the Staff cannot switch to another child during that flow. Development history is displayed inline for every role, grouped by its category, rather than behind a separate sheet. Platform Admins manage the global catalog from the **Master data** bottom tab (Kurikulum global, Program Perkembangan global, and Kategori perkembangan global); global programs are visible directly in tenant selectors and may be linked to a tenant level without creating a tenant copy. The future Platform Knowledge pipeline may publish additional reviewed global Programs and Goals, but does not change this current direct-use UX until a separate implementation explicitly does so. A level represents a tier such as Nursery, Toddler, PAUD, TK A, or TK B; a class group represents a parallel group such as `TK A – Matahari`. System templates are filtered by the tenant's institution types, while custom levels remain allowed. Levels may carry optional age guidance and curriculum-program links. Each class group may also have its own named programs, separate from the level curriculum, plus an optional child capacity and a Staff, Nurse, or Miss roster.

Program Kurikulum is a reusable container for one or more Program Perkembangan (`DevelopmentProgram`, formerly Goal Template/Goal Category). Development categories such as **Bahasa & Komunikasi** remain on the Program Perkembangan, while a global Program Kurikulum may link only active global Program Perkembangan and a tenant Program Kurikulum may link active global Program Perkembangan plus ones owned by that tenant. A new or edited global Program Kurikulum must choose one global reference learning level; its Goal picker and API accept only Program Perkembangan from that level. That reference does not replace the program's separate links to tenant learning levels, so tenants can still use the global program directly without copying it. Legacy global programs without a reference level remain readable but require a level before their next save. Global records expose `isTemplate=true`; tenant-owned records expose `false`. Platform Admin manages global Program Kurikulum, while Staff Admin manages only tenant-owned Program Kurikulum. Archived Program Kurikulum are retained with their existing learning-level links but cannot be selected for a new Goal. Platform Admin can also create, edit, and delete global Program Perkembangan directly from **Master data > Program Perkembangan global** (name, learning level, development category, target duration/percentage/streak, and an indicator set chosen at creation time); indicators cannot be added to, edited on, or archived from an existing global Program Perkembangan afterward, and deletion is refused while any child still has it assigned.

The learning flow is **Program Kurikulum → Program Perkembangan → Goal Anak → penilaian harian**. A new Goal must store a selected active and authorized Program Kurikulum together with an active Program Perkembangan linked to it; the API rejects mismatched pairs. Existing Goals created before this rule remain readable with no inferred source. Active Staff Admins can list and edit only tenant-owned Development Programs from Goals; global records remain read-only in tenant UI. The edit form explains that changes to the reusable program also apply to every child Goal that uses it. Each Goal shows a read-only daily indicator record for authorized Staff and the linked Parent: every saved date displays its individual Yes, No, and not-yet-recorded active indicators, including partial dates. System metrics remain separate and count only days with every active indicator recorded; the UI labels that absence clearly instead of showing a misleading `0/0` percentage. **Program Pendampingan Anak** remains separate from this chain: it is a child-specific operational plan with staff steps, internal delivery notes, an optional Parent-specific summary, and optional home guidance. A program and each individual step are private by default; Staff/Admin explicitly share the suitable summary and guidance with the linked Parent. The Parent can read only shared content and submit short feedback, never edit Staff steps, statuses, notes, or internal description. Staff Admin manages these plans tenant-wide; permitted Staff may manage them only with `canManageChildPrograms` and within child scope. A plan with history is completed or discontinued rather than deleted. Goal assignment and indicator recording remain separate: any active Staff Admin or active in-scope Staff may assign and record a Goal without that Program Pendampingan Anak permission.

Staff Admins and assigned Staff can place or move a child between active same-branch class groups. The previous placement is closed and preserved as history; a child has one active placement at a time. A directly assigned Staff member may place that child in any active same-branch class group. A Staff member whose access is only through the child's current class group may place the child only into another active same-branch class group to which that Staff member is also assigned. The server provides only permitted targets through `GET /children/{childId}/placement-options` and validates the same rule again on `POST /children/{childId}/placements`; the mobile client must not derive the permitted list from the general class-group endpoint. Age guidance warns instead of blocking a placement. A class-group capacity is checked first, then the configured branch capacity is used when the class group does not have its own limit. Class-group staff receive the same child visibility scope as direct child assignments. Archiving preserves historical placements and never deletes them.

Weekly plans specify the number of day credits. Parents can initially select fewer dates than the purchased credits, then use the visible remaining credits for a later booking. The Staff Admin chooses whether unused weekly credits expire at the end of the seven-day period or remain transferable for 30 additional days. Rejected bookings return their reserved credit. This first version intentionally uses Staff Admin proof review; connect a payment gateway such as Midtrans or Xendit by replacing that review step with a verified payment callback.

Staff Admins can record activities, meals, naps, and observations for every tenant child. Staff can do so only for children explicitly assigned to them through the child's Staff, Nurse, or Miss assignment; the same assignment scope limits the Staff Home list, child list, attendance, development, placement, and booking approval. Staff may approve or reject ordinary assigned-child bookings, while only a Staff Admin decides Parent enrollment before payment. Parents can view development notes for children linked to their account and receive in-app/native push notifications for newly recorded notes. A Parent may cancel a pending approval application; no invoice exists until Staff Admin approval. An overdue approved-enrollment invoice returns a Parent without another active service to the limited onboarding and billing flow.

Payment-proof images are intentionally limited to a single JPEG or PNG of at most 5 MB and are stored in the database with invoice-level authorization. Before adding general photo uploads, move media to dedicated object storage and define consent, retention, access-control, and deletion policies.
