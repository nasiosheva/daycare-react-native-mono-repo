# Platform Admin navigation cleanup and two branch-filter bugs

## Change

- Added a **Master data** bottom navigation tab for Platform Admin (`platform-catalog.tsx`), replacing three separate buttons previously on Home (Kurikulum global, Program Perkembangan global, Kategori perkembangan global).
- Moved Platform Admin's Profile access from a bottom-nav tab to a toolbar icon on Home, matching the existing Staff/Staff Admin pattern (`profile.tsx`'s bottom-nav-vs-back-button behavior now also applies to `profile?.isPlatformAdmin`).
- Added a **Tambah tenant** floating action button directly on the Platform Admin Home screen (in addition to the existing one on the Tenant list screen).
- Fixed the Parent enrollment catalog (`ParentEnrollmentService.catalog()`) to list every tenant with an `ACTIVE`/`TRIAL` subscription and `DAYCARE_OPERATIONS` capability, regardless of whether it has an active branch or Service Plan yet. Previously a tenant with zero branches or zero Service Plans was silently excluded from the catalog entirely.
- Fixed a bug where `STAFF_ADMIN` accounts (tenant-wide by design, `branchId` always `null`) were excluded from every per-branch staff count/listing: `apps/mobile/app/home.tsx`'s per-branch summary, and the backend `/tenant-users?branchId=` filter in `AdministrationService.tenantUsers()`. Both now always include active `STAFF_ADMIN`s regardless of the branch filter, matching the existing `role != Role.STAFF || ...` convention already used in `ChildManagementService`/`LearningStructureService`.
- Added server-side branch name search: `BranchRepository.findAllByOrganizationIdAndNameContainingIgnoreCase`, `BranchManagementService.branches(search)`, `GET /branches?search=`, and `api.branches(search)`. The Home branch summary search box now debounces and filters server-side instead of client-side.

## Behavior

- A tenant that has just been created (no branches/Service Plans configured yet) is now visible to Parents immediately, but cannot complete enrollment (empty branch/plan pickers) until its Staff Admin finishes setup.
- Filtering the tenant-users list or the Home branch summary by a specific branch no longer hides Staff Admin accounts.

## Verification

- `gradle compileKotlin` clean for both fixes.
- `pnpm --filter @daycare/api-client` and `pnpm --filter @daycare/app` typecheck/test clean.
- Verified locally against the dev database: a tenant with a `TRIAL` subscription, `DAYCARE_OPERATIONS` capability, one active branch, and zero Service Plans is now returned by `catalog()`.

## Follow-up

- The backend fixes require restarting the running API process to take effect; they do not need a schema migration.
