# DevelopmentProgram rename and check-in note/photo/audio

## Change

- Renamed `GoalCategory`/`GoalCategoryItem` to `DevelopmentProgram`/`DevelopmentProgramItem` across the backend (entities, repositories, services, controllers), `packages/api-client`, and the mobile UI, to disambiguate the term from the separate, pre-existing "Program Kurikulum" (`CurriculumProgram`) feature. `LearningLevel` and the `GoalDomain` classification enum were intentionally left unrenamed.
- Added a Flyway migration (`V5`) performing the table/column renames and adding nullable `note`, `photo_content_type`, `photo_data`, `audio_content_type`, `audio_data`, `audio_duration_ms` columns to `child_goal_check_ins`.
- Extended `PUT /child-goals/{goalId}/check-ins/{date}` to accept an optional note, photo, and audio recording per check-in, with partial-update semantics (submitting only an outcome never clears a previously saved note/photo/audio). Added `GET .../check-ins/{date}/{indicatorId}/photo` and `.../audio` to fetch the binary payload on demand, keeping the check-in list response lightweight (`hasPhoto`/`hasAudio` booleans plus `audioDurationMs`).
- Added the missing Platform Admin UI for managing the **global** `DevelopmentProgram` catalog (`apps/mobile/app/global-development-programs.tsx`): create, edit, and delete. This closes a gap where the backend already supported `/platform/development-programs` but no screen exposed it.

## Behavior

- Photo validation mirrors `BillingService.decodePaymentProof` (JPEG/PNG magic-byte check, 5 MB cap). Audio accepts `audio/mp4`/`audio/m4a` up to 10 MB.
- Indicators can only be set when a `DevelopmentProgram` (global or tenant) is created. There is no backend support yet for adding/editing/archiving indicators on an existing **global** program; tenant programs already support this via the existing indicator endpoints.
- `DevelopmentProgram` has no archive/reactivate state. Deletion is refused while any child still has it assigned; otherwise it is a hard delete.

## Verification

- `gradle compileKotlin` clean; migration V5 tested end-to-end on a scratch database (empty → migrate → seed with `SEED_GLOBAL_CURRICULUM_ENABLED=true` → 4 levels / 24 programs / 138 indicators, idempotent on a second run) before being applied to the local dev database.
- `pnpm --filter @daycare/api-client` and `pnpm --filter @daycare/app` typecheck/test clean.

## Follow-up

- No backend route exists yet to manage indicators on an already-created global `DevelopmentProgram`; only creation-time indicator names are supported.
- `apps/api/src/test/kotlin/.../AcademicServiceTest.kt` and `LearningStructureServiceTest.kt` fail to compile against current constructors/entity names — pre-existing debt from an earlier rename pass, not touched by this change.
