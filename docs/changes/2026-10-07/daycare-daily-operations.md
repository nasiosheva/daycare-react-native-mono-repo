# Daycare daily operations, safety follow-up, and directed announcements

## Delivered

- Added append-only Daycare care logs for meals, naps, and toilet events, including validated type-specific fields and correction addenda. Staff can correct an original record from its card; correction addenda are not recursively corrected from the UI.
- Added a combined child daily timeline UI that reads authorized development, care, and incident histories without inventing missing health, attendance, or Goal facts.
- Added staff-only child handovers with a server-scoped recipient list and recipient-only acknowledgement.
- Added tenant/branch announcements with immutable recipient snapshots, optional acknowledgement, draft editing, immediate publish, close, and scheduled server publishing.
- Added Staff Admin configuration of idempotent Daycare entitlement-expiry reminder lead days; the Asia/Jakarta scheduler notifies the entitlement owner and active Staff Admins of the service name and expiry date without changing billing or entitlement state.
- Extended incidents with lifecycle state, guardian-contact outcome, internal follow-up addenda, and close guards for serious incidents and outstanding work.

## Safety boundaries

- All child actions re-check tenant, active membership, published `DAYCARE_OPERATIONS` capability where relevant, and Parent/Staff child scope on the server.
- Parent access remains read-only for care logs and is denied entirely for internal handovers and internal incident follow-ups.
- Announcement recipients are calculated at publish time and stored per user; a client cannot broaden a tenant or branch audience.
- The daily timeline deliberately composes existing source endpoints rather than becoming a new authoritative server record.
- Each new operational source has its own websocket invalidation flag, so an authorized open list refreshes from REST without treating websocket data as a source of truth.

## Verification

- `./scripts/run_full_suite_and_compile_check.sh` (launcher shell syntax, full TypeScript lint/typecheck/test, complete Spring suite, and patch whitespace)
- `apps/api/gradlew -p apps/api test --no-daemon --rerun-tasks --tests "*.ChildCareLogServiceTest" --tests "*.ServiceExpiryReminderServiceTest"`
- Focused service tests cover cross-child care-log correction rejection, guardian-only care-log refresh delivery, and idempotent service-expiry reminders for the Parent and active Staff Admin.

## Follow-up

- Add an explicit server-side per-operational-day summary only after its attendance, Goal, and Program sources have a settled read-model contract.
- Add required incident owner/due-date assignment and overdue escalation only with an explicit assignment and notification workflow.
