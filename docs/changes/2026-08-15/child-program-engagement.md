# Program Pendampingan Anak: notifications, Home visibility, templates, and stale-step reminders

## Change

Program Pendampingan Anak had zero recorded usage in the local dev database despite being fully built end-to-end. Investigation found the feature was effectively invisible: no notification hooked into it, no Home entry point, no quick-start path (every program had to be typed from scratch), and no follow-up if a step was left incomplete. This change addresses all four gaps:

- **Notifications** (`ChildManagementService.kt`): sharing a program or step with Parent (`parentVisible` flips `false` → `true`) now notifies linked guardians; Parent feedback now notifies the child's assigned staff (or all active Staff Admins if none assigned). Added `RealtimeFlag.CHILD_PROGRAMS` end to end (backend enum, `packages/api-client` type, mobile `queryInvalidation.ts` mapping, and `notificationRouteAccess.ts` entries for `/parent-child-profile` and `/child-detail`, which were missing and would have silently blocked these notification deep links).
- **Home visibility**: new `GET /children/programs-summary` (Staff Admin, org-wide active program + feedback counts) and `GET /parent/children/programs-summary` (Parent, own children's shared active program count) endpoints, surfaced as a new summary section on `home.tsx` for both roles.
- **Templates**: new `ChildProgramTemplate`/`ChildProgramTemplateStep` entities (migration `V11__child_program_templates.sql`), Staff-Admin-only CRUD via a new `child-program-templates.tsx` screen (reachable from `child-detail.tsx`'s Programs sheet), and a "use a template" picker in the add-program flow that instantiates a program + copied steps in one action (`POST /children/{childId}/programs/from-template/{templateId}`). Templates are a pure copy source — no ongoing link to programs created from them.
- **Stale-step reminders**: new daily `@Scheduled` job (`ChildManagementService.sendStaleProgramStepReminders`, 20:00 Asia/Jakarta, same cron as `GoalService.sendMissedCheckInReminders`) notifies assigned staff once when an incomplete step on an active program crosses 7 days since its last update. This deliberately does *not* use the Staff Reminders feature (`StaffReminderService`) — that system is Staff-authored, recurring, per-device-scheduled reminders with a fixed small set of screen targets, not a fit for system-generated one-off staleness alerts tied to a specific program/child.
- Separately: `child-detail.tsx`'s staff-assignment sheet now explains that assigning a Staff member there also grants them check-in/check-out and other management rights for that child (`children.assignmentGrantsScope`) — the mechanism already existed via `childScopes.isStaffManagedChild`, it just wasn't explained in the UI.
- `docs/business-rules.md` §6.2 updated to document templates and the new notification/reminder behavior.

## Verification

- `apps/api/gradlew test` passed (full suite, including new `ChildManagementServiceTest` cases for stale-step notification gating and template-to-program step copying).
- Migration `V11` applied cleanly against the local dev database (`child_program_templates`/`child_program_template_steps` created with expected columns/indexes/FK).
- `tsc --noEmit` and `expo lint` passed for the mobile app (no new findings; pre-existing `import/no-unresolved` baseline unchanged).
- `corepack pnpm test` (mobile, vitest) passed, 84/84.
- Not done: a live authenticated HTTP/UI walkthrough of the new endpoints — the local dev database's seeded Staff Admin account's password is unknown, so an end-to-end login-and-click-through pass could not be completed in this session. Correctness rests on the unit tests, migration application, and static checks above.
