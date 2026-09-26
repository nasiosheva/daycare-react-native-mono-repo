# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Scope and safety

Operate using only this repository's local context; do not pull in unrelated global assumptions or memories when working here. Never take any action — reading, editing, running commands, creating branches, committing, or otherwise — outside this repository's working directory. If a request references a different repository, project, ticket, task tracker, or working item that lives elsewhere, stop before doing any work there, point out the mismatch, and ask the user to confirm the correct repository first; a URL or reference the user supplied is not by itself authorization to act outside this checkout — they may have pasted the wrong link or meant a different project.

## Required reading before any change

Read `README.md` and `docs/business-rules.md` before implementing, reviewing, or changing any business flow, API contract, data model, or authorization rule. Both are required repository context; `docs/business-rules.md` is the normative source of truth for every business-facing UI/UX flow and its supporting backend/API/authorization/data contract. Before designing, reviewing, or changing such a flow, compare the proposed and current behavior against the documented rule, and distinguish an explicitly documented *current* implementation from an explicitly documented *target/future* rule that has not been built yet. `.codex/project-memory.md` holds durable architectural/product decisions accumulated across sessions and is worth skimming before non-trivial work.

**When the current or proposed UI/UX or contract does not match `docs/business-rules.md`, stop before implementing the affected change.** Explain the documented rule, the conflicting behavior, and the practical impact on users, roles, data, authorization, and operations. Ask the user to choose one of:

1. Update `docs/business-rules.md` so it intentionally defines the desired behavior.
2. Change the UI/UX and every supporting backend/API/data contract needed to comply with `docs/business-rules.md`.
3. If both the documented rule and the current/proposed behavior are unsafe, impractical, or contrary to common-sense real-world operations, propose a third safer alternative — state why the first two paths are unsuitable, what it requires, and its tradeoffs.

Never silently pick among these paths or implement the third alternative without the user's explicit decision. This applies to any disagreement between the docs, the current code, project memory, or a request — surface the exact difference and ask, never resolve it silently.

## Documentation review (every change)

Every change needs a same-change-set documentation review: create or update a daily context note at `docs/changes/YYYY-MM-DD/<context>.md` recording the change, affected behavior, verification, and any follow-up. Update `README.md` for any change to user flow, business rules, API contracts, configuration, local/prod operation, or verification, and update the relevant module documentation when it exists. If no documentation update is materially needed, state that explicitly in the handoff with the reason — don't silently omit the review.

## Engineering baseline

Follow the current baseline code and stay focused: match existing architecture, patterns, naming, style, and folder structure; make only the requested changes; avoid unnecessary refactors. Apply SOLID and DRY where the baseline doesn't already define a clear pattern of its own — clear separation of presentation/business-logic/state/side-effects/data-access/config/integration concerns, and no duplicated business rules, validation, mappings, API contracts, or UI behavior when an existing abstraction already covers the need. Avoid hardcoding keys, labels, wording, routes, or repeated literals inside business/UI logic; prefer centralized constants, i18n files, schema definitions, and shared/typed abstractions matching the existing baseline. When the baseline pattern is clear, follow it even over an abstractly "better" SOLID-driven alternative; apply SOLID/DRY from scratch only when the baseline itself is unclear or missing.

## UI/UX form baseline

Use a **full-page multi-step form wizard with a visible stepper** as the default for long, dependent workflows — three or more logical sections, repeatable records, or a final review before a consequential submission (enrollment, checkout, billing, approval, account creation). The stepper shows wizard progress; it is not free-form tab navigation and must not let users skip required earlier steps. Keep each step focused on one goal, validate before advancing, preserve valid draft data on back-navigation, and clear only downstream values invalidated by an earlier-choice change. A consequential flow's final review states what will be created/changed, what remains pending, and any price/authorization boundary without recalculating server-owned values.

Every wizard must use the shared `MultiStepFormWizard` from `packages/ui` — pass it a dynamic ordered step list and a controlled zero-based current-step index, keeping screen-specific content/validation/navigation/side-effects in the owning screen; don't copy its indicator markup into a feature screen. Don't use a wizard for short independent add/edit forms, confirmations, or a single decision — those stay on the existing screen or Bottom Sheet baseline (see the FAB/BottomSheet convention under Architecture below). The wizard must handle loading/empty/error/retry/disabled/submitting states, work with keyboard and scrolling on mobile and web, expose accessible semantics, and have complete translations for every supported locale (see the i18n note under Architecture).

## Before opening a pull request

All frontend and backend tests must pass — see the Commands section below. Fix any failing/non-compiling test before opening the PR; never open one with a known-failing suite on either side.

Delete every `.txt` file under `run-logs/` before opening a PR, regardless of gitignore status — don't leave session logs on disk across a PR (see the launcher note under Commands).

Never commit directly on the `production` branch, even for a small or low-risk change — check the current branch before `git commit`; if it's `production`, create and switch to a new branch first. All changes reach `production` only through a reviewed PR. Do not add a "Generated with Claude Code" watermark, 🤖 emoji, or similar tool-attribution footer to PR titles/descriptions — commit trailers such as `Co-Authored-By` are unaffected by this rule.

## Commands

Install once: `corepack enable && pnpm install`.

```sh
pnpm verify                 # lint + typecheck + test across every TS workspace (root convenience script)
pnpm lint                   # same, lint only
pnpm typecheck              # same, typecheck only
pnpm test                   # same, test only
pnpm --filter @daycare/app test -- src/path/to/file.test.ts   # single mobile test file (vitest)
pnpm --filter @daycare/core typecheck                          # scope any command to one workspace
```

Backend (needs `JAVA_HOME` pointed at a JDK 21 install):

```sh
./apps/api/gradlew -p apps/api test --no-daemon                                  # full backend suite
./apps/api/gradlew -p apps/api test --no-daemon --tests "*.TenantFeedbackServiceTest"  # one test class
```

Local dev stack — prefer the interactive launchers over calling Gradle/Expo directly, they handle env files, backend lifecycle, and device selection:

```sh
./scripts/run-backend-local.sh   # local API in its own terminal (Ctrl+C to stop)
./scripts/run-web.sh             # asks local/dev/prod, starts/reuses the local API for "local"
./scripts/run-android.sh         # asks Debug/Release, then local/dev/prod; physical devices only, no emulators
./scripts/run-ios.sh             # asks local/dev/prod; Simulator only, no physical iPhones
```

Every launcher exports its session output (including everything the launched Metro/Expo/adb-logcat process prints, since file-descriptor redirection survives both `exec` and a plain child process) to a timestamped `.txt` file under `run-logs/` at the repo root (see `scripts/lib/session-log.sh`). `run-logs/` is `.gitignore`d — delete its `.txt` files before opening a PR regardless (see above).

## Architecture

**Monorepo** (pnpm + Turborepo): `apps/mobile` (Expo Router app, Android/iOS/web), `apps/api` (Kotlin/Spring Boot REST API), `packages/core` (roles, permissions, domain types, Zod schemas — the shared source of truth consumed by both mobile and api-client), `packages/ui` (shared React Native UI primitives/design tokens), `packages/api-client` (typed HTTP client, hand-written to mirror the backend contract). Changing a persisted feature normally touches all four: a migration + entity + repository + service + controller in `apps/api`, then a type/method in `packages/api-client`, then the screen/hook in `apps/mobile`, and often a shared enum/schema in `packages/core`.

**Kotlin backend layout is one-file-per-layer, not one-class-per-file.** `domain/Models.kt` holds nearly every enum, `persistence/Entities.kt` holds nearly every JPA `@Entity` (a few large or genuinely separate concerns split out into `BillingEntities.kt`, `OvertimeEntities.kt`, `Audit.kt`), `persistence/Repositories.kt` holds nearly every Spring Data repository, and `web/Controllers.kt` holds every `@RestController` (currently ~1000 lines). `service/` is the one package that follows normal one-class-per-file. When adding a new persisted feature, add to these existing files rather than creating new single-purpose files, unless the existing file has already grown large enough that the codebase has started splitting a concern out (as with billing/overtime).

**Every new backend error message needs three registrations**, or the client falls back to a generic message instead of the specific one: the message constant (an `object XxxError { const val ... }` companion next to its service), an entry in `ApiExceptionHandler.errorKeys`, and a line in both `apps/api/src/main/resources/i18n/errors_id.properties` and `errors_en.properties`.

**Flyway migrations are sequential and additive** under `apps/api/src/main/resources/db/migration/` (`V1__initial_schema.sql` is a consolidated baseline; never edit an already-applied migration, only add the next `V<n>__description.sql`). API releases must stay backward-compatible with the previous release since a rollback cannot reverse an already-applied migration.

**Tenant scoping**: almost every API call is scoped to one active tenant via the `X-Organization-Id` header, driven by the mobile client's single `organizationId` in `AuthProvider`. A non-platform account with more than one membership must select a tenant before a tenant-scoped screen renders (`apps/mobile/src/auth/organizationContext.ts`; a Parent whose memberships are *all* `PARENT` is auto-selected instead of being forced through the picker, since Parent screens can aggregate across tenants — see below). Switching tenants (`selectOrganization`) clears the entire React Query cache. Several `api-client` methods (`children`, `invoices`, `paymentInstructions`) accept an optional trailing `organizationId` to override the header for one call without switching the active tenant — the pattern used to fetch a Parent's data across every tenant they belong to in parallel via `useQueries` (see `useParentChildrenAcrossTenants` / `useParentInvoicesAcrossTenants`), then switch context only when the user drills into one tenant's action.

**Realtime is a dumb invalidation signal, not a data source.** The client connects to `GET ws(s)://<api-host>/api/v1/realtime`, and each event carries `flags` (e.g. `CHILDREN`, `INVOICES`, `GOALS`) mapped to React Query keys in `apps/mobile/src/realtime/queryInvalidation.ts`. Adding a new realtime-notified feature means adding the flag in three places: the backend `RealtimeFlag` enum, the `RealtimeFlag` string union in `packages/api-client`, and `queryKeysByFlag` in that invalidation map.

**i18n is stricter than it looks.** `apps/mobile/src/i18n/translations.ts` types `translations` as `Record<AppLocale, Record<TranslationKey, string>>` — every one of the 7 supported locales (`id`, `en`, `zh`, `fr`, `pt`, `es`, `ru`) must have a value for every key, not just `id`/`en`. The file is organized as many small per-feature-area `const xTranslations = { id: {...}, en: {...}, zh: {...}, ... }` objects that get spread into the large `id`/`en` consts and into the final per-locale export block — follow that pattern for a new feature's strings rather than editing the big consts inline, and add all 7 locale sub-objects up front (`tsc --noEmit` will otherwise fail late with a wall of missing-property errors).

**Mobile screens are file-based routes** under `apps/mobile/app/` (Expo Router — filename is the route). New routes that shouldn't animate on push need to be added to the `bottomNavigationScreenNames`/screen-name array in `apps/mobile/app/_layout.tsx`. Get navigation via `useRouter()`, never the global `router` import (unavailable during Android's render lifecycle per `.codex/project-memory.md`).

**UI conventions worth matching**: a FAB (`FloatingActionButton`, passed via `AppScreen`'s `floatingAction` prop) is the baseline for a screen's primary "add" action, not an inline `Button` above a list; a short add/edit form belongs in `BottomSheet`, a longer multi-step flow uses `MultiStepFormWizard` (see above). A card/menu item that should reflect a tenant-readiness issue takes the danger/`dangerSoft` color pair already used in `staff-admin.tsx`'s `menuAttention` style, not a new ad hoc treatment.
