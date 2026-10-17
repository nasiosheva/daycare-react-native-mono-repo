# CORS idempotency header

<!-- Mories Deo Hutapea,S.E.,S.Kom -->

- Added `Idempotency-Key` to the backend CORS allowlist.
- This allows browser preflight requests for renewal, payment, booking, and other idempotent mutations to reach their authenticated API endpoints.
- Added a regression assertion to the Spring security configuration test.
