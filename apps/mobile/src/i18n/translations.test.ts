import { describe, expect, it } from "vitest";
import { translate } from "./translations";

describe("translations", () => {
  it("uses the active locale and interpolates values", () => {
    expect(translate("id", "home.greeting", { name: "Ayu" })).toBe("Halo, Ayu");
    expect(translate("en", "home.greeting", { name: "Ayu" })).toBe("Hello, Ayu");
  });

  it("keeps enum labels localized", () => {
    expect(translate("id", "status.PENDING_PAYMENT")).toBe("Menunggu pembayaran");
    expect(translate("en", "status.PENDING_PAYMENT")).toBe("Awaiting payment");
  });
});
