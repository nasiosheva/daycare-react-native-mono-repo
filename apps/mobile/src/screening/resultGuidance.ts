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
