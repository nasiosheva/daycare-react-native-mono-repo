export function profileForCurrentIdentity<T>(
  profile: T | null,
  profileIdentityKey: string | null,
  currentIdentityKey: string | null,
) {
  if (!currentIdentityKey || profileIdentityKey !== currentIdentityKey) return null;
  return profile;
}

export function profileIdentityChanged(
  previousIdentityKey: string | null | undefined,
  nextIdentityKey: string | null,
) {
  return previousIdentityKey !== undefined && previousIdentityKey !== nextIdentityKey;
}
