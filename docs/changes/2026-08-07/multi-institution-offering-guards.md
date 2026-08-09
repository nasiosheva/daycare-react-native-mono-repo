# Multi-institution offering guards

## Change

- Preserved multi-select institution types as tenant identity rather than a feature switch.
- Capability-gated legacy API operations now require both the existing tenant compatibility capability and a matching `PUBLISHED` offering. Attendance uses the child's own branch offering before applying Daycare booking or pickup behaviour.
- Tenant type updates reject an empty type list and reject removal of a type that is still referenced by any offering, preserving offering history and preventing an orphaned offering.
- Added localized Tenant-form guidance that selecting a type does not activate a feature by itself.
- Added a Staff Admin management entry for creating an offering on an active branch and progressing its existing lifecycle, so a newly added tenant type has an in-app operational setup path.
- Replaced remaining Daycare UI, bottom-navigation, route, notification, consent, operating-hours, and Staff-reminder gates that read aggregate tenant capability with the published offering context. Child-specific actions use the child's branch offering.
- Parent enrollment catalog and checkout, enrollment approval, overtime operations, and scheduled overtime alerts now require the published Daycare offering of the relevant branch. Tenant readiness evaluates Daycare setup only for published Daycare branches, so an unused type or another branch cannot create false readiness requirements.

## Verification

- `corepack pnpm typecheck` passed.
- `corepack pnpm test` passed (74 mobile tests plus shared workspace tests).
- `JAVA_HOME=$(/usr/libexec/java_home -v 21) apps/api/gradlew -p apps/api test --no-daemon` passed (154 tests; 4 skipped), including published capability resolution by branch and offering-scoped readiness.

## Follow-up

- Legacy records without `offeringId` still need their separately documented scope migration before every academic and Daycare resource can be authorized by an individual offering ID.
