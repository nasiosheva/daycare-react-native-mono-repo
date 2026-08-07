# Branch operating-hours save navigation

## Change

- A successful operating-hours save now invalidates the branch operating-hours query, shows a shared cross-platform Bottom Sheet confirmation, and returns to the previous screen only after the Staff Admin selects **OK**.
- A failed save keeps the Staff Admin on the form and continues to show the existing localized error. No automatic retry is added.

## Verification

- Passed `corepack pnpm typecheck`, `corepack pnpm test`, and `git diff --check`.
