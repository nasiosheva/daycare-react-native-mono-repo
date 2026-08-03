# Daycare server-driven attendance and billing

## Change

- Parent enrollment now returns a canonical `accessState` and explicit
  `allowedActions`. The Parent screen no longer infers a payment or reapply
  action from raw enrollment and invoice fields.
- The child roster now returns an `AttendanceContext` for Staff and Staff
  Admin. Daycare check-in eligibility is evaluated by the server from the
  attendance record plus confirmed booking or active monthly entitlement.
  The client uses the returned action list as presentation state only; the
  existing write path remains the final authority.
- Pickup authorization is now a dedicated Daycare resource. Linked Parents
  submit their own pickup people, Staff Admin verifies or revokes them, and
  checkout stores the authorization snapshot or a Staff Admin exception reason.
- Emergency contacts are now stored independently of pickup authorizations and
  guardian links, with separate authorization and immutable audit events.
- Consent now has additive storage for tenant definitions and immutable
  definition snapshots per guardian/child record. No medical or medication
  behavior is wired to it until its API and authority model are complete.

## Verification

- `pnpm typecheck`
- `JAVA_HOME=$(/usr/libexec/java_home -v 21) apps/api/gradlew -p apps/api test --no-daemon`

## Follow-up

- The documented target for education and combined attendance contexts is not
  built yet.
- Emergency contacts, consent, explicit grant administration, medication, and
  offering-specific two-person exception policies remain separate safety work.
