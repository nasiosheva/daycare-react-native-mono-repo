// Mories Deo Hutapea,S.E.,S.Kom
package com.daycare.api.service

import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Test
import java.math.BigDecimal

class TenantSubscriptionBillingPolicyTest {
    @Test
    fun `accepts whole rupiah amount up to configured ceiling`() {
        val policy = TenantSubscriptionBillingPolicy("2500000")

        policy.requireAllowedAmount(BigDecimal("2500000"))
        policy.requireAllowedAmount(BigDecimal("1000"))
    }

    @Test
    fun `rejects amount above ceiling and fractional rupiah`() {
        val policy = TenantSubscriptionBillingPolicy("2500000")

        assertThrows(IllegalArgumentException::class.java) { policy.requireAllowedAmount(BigDecimal("2500001")) }
        assertThrows(IllegalArgumentException::class.java) { policy.requireAllowedAmount(BigDecimal("100.5")) }
    }

    @Test
    fun `fails closed when ceiling is not configured`() {
        val policy = TenantSubscriptionBillingPolicy("")

        assertThrows(IllegalStateException::class.java) { policy.requireAllowedAmount(BigDecimal("1000")) }
    }
}
