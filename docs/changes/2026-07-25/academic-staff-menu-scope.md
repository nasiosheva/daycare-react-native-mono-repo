# Academic Staff menu scope

## Change

- Hid the **Tingkatan** action card from the Academic menu for the `STAFF` role.
- `STAFF_ADMIN` retains the card and the existing learning-level management flow.

## Verification

- Reviewed the role guard in `apps/mobile/app/academic.tsx`; the card now uses the same `STAFF_ADMIN` role boundary as the Goals action.
