# Booking approval invoice details

## Change

- Extended the booking API response with the source invoice number and locked total amount.
- The Booking Approvals list now shows the locked enrollment amount for pending Parent applications and the invoice number plus total for ordinary pending bookings.

## Behavior

- The displayed amount is the persisted invoice total, including an applied discount when present; the mobile client does not recalculate a package price.
- Existing authorization remains unchanged: Staff Admin sees tenant-wide pending bookings and assigned Staff only receive bookings in their child scope.

## Verification

- `corepack pnpm verify` passed.
- `./apps/api/gradlew -p apps/api test --no-daemon` passed with JDK 21.

## Follow-up

- No schema migration is needed because the response reads existing invoice data already linked by `booking.invoiceId`.
