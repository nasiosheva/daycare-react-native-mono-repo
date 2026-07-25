# Profile personal details, Goal template seeding, and hub-screen UX refinements

Date: 2026-07-25
Branch: `feature/profile-details-and-goal-templates`

## Context

This note documents everything implemented in this working session, spanning both mobile-app UX iteration (entry-point/hub screens vs. inline lists) and a backend feature addition (gender/date-of-birth on personal profile data) plus new Goal-template demo seed data. Each section below is self-contained; together they touch `apps/api`, `apps/mobile`, `packages/core`, and `packages/api-client`.

**Scope note:** this branch was cut from a working tree that also contained in-progress changes from a separate, concurrent effort (`PlatformSeedService.kt`, `OnDemandSeedRunner.kt`, changes to `LocalPlatformAdminSeeder.kt`, `AdministrationService.kt`, `BillingService.kt`, `ParentEnrollmentService.kt`, `application.yml`, and several `apps/mobile/app/*.tsx` files not listed below). Those files are **not** described in this document — they were not authored as part of this session's work and this document makes no claims about their behavior or completeness.

---

## 1. Booking screen (PARENT): entry-point hub instead of inline lists

**Request:** "saya mau menu booking di parent ada entry pointnya dulu jangan langsung menampilkan item list secara inline."

- `apps/mobile/app/booking.tsx` was restructured from one long page (child selector, plan list, inline date-booking form, remaining-services list, invoices list, booking history — all always visible) into a hub: child selector stays visible, then four entry points open dedicated `BottomSheet`s (Paket, Sisa Layanan, Tagihan, Riwayat), each with its own short description line plus the existing list/actions unchanged.
- A fifth, transition-only `BottomSheet` holds the actual booking form (date picker + "Tambah" + chosen-dates summary, or the monthly-plan note). It's reached only by tapping a plan card (`selectPlan`) or "Pakai sisa hari" (`useRemaining`), which close the source list sheet and open the form sheet in one step — mirroring the pattern already used by `billing-admin.tsx`'s capacity editor.
- Removed the `useEffect` that used to auto-select the first plan on mount (no longer meaningful once the form isn't always on screen).
- Added 4 translation keys (`booking.planDescription`, `booking.remainingDescription`, `booking.invoicesDescription`, `booking.historyDescription`) in `id`/`en`.

### 1a. Follow-up: toolbar + informative entry tiles

**Requests:** "seharusnya screen baru ada toolbar" and "buat UX yang lebih informatif di screen booking di role parent."

- `booking.tsx` now passes `title={t("booking.title")}` to `AppScreen`, giving it a real app-bar toolbar (previously it only had an inline `<AppText variant="title">`).
- The four plain entry buttons were replaced with `NavigationCard` tiles in a 2×2 grid (`styles.grid`/`styles.tile`, `flexBasis: "47%"`). Each tile now shows live, per-selected-child status instead of just a label:
  - **Paket**: active plan name (`booking.activePlanSummary`) or "Belum ada paket aktif".
  - **Sisa Layanan**: remaining-credit count or "Aktif bulanan", same fallback as above.
  - **Tagihan**: pending-invoice count + total amount (`booking.pendingInvoicesSummary`, tone `danger` when count > 0) or "Tidak ada tagihan pending".
  - **Riwayat**: booking count (`booking.historySummary`) or "Belum ada riwayat booking".
- New translation keys: `booking.noActivePlan`, `booking.activePlanSummary`, `booking.pendingInvoicesSummary`, `booking.noPendingInvoices`, `booking.historySummary`, `booking.noBookingsYet` (id + en).
- This shape was saved as a standing convention for future hub screens (see `.claude` memory `feedback_screen_ux_pattern.md`): app-bar toolbar + informative `NavigationCard` tiles, not plain title + button row.

**Files:** `apps/mobile/app/booking.tsx`, `apps/mobile/src/i18n/translations.ts`

---

## 2. Parent subscriptions & parent payments: hub + BottomSheet (last two inline-list screens)

**Requests:** "sisa layanan juga pakai BottomSheet.tsx saja" and "tagihan juga pakai BottomSheet.tsx."

These were the last two Staff Admin screens (`parent-subscriptions.tsx`, reached via "Kuota dan langganan parent"; `parent-payments.tsx`, reached via "Pembayaran parent") still rendering their lists directly on the page — every sibling screen (`billing-admin.tsx`, `tenant-users.tsx`, `booking.tsx`) had already been converted earlier in the project.

- **`parent-subscriptions.tsx`**: kept the `BranchFilterControl`, added an entry `NavigationCard` (title + description + `staffAdmin.subscriptionsSummary` showing "{active} aktif dari {total} langganan" or the empty-state text), moved the entitlement-card list into a `BottomSheet` opened from that tile.
- **`parent-payments.tsx`**: same pattern — entry tile shows `staffAdmin.paymentsSummary` ("{count} tagihan menunggu · {amount}", tone `danger` when count > 0) or the empty-state text. The invoice list (with "Tandai sudah dibayar" / "Tinjau bukti" actions) moved into a `BottomSheet`. The existing payment-proof review `BottomSheet` is unchanged, except opening it (`openReview`) now also closes the list sheet first, matching the transition pattern from `billing-admin.tsx`.
- New translation keys: `staffAdmin.subscriptionsSummary`, `staffAdmin.paymentsSummary` (id + en).
- Fixed one new `react-hooks/exhaustive-deps` lint warning introduced by this change (`pendingInvoices` needed its own `useMemo` since `pendingTotal`'s `useMemo` depended on it).

**Files:** `apps/mobile/app/parent-subscriptions.tsx`, `apps/mobile/app/parent-payments.tsx`, `apps/mobile/src/i18n/translations.ts`

---

## 3. Platform tenants list: reverted to inline rendering

**Request:** "sekarang lanjut di platform-tenants.tsx untuk list langsung inline saja tidak melalui BottomSheet.tsx."

This is the opposite direction from sections 1–2: `platform-tenants.tsx` had previously been converted to an entry-tile + `BottomSheet` hub; this session reverted that specific screen back to showing the tenant list directly on the page.

- Removed the `NavigationCard` summary tile, the `listOpen` state, and the `BottomSheet` wrapper.
- The tenant cards (institution types, subscription plan/status, Staff Admin, trial date, payments with "Tandai dibayar", and "Buka detail") now render directly below the search box and the two filter-tab rows (status, institution type), exactly as they did before the earlier hub conversion.
- Verified against the actual Metro dev bundle being served on `localhost:8081` (not just the source file) that the compiled `platform-tenants.tsx` module contains no `BottomSheet`/`NavigationCard`/`listOpen` references.

**Files:** `apps/mobile/app/platform-tenants.tsx`

---

## 4. Personal profile data: gender and date of birth (Parent, Staff, Staff Admin, Admin)

**Request:** "saya mau data diri parent, staff jangan cuma nama saja, seharusnya nama, jenis kelamin, tanggal lahir. sesuaikan FE dan BE."

### Backend

- **Migration** `V15__user_gender_and_date_of_birth.sql`: adds `gender VARCHAR(16) NOT NULL DEFAULT 'UNSPECIFIED'` and nullable `date_of_birth DATE` to `users`.
- **`UserProfile` entity** (`Entities.kt`): new `gender: Gender` (reuses the existing `Gender` enum already used by `Child`) and `dateOfBirth: LocalDate?` fields.
- **New generic endpoint**, `PATCH /v1/me` on `IdentityController`, backed by `UpdatePersonalDetailsRequest(gender: Gender, dateOfBirth: LocalDate)` (both `@NotNull`) and `AccessService.updatePersonalDetails` → `IdentityService.updatePersonalDetails`. This endpoint works uniformly for **both** local-auth and Firebase-auth users — unlike the existing `/auth/local/profile` PATCH (local-auth only), it doesn't touch `displayName`, since Firebase Auth's own SDK already owns that field for Firebase-mode users and `IdentityService.sync()` re-overwrites `displayName` from the JWT `name` claim on every request regardless.
- **`CurrentUserResponse`** (`GET /v1/me`) now includes `gender` and `dateOfBirth`.
- Bean-validation failures (`@NotNull` gender/dateOfBirth) fall through to the existing generic `"error.validation"` mapping, consistent with how other simple request DTOs in this codebase are validated — no new dedicated error keys were needed.

### Frontend

- **`packages/core`**: added `PersonGender = ChildGender | "UNSPECIFIED"`; `CurrentUser` gained `gender: PersonGender` (required) and `dateOfBirth?: string`.
- **`packages/api-client`**: `ApiClient.updateMyProfile({ gender, dateOfBirth })` → `PATCH /me`.
- **`AuthProvider.tsx`**: new `updatePersonalDetails(gender, dateOfBirth)` in the auth context, handling all three session kinds — simulation (updates local state only), local-auth and Firebase (both call `api.updateMyProfile` directly, since gender/DOB live only in the app's own database regardless of auth mode).
- **`simulation.ts`**: simulation profile literal now includes `gender: "UNSPECIFIED"` to satisfy the now-required `CurrentUser.gender` field.
- **`profile.tsx`**: the "Data diri" `BottomSheet` now has three fields — name (unchanged `TextInput`), gender (reused `GenderPicker` from `@/children/GenderPicker`, same component used for children), and date of birth (reused `DatePicker`, `maximumDate` capped at today). Save is gated on all three being valid (name non-blank, gender selected, date a valid ISO date) and saves via `updateDisplayName` + `updatePersonalDetails` in sequence. The profile summary card (top of the screen) now also shows gender and formatted date of birth beneath the name, not just the name.
- New translation key: `profile.dateOfBirth` (id/en); gender labels reuse the existing `children.gender`/`children.genderMale`/`children.genderFemale` keys as-is (their Indonesian/English text is already generic, not child-specific).

### Verification

Live end-to-end against the local dev API (not just compile checks): logged in, `PATCH /v1/me` with `{"gender":"MALE","dateOfBirth":"1990-05-15"}` returned `200` with the updated fields; a follow-up `GET /v1/me` confirmed persistence; a request missing `dateOfBirth` and a request with an invalid `gender` enum value both correctly returned `400` with the generic validation error.

**Files:** `apps/api/src/main/resources/db/migration/V15__user_gender_and_date_of_birth.sql`, `apps/api/.../persistence/Entities.kt`, `apps/api/.../service/IdentityAndAccessService.kt`, `apps/api/.../web/Controllers.kt`, `packages/core/src/index.ts`, `packages/api-client/src/index.ts`, `apps/mobile/src/auth/AuthProvider.tsx`, `apps/mobile/src/auth/simulation.ts`, `apps/mobile/app/profile.tsx`, `apps/mobile/src/i18n/translations.ts`

---

## 5. Profile screen: language switcher moved into the toolbar

**Request:** "switch language di profile.tsx di toolbar saja."

- `profile.tsx`'s `AppScreen` now always renders the app-bar toolbar (`title={t("profile.title")}`, for every role, not just Staff/Staff Admin as before), with `LanguageSwitcher compact` passed as `headerAction` (top-right of the bar) instead of sitting inline inside the "Data diri" card.
- The `BackButton` in `header` remains conditional on `isStaffProfile`, since Parent/Admin reach this screen from the bottom tab bar (main-tab root, no back navigation), while Staff/Staff Admin reach it from their Home toolbar's profile icon (pushed screen, needs Back).
- Removed the now-redundant conditional inline `<AppText variant="title">`.

**Files:** `apps/mobile/app/profile.tsx`

---

## 6. Goal template demo seed data (30 templates)

**Request:** a list of 30 Indonesian early-childhood developmental milestones (toilet training; color/shape/number/letter recognition; name/parents'-names/address recall; self-care habits; social behavior; fine/gross motor skills; short prayers/songs; emotion recognition; focus/reading habits), asking for a seeder to add them as Goal templates, later refined to live in its own dedicated file.

- **Domain constraint discovered during research:** `GoalTemplate` (and the `LearningLevel` it's scoped to) has `organizationId` as **`NOT NULL`** — unlike `CurriculumProgram`, which explicitly supports a nullable/global `organizationId` for platform-owned rows. There is no way to seed these 30 goals as reusable, tenant-agnostic reference data; each must belong to one specific tenant's learning level or classroom.
- **Final design — `GoalTemplateSeeder.kt`** (new file, `@Component`, `@Profile("default", "simulation")`, `@Order(2)`):
  - Looks up the tenant named `Daycare Pelangi` (seeded by whichever profile-specific seeder — `LocalDemoDataSeeder` for `default`, `SimulationDataSeeder` for `simulation` — ran first).
  - No-ops if that tenant doesn't exist yet, or if it already has Goal templates — so it needs no `@ConditionalOnProperty` gate of its own (an earlier iteration tried gating on both `local-seed-enabled` and `simulation-seed-enabled` in one `@ConditionalOnProperty`, which doesn't work: that annotation's `name` array is AND-only, and the two flags are never both true at once since the seeders live in mutually exclusive Spring profiles).
  - Attaches all 30 templates to the tenant's first `LearningLevel` if one exists (the `default` profile's seeded "Toddler" level), otherwise its first `Classroom` (the `simulation` profile has no learning level, only a classroom).
  - Creates exactly one `GoalTemplateIndicator` per template (named after the template), mirroring what `GoalService.createTemplate` auto-generates via the real API — required because `GoalService.assign` rejects any template with no active indicator.
  - `SimulationDataSeeder` gained an explicit `@Order(1)` (it previously had none, defaulting to lowest precedence) so it reliably runs before the new `@Order(2)` goal seeder in the `simulation` profile too.
- **Earlier, superseded iteration** (kept here for context, not present in the final diff): the 30 templates were first seeded inline inside `LocalDemoDataSeeder.kt` and `SimulationDataSeeder.kt` directly (each keeping its own duplicated `GoalSeed` list and ID-generation helper). This worked but duplicated ~30 lines of seed data across two files; refactored into the single dedicated seeder above after the user asked for a goals-specific file.

### Verification

Live end-to-end, twice (once per design iteration), each time by resetting the local PostgreSQL `daycare` database (`DROP`/`CREATE DATABASE`) and restarting the local API with `LOCAL_SEED_ENABLED=true`:
- Flyway migrated cleanly; all seeders ran without error.
- Direct SQL confirmed exactly 30 rows in `goal_templates` and 30 in `goal_template_indicators`, correctly attached via `learning_level_id` (not `classroom_id`) for the local profile.
- `GET /v1/goal-templates` (as the seeded `owner` Staff Admin, with `X-Organization-Id` set) returned all 30 templates, each with its one indicator.
- `POST /v1/children/{childId}/goals` assigning the "Lepas pempers (toilet training)" template to the seeded child Aruna succeeded (`201`), returning an active child Goal with the expected `durationDays`/`minimumYesPercent`/`minimumYesStreak` and indicator.
- `gradle compileKotlin` passed on every iteration. `gradle compileTestKotlin` fails, but only due to `LocalPlatformAdminSeederTest.kt` — a pre-existing, unrelated in-progress change from the other concurrent work noted in the Context section above (constructor mismatch against a new `PlatformSeedService`), not caused by this feature.

Also updated `README.md`'s local-seed and simulation-seed dataset descriptions to mention the 30 Goal templates.

**Files:** `apps/api/src/main/kotlin/com/daycare/api/config/GoalTemplateSeeder.kt` (new), `apps/api/src/main/kotlin/com/daycare/api/config/SimulationDataSeeder.kt` (`@Order(1)` added), `README.md`, `docs/changes/2026-07-25/goal-template-seed-data.md` (narrower companion note written during the first iteration)

---

## Cross-cutting verification summary

- `cd apps/mobile && npx tsc --noEmit -p .` — clean after every change in sections 1–5.
- `pnpm --filter @daycare/app lint` — no new errors/warnings introduced beyond this repo's existing known false positives (date-picker/notify module-resolution false positives, `useRemaining`/`useTemplate` naming false positives on `react-hooks/rules-of-hooks`), except the one real `exhaustive-deps` warning in section 2, which was fixed.
- `gradle compileKotlin` — clean after every backend change (sections 4 and 6).
- No product code in this session relies on the unrelated concurrent-session files mentioned in the Context section; none of those files were read, modified, or reverted by this work.

## Follow-up

- The 30 seeded Goal templates are demo/local-dev data only; they are not created for real tenants and have no bearing on production behavior.
- `LocalPlatformAdminSeederTest.kt`'s compile failure against `PlatformSeedService` belongs to the other in-progress work noted above and needs to be resolved by that effort, not this one.
