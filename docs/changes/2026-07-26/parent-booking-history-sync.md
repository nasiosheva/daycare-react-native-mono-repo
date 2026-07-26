# Parent booking history sync

## Change

- Corrected the Parent **Riwayat booking** Bottom Sheet so it renders only the booking records for the child selected on the Booking screen.
- Opening the history now refetches bookings before display, while the existing realtime `BOOKINGS` invalidation and mutation invalidation remain in place.

## Root cause and implementation

- `apps/mobile/app/booking.tsx` already derived `childBookings` for the history-card count, but the Bottom Sheet rendered the unfiltered `bookings.data` response and used its all-child empty state.
- The Bottom Sheet now renders `childBookings` and uses `childBookings.length` for its empty state, matching the selected child and history-card summary.
- The protected API (`GET /bookings`) already limits Parent records to entitlements owned by the authenticated Parent and returns them in booking-date descending order. No API change was needed.

## Affected behavior

- The history card count, empty state, and displayed records now use the same selected-child scope.
- A booking belonging to another linked child can no longer appear in the selected child's history.
- Parent-created bookings are visible immediately after the existing mutation invalidation; booking/payment/approval updates also refresh through the `BOOKINGS` realtime flag when connected.

## Verification

- `corepack pnpm verify`
- `git diff --check`

## Follow-up

- No backend, API-contract, or business-rule change is required; the API already returns Parent-authorized booking history and sorts it by booking date descending.
