// Mories Deo Hutapea,S.E.,S.Kom
import { describe, expect, it } from "vitest";
import { normalizeBrowserUrl } from "./normalizeBrowserUrl";

describe("normalizeBrowserUrl", () => {
  it("adds HTTPS to a host entered without a scheme", () => {
    expect(normalizeBrowserUrl("example.com/promo")).toBe("https://example.com/promo");
  });

  it("preserves and normalizes a valid HTTPS address", () => {
    expect(normalizeBrowserUrl(" https://example.com/path?q=one ")).toBe("https://example.com/path?q=one");
  });

  it.each(["", "   ", "http://example.com", "javascript:alert(1)", "https://user:password@example.com", "not a url"]) (
    "rejects unsafe or invalid input: %s",
    (value) => expect(normalizeBrowserUrl(value)).toBeNull(),
  );
});
