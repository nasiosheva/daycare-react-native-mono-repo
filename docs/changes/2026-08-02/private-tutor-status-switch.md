# Private Tutor Status Switch

## Change

- Replaced the active/inactive status buttons with the shared `ToggleSwitch` in the tutor and private-tutoring service forms.
- Each switch keeps its existing `active` state and sends the same value when the form is saved.

## Impact

- Staff Admin can see each status label and its current active/inactive value before saving.
- There is no change to the private-tutoring business rule, authorization, API contract, or backend behavior.

## Verification

- `corepack pnpm verify` passed: lint, TypeScript checks, and workspace tests.
