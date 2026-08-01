# Fix inactive-account read bypass and shared incident acknowledgement

## Context

Found during a full audit of `docs/business-rules.md` against the actual UI/backend (see the parallel audit findings). Two items were genuine code bugs contradicting the document's own explicit rules, not documentation drift — fixed here rather than just annotated in the doc.

## Changes

### 1. Inactive-account blanket read bypass (§9/§1)

`AccessService.require(jwt, organizationId, allowedRoles, requiredCapability, readOnly)` allows an inactive membership to pass whenever `readOnly = true` is passed, regardless of role or resource. This is correct and intentional for the *general* rule that inactive accounts keep ordinary read access — but §1 explicitly excludes health detail, incident reports, live attendance, exports, and guardian contact from that blanket allowance, requiring an explicit resource grant instead. No such grant model exists yet, so the correct interim behavior is to require an active membership for exactly these reads.

Removed `readOnly = true` from the six call sites that serve these specific resources, so they now require an active membership like any mutation:
- `ChildHealthService.get()` — health detail.
- `ChildIncidentService.list()` and `.photo()` — incident reports.
- `ChildManagementService.profile()` — includes guardian contact info.
- `AttendanceService.listChildren()` — the live per-child attendance list (`GET /children`).
- `AttendanceService.childAttendanceReport()` — powers the Staff Admin attendance export; already gated by an active-only check at the `ChildReportExportService` wrapper, tightened here too for defense in depth in case a future endpoint calls it directly.

All other `readOnly = true` call sites (e.g. an inactive Parent reading their own invoices) are untouched — the general "inactive accounts keep existing read access" rule still applies everywhere else.

### 2. Incident acknowledgement shared across all guardians

`ChildIncidentReport` stored acknowledgement as a single `acknowledgedByUserId`/`acknowledgedAt` pair on the incident row itself. Whichever guardian tapped "acknowledge" first silently marked the incident acknowledged for every other guardian of the same child — directly contradicting §13.13.4's explicit requirement that one guardian's acknowledgement must not remove the unread indicator for another.

- Migration `V10__child_incident_acknowledgements.sql`: new `child_incident_acknowledgements` table (`incident_id`, `user_id`, `acknowledged_at`, unique per pair), backfilled from any existing shared acknowledgement so historical data isn't lost from that one guardian's perspective. The old `acknowledged_by_user_id`/`acknowledged_at` columns on `child_incident_reports` are left in place (non-destructive) but no longer read or written by the app.
- `ChildIncidentService.acknowledge()` now inserts one row per `(incidentId, userId)`, idempotently.
- `ChildIncidentResponse.acknowledgedAt` replaced with `acknowledgedByMe: Boolean`, computed relative to the calling user for `list()` (batch-fetched per request) and `acknowledge()`. `create()` always returns `acknowledgedByMe = false` (the creator is Staff/Staff Admin, not a guardian).
- `packages/api-client` and `apps/mobile/app/incident-reports.tsx` updated to the new field name/shape.

## Verification

- `gradle compileKotlin` and `gradle test` — clean, 121 tests (2 `AttendanceServiceTest` fixtures updated to match the tightened call signature).
- `pnpm typecheck` and `pnpm test` from repo root — clean.
- Live: created an active Staff account, confirmed `GET /children` returns 200; deactivated the same account without issuing a new token, confirmed the identical JWT now gets 403.
- Live: created a `SERIOUS` incident on a test child with two independent Parent guardians. Both initially saw `acknowledgedByMe: false`. Guardian 1 acknowledged and saw `true`; Guardian 2, listing the same incident afterward, still saw `false` — confirming the fix.
