# Institution-type Parent information visibility

## Change

- Platform Admin can now enable Parent occupation and Parent monthly-income-range visibility independently for each institution type.
- Both controls default to off, including for the built-in institution types and newly created types.
- A tenant may receive a field only when at least one of its assigned institution types enables that field.

## Behavior and access

- Parent family data remains global and optional; it is not used for automatic pricing.
- Only `STAFF_ADMIN` receives the enabled data, and only with pending Parent enrollment approvals.
- `STAFF`, Platform Admin, Parent enrollment history, and tenants without the relevant configuration do not receive the sensitive fields.
- The exposed value remains a predefined monthly-income range, not an exact salary amount.

## Verification

- Backend coverage verifies that disabled fields are omitted and enabled fields are selectively returned.
- API-client coverage verifies the two visibility flags are sent in Platform catalog create and update requests.
- `V12` itself is forward-only. However, the current branch also contains a trailing-line change to the already-applied `V1__initial_schema.sql`. A local database that recorded the earlier V1 checksum will fail Flyway validation until its schema history is repaired or the database is recreated. This is an operational limitation of the current branch, not a behavior of V12.

## Follow-up

- Review and resolve the V1 checksum divergence before applying this branch to a shared or production database. Do not run `flyway repair` against a shared database without first confirming that the V1 SQL content is intended.
