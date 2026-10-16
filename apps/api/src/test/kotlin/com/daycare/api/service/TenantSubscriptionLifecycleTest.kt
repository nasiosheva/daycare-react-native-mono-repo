// Mories Deo Hutapea,S.E.,S.Kom
package com.daycare.api.service

import com.daycare.api.domain.TenantSubscriptionStatus
import com.daycare.api.persistence.TenantSubscription
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import java.time.LocalDate

class TenantSubscriptionLifecycleTest {
    private val today = LocalDate.of(2026, 10, 14)

    @Test
    fun `period end is inclusive and grace starts the following WIB calendar day`() {
        val subscription = TenantSubscription(status = TenantSubscriptionStatus.ACTIVE, periodEnd = today, gracePeriodDays = 7)

        assertEquals(TenantSubscriptionStatus.ACTIVE, effectiveTenantSubscriptionStatus(subscription, today))
        assertEquals(TenantSubscriptionStatus.GRACE, effectiveTenantSubscriptionStatus(subscription, today.plusDays(1)))
        assertEquals(TenantSubscriptionStatus.GRACE, effectiveTenantSubscriptionStatus(subscription, today.plusDays(7)))
        assertEquals(TenantSubscriptionStatus.EXPIRED, effectiveTenantSubscriptionStatus(subscription, today.plusDays(8)))
    }

    @Test
    fun `zero grace expires immediately after period end`() {
        val subscription = TenantSubscription(status = TenantSubscriptionStatus.ACTIVE, periodEnd = today, gracePeriodDays = 0)

        assertEquals(TenantSubscriptionStatus.ACTIVE, effectiveTenantSubscriptionStatus(subscription, today))
        assertEquals(TenantSubscriptionStatus.EXPIRED, effectiveTenantSubscriptionStatus(subscription, today.plusDays(1)))
    }

    @Test
    fun `disabled rollout keeps overdue subscriptions expired while preview can evaluate grace`() {
        val subscription = TenantSubscription(status = TenantSubscriptionStatus.ACTIVE, periodEnd = today, gracePeriodDays = 7)
        val policy = TenantSubscriptionLifecyclePolicy(graceEnabled = false)

        assertEquals(TenantSubscriptionStatus.EXPIRED, policy.effectiveStatus(subscription, today.plusDays(1)))
        assertEquals(TenantSubscriptionStatus.GRACE, policy.previewStatusWithGrace(subscription, today.plusDays(1)))
        assertEquals(TenantSubscriptionStatus.ACTIVE, subscription.status)
    }

    @Test
    fun `manual suspension overrides grace and expired trial is pending payment`() {
        val suspended = TenantSubscription(
            status = TenantSubscriptionStatus.SUSPENDED,
            periodEnd = today.minusDays(1),
            gracePeriodDays = 7,
            nextPeriodStart = today,
            nextPeriodEnd = today.plusMonths(1),
        )
        val trial = TenantSubscription(status = TenantSubscriptionStatus.TRIAL, trialEndsAt = today.minusDays(1))

        assertEquals(TenantSubscriptionStatus.SUSPENDED, effectiveTenantSubscriptionStatus(suspended, today))
        assertEquals(TenantSubscriptionStatus.PENDING_PAYMENT, effectiveTenantSubscriptionStatus(trial, today))
    }

    @Test
    fun `paid next period takes effect on its start date without changing current period earlier`() {
        val subscription = TenantSubscription(status = TenantSubscriptionStatus.ACTIVE, periodEnd = today, gracePeriodDays = 7, nextPeriodStart = today.plusDays(1), nextPeriodEnd = today.plusMonths(1))

        assertEquals(TenantSubscriptionStatus.ACTIVE, effectiveTenantSubscriptionStatus(subscription, today))
        assertEquals(TenantSubscriptionStatus.ACTIVE, effectiveTenantSubscriptionStatus(subscription, today.plusDays(1)))
        assertEquals(TenantSubscriptionStatus.ACTIVE, effectiveTenantSubscriptionStatus(subscription, today.plusMonths(1)))
        assertEquals(TenantSubscriptionStatus.GRACE, effectiveTenantSubscriptionStatus(subscription, today.plusMonths(1).plusDays(1)))
    }

    @Test
    fun `pending grace configuration does not shorten the current period grace`() {
        val subscription = TenantSubscription(status = TenantSubscriptionStatus.ACTIVE, periodEnd = today, gracePeriodDays = 7, nextGracePeriodDays = 0)

        assertEquals(TenantSubscriptionStatus.GRACE, effectiveTenantSubscriptionStatus(subscription, today.plusDays(5)))
    }

    @Test
    fun `pending grace configuration applies to the paid next period`() {
        val nextEnd = today.plusMonths(1)
        val subscription = TenantSubscription(status = TenantSubscriptionStatus.ACTIVE, periodEnd = today, gracePeriodDays = 7, nextPeriodStart = today.plusDays(1), nextPeriodEnd = nextEnd, nextGracePeriodDays = 0)

        assertEquals(TenantSubscriptionStatus.EXPIRED, effectiveTenantSubscriptionStatus(subscription, nextEnd.plusDays(1)))
    }
}
