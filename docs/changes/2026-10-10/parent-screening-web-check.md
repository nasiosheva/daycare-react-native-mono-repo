# Parent screening web check — 2026-10-10

Author: Mories Deo Hutapea,S.E.,S.Kom

## Scope

Validated the Expo web route `/parent-screening` and its platform-specific
document export import. The local web bundle served the route and included the
screening route/API references. Browser interaction was not available in this
environment, so visual and click-through behavior remains a separate check.

## Fix

The screen now imports document export helpers from the platform-aware module
barrel. Web and native barrels both export `saveDownloadedReport` alongside
`shareDocumentExport`, preventing an unresolved platform-neutral downloader
import while preserving the existing web/native implementations.

## Verification

- Local Expo web route returned HTTP 200.
- The served bundle contained `parent-screening`, `screening-profiles`, and
  `screeningQuestionnaire` references.
- `corepack pnpm --filter @daycare/app typecheck` passed.
- Route-specific ESLint passed after the import fix.
- Component UI test passed for the full enablement path: select profile,
  select template, accept consent, verify `Start check` becomes enabled, and
  press it to invoke the session mutation.
- The local screening seed batch was applied explicitly after fixing the
  foreign-key ordering in `ScreeningSeedBatchService`: 12 draft templates,
  12 draft rule sets, 238 questions, and 964 choices were inserted. No
  template is published automatically.
- Screening content is currently scoped to reviewed `id` and `en` locales;
  the app shell's other locales remain available for non-screening UI and
  require separate reviewed catalog content before screening is expanded.
- The catalog response now reports the actual aggregate review status, and the
  Publish action validates first so inline validation errors are shown before
  attempting the publish mutation.
- For local functional verification, all 12 seeded templates were reviewed,
  validated, and published through the local Platform Admin API. The database
  now reports 12 `PUBLISHED` templates and 12 `PUBLISHED` rule sets (`B02`
  through `B60`). This is local test data only; production publication still
  requires the documented clinical, privacy, and language review gates.
- Focused backend tests passed for catalog administration, seed ordering, and
  screening session behavior. The parent screening UI test, route lint, and
  app typecheck also passed after the publish-flow changes.
- Completion testing exposed that the seeded global `BELUM` and
  `TIDAK_DIAMATI` answer triggers were rejected by the evaluator because they
  intentionally had no question scope. The evaluator now supports this typed,
  reviewed global fallback while preserving question-scoped matching.
- End-to-end local completion of the `B60` session returned HTTP 200 and wrote
  one completed result; the local session/result counts are now both `1`.
- A subsequent Indonesian (`id`) `B60` session also completed with HTTP 200
  after the evaluator fix. The visible failure had been served by a stale
  backend process on port 8080; that process was restarted with the current
  classes for local verification.
- Result reasons now expose the snapshotted question and selected answer to
  the Parent UI and PDF. The UI no longer renders internal reason codes such
  as `DISKUSIKAN_BUTIR_PERKEMBANGAN`; it shows the actual item and answer that
  needs discussion.
- The result now also presents an Usia Emas product summary: observed
  capabilities, concrete question/answer items needing attention, and a
  practical non-diagnostic next-step guide. The same observed-capability
  section is included in the snapshot PDF.
- The PDF domain summary no longer exposes internal domain/status codes. It
  now groups subitems into readable areas such as Bahasa dan komunikasi,
  Motorik kasar, and Kemandirian, with translated narrative statuses.
- The Parent result card now has a separate PDF preview action. Web opens the
  authorized PDF in a new tab, while native tries the device PDF viewer; the
  existing download/share action remains available as a fallback.

## Follow-up

An interactive browser session is still needed for authenticated form
interactions (profile creation, questionnaire completion, result view, and PDF
download).
