# Firebase native modular authentication

## Change

- Migrated the Android/iOS Firebase authentication adapter from deprecated React Native Firebase namespaced calls to the v22 modular API.
- The adapter now obtains one `getAuth()` instance and uses modular `onAuthStateChanged`, `signInWithCredential`, `signInWithPhoneNumber`, `updateProfile`, `signOut`, and `getIdToken` functions.

## Affected behavior

- Google identity verification, phone OTP verification, Firebase session observation, profile-name synchronization, sign-out, and Firebase token retrieval retain their existing `AuthGateway` contract.
- The migration removes the runtime warnings emitted by `auth()` namespaced calls and prepares the native adapter for the next React Native Firebase major version.

## Verification

- `corepack pnpm --filter @daycare/app typecheck`
- Confirm no namespaced `auth()` call remains in `apps/mobile/src/auth/firebase.native.ts`.

## Documentation review

- README and business rules do not change because authentication flow, user-visible behavior, API contracts, and configuration remain unchanged.
