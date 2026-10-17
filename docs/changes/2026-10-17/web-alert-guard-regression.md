# Web Alert Guard and Child Deactivation Regression

## Change

- Added a screen-scoped lint restriction against importing React Native `Alert` in app routes. Route feedback should use the shared `notify` helper, whose web and native adapters provide platform-appropriate behavior.
- Kept the intentional compatibility shim in `apps/mobile/app/_layout.tsx` exempt; the native notification adapter is outside the route scope.
- Added UI regression tests for child deactivation: cancel does not submit, success returns to the child list, and failure shows an error notification without navigating away.

## Verification

- `pnpm --filter @daycare/app exec jest --config jest.ui.config.cjs --runInBand src/ui/child-detail-deactivation.ui.test.tsx` — 2 tests passed.
- Before the lint change, `printf 'import { Alert } from "react-native";\nAlert.alert("title");\n' | pnpm --filter @daycare/app exec eslint --stdin --stdin-filename app/__alert_guard_fixture.tsx` passed, confirming the gap.
- After the lint change, the same probe fails with `no-restricted-imports`; `pnpm --filter @daycare/app exec eslint app/_layout.tsx app/child-detail.tsx` passes, confirming the intentional exception and changed screen are lint-clean.
- `pnpm --filter @daycare/app typecheck` — passed.
- `pnpm --filter @daycare/app exec jest --config jest.ui.config.cjs --runInBand` — 5 suites / 19 tests passed. Existing `OfflineProvider` UI test emits a React `act(...)` warning.
- `pnpm --filter @daycare/app lint` — blocked by an existing unresolved import in `app/tenant-subscription-review.tsx` (`@/tenant-subscription/openPaymentProof`); 23 other baseline warnings were reported. The changed files pass targeted ESLint above.
- Final batch before commit: targeted ESLint across all changed mobile files passed with 0 warnings; app unit tests 58 files / 235 tests; UI tests 7 suites / 27 tests; typecheck passed. The unrelated full-lint baseline import issue remains outside this commit's scope.

## Follow-up

- Route files cannot import named `Alert` or use a React Native namespace import, closing the common alias bypass while retaining the layout shim exception.

<!-- Mories Deo Hutapea,S.E.,S.Kom -->
