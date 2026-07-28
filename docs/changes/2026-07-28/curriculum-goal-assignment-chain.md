# Curriculum-to-Goal assignment chain

## Change

- New Child Goal assignments now require the ordered flow **Program Kurikulum → Program Perkembangan → Goal Anak → Daily Assessment**.
- The selected Curriculum Program is persisted on `child_goals.curriculum_program_id` through Flyway migration `V8__child_goal_curriculum_program_source.sql`.
- The Goal assignment picker first loads active Curriculum Programs, then queries only their linked Development Programs with a server-side search parameter.
- The API validates that the Curriculum Program is active and visible to the tenant, and that the selected Development Program belongs to it before creating the Goal.
- Child Goal responses expose the persisted Curriculum Program ID and name. Existing records remain readable with a null source; no historical source is inferred.

## Affected behavior

- Staff Admin and in-scope active Staff must select both values before the **Tetapkan Goal** action becomes available.
- Existing child-level, age-range, active-indicator, and duplicate-active-Goal checks remain in force.
- Daily assessments continue to belong to the assigned Goal indicators; their calculation and Parent read-only access are unchanged.

## Verification

- API-client tests cover the curriculum-filtered Development Program request and the assignment request body containing both IDs. Goal-service tests cover curriculum-filtered results and rejection of an unlinked assignment pair.
- `pnpm --filter @daycare/api-client test`, `pnpm --filter @daycare/api-client typecheck`, `pnpm --filter @daycare/app typecheck`, and `apps/api/gradlew -p apps/api test --no-daemon` pass.

## Follow-up

- A future reporting view may use the stored curriculum source to group Goal outcomes. It must not infer sources for legacy Goal records.
