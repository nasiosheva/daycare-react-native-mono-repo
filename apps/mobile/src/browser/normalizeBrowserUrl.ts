// Mories Deo Hutapea,S.E.,S.Kom
import { isValidHttpsUrl } from "../media/imageUrl";

export function normalizeBrowserUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 2_048) return null;
  const candidate = /^[a-z][a-z\d+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
  return isValidHttpsUrl(candidate) ? new URL(candidate).toString() : null;
}
