# Multi-step form baseline

## Change

- Added a repository-wide UI/UX baseline for long, dependent forms: use a full-page multi-step form wizard with a visible stepper/progress indicator.
- Defined per-step validation, draft-preserving back navigation, selective downstream resets, final review, accessibility, responsive behavior, localization, and testability expectations.
- Kept short independent forms and confirmations on the existing screen or Bottom Sheet pattern.
- Added the shared controlled `MultiStepFormWizard` UI shell for a dynamic one-to-many step list, including a horizontally scrollable indicator for longer flows.
- Added connecting lines between step markers: an unreached connection is white, then changes to the shared primary gold color when its destination step becomes current or completed.

## Affected behavior

- This is implementation guidance for future UI/UX work. It does not automatically convert existing screens or change an API, database schema, authorization rule, or current business lifecycle.
- A future conversion still requires comparison with `docs/business-rules.md` and the complete supporting contract for that specific flow.

## Verification

- Reviewed against the existing shared-UI guidance in README and the Parent enrollment wizard rule in `docs/business-rules.md`.
- `corepack pnpm lint` passed.
- `corepack pnpm typecheck` passed.
- `corepack pnpm test` passed, including 6 shared-UI tests and 78 mobile tests.
- `corepack pnpm --filter @daycare/app exec expo export --platform web` passed.
- `git diff --check` passed.

## Follow-up

- Keep feature-specific state, validation, and side effects outside the shared component; add navigation controls to it only if multiple flows later prove an identical contract.
