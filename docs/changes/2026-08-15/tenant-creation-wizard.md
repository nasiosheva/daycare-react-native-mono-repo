# Tenant creation wizard

## Change

- Converted Platform Admin tenant provisioning to the shared full-page `MultiStepFormWizard` baseline.
- Split the flow into institution data, the first Staff Admin account, subscription/trial, and a final review.
- Added step-specific inline validation while keeping one server submit at the end.

## Affected behavior

- Back navigation preserves the current draft and exits the screen only from the first step.
- The review displays institution, branch, selected institution types, Staff Admin identity, and subscription terms without displaying the password.
- API payload, authorization, atomic backend provisioning, and network no-auto-retry behavior remain unchanged.

## Verification

- `corepack pnpm typecheck` passed.
- `corepack pnpm lint` passed.
- `corepack pnpm test` passed with 133 tests, including 4 tenant-creation validation/payload tests and translation coverage for every supported locale.
- `corepack pnpm --filter @daycare/app exec expo export --platform web` passed.
- `git diff --check` passed.

## Follow-up

- None.
