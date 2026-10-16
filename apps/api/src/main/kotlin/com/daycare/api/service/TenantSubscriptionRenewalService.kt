// Mories Deo Hutapea,S.E.,S.Kom
package com.daycare.api.service

import com.daycare.api.domain.TenantPaymentStatus
import com.daycare.api.domain.TenantSubscriptionStatus
import com.daycare.api.persistence.TenantPayment
import com.daycare.api.persistence.TenantPaymentRepository
import com.daycare.api.persistence.TenantSubscriptionAuditEvent
import com.daycare.api.persistence.TenantSubscriptionAuditEventRepository
import com.daycare.api.persistence.TenantSubscriptionRepository
import com.daycare.api.persistence.TenantSubscription
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.math.BigDecimal
import java.security.MessageDigest
import java.time.LocalDate
import java.util.UUID

data class TenantSubscriptionRenewalPreview(val periodStart: LocalDate, val periodEnd: LocalDate, val dueDate: LocalDate)

@Service
class TenantSubscriptionRenewalService(
    private val subscriptions: TenantSubscriptionRepository,
    private val payments: TenantPaymentRepository,
    private val billingPolicy: TenantSubscriptionBillingPolicy,
    private val lifecycle: TenantSubscriptionLifecyclePolicy,
    private val audits: TenantSubscriptionAuditEventRepository,
    private val invoiceNumbers: TenantSubscriptionInvoiceNumberGenerator,
) {
    @Transactional
    fun renew(organizationId: UUID, actorUserId: UUID, idempotencyKey: UUID, requestedAmount: BigDecimal? = null): TenantPayment {
        val subscription = subscriptions.findByOrganizationIdForUpdate(organizationId)
            ?: throw IllegalArgumentException("Tenant subscription was not found")
        val requestedAmountKey = requestedAmount?.stripTrailingZeros()?.toPlainString() ?: "USE_CURRENT_PRICE"
        val payloadHash = sha256("$organizationId|$actorUserId|TENANT_SUBSCRIPTION_RENEWAL|${subscription.id}|$requestedAmountKey")
        payments.findByOrganizationIdAndIdempotencyKey(organizationId, idempotencyKey)?.let { existing ->
            if (existing.idempotencyPayloadHash != payloadHash) throw TenantSubscriptionIdempotencyConflict()
            return existing
        }

        val amount = requestedAmount ?: subscription.monthlyFee
            ?: throw IllegalArgumentException("Monthly fee is required to renew a tenant subscription")

        billingPolicy.requireAllowedAmount(amount)
        val today = LocalDate.now(BILLING_TIME_ZONE)
        val status = lifecycle.effectiveStatus(subscription, today)
        require(status in setOf(TenantSubscriptionStatus.TRIAL, TenantSubscriptionStatus.ACTIVE, TenantSubscriptionStatus.GRACE, TenantSubscriptionStatus.EXPIRED)) {
            "This tenant subscription cannot be renewed in its current state"
        }
        require(payments.findAllByOrganizationIdOrderByCreatedAtDesc(organizationId).none { it.status == TenantPaymentStatus.PENDING }) {
            "A tenant payment is already awaiting review or payment"
        }

        val terms = renewalTerms(subscription, status, today)
        val payment = payments.save(
            TenantPayment(
                invoiceNumber = invoiceNumbers.next(today),
                subscriptionId = subscription.id,
                organizationId = organizationId,
                amount = amount,
                dueDate = terms.dueDate,
                periodStart = terms.periodStart,
                periodEnd = terms.periodEnd,
                planCodeSnapshot = subscription.plan.name,
                idempotencyKey = idempotencyKey,
                idempotencyPayloadHash = payloadHash,
            ),
        )
        audits.save(
            TenantSubscriptionAuditEvent(
                organizationId = organizationId,
                subscriptionId = subscription.id,
                actorUserId = actorUserId,
                action = "RENEWAL_PAYMENT_CREATED",
                reason = "Renewal payment created",
                afterValue = "${terms.periodStart}/${terms.periodEnd}:${subscription.plan.name}:$amount",
                referenceId = payment.id,
                correlationId = idempotencyKey,
            ),
        )
        return payment
    }

    fun previewTerms(subscription: TenantSubscription, today: LocalDate): TenantSubscriptionRenewalPreview? {
        val status = lifecycle.effectiveStatus(subscription, today)
        if (status !in setOf(TenantSubscriptionStatus.TRIAL, TenantSubscriptionStatus.ACTIVE, TenantSubscriptionStatus.GRACE, TenantSubscriptionStatus.EXPIRED)) return null
        return renewalTerms(subscription, status, today)
    }

    private fun renewalTerms(subscription: TenantSubscription, status: TenantSubscriptionStatus, today: LocalDate): TenantSubscriptionRenewalPreview {
        val currentPeriodEnd = subscription.nextPeriodEnd ?: if (status == TenantSubscriptionStatus.TRIAL) {
            subscription.trialEndsAt ?: subscription.periodEnd
        } else {
            subscription.periodEnd
        }
        val carriesCoverage = status in setOf(TenantSubscriptionStatus.TRIAL, TenantSubscriptionStatus.ACTIVE, TenantSubscriptionStatus.GRACE)
        val periodStart = if (carriesCoverage) currentPeriodEnd.plusDays(1) else today
        return TenantSubscriptionRenewalPreview(
            periodStart = periodStart,
            periodEnd = periodStart.plusMonths(1).minusDays(1),
            dueDate = if (carriesCoverage) currentPeriodEnd else today.plusDays(7),
        )
    }

    private fun sha256(value: String): String = MessageDigest.getInstance("SHA-256")
        .digest(value.toByteArray()).joinToString("") { "%02x".format(it) }
}
