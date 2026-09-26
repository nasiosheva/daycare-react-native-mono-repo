# UI components (`@daycare/ui`)

Use these shared building blocks instead of hand-styled `View`/`TextInput` so screens look and behave the same.

| Need | Use | Notes |
| --- | --- | --- |
| Text input | `TextField` | Always pass a visible `label`. Use `hint` for guidance, `error` for validation, `required` for mandatory fields. |
| Search box | `SearchField` | Has a search icon and a clear button. |
| Pick one option | `ChipGroup` + `Chip` | Lighter than a row of full `Button`s. |
| Menu entry | `MenuItem` inside `MenuSection` | Every entry has an icon; group long menus under short section titles. Use `attention` + a `Badge` for items that need action. |
| Section title | `SectionHeader` | Optional description and action slot. |
| Content box | `Card` (+ `InfoRow`) | Optional `icon`, `title`, `subtitle` and a `trailing` Badge. Use `InfoRow` for label/value pairs such as due date or account number. `variant="tinted"` inside sheets, `"selected"` for a chosen option. |
| Status pill | `Badge` | Tones: `neutral`, `info`, `success`, `warning`, `danger`. Always include a text label; colour must not be the only signal. For backend statuses use `statusTone(status)` from `src/ui/statusTone.ts` so the same status always gets the same colour. |
| Persistent notice | `Banner` | Read-only mode, form errors, setup that needs attention. |
| Empty list | `EmptyState` | Say what is missing and, when the user can fix it, offer an `action`. |
| Load failure | `ErrorState` | Always offer `onRetry`. Hide it while the query is refetching. |
| Short-lived result | `notify(title, message, tone)` / `publishInlineFeedback` | Shows a toast pinned under the app bar (web). Errors stay longer than successes. |
| Primary screen action | `FloatingActionButton` with `icon` | `Screen` adds bottom padding so it never covers content. |

Colours come from `theme.ts` (`colors`, `toneColors`). Text colours are checked against WCAG AA (4.5:1) on their backgrounds; keep that when adding new ones.

Reference screens: parent flow — `app/parent-payment.tsx` and `app/payment-proof.tsx` (payment steps, cards), `app/parent-enrollment.tsx` (status badges), `app/parent-child-profile.tsx`. Staff/admin — `app/staff-admin.tsx` (grouped menu), `app/classrooms.tsx` (form, chips, empty state), `app/home.tsx` (empty/error states, search, badges), `app/sign-in.tsx` (labelled fields, error banner).
