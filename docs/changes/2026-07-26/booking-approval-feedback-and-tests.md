# Booking approval feedback and tests

## Change

- Separated Parent enrollment applications from paid booking requests in the approval list so Staff Admin can identify the business decision being made.
- Replaced system-alert failure feedback for approval actions and proof downloads with inline, accessible feedback in the active Bottom Sheet.
- Added backend coverage for Parent enrollment approval/rejection and booking approval/rejection side effects.

## Affected behavior

- Approving a Parent enrollment creates the deferred invoice and entitlement, activates the child and Parent tenant link, and notifies the Parent.
- Rejecting a Parent enrollment deactivates the pending child and notifies the Parent.
- Approving a booking confirms it; rejecting it returns the reserved credit, releases booking capacity, and notifies the Parent.

## Verification

- `corepack pnpm verify`
- `./apps/api/gradlew -p apps/api test --no-daemon`

## Follow-up

- Run the Parent and Staff Admin approval flow on a physical native device to verify the resulting Expo push delivery in addition to backend unit coverage.
