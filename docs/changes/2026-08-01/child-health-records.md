# Child health records

## Context

Part of a batch of four modern-daycare features requested by the user (health records, incident reports, tenant analytics, multi-media daily notes). This entry covers the first: a per-child health/allergy/medication profile.

## Changes

- Migration `V6__child_health_records.sql`: new `child_health_records` table, one row per child (`child_id UNIQUE`) — blood type, allergies, medical conditions, medications, emergency instructions, all optional text fields, plus `updated_by_user_id`/`updated_at`.
- `ChildHealthRecord` entity + `ChildHealthRecordRepository` (`findByOrganizationIdAndChildId`).
- `ChildHealthService.kt`: `get()` (Staff Admin/Staff via `ChildScopeService.requireStaffManagedChild`, or Parent via `requireParentLinkedChild`, read-only) and `upsert()` (Staff Admin or any Staff assigned to the child — no new granular permission flag, matching the existing `ChildProgram` pattern rather than `canManageChildPrograms`/`canManageDevelopmentCategories`). Every upsert writes an `AuditLog` row (`CHILD_HEALTH_RECORD`/`UPSERTED`) since this is sensitive data.
- Endpoints: `GET`/`PUT /children/{childId}/health-record`, added to `InstitutionController`.
- Mobile: `apps/mobile/app/child-health.tsx` — single-record form (not list+BottomSheet, since there is exactly one record per child); Parent sees a read-only view, Staff/Staff Admin get an editable form with a Save button. Entry point added to `development.tsx` (shared per-child screen reachable by all three roles) rather than duplicating it into `child-detail.tsx`, since that screen already serves Staff, Staff Admin, and Parent uniformly.
- `packages/api-client`: `ChildHealthRecord`/`UpsertChildHealthRecordInput` types, `childHealthRecord()`/`upsertChildHealthRecord()` methods.

## Verification

- `gradle compileKotlin` — clean.
- Live: reset local DB, fresh tenant + child via `/platform/tenants` and `/children`; `GET .../health-record` returns an empty body (200) before any record exists; `PUT` creates it; `GET` after returns the saved fields; a platform-admin token (not a tenant member) gets 403.
- `cd apps/mobile && npx tsc --noEmit -p .` — clean.
