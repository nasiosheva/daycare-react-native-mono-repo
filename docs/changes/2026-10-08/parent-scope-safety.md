# Parent tenant-scope safety

## Change

- Notification deep links no longer switch `AuthProvider`'s active tenant. Cross-tenant Parent routes keep the notification tenant in the route/query context and let the destination resolve it per action.
- Development and Goals resolve the selected child's `organizationId` before loading child-scoped data and use the matching membership/access context.
- Booking keeps invoice reads available for restricted tenants, but disables booking, service-plan, entitlement, and booking-history operational queries for those children. Partial child-tenant failures show a retry action.

## Verification

- `pnpm --filter @daycare/app typecheck`
- Existing navigation tests cover cross-tenant route authorization and organization-id propagation.

## Follow-up

Absence/consent eligibility remains unchanged until the product rule is chosen for non-Daycare institution contexts; the current documented server policy still requires the Daycare entitlement for those mutations.
