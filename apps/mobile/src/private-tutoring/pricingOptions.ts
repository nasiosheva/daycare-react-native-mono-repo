import type { ServicePlanType } from "@daycare/core";

export type PricingOption = { type: ServicePlanType; price: number };

export function pricingOptions(service: { dailyPrice: number | null; weeklyPrice: number | null; monthlyPrice: number | null }): PricingOption[] {
  const options: PricingOption[] = [];
  if (service.dailyPrice != null) options.push({ type: "DAILY", price: service.dailyPrice });
  if (service.weeklyPrice != null) options.push({ type: "WEEKLY", price: service.weeklyPrice });
  if (service.monthlyPrice != null) options.push({ type: "MONTHLY", price: service.monthlyPrice });
  return options;
}
