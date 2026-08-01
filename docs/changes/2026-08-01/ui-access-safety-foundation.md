# UI access safety foundation

## Scope

- Treat `docs/business-rules.md` as the normative product source and keep target school, academic, and class-fund flows hidden until their dedicated server contracts exist.
- Add a safe legacy foundation for tenant context selection, profile/cache handling, notification routing, inactive-account behavior, and Daycare route/capability checks.

## Affected behavior

- A non-platform account with multiple returned tenant memberships must choose one tenant before a tenant-scoped Home **or direct route** renders. The client does not silently select the first membership. A Parent with no membership is also kept out of child-scoped direct routes. Global Profile, explicit Parent self-service routes, and the server-authorized read-only all-tenant operating-hours overview remain available before that choice.
- Authenticated direct routes wait at Home while the profile is loading or has failed, so a screen cannot run against an unverified stale profile. A profile is bound to the identity/session that loaded it and is not exposed during an account change. Changing the authenticated user or tenant, signing out, every successful profile refresh, and every failed profile refresh clear React Query data before another scoped render. A failed profile exposes only Home's retry/sign-out state.
- Every realtime `CONNECTED` revalidates the profile before queued events invalidate/render data. The reconnect path avoids a profile-refresh/reconnect loop and reuses a remembered tenant only after the new profile validates it.
- Native-push and inbox notification routes use the same fail-closed policy for current role, active membership, and required capability. They can switch tenant only to an ID still present in the current profile. Parent enrollment and payer billing self-service require `registrationRole=PARENT`, do not switch tenant, and pass the enrollment organization only for payment-instruction lookup; invoice/proof endpoints remain authorized by the server against the payer.
- Legacy Daycare entry points and queries require the current tenant context. Parent QR/booking and Staff/Admin scan routes are guarded; service-plan billing, entitlement subscriptions, branch operating hours, and overtime routes require an active Staff Admin with `DAYCARE_OPERATIONS`; booking approvals preserve the existing active Staff or Staff Admin scope with that capability. The Staff Admin hub does not advertise its Daycare-only cards to a tenant without that capability.
- An inactive Parent returns to limited onboarding/payer-billing self-service; child, booking, notification, development, absence, and incident routes are blocked before their screen hooks run. The server-authorized read-only all-tenant operating-hours overview remains the documented cross-tenant exception. The absence cancel and incident acknowledge affordances also require active membership as a defense in depth.
- An inactive Staff or Staff Admin reaches only a safe read-only Home/Profile state with no operational navigation. Historical read access is not inferred by this client and still requires an explicit resource policy at the server/UI boundary. PDF/XLSX child-list and attendance-recap exports are not rendered for inactive Staff/Admin, and the report service requires an active membership before it reads report data.
- Parent self-enrollment and catalog queries are scoped to the signed-in user. Realtime invalidation carries the event/current tenant and user scope so it neither invalidates another tenant nor another Parent's self-service cache.

## Verification

Completed during this change:

- `corepack pnpm verify` (workspace lint, typecheck, and tests; mobile: 24 files, 61 tests)
- `cd apps/api && JAVA_HOME=$(/usr/libexec/java_home -v 21) ./gradlew test --tests com.daycare.api.service.ChildReportExportServiceTest --no-daemon`
- `JAVA_HOME=$(/usr/libexec/java_home -v 21) ./apps/api/gradlew -p apps/api test --no-daemon`
- `git diff --check`

The focused export test and the complete API suite both passed with JDK 21. The workspace verification passed after the full mobile typecheck/test suite.

## Follow-up

- This does not claim implementation of the target `UiAccessContext`, per-offering capability, revision, idempotency, or school/class-fund domains in sections 12–13 of `docs/business-rules.md`.
- Implement those server-owned contracts before exposing PAUD/TK/SD/SMP target admission, attendance, report-card, billing, or class-fund routes.
