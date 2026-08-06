import { describe, expect, it } from "vitest";
import { appBrandName, appBrandNameUppercase, appCopyright } from "./brand";

describe("application brand", () => {
  it("uses the approved Usia Emas display name consistently", () => {
    expect(appBrandName).toBe("Usia Emas");
    expect(appBrandNameUppercase).toBe("USIA EMAS");
    expect(appCopyright).toBe("© 2026 Usia Emas App");
  });
});
