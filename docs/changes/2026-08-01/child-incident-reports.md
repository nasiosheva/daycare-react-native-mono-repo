# Child incident reports

## Context

Second of four modern-daycare features requested by the user. Staff need a way to log incidents (injury, illness, behavior, other) per child, with an optional photo, that reliably reaches the Parent and — for serious incidents — the Staff Admin, without turning into another approve/reject workflow like Parent absence requests.

## Changes

- Migration `V7__child_incident_reports.sql`: new `child_incident_reports` table — severity (`MINOR`/`MODERATE`/`SERIOUS`), category (`INJURY`/`ILLNESS`/`BEHAVIOR`/`OTHER`), description, optional action-taken text, `occurred_at`, optional photo (bytea, mirroring `DevelopmentEntry`'s existing photo columns), and `acknowledged_by_user_id`/`acknowledged_at`.
- New domain enums `IncidentSeverity`, `IncidentCategory` (`domain/Models.kt`).
- `ChildIncidentService.kt`, modeled closely on `ChildAbsenceService.kt`:
  - `create()` — Staff Admin/Staff in scope (`requireStaffManagedChild`). Notifies every guardian unconditionally (same pattern as `DevelopmentService.create`); additionally notifies every active Staff Admin in the tenant **only when `severity == SERIOUS`** — this was the one piece of business logic explicitly confirmed with the user before implementation.
  - `acknowledge()` — Parent only (`requireParentLinkedChild`), idempotent (a second call is a no-op, does not overwrite the original acknowledgement timestamp). This is a read-receipt, not an approve/reject decision — incident reports are Staff-authored facts, not Parent requests.
  - `photo()` — same dual Staff/Parent authorization as `list()`, reuses the exact photo validation (JPEG/PNG, 5 MB limit, magic-byte check) already established in `DevelopmentService`.
  - New `RealtimeFlag.INCIDENT_REPORTS` so both Parent and Staff Admin inboxes refresh live.
- Endpoints: `GET`/`POST /children/{childId}/incident-reports`, `POST .../{incidentId}/acknowledge`, `GET .../{incidentId}/photo`.
- Mobile: `apps/mobile/app/incident-reports.tsx`, modeled on `absence-requests.tsx`'s list+BottomSheet shape but without a branch-filter tab bar (this screen is always scoped to one `childId`). Staff/Staff Admin get a create form (severity/category pickers, description, optional action taken, optional photo via `useImagePicker`); Parent gets an "acknowledge" button per unread item. Entry point added next to the health-record button in `development.tsx`.
- `packages/api-client`: `ChildIncidentReport`/`CreateChildIncidentInput`/`ChildIncidentPhoto` types and matching methods; `RealtimeFlag` union and `queryInvalidation.ts` both updated with `INCIDENT_REPORTS`.

## Not implemented

Marking a child's classroom/branch scope for the *photo* endpoint intentionally reuses `list()`'s authorization rather than a bespoke check — same as the equivalent `DevelopmentService.photo()` precedent.

## Verification

- `gradle compileKotlin` — clean.
- Live: created one `SERIOUS`/`INJURY` incident and one `MINOR`/`BEHAVIOR` incident against the same test child. Confirmed via `GET /notifications` (Staff Admin token) that exactly one notification exists after both — the `SERIOUS` incident produced the escalation, the `MINOR` one did not. `GET .../incident-reports` returned both, most recent first. `acknowledge` as the Staff Admin (not a Parent) returned 403.
- `cd apps/mobile && npx tsc --noEmit -p .` — clean.
