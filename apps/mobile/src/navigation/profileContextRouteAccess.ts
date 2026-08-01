const profilelessAllowedPaths = new Set(["/home", "/sign-in", "/sign-up", "/verify-phone"]);

export function shouldRedirectUntilProfileLoaded(hasUser: boolean, hasProfile: boolean, pathname: string): boolean {
  if (!hasUser || hasProfile) return false;
  return !profilelessAllowedPaths.has(pathname);
}
