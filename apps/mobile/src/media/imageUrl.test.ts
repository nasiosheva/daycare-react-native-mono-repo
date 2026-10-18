// Mories Deo Hutapea,S.E.,S.Kom
import { describe, expect, it } from "vitest";
import { isValidHttpsImageUrl, isValidHttpsUrl } from "./imageUrl";

describe("isValidHttpsImageUrl", () => {
  it("accepts valid HTTPS URLs and rejects insecure, malformed, and oversized input", () => {
    expect(isValidHttpsImageUrl(" https://cdn.example/image.jpg ")).toBe(true);
    expect(isValidHttpsImageUrl("http://cdn.example/image.jpg")).toBe(false);
    expect(isValidHttpsImageUrl("https:///image.jpg")).toBe(false);
    expect(isValidHttpsImageUrl("text only")).toBe(false);
    expect(isValidHttpsImageUrl(`https://cdn.example/${"x".repeat(2048)}`)).toBe(false);
  });
});

describe("isValidHttpsUrl", () => {
  it("accepts only credential-free HTTPS URLs for external links", () => {
    expect(isValidHttpsUrl("https://example.org/info")).toBe(true);
    expect(isValidHttpsUrl("http://example.org/info")).toBe(false);
    expect(isValidHttpsUrl("https://user:secret@example.org/info")).toBe(false);
  });
});
