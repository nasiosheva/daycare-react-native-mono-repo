# Goal template seed data

Date: 2026-07-25

## Context

Goal templates previously had no seeded demo rows in either the local (`LOCAL_SEED_ENABLED=true`) or `simulation` profile, even though the feature (Staff Admin creating scoped Goal templates with indicators, then assigning them to children) has been implemented since an earlier change. This made it hard to exercise the Goals flow against realistic data without creating templates by hand first.

## Changed behavior

- A new dedicated seeder, `GoalTemplateSeeder` (`@Profile("default", "simulation")`, `@Order(2)`), creates 30 Goal templates covering toilet training, color/shape/number/letter recognition, personal-identity recall (name, parents' names, home area), daily self-care habits (eating, drinking, handwashing, brushing teeth, dressing, shoes, tidying toys), social behavior (sharing, polite words, following multi-step instructions, polite speaking), fine and gross motor skills, short prayers/children's songs, basic-emotion recognition, and focused sitting/daily reading enjoyment.
- It finds the tenant named `Daycare Pelangi` (seeded by whichever profile-specific seeder ran first — `LocalDemoDataSeeder` or `SimulationDataSeeder`) and attaches the templates to that tenant's first learning level if one exists, otherwise its first classroom. It no-ops if that tenant doesn't exist yet or already has templates, so it needs no property gate of its own — it just runs after both existing seeders (`SimulationDataSeeder` now also carries an explicit `@Order(1)` so this ordering holds in the `simulation` profile too).
- Each seeded template gets exactly one matching `GoalTemplateIndicator` (named after the template), mirroring what `GoalService.createTemplate` auto-creates for templates made through the API — required because `GoalService.assign` rejects templates with no active indicator.

## Affected areas

- `apps/api/src/main/kotlin/com/daycare/api/config/GoalTemplateSeeder.kt` (new)
- `apps/api/src/main/kotlin/com/daycare/api/config/SimulationDataSeeder.kt` (added explicit `@Order(1)`)
- Repository README (local-seed and simulation-seed dataset descriptions).

## Verification

- `gradle compileKotlin` passed.
- Reset the local PostgreSQL `daycare` database and restarted the local API (`LOCAL_SEED_ENABLED=true`): Flyway migrated cleanly, all three seeders ran in order, and direct SQL confirmed 30 rows in `goal_templates` and 30 in `goal_template_indicators`, correctly attached to the seeded learning level (not a classroom, since the local profile has one).
- `GET /v1/goal-templates` (authenticated as the seeded `owner` Staff Admin, `X-Organization-Id` set to the seeded tenant) returned all 30 templates with their indicator attached.
- `POST /v1/children/{childId}/goals` against the seeded child `Aruna` and the "Lepas pempers (toilet training)" template succeeded (`201`), returning an active child Goal with the expected duration/percent/streak and one indicator.

## Follow-up

- None; the `simulation` profile's compile/test failure in `LocalPlatformAdminSeederTest.kt` (constructor signature mismatch against a new `PlatformSeedService`) is a pre-existing, in-progress change from other work on this branch and is unrelated to this seed-data addition.
