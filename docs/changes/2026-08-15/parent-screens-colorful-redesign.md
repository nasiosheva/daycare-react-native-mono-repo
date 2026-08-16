# Parent-facing screens: colorful redesign

## Change

Pure visual redesign of two Parent-facing screens, requested to be more colorful and user-friendly. No behavior, data, permission, or API changes — same hooks, same queries, same navigation targets, only JSX structure and styling.

- `operational-hours.tsx`: day-of-week schedule now renders as a color-coded grid (open days tinted with `colors.accentSoft`, closed days with `colors.disabled`), with today's entry highlighted based on the branch's own timezone (not the device's). Overtime rate tiers render as `colors.dangerSoft` pills with a clock icon, distinct from the neutral schedule colors, to signal "this costs money." Each child gets an initial avatar and a location-tagged tenant/branch line.
- `home.tsx` (`ParentHome` only — `StaffHome`/`StaffAdminHome`/`InactiveStaffHome`/`ParentOnboardingHome` are untouched): child cards get an avatar, a color-coded attendance status pill (green while checked in, neutral otherwise), and icons on the action buttons (`Button`'s existing `leadingIcon` prop). Entitlement/plan info moved from a bordered text block into a colored pill. Invoice cards get a red "needs payment" status pill for `PENDING` invoices and a colored total amount. New style keys (`childCard`, `invoiceCard`, `statusPill*`, `entitlementPill`, etc.) were added rather than restyling the shared `parentCard`/`parentToolbar`/`staffHeading` keys, since those are also used by `InactiveStaffHome` and `ParentOnboardingHome` and were intentionally left alone.

## Verification

- `tsc --noEmit` passed for the mobile app.
- `expo lint` passed for both files (no new findings; unrelated pre-existing findings elsewhere unchanged).
- `corepack pnpm test` (mobile, vitest) passed, 84/84.
- No `docs/business-rules.md` or `README.md` changes: this does not alter user flow, permissions, data, or API contracts.
- Not done: a live visual walkthrough as a signed-in Parent. The local dev database's seeded Parent account password is unknown, so the actual rendered colors/layout have not been visually confirmed in this session.
