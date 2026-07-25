# Branch operating hours and overtime invoices

## Change

- Staff Admin can configure every branch's active weekday schedule, opening/closing time, and ordered overtime blocks.
- Staff Admin manually records actual pickup time to create a Parent overtime invoice. The default due date is two days after creation and is editable while pending.
- Overtime blocks are cumulative: each block is charged once when pickup reaches it; time beyond the final configured block is capped at the final cumulative amount.
- A closed branch day cannot be billed. A child has one non-void charge per operational date; only pending overtime invoices can be edited or voided.
- Parent has a dedicated operating-hours menu and sees the linked child branch's weekly schedule and rates. Overtime invoices use the existing payment instructions and proof-review flow, but never create or activate a service entitlement.

## Affected implementation

- Flyway migration `V18__branch_operating_hours_and_overtime.sql` adds schedule, tier, charge, snapshot, and generic-invoice fields.
- `OvertimeService` enforces branch, role, schedule, invoice-state, parent-link, and charge uniqueness rules.
- `BillingService` now supports both service and overtime invoice sources while retaining entitlement activation only for service invoices.
- Expo screens: branch configuration, Staff Admin overtime invoice management, Parent operating-hours menu, and invoice source display.

## Verification

- `corepack pnpm --filter @daycare/api-client typecheck`
- `corepack pnpm --filter @daycare/app typecheck`
- Backend test execution was attempted with Gradle but the local Gradle installation failed before compilation because its native platform library could not load on this macOS ARM environment.

## Follow-up

- Run `gradle -p apps/api test --no-daemon` from a working JDK 21/Gradle installation before release.
