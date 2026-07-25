package com.daycare.api.service

import java.math.BigDecimal

data class OvertimePricingTier(val durationMinutes: Int, val amount: BigDecimal)

/**
 * Bills cumulative overtime blocks. A block is charged as soon as pickup enters it;
 * time beyond the final configured block is capped at that final cumulative amount.
 */
fun calculateCappedCumulativeOvertimeAmount(overtimeMinutes: Int, tiers: List<OvertimePricingTier>): BigDecimal {
    var remainingMinutes = overtimeMinutes
    return tiers.fold(BigDecimal.ZERO) { total, tier ->
        if (remainingMinutes <= 0) total else {
            remainingMinutes = (remainingMinutes - tier.durationMinutes).coerceAtLeast(0)
            total + tier.amount
        }
    }
}
