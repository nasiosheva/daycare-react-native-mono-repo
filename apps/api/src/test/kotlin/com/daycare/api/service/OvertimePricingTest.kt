package com.daycare.api.service

import java.math.BigDecimal
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test

class OvertimePricingTest {
    private val tiers = listOf(
        OvertimePricingTier(15, BigDecimal("100000")),
        OvertimePricingTier(20, BigDecimal("150000")),
    )

    @Test
    fun `charges cumulative blocks and caps after the final block`() {
        assertEquals(BigDecimal("100000"), calculateCappedCumulativeOvertimeAmount(15, tiers))
        assertEquals(BigDecimal("250000"), calculateCappedCumulativeOvertimeAmount(16, tiers))
        assertEquals(BigDecimal("250000"), calculateCappedCumulativeOvertimeAmount(90, tiers))
    }
}
