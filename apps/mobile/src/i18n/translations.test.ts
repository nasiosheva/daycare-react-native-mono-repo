import { describe, expect, it } from "vitest";
import { translate, type TranslationKey } from "./translations";

describe("translations", () => {
  it("uses the active locale and interpolates values", () => {
    expect(translate("id", "home.greeting", { name: "Ayu" })).toBe("Halo, Ayu");
    expect(translate("en", "home.greeting", { name: "Ayu" })).toBe("Hello, Ayu");
  });

  it("keeps enum labels localized", () => {
    expect(translate("id", "status.PENDING_PAYMENT")).toBe("Menunggu pembayaran");
    expect(translate("en", "status.PENDING_PAYMENT")).toBe("Awaiting payment");
  });

  it("keeps rendering when a runtime translation key is unavailable", () => {
    expect(translate("id", "tenant.unavailable" as TranslationKey)).toBe("tenant.unavailable");
  });
});
