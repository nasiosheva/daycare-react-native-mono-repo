# Backend token-revocation logout

## Change

- Added protected `POST /api/v1/auth/logout`, which records only the SHA-256 hash and expiry of the authenticated bearer token.
- Added a Flyway table and JWT-decoder revocation check so a successfully logged-out token is rejected until its existing expiry.
- Local JWT issuance now includes a random JWT ID, ensuring each password-session token is unique.
- Mobile starts backend logout best-effort, clears local state immediately, ignores logout callback failures, and returns to Login without waiting for the backend or Firebase.

## Affected behavior

- Online logout invalidates the exact current application or Firebase bearer token for subsequent API and realtime authentication.
- Offline logout remains a local session clear. If the request cannot be sent, a copied token remains valid only until normal expiry.
- Tokens, raw bearer values, and credentials are never persisted in the revocation table or diagnostic logs.

## Verification

- API unit test verifies only a token hash is persisted.
- API integration test verifies a token succeeds before logout and receives `401 Unauthorized` after logout.
- API-client test verifies the logout endpoint receives the captured bearer token.
- Local Android runtime verification completed on 2026-07-28: `POST http://localhost:8080/api/v1/auth/logout` returned `204` in the launcher API log. This confirms the local API restarted with Flyway migration `V7__revoked_access_tokens.sql` and the logout route is registered.
- The recommended manual regression check is to replay the exact bearer token against a protected endpoint after that `204`; the JWT decoder must respond with `401`.

## Follow-up

- The production API deployment process must apply Flyway migration `V7__revoked_access_tokens.sql` before this endpoint is available in production.
