# Child absence requests

## Change

- Added the `child_absence_requests` Flyway schema and typed core/API-client contracts.
- Linked Parents can create and cancel a dated child-absence request. Supported purposes are sick, out of town, family event, emergency, and other; other requires a note.
- Staff Admin and Staff within the existing child-assignment/classroom scope can review the pending queue and approve or reject a request. Staff Admin branch filtering is staged in a Bottom Sheet and only changes the list after Apply.
- Added Parent child-card access plus Staff and Staff Admin operational-menu access to the dedicated child screen.
- Added persisted inbox notifications, native Expo push delivery, and realtime query invalidation for submissions, decisions, and cancellations.

## Behavior

- The date range begins today or later in the child branch timezone, cannot end before it starts, and cannot overlap an existing pending or approved range for the same child.
- An absence request is informational. It does not create, alter, cancel, reserve, or restore bookings or service credits, and it does not substitute for actual attendance recording.
- Parent may cancel only its own pending request. A rejection requires an operating-user reason. Inactive tenant memberships retain read-only access and cannot mutate a request.

## Verification

- Added service tests covering Parent creation, required note validation, and in-scope Staff approval/guardian notification.
- Run `corepack pnpm verify` and `gradle -p apps/api test --no-daemon` with JDK 21 after the implementation changes.

## Follow-up

- No attendance automation is intentionally coupled to the approved absence state; any future attendance policy must be explicitly designed before changing this informational flow.
