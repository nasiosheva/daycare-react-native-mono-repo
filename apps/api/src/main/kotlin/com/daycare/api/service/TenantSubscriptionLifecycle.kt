// Mories Deo Hutapea,S.E.,S.Kom
package com.daycare.api.service

import com.daycare.api.domain.TenantSubscriptionStatus
import com.daycare.api.persistence.TenantSubscription
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Component
import java.time.LocalDate
import java.time.ZoneId

internal val BILLING_TIME_ZONE: ZoneId = ZoneId.of("Asia/Jakarta")

internal fun effectiveTenantSubscriptionStatus(
    subscription: TenantSubscription,
    today: LocalDate,
    graceEnabled: Boolean = true,
): TenantSubscriptionStatus {
    // A manual suspension is an immediate administrative restriction and must
    // not be overridden by an already-paid future period.
    if (subscription.status == TenantSubscriptionStatus.SUSPENDED) return TenantSubscriptionStatus.SUSPENDED

    val nextStart = subscription.nextPeriodStart
    val nextEnd = subscription.nextPeriodEnd
    if (nextStart != null && nextEnd != null && !today.isBefore(nextStart) && !today.isAfter(nextEnd)) return TenantSubscriptionStatus.ACTIVE
    return when (subscription.status) {
    TenantSubscriptionStatus.TRIAL -> if (subscription.trialEndsAt?.isBefore(today) == true) TenantSubscriptionStatus.PENDING_PAYMENT else TenantSubscriptionStatus.TRIAL
    TenantSubscriptionStatus.PENDING_PAYMENT -> TenantSubscriptionStatus.PENDING_PAYMENT
    TenantSubscriptionStatus.ACTIVE, TenantSubscriptionStatus.GRACE -> {
        val nextPeriodIsCurrentOrPast = nextStart != null && nextEnd != null && !today.isBefore(nextStart)
        val paidPeriodEnd = if (nextPeriodIsCurrentOrPast) nextEnd!! else subscription.periodEnd
        val graceDays = if (nextPeriodIsCurrentOrPast) subscription.nextGracePeriodDays ?: subscription.gracePeriodDays else subscription.gracePeriodDays
        when {
        !paidPeriodEnd.isBefore(today) -> TenantSubscriptionStatus.ACTIVE
        graceEnabled && graceDays > 0 && !today.isAfter(paidPeriodEnd.plusDays(graceDays.toLong())) -> TenantSubscriptionStatus.GRACE
        else -> TenantSubscriptionStatus.EXPIRED
        }
    }
    else -> subscription.status
}
}

@Component
class TenantSubscriptionLifecyclePolicy(
    @Value("\${daycare.tenant-subscription.grace-enabled:false}")
    private val graceEnabled: Boolean = false,
) {
    fun effectiveStatus(subscription: TenantSubscription, today: LocalDate): TenantSubscriptionStatus =
        effectiveTenantSubscriptionStatus(subscription, today, graceEnabled)

    fun previewStatusWithGrace(subscription: TenantSubscription, today: LocalDate): TenantSubscriptionStatus =
        effectiveTenantSubscriptionStatus(subscription, today, graceEnabled = true)

    fun isGraceEnabled(): Boolean = graceEnabled
}
