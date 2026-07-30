import { describe, expect, it } from "vitest";
import { capitalizeWords } from "./capitalizeWords";

describe("capitalizeWords", () => {
  it("capitalizes the first letter of every word", () => {
    expect(capitalizeWords("budi santoso")).toBe("Budi Santoso");
  });

  it("only forces the first letter of each word, leaving the rest untouched", () => {
    expect(capitalizeWords("bUDI sANTOSO")).toBe("BUDI SANTOSO");
  });

  it("handles single words, extra spaces, and empty input", () => {
    expect(capitalizeWords("budi")).toBe("Budi");
    expect(capitalizeWords("  budi   santoso  ")).toBe("  Budi   Santoso  ");
    expect(capitalizeWords("")).toBe("");
  });
});
