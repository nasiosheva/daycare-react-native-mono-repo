# Global curriculum reference level

## Change

- The Platform Admin form for a global Curriculum Program now requires one active global learning level before it shows selectable Development Programs.
- The picker shows only active Development Programs from that reference level. Changing the reference level removes selected Goals outside the newly selected level.
- The Platform Curriculum API now receives `learningLevelId`, stores the global reference through the existing learning-level/program relation, returns it as `learningLevelId`, and rejects global Development Programs from a different level.
- The stored reference is separate from tenant learning-level links. A tenant can still link a global Curriculum Program to its own level without copying or altering the global reference.

## Compatibility

- Existing global programs without a global reference level remain readable. Their editor requires a reference level before the next save; the system does not infer or migrate one automatically.

## Verification

- `corepack pnpm verify`
- `JAVA_HOME=$(/usr/libexec/java_home -v 21) ./apps/api/gradlew -p apps/api test --no-daemon`
- `JAVA_HOME=$(/usr/libexec/java_home -v 21) ./apps/api/gradlew -p apps/api test --tests com.daycare.api.service.PlatformCurriculumServiceTest --no-daemon`

## Follow-up

- None. The change reuses the existing learning-level/program relation and intentionally preserves tenant-owned links.
