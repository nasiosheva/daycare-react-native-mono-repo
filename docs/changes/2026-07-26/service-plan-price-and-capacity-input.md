# Service plan price formatting and daily-capacity cap

## Change

- `billing-admin.tsx`: the price field (plan and template forms) now auto-formats with Indonesian thousand-separator dots while typing (e.g. `100000` → `100.000`); parsing for submission strips the separators back out before converting to a number.
- The daily-capacity field, in both the Service Plan form and the branch-capacity form, now accepts digits only and is clamped to a maximum of 999 while typing (`maxLength={3}`, live-clamped value).
- Backend now enforces the same 1–999 bound: `BillingService.validatePlanConfiguration` and `CapacityReservationService.setBranchCapacity` both reject a `dailyCapacity` outside that range, instead of only requiring it to be positive.

## Behavior

- Daily capacity (Service Plan or branch) must be a whole number from 1 to 999 everywhere it is set — enforced client-side for UX and re-validated server-side regardless of client formatting.

## Verification

- `gradle compileKotlin` clean.
- `pnpm --filter @daycare/app` typecheck/test clean.

## Follow-up

- None of the numeric-input sanitization was applied outside `billing-admin.tsx`; other screens with free-text price/capacity fields were not audited for the same comma/dot-parsing risk.
