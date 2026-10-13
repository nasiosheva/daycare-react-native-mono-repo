import type { TranslationKey } from "@/i18n/translations";

// Mories Deo Hutapea,S.E.,S.Kom

/**
 * Product guidance is deliberately practical and non-diagnostic. The server
 * status remains authoritative; this only selects the matching Parent-facing
 * explanation for the result screen.
 */
export function resultGuidanceKey(status: string): TranslationKey {
  switch (status) {
    case "SEGERA_DISKUSIKAN":
      return "screening.guidance.discussSoon";
    case "DISKUSIKAN_PERKEMBANGAN":
      return "screening.guidance.discussDevelopment";
    case "PENGAMATAN_BELUM_CUKUP":
      return "screening.guidance.observeMore";
    case "KEMAMPUAN_DILAPORKAN_TERLIHAT":
      return "screening.guidance.continuePractice";
    default:
      return "screening.guidance.observeMore";
  }
}

const capabilityDomainCodes = ["BK", "MK", "MH", "KG", "SE", "AD"] as const;
type CapabilityDomainCode = (typeof capabilityDomainCodes)[number];

/** Strips the trailing question-group digit (e.g. "BK1" -> "BK"), matching ScreeningResultExportService.domainLabel on the backend. */
export function normalizeDomainCode(code: string): string {
  return code.replace(/\d+$/, "");
}

/**
 * Domains (in fixed display order) whose summed attentionCount is positive on this result.
 * CTX is observation context, not a capability area, so it is excluded even if present.
 */
export function domainsWithAttention(domains: readonly { domainCode: string; attentionCount: number }[]): CapabilityDomainCode[] {
  const attentionByCode = new Map<string, number>();
  for (const domain of domains) {
    const normalized = normalizeDomainCode(domain.domainCode);
    attentionByCode.set(normalized, (attentionByCode.get(normalized) ?? 0) + domain.attentionCount);
  }
  return capabilityDomainCodes.filter((code) => (attentionByCode.get(code) ?? 0) > 0);
}

export function domainLabelKey(domainCode: string): TranslationKey | undefined {
  switch (domainCode) {
    case "BK": return "screening.domain.BK";
    case "MK": return "screening.domain.MK";
    case "MH": return "screening.domain.MH";
    case "KG": return "screening.domain.KG";
    case "SE": return "screening.domain.SE";
    case "AD": return "screening.domain.AD";
    default: return undefined;
  }
}

export function domainGuidanceKey(domainCode: string): TranslationKey | undefined {
  switch (domainCode) {
    case "BK": return "screening.domainGuidance.BK";
    case "MK": return "screening.domainGuidance.MK";
    case "MH": return "screening.domainGuidance.MH";
    case "KG": return "screening.domainGuidance.KG";
    case "SE": return "screening.domainGuidance.SE";
    case "AD": return "screening.domainGuidance.AD";
    default: return undefined;
  }
}

/**
 * Plain-text version of the result for a Parent to copy elsewhere (e.g. to ask an outside AI or
 * professional to look at it). Deliberately concise — status + domain tips, no item-by-item
 * list — but keeps the non-diagnostic disclaimer, since that caveat must travel with the result
 * wherever it goes, the same way it is required on the UI and PDF.
 */
export function buildCopySummary(input: { statusTitle: string; statusSummary: string; domainTips: readonly { label: string; guidance: string }[]; disclaimer: string }): string {
  const lines = [input.statusTitle, input.statusSummary];
  for (const tip of input.domainTips) lines.push("", `${tip.label}: ${tip.guidance}`);
  lines.push("", input.disclaimer);
  return lines.join("\n");
}
