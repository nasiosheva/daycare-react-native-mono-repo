# Operational workflows and private-tutoring pricing

## Changes

- The direct-child flow lets a Staff Admin link or unlink an existing Parent account by exact username or email. Linking only creates or reactivates the tenant Parent membership and guardian relationship; it never creates an enrollment application, invoice, entitlement, or booking.
- Manual attendance now asks for explicit confirmation and accepts a Staff-selected event time. The server rejects a future time, a time outside the child's branch operational day using the branch time zone, and a check-out earlier than the existing check-in.
- Private-tutoring services now use optional daily, weekly, and monthly tariffs. At least one positive tariff is required. Parent selects one available tariff, and the selected amount/type are copied to the request before approval and invoice creation.
- Flyway `V13` preserves every existing private-tutoring service price by copying its former single `price` value into `daily_price` before removing the legacy column. This keeps existing services valid under the new at-least-one-tariff constraint.
- Tutor and private-tutoring-service status controls use the shared accessible `ToggleSwitch`; see `private-tutor-status-switch.md` for the focused UI record.

## Documentation alignment

- `README.md` now describes direct Parent linking, manual attendance validation, and the multi-tariff private-tutoring flow.
- `docs/business-rules.md` remains the source of truth for the roles, validation, pricing snapshot, and scope rules; it already defines those behaviors.

## Verification

- `corepack pnpm verify` passed.
- `JAVA_HOME=$(/usr/libexec/java_home -v 21) ./apps/api/gradlew -p apps/api test --no-daemon` passed.
