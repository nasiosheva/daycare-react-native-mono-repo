import { describe, expect, it } from "vitest";
import { pricingOptions } from "./pricingOptions";

describe("pricingOptions", () => {
  it("only includes tiers that have a price set", () => {
    expect(pricingOptions({ dailyPrice: 50_000, weeklyPrice: null, monthlyPrice: 500_000 })).toEqual([
      { type: "DAILY", price: 50_000 },
      { type: "MONTHLY", price: 500_000 },
    ]);
  });

  it("returns an empty list when no tier is set", () => {
    expect(pricingOptions({ dailyPrice: null, weeklyPrice: null, monthlyPrice: null })).toEqual([]);
  });
});
