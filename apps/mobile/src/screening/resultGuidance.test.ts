// Mories Deo Hutapea,S.E.,S.Kom

import { describe, expect, it } from "vitest";
import { buildCopySummary, domainGuidanceKey, domainLabelKey, domainsWithAttention, normalizeDomainCode, resultGuidanceKey } from "./resultGuidance";

describe("resultGuidanceKey", () => {
  it("maps every known status to its guidance key and falls back for unknown status", () => {
    expect(resultGuidanceKey("SEGERA_DISKUSIKAN")).toBe("screening.guidance.discussSoon");
    expect(resultGuidanceKey("DISKUSIKAN_PERKEMBANGAN")).toBe("screening.guidance.discussDevelopment");
    expect(resultGuidanceKey("PENGAMATAN_BELUM_CUKUP")).toBe("screening.guidance.observeMore");
    expect(resultGuidanceKey("KEMAMPUAN_DILAPORKAN_TERLIHAT")).toBe("screening.guidance.continuePractice");
    expect(resultGuidanceKey("UNKNOWN")).toBe("screening.guidance.observeMore");
  });
});

describe("normalizeDomainCode", () => {
  it("strips the trailing question-group digit", () => {
    expect(normalizeDomainCode("BK1")).toBe("BK");
    expect(normalizeDomainCode("MK12")).toBe("MK");
    expect(normalizeDomainCode("CTX")).toBe("CTX");
  });
});

describe("domainsWithAttention", () => {
  it("sums attentionCount across domain rows sharing the same normalized code", () => {
    expect(domainsWithAttention([
      { domainCode: "BK1", attentionCount: 0 },
      { domainCode: "BK2", attentionCount: 2 },
    ])).toEqual(["BK"]);
  });

  it("excludes domains whose summed attentionCount is zero", () => {
    expect(domainsWithAttention([{ domainCode: "MK1", attentionCount: 0 }])).toEqual([]);
  });

  it("excludes CTX even if it somehow carried attention", () => {
    expect(domainsWithAttention([{ domainCode: "CTX", attentionCount: 3 }])).toEqual([]);
  });

  it("ignores unrecognized domain codes", () => {
    expect(domainsWithAttention([{ domainCode: "ZZ", attentionCount: 3 }])).toEqual([]);
  });

  it("returns multiple domains in the fixed BK, MK, MH, KG, SE, AD display order regardless of input order", () => {
    expect(domainsWithAttention([
      { domainCode: "AD1", attentionCount: 1 },
      { domainCode: "BK1", attentionCount: 1 },
      { domainCode: "MK1", attentionCount: 1 },
    ])).toEqual(["BK", "MK", "AD"]);
  });
});

describe("domainLabelKey / domainGuidanceKey", () => {
  it("maps every capability domain code and returns undefined for anything else", () => {
    for (const code of ["BK", "MK", "MH", "KG", "SE", "AD"]) {
      expect(domainLabelKey(code)).toBe(`screening.domain.${code}`);
      expect(domainGuidanceKey(code)).toBe(`screening.domainGuidance.${code}`);
    }
    expect(domainLabelKey("CTX")).toBeUndefined();
    expect(domainGuidanceKey("ZZ")).toBeUndefined();
  });
});

describe("buildCopySummary", () => {
  it("includes the status, each domain tip, and the disclaimer without an item-by-item list", () => {
    const summary = buildCopySummary({
      statusTitle: "Perlu dibahas",
      statusSummary: "Ada jawaban untuk dibahas dengan dokter anak",
      domainTips: [{ label: "Bahasa dan komunikasi", guidance: "Ajak anak menyebut benda." }],
      disclaimer: "Ini bukan diagnosis.",
    });

    expect(summary).toContain("Perlu dibahas");
    expect(summary).toContain("Ada jawaban untuk dibahas dengan dokter anak");
    expect(summary).toContain("Bahasa dan komunikasi: Ajak anak menyebut benda.");
    expect(summary).toContain("Ini bukan diagnosis.");
  });

  it("omits the domain-tip lines entirely when no domain has attention", () => {
    const summary = buildCopySummary({ statusTitle: "Kemampuan dilaporkan terlihat", statusSummary: "Semua butir terjawab", domainTips: [], disclaimer: "Ini bukan diagnosis." });

    expect(summary).toBe("Kemampuan dilaporkan terlihat\nSemua butir terjawab\n\nIni bukan diagnosis.");
  });
});
