# Global, age-graded Goal templates (supersedes the earlier local-only seeder)

Date: 2026-07-25
Branch: `feature/global-goal-templates`

## Context

Earlier the same day, 30 Goal templates were seeded through a Kotlin `ApplicationRunner` (`GoalTemplateSeeder.kt`) scoped to one fake local demo tenant, gated to the `default`/`simulation` profiles only — by design, never touching production or applying to any real tenant. The user then supplied a much richer, age-graded version of the same content ("Program Daycare Berdasarkan Usia 1–5 Tahun": 4 age bands × 6 developmental categories) and asked for it to become real reference data in **both local and production**, for **every tenant, including tenants created in the future** — not demo data for one fake tenant. This is a different requirement from the earlier seeder and required an architecture change, not just more seed rows.

## Changed behavior

- `GoalTemplate` (and its `GoalTemplateIndicator` rows) can now be **global**: `organization_id` is nullable, mirroring the existing `CurriculumProgram` global mechanism (`V5__global_curriculum_programs.sql`). A global template is visible to every tenant without duplication and is seeded exactly once via Flyway (`V19__global_goal_templates.sql`) — the same mechanism this repository already uses for anything that must exist identically in every environment including production, unlike the `ApplicationRunner` seeders, which stay demo-data-only and never run in production.
- `GoalTemplate` gained `minAgeMonths`/`maxAgeMonths` (nullable) and `category` (one of `KEMANDIRIAN`, `BAHASA_KOMUNIKASI`, `KOGNITIF`, `MOTORIK_HALUS`, `MOTORIK_KASAR`, `SOSIAL_EMOSI`). The 138 seeded global templates cover 4 age bands (1–2, 2–3, 3–4, 4–5 years) × the 6 categories (135 templates), plus 3 general milestones from the original 30-goal list that had no age-graded equivalent — home address recall (`BAHASA_KOMUNIKASI`, 3–4 years), enjoying shared reading (`BAHASA_KOMUNIKASI`, 4–5 years), and sustained 10–20 minute focus (`KOGNITIF`, 4–5 years). Each template follows a duration/percent/streak default fixed per category (Kemandirian 21d/80%/7-day streak; Bahasa & Komunikasi and Sosial & Emosi 21d/70%/5; Kognitif and both Motorik categories 30d/70%/3) and gets exactly one indicator (named after the template), matching what `GoalService.createTemplate` already does for templates made through the API.
- `GoalService` now: lists tenant-owned **and** global templates together (tagged `source: GLOBAL | TENANT` in the response, same convention as `CurriculumProgramResponse`); rejects any edit/archive/indicator-mutation attempt on a global template with a new `error.goalTemplateGlobalReadOnly`; and, when assigning a template to a child, validates a global template by the child's age (computed from `Child.dateOfBirth`) against the template's age band instead of the learning-level/classroom check used for tenant-owned templates (which still applies as before, and now additionally honors an age band if a tenant sets one on their own template).
- `apps/mobile/app/goals.tsx`: the template-management list now groups templates by category with an age-range subtitle and a "· Global" tag, and hides Edit/Archive for global templates. The assign-to-child picker is filtered to templates whose age band contains the selected child's current age (new `apps/mobile/src/development/childAge.ts` helper, unit-tested).
- The earlier `GoalTemplateSeeder.kt` (both its first inline-in-two-seeders iteration and its later dedicated-file iteration) is fully removed — its content is superseded by the global migration, which now also covers what it used to seed for the local demo tenant and the simulation profile.

## Affected areas

- `apps/api/src/main/resources/db/migration/V19__global_goal_templates.sql` (new)
- `apps/api/src/main/kotlin/com/daycare/api/domain/Models.kt` (`GoalCategory` enum)
- `apps/api/src/main/kotlin/com/daycare/api/persistence/Entities.kt`, `Repositories.kt`
- `apps/api/src/main/kotlin/com/daycare/api/service/GoalService.kt`
- `apps/api/src/main/kotlin/com/daycare/api/web/ApiExceptionHandler.kt`, `apps/api/src/main/resources/i18n/errors*.properties`
- `packages/core/src/index.ts`, `packages/api-client/src/index.ts`
- `apps/mobile/app/goals.tsx`, `apps/mobile/src/development/childAge.ts` (+ test), `apps/mobile/src/i18n/translations.ts`
- `README.md`
- Supersedes `docs/changes/2026-07-25/goal-template-seed-data.md` and the Goal-template section of `docs/changes/2026-07-25/profile-details-goal-templates-and-hub-refinements.md`, which describe the now-removed local-only seeder — left as-is per this repo's "docs/changes is a running log" convention rather than edited retroactively.

## Verification

- `gradle compileKotlin` passed on every iteration, including after unrelated concurrent changes repeatedly landed in the same working tree.
- Applied all Flyway migrations directly against a freshly created local `daycare` database on each iteration; confirmed via SQL the expected row counts in `goal_templates`/`goal_template_indicators` (135, then 138 after the 3 additional milestones were added), the relaxed `goal_templates_scope` CHECK constraint, the nullable `organization_id` columns, and the new `goal_templates_global_idx` partial index.
- `cd apps/mobile && npx tsc --noEmit -p .` and `pnpm --filter @daycare/app lint` are clean; the new `childAge.test.ts` (3 cases) passes alongside the full existing suite (27 tests).
- **Live end-to-end, round 1 (135 templates):** worked around the schema/entity mismatch left by an unrelated concurrent overtime feature (`OvertimeEntities.kt` vs. `V18__branch_operating_hours_and_overtime.sql`) by booting locally with `spring.jpa.hibernate.ddl-auto=none` instead of the default `validate` (an ephemeral override for the test run only, never committed). Registered a fresh local user, bootstrapped it as Platform Admin via `PLATFORM_ADMIN_EMAILS`, created a real tenant with an active subscription and Staff Admin. As that Staff Admin: `GET /v1/goal-templates` returned all 135 templates tagged `source: GLOBAL`; both `PATCH` (with a valid learning-level scope supplied) and `POST .../archive` on a global template were cleanly rejected with `error.goalTemplateGlobalReadOnly`; assigning a 1–2-year-band template to a child born in 2022 (~4 years old) was rejected with the child-scope error; assigning a matching 3–4-year-band template ("Toilet mandiri") to the same child succeeded (`201`) with the correct duration/percent/streak.
- **Live end-to-end, round 2 (138 templates, after adding the 3 missing milestones):** repeated the same bootstrap (fresh database, fresh Platform Admin, fresh tenant/Staff Admin) end to end. `GET /v1/goal-templates` returned all 138 templates; the 3 new items ("Menghafal alamat rumah", "Menyukai kegiatan membaca buku bersama", "Duduk fokus 10-20 menit untuk belajar atau membaca") were each present with the correct `category`/`minAgeMonths`/`maxAgeMonths`/`source: GLOBAL`. Assigned "Duduk fokus 10-20 menit untuk belajar atau membaca" to a child born 2022-01-01 (~4.5 years old, within its 48–60-month band) — succeeded (`201`) with `durationDays: 30, minimumYesPercent: 70, minimumYesStreak: 3` (the `KOGNITIF` category default) copied correctly onto the new `ChildGoal`.

## Follow-up

- None outstanding for this feature. The concurrent overtime schema mismatch and the seeding-architecture refactor noted above belong to other in-progress work on this branch and are unaffected by, and did not affect, this change.
