# Staff leave and sick requests

## Change

- Added tenant-scoped Staff leave/sick requests with `PENDING`, `APPROVED`, `REJECTED`, and `CANCELLED` lifecycle states.
- Staff submit their own request from Profile, with date range and required reason plus one optional JPEG/PNG supporting image up to 5 MB.
- Staff Admin reviews pending requests from Manage and must provide a reason when rejecting.
- Added inbox/push delivery for new requests and decisions, plus `STAFF_LEAVE_REQUESTS` realtime invalidation for both Staff and Staff Admin lists.

## API and persistence

- Added Flyway migration `V10__staff_leave_requests.sql`.
- Added `/staff-leave-requests`, `/staff-leave-requests/pending-approval`, decision, cancellation, and scoped evidence endpoints.
- The API rejects past start dates, invalid ranges, overlapping pending/approved requests, unauthorised evidence access, invalid evidence, and rejection without a reason.

## Verification

- Added service tests for creation/Staff Admin notification, inclusive overlap rejection, and required rejection reason.
- Added API-client contract coverage for request creation, decision, and evidence retrieval.

## Follow-up

- This feature intentionally does not alter staffing schedules, capacity, or attendance. A future scheduling module must consume approved requests explicitly instead of adding implicit side effects here.
