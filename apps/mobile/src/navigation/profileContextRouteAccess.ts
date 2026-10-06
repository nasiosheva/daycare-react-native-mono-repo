// Keep the Expo Router bootstrap route mounted while AuthProvider resolves the
// persisted session. The index route owns the initial redirect once loading
// finishes; redirecting from the guard would otherwise unmount the root Stack
// before the navigation action can be handled.
const profilelessAllowedPaths = new Set(["/", "/home", "/sign-in", "/sign-up", "/verify-phone"]);

export function shouldRedirectUntilProfileLoaded(hasUser: boolean, hasProfile: boolean, pathname: string): boolean {
  if (!hasUser || hasProfile) return false;
  return !profilelessAllowedPaths.has(pathname);
}
