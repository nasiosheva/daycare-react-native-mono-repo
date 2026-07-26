# Parent profile toolbar navigation

## Change

- Removed Profile from the active-tenant and onboarding Parent bottom navigation.
- Added the existing Profile toolbar icon to both Parent Home states.
- Made Profile consistently a dedicated child screen for every role, with no bottom navigation and an app-bar back button.

## Implementation

- `apps/mobile/src/navigation/RoleBottomNavigation.tsx` defines Parent and Parent-onboarding tab destinations without `/profile`.
- `apps/mobile/app/home.tsx` opens `/profile` from the Home toolbar for both Parent states.
- `apps/mobile/app/profile.tsx` always uses `AppScreen` with `showBottomNavigation={false}`, a translated Profile title, a shared `BackButton`, and the compact language switcher.

## Affected behavior

- Parent opens Profile from Home without consuming a bottom-navigation slot.
- Sign-out and personal-account management remain exclusively in Profile.
- Profile no longer changes layout based on the active role or whether it was opened from a toolbar icon.

## Verification

- `corepack pnpm verify`
- `git diff --check`

## Follow-up

- No backend or API-contract change is required.
- This supersedes the earlier project-memory statement that Parent Profile was a bottom-navigation item.
