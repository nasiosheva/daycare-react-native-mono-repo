import { describe, expect, it } from "vitest";
import { goalPickerLabel, supportedLocales, translate, type TranslationKey } from "./translations";

describe("translations", () => {
  it("uses the active locale and interpolates values", () => {
    expect(translate("id", "home.greeting", { name: "Ayu" })).toBe("Halo, Ayu");
    expect(translate("en", "home.greeting", { name: "Ayu" })).toBe("Hello, Ayu");
  });

  it("resolves the zh and fr locales with the same placeholder", () => {
    expect(translate("zh", "home.greeting", { name: "Ayu" })).toContain("Ayu");
    expect(translate("fr", "home.greeting", { name: "Ayu" })).toContain("Ayu");
  });

  it("includes the Consent V1 labels in every supported locale", () => {
    for (const locale of supportedLocales) expect(translate(locale, "consent.title")).not.toBe("consent.title");
  });

  it("includes the Consent V1 information page in every supported locale", () => {
    for (const locale of supportedLocales) expect(translate(locale, "consent.informationLimitDescription")).not.toBe("consent.informationLimitDescription");
  });

  it("includes the Parent enrollment wizard in every supported locale", () => {
    for (const locale of supportedLocales) {
      expect(translate(locale, "parentEnrollment.stepBranch")).not.toBe("parentEnrollment.stepBranch");
      expect(translate(locale, "parentEnrollment.pendingApprovalNotice")).not.toBe("parentEnrollment.pendingApprovalNotice");
    }
  });

  it("includes the tenant creation wizard in every supported locale", () => {
    for (const locale of supportedLocales) {
      expect(translate(locale, "tenantCreation.stepInstitution")).not.toBe("tenantCreation.stepInstitution");
      expect(translate(locale, "tenantCreation.create")).not.toBe("tenantCreation.create");
    }
  });

  it("includes the published-offering readiness issue in every supported locale", () => {
    for (const locale of supportedLocales) expect(translate(locale, "tenantReadiness.issuePublishedOffering")).not.toBe("tenantReadiness.issuePublishedOffering");
  });

  it("collapses the goal picker label when the name only repeats the domain", () => {
    const t = (key: TranslationKey) => translate("id", key);
    expect(goalPickerLabel(t, "KEMANDIRIAN", "Kemandirian")).toBe("Kemandirian");
    expect(goalPickerLabel(t, "KEMANDIRIAN", "Makan sendiri")).toBe("Kemandirian · Makan sendiri");
  });

  it("keeps enum labels localized", () => {
    expect(translate("id", "status.PENDING_PAYMENT")).toBe("Menunggu pembayaran");
    expect(translate("en", "status.PENDING_PAYMENT")).toBe("Awaiting payment");
  });

  it("keeps rendering when a runtime translation key is unavailable", () => {
    expect(translate("id", "tenant.unavailable" as TranslationKey)).toBe("tenant.unavailable");
  });
});
