import { describe, expect, it } from "vitest";
import { ageInMonths } from "./childAge";

describe("ageInMonths", () => {
  it("computes whole months elapsed since the birth date", () => {
    expect(ageInMonths("2024-01-15", new Date(2026, 6, 15))).toBe(30);
  });

  it("does not round up before the birth day of the month has passed", () => {
    expect(ageInMonths("2024-01-15", new Date(2026, 6, 14))).toBe(29);
  });

  it("never returns a negative age", () => {
    expect(ageInMonths("2026-12-01", new Date(2026, 6, 15))).toBe(0);
  });
});
