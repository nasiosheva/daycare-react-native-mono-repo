// Mories Deo Hutapea,S.E.,S.Kom
export function isValidHttpsImageUrl(value: string): boolean {
  return isValidHttpsUrl(value);
}

export function isValidHttpsUrl(value: string): boolean {
  const normalized = value.trim();
  if (normalized.length === 0 || normalized.length > 2_048) return false;
  if (!/^https:\/\/[^/?#]+/i.test(normalized)) return false;
  try {
    const url = new URL(normalized);
    return url.protocol === "https:" && Boolean(url.hostname) && !url.username && !url.password;
  } catch {
    return false;
  }
}
