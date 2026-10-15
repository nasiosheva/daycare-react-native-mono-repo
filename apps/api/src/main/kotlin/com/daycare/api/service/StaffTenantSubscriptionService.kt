// Mories Deo Hutapea,S.E.,S.Kom
package com.daycare.api.service

import com.daycare.api.domain.Role
import com.daycare.api.domain.TenantSubscriptionPlan
import com.daycare.api.domain.TenantSubscriptionStatus
import com.daycare.api.persistence.OrganizationRepository
import com.daycare.api.persistence.TenantPaymentRepository
import com.daycare.api.persistence.TenantSubscriptionRepository
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.beans.factory.annotation.Value
import java.math.BigDecimal
import java.time.LocalDate
import java.time.Instant
import java.util.UUID

data class StaffTenantSubscriptionResponse(
    val organizationId: UUID,
    val organizationName: String,
    val plan: TenantSubscriptionPlan,
    val status: TenantSubscriptionStatus,
    val periodStart: LocalDate,
    val periodEnd: LocalDate,
    val trialEndsAt: LocalDate?,
    val monthlyFee: BigDecimal?,
    val gracePeriodDays: Int,
    val payments: List<TenantPaymentResponse>,
    val paymentProofEnabled: Boolean,
    val correctionEnabled: Boolean,
    val paymentInstructions: String?,
)

@Service
class StaffTenantSubscriptionService(
    private val access: AccessService,
    private val organizations: OrganizationRepository,
    private val subscriptions: TenantSubscriptionRepository,
    private val payments: TenantPaymentRepository,
    private val renewals: TenantSubscriptionRenewalService,
    private val lifecycle: TenantSubscriptionLifecyclePolicy,
    @Value("\${daycare.tenant-subscription.payment-proof-enabled:false}") private val paymentProofEnabled: Boolean = false,
    @Value("\${daycare.tenant-subscription.correction-enabled:false}") private val correctionEnabled: Boolean = false,
    @Value("\${daycare.tenant-subscription.payment-instructions:}") private val paymentInstructions: String = "",
) {
    @Transactional(readOnly = true)
    fun current(jwt: Jwt, organizationId: UUID): StaffTenantSubscriptionResponse {
        requireStaffAdmin(jwt, organizationId)
        val organization = organizations.findById(organizationId).orElseThrow { IllegalArgumentException("Tenant was not found") }
        val subscription = subscriptions.findByOrganizationId(organizationId)
            ?: throw IllegalArgumentException("Tenant subscription was not found")
        return StaffTenantSubscriptionResponse(
            organizationId = organization.id,
            organizationName = organization.name,
            plan = subscription.plan,
            status = lifecycle.effectiveStatus(subscription, LocalDate.now(BILLING_TIME_ZONE)),
            periodStart = subscription.periodStart,
            periodEnd = subscription.periodEnd,
            trialEndsAt = subscription.trialEndsAt,
            monthlyFee = subscription.monthlyFee,
            gracePeriodDays = subscription.nextGracePeriodDays ?: subscription.gracePeriodDays,
            payments = payments.findAllByOrganizationIdOrderByCreatedAtDesc(organizationId).map {
                TenantPaymentResponse(it.id, it.invoiceNumber, it.amount, it.status, it.dueDate, it.paidAt, it.periodStart, it.periodEnd, it.coveragePeriodStart, it.coveragePeriodEnd, it.planCodeSnapshot)
            },
            paymentProofEnabled = paymentProofEnabled,
            correctionEnabled = correctionEnabled,
            paymentInstructions = paymentInstructions.trim().ifBlank { null },
        )
    }

    @Transactional
    fun renew(jwt: Jwt, organizationId: UUID, idempotencyKey: UUID): TenantPaymentResponse {
        val scope = requireStaffAdmin(jwt, organizationId)
        val payment = renewals.renew(organizationId, scope.user.id, idempotencyKey)
        return TenantPaymentResponse(payment.id, payment.invoiceNumber, payment.amount, payment.status, payment.dueDate, payment.paidAt, payment.periodStart, payment.periodEnd, payment.coveragePeriodStart, payment.coveragePeriodEnd, payment.planCodeSnapshot)
    }

    private fun requireStaffAdmin(jwt: Jwt, organizationId: UUID) = access.require(
        jwt,
        organizationId,
        setOf(Role.STAFF_ADMIN),
        allowSubscriptionRestrictedForRoles = setOf(Role.STAFF_ADMIN),
    )
}
