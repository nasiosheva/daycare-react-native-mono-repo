<!-- Mories Deo Hutapea,S.E.,S.Kom -->

# Responsive mobile layouts

## Changes

- Billing Admin summary navigation cards switch to one column below 600 dp so their labels and summaries retain readable width; wider screens keep two columns.
- Parent operating-hours day/time chips switch from four columns to two below 600 dp; wider screens retain four columns.
- Platform banner action buttons stack at full width below 600 dp; wider screens retain the existing wrapping row.
- The 600 dp narrow-phone breakpoint is shared with the Parent Booking layout through `isNarrowPhoneLayout`.

## Verification

- Test-first regressions were observed before each screen fix: Billing Admin expected a column but received the old row layout at 360 dp; operating hours expected 47% chip basis but received 22%; platform banners expected stacked actions but received the old row layout.
- During final review, the billing/banner tests were changed to use explicit test IDs instead of discovering containers by style shape. The revised selectors failed first because the IDs were absent, then passed after adding non-visual IDs to the corresponding containers.
- `pnpm --filter @daycare/app exec jest --config jest.ui.config.cjs --runInBand src/ui/billing-admin.ui.test.tsx src/ui/booking.ui.test.tsx` — 2 suites, 10 tests passed.
- `pnpm --filter @daycare/app exec jest --config jest.ui.config.cjs --runInBand src/ui/operational-hours.ui.test.tsx` — 2 tests passed.
- `pnpm --filter @daycare/app test:ui -- src/content-management/platform-banners.ui.test.tsx` — 2 tests passed.
- `pnpm --filter @daycare/app exec jest --config jest.ui.config.cjs --runInBand` — 17 suites, 74 tests passed. Existing React `act(...)` console warnings remain in unrelated tests.
- `pnpm --filter @daycare/app test` — 72 files, 284 tests passed.
- `pnpm --filter @daycare/app typecheck` and `git diff --check` passed.
- `pnpm --filter @daycare/app lint` passed with 0 errors and 13 warnings in unrelated existing files.
- `pnpm verify` — passed across all TypeScript workspaces; mobile Vitest reported 72 files and 284 tests passing. Existing `react-test-renderer` deprecation warnings appeared in unrelated tests.
- `pnpm --filter @daycare/app test:coverage` — passed; existing app-wide coverage is 26% statements/lines, 79.83% branches, and 60.7% functions. The responsive behavior is separately exercised by the Jest UI suite (17 suites, 74 tests); coverage runners are separate.
- `./apps/api/gradlew -p apps/api test --no-daemon` — passed (`BUILD SUCCESSFUL`; Gradle reported tasks up-to-date).
- Final review: billing, platform banner, and operating-hours reviews had no findings; all responsive test selectors now use explicit IDs or the grid's direct children. No Android/iOS device visual test was run.

README and business rules were not changed: this is a responsive presentation correction and does not alter product behavior, role access, or business contracts.
