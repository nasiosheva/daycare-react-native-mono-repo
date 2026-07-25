# Curriculum programs inline list

## Change

- Replaced the curriculum-program summary card and list sheet with an inline list in `curriculum-programs`.
- Added a debounced server-side search over global and tenant-owned program names and descriptions.
- Moved the Staff Admin create action to the floating action button; the existing create form remains a bottom sheet.

## API contract

- `GET /api/v1/curriculum-programs` accepts an optional `search` query parameter.
- Search results remain organization-scoped and include global programs before tenant-owned programs.

## Verification

- Added an `AcademicService` unit test covering trimmed server-side search, source mapping, and the non-search repository methods not being used.
- Added an API-client test verifying the encoded `search` query is sent to the tenant endpoint.
- `corepack pnpm verify` passed (lint, typecheck, and frontend/package tests).
- Backend test compilation is currently blocked before tests run by the pre-existing `LocalPlatformAdminSeederTest`, which calls an outdated `LocalPlatformAdminSeeder` constructor.
