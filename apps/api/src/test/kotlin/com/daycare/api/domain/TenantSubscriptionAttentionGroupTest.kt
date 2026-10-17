package com.daycare.api.domain

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test

// Mories Deo Hutapea,S.E.,S.Kom
class TenantSubscriptionAttentionGroupTest {
    @Test
    fun `pending payment and grace statuses need attention`() {
        assertEquals(TenantSubscriptionAttentionGroup.ATTENTION, TenantSubscriptionStatus.PENDING_PAYMENT.attentionGroup())
        assertEquals(TenantSubscriptionAttentionGroup.ATTENTION, TenantSubscriptionStatus.GRACE.attentionGroup())
    }

    @Test
    fun `trial and active statuses are operating normally`() {
        assertEquals(TenantSubscriptionAttentionGroup.ACTIVE, TenantSubscriptionStatus.TRIAL.attentionGroup())
        assertEquals(TenantSubscriptionAttentionGroup.ACTIVE, TenantSubscriptionStatus.ACTIVE.attentionGroup())
    }

    @Test
    fun `suspended and expired statuses are restricted`() {
        assertEquals(TenantSubscriptionAttentionGroup.RESTRICTED, TenantSubscriptionStatus.SUSPENDED.attentionGroup())
        assertEquals(TenantSubscriptionAttentionGroup.RESTRICTED, TenantSubscriptionStatus.EXPIRED.attentionGroup())
    }
}
