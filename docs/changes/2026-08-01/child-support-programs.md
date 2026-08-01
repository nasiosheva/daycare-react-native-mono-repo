# Child support programs

## Change

- `ChildProgram` is now the implementation entity for a **Program Pendampingan Anak**. It stores an operational status, explicit Parent sharing, a Parent-specific summary, and optional home guidance in addition to its internal Staff description.
- Staff Admin and authorized in-scope Staff can create and manage ordered support steps plus internal delivery notes. A program with steps, notes, or Parent feedback retains its history and must be completed or discontinued instead of deleted.
- A linked Parent receives only programs and steps explicitly shared by Staff. The Parent response omits the internal program description, Staff notes, and feedback from other guardians. The Parent may send a short feedback note to a shared program but cannot alter Staff-owned data.
- These records remain operational support plans. They do not contain Goal indicators, scores, percentages, streaks, rubrics, development targets, or Platform Knowledge input.

## API and data

- Flyway migration `V11__child_program_plans.sql` adds support-program fields plus child-program steps, Staff notes, and Parent-feedback tables. Existing Flyway migrations, including `V1`, remain unchanged so deployed environments keep a valid checksum history.
- The child profile endpoint returns the full Staff-scoped plan. The Parent child-profile endpoint returns its restricted shared projection.
- New child-program endpoints support updates, steps, Staff notes, and Parent feedback. Every mutation reuses the established child scope and `canManageChildPrograms` policy.
- Selecting **Kelola Program** closes the child-detail program-list Bottom Sheet before navigation, preventing the sheet from remaining mounted behind the dedicated management screen.

## Verification

- `corepack pnpm verify`
- `JAVA_HOME=$(/usr/libexec/java_home -v 21) ./apps/api/gradlew -p apps/api test --tests com.daycare.api.service.ChildManagementServiceTest --no-daemon`
- `JAVA_HOME=$(/usr/libexec/java_home -v 21) ./apps/api/gradlew -p apps/api test --no-daemon`

## Follow-up

- None. Parent feedback remains text-only; it intentionally does not create a development assessment or a staff task automatically.
