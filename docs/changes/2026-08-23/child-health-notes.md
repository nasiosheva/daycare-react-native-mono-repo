# Add running health notes to the child health screen

## Behavior change

`child-health.tsx` (Catatan Kesehatan) previously exposed only the single
per-child health profile (`ChildHealthRecord`: blood type, allergies,
medical conditions, medications, emergency instructions). It now also shows
an append-only list of free-text health notes ("Catatan Tambahan") below the
profile, with a floating action button ("+ Tambah catatan") for Staff
Admin/Staff to add a new one via a bottom sheet. Parents (and any linked
guardian) can read the list but cannot add to it, mirroring the existing
read/write split on the health profile itself.

## New backend surface

- New entity/table `ChildHealthNote` / `child_health_notes`
  (`V13__child_health_notes.sql`): `id`, `organizationId`, `childId`,
  `authorUserId`, `note` (max 2000 chars), `recordedAt`.
- `ChildHealthService.listNotes`/`addNote`, following the same
  `ChildScopeService` authorization split as `get`/`upsert`, and the same
  `staffNoteResponse`-style author-name resolution as
  `ChildProgramStaffNote`.
- `GET /children/{childId}/health-notes`, `POST /children/{childId}/health-notes`.
- `api-client`: `ChildHealthNote`, `CreateChildHealthNoteInput`,
  `childHealthNotes()`, `createChildHealthNote()`.

Adding a note reuses the existing `notifyGuardians` path, so it triggers the
same guardian notification (inbox, realtime `HEALTH`, push) as editing the
health profile — see `docs/business-rules.md` §10.
