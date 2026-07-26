# Curriculum program Goal templates

## Change

- Added a Flyway migration for curriculum-program lifecycle fields, explicit template flags, and the many-to-many Program-to-Goal Template relation.
- Added scoped Program create, update, archive, and restore API operations for Platform Admin and tenant Staff Admin.
- Added Goal category selection to the tenant Goal Template form, while keeping the shared `GoalCategory` enum as the category source.
- Updated global and tenant curriculum forms to search and select Goal Templates when creating or editing a Program.

## Behavior

- Global Programs can link only active global Goal Templates; tenant Programs can link active global Goals and Goals owned by the same tenant.
- Global Program and Goal records report `isTemplate=true`; tenant-owned records report `false`.
- Archived Programs retain their existing learning-level relations but are unavailable for new links.

## Verification

- `corepack pnpm verify`
- `JAVA_HOME=$(/usr/libexec/java_home -v 21) gradle -p apps/api test --no-daemon`

## Follow-up

- Existing Program-to-Level relations remain available after a Program is archived; a later level update may preserve them but cannot add a new archived Program.
