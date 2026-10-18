# Parent booking card layout

<!-- Mories Deo Hutapea,S.E.,S.Kom -->

## Change

Parent booking summary cards now use one column below 600 dp and retain the two-column layout on wider screens. This gives each card enough horizontal space for its icon, label, summary, and navigation indicator on phones.

## Behavior

- Phone-sized layouts show each summary card at full available width.
- Wider layouts keep the existing two-column grid.
- Booking actions and card content are unchanged.

## Verification

- Red: `corepack pnpm --filter @daycare/app exec jest --config jest.ui.config.cjs src/ui/booking.ui.test.tsx` failed because the narrow-screen grid remained a row.
- Green: `corepack pnpm --filter @daycare/app exec jest --config jest.ui.config.cjs --runInBand` passed (14 suites, 68 tests).
- Green: `corepack pnpm --filter @daycare/app typecheck` passed.
- The UI suite emitted existing React `act(...)` warnings in unrelated icon/offline tests; no test failed.
- README update: not applicable; this is a presentation-only layout fix with no change to user flow, business rules, API contracts, configuration, or operation.

## Follow-up

- Confirm the visual result on a narrow Android device when one is available.
