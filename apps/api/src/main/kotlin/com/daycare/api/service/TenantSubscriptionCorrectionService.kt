// Mories Deo Hutapea,S.E.,S.Kom
package com.daycare.api.service

import com.daycare.api.domain.Role
import com.daycare.api.domain.TenantPaymentStatus
import com.daycare.api.persistence.MembershipRepository
import com.daycare.api.persistence.OrganizationRepository
import com.daycare.api.persistence.TenantPaymentAdjustment
import com.daycare.api.persistence.TenantPaymentAdjustmentRepository
import com.daycare.api.persistence.TenantPaymentCorrectionRequest
import com.daycare.api.persistence.TenantPaymentCorrectionRequestRepository
import com.daycare.api.persistence.TenantPaymentRepository
import com.daycare.api.persistence.TenantSubscriptionAuditEvent
import com.daycare.api.persistence.TenantSubscriptionAuditEventRepository
import com.daycare.api.persistence.TenantSubscriptionRepository
import org.springframework.beans.factory.annotation.Value
import org.springframework.data.domain.PageRequest
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.math.BigDecimal
import java.security.MessageDigest
import java.time.Instant
import java.util.UUID

enum class TenantPaymentCorrectionCategory { AMOUNT_MISMATCH, WRONG_REFERENCE, WRONG_PROOF_OR_INVOICE, DUPLICATE_OR_OVERPAYMENT }

data class CreateTenantPaymentCorrectionRequest(
    val category: TenantPaymentCorrectionCategory,
    val description: String,
    val proposedAmount: BigDecimal? = null,
    val proposedReference: String? = null,
)

data class TenantPaymentCorrectionResponse(
    val id: UUID,
    val organizationId: UUID,
    val organizationName: String,
    val paymentId: UUID,
    val invoiceNumber: String,
    val paymentAmount: BigDecimal,
    val paymentStatus: TenantPaymentStatus,
    val category: TenantPaymentCorrectionCategory,
    val description: String,
    val proposedAmount: BigDecimal?,
    val proposedReference: String?,
    val status: String,
    val createdAt: Instant,
    val reviewReason: String?,
    val adjustmentKind: String?,
    val adjustmentAmount: BigDecimal?,
)

data class ReviewTenantPaymentCorrectionRequest(val approved: Boolean, val reason: String)

@Service
class TenantSubscriptionCorrectionService(
    private val access: AccessService,
    private val platformAccess: PlatformAccessService,
    private val organizations: OrganizationRepository,
    private val payments: TenantPaymentRepository,
    private val corrections: TenantPaymentCorrectionRequestRepository,
    private val adjustments: TenantPaymentAdjustmentRepository,
    private val subscriptions: TenantSubscriptionRepository,
    private val audits: TenantSubscriptionAuditEventRepository,
    private val memberships: MembershipRepository,
    private val notifications: NotificationService,
    private val billingPolicy: TenantSubscriptionBillingPolicy,
    @Value("\${daycare.tenant-subscription.correction-enabled:false}") private val enabled: Boolean,
) {
    @Transactional
    fun create(jwt: Jwt, organizationId: UUID, paymentId: UUID, idempotencyKey: UUID, request: CreateTenantPaymentCorrectionRequest): TenantPaymentCorrectionResponse {
        requireEnabled()
        val scope = access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN), allowSubscriptionRestrictedForRoles = setOf(Role.STAFF_ADMIN))
        val description = request.description.trim()
        require(description.length in 3..1000) { "A correction explanation of 3 to 1000 characters is required" }
        val proposedReference = request.proposedReference?.trim()?.takeIf(String::isNotBlank)
        require(proposedReference == null || proposedReference.length <= 200) { "Correction reference must not exceed 200 characters" }
        val amount = request.proposedAmount
        if (request.category in setOf(TenantPaymentCorrectionCategory.AMOUNT_MISMATCH, TenantPaymentCorrectionCategory.DUPLICATE_OR_OVERPAYMENT)) {
            require(amount != null) { "A proposed amount is required for this correction type" }
            billingPolicy.requireAllowedAmount(amount)
        } else {
            require(amount == null) { "A proposed amount is not applicable to this correction type" }
        }
        if (request.category == TenantPaymentCorrectionCategory.WRONG_REFERENCE) require(proposedReference != null) { "A corrected payment reference is required" }
        val payment = payments.findWithLockById(paymentId) ?: throw IllegalArgumentException("Tenant payment was not found")
        require(payment.organizationId == organizationId) { "Tenant payment was not found" }
        val payloadHash = sha256("$paymentId|${request.category}|$description|${amount?.stripTrailingZeros()?.toPlainString()}|$proposedReference")
        corrections.findByOrganizationIdAndRequestedByUserIdAndRequestIdempotencyKey(organizationId, scope.user.id, idempotencyKey)?.let { existing ->
            if (existing.requestPayloadHash != payloadHash) throw TenantSubscriptionIdempotencyConflict()
            return response(existing)
        }
        require(corrections.findFirstByOrganizationIdAndPaymentIdAndStatus(organizationId, paymentId, PENDING) == null) { "A correction request is already awaiting review" }
        val subscription = subscriptions.findByOrganizationId(organizationId) ?: throw IllegalArgumentException("Tenant subscription was not found")
        val correction = corrections.save(TenantPaymentCorrectionRequest(organizationId = organizationId, paymentId = paymentId, requestedByUserId = scope.user.id, category = request.category.name, description = description, proposedAmount = amount, proposedReference = proposedReference, requestIdempotencyKey = idempotencyKey, requestPayloadHash = payloadHash))
        audits.save(TenantSubscriptionAuditEvent(organizationId = organizationId, subscriptionId = subscription.id, actorUserId = scope.user.id, action = "PAYMENT_CORRECTION_SUBMITTED", reason = description, beforeValue = "payment=${payment.id};amount=${payment.amount};status=${payment.status}", afterValue = "category=${correction.category};proposedAmount=$amount;proposedReference=$proposedReference", referenceId = correction.id, correlationId = idempotencyKey))
        return response(correction)
    }

    @Transactional(readOnly = true)
    fun ownRequests(jwt: Jwt, organizationId: UUID, paymentId: UUID): List<TenantPaymentCorrectionResponse> {
        requireEnabled()
        access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN), allowSubscriptionRestrictedForRoles = setOf(Role.STAFF_ADMIN))
        val payment = requirePayment(organizationId, paymentId)
        return corrections.findAllByOrganizationIdAndPaymentIdOrderByCreatedAtDesc(organizationId, paymentId).map { response(it, payment) }
    }

    @Transactional(readOnly = true)
    fun reviewQueue(jwt: Jwt, page: Int, size: Int): TenantSubscriptionReviewPage<TenantPaymentCorrectionResponse> {
        platformAccess.requirePlatformAdmin(jwt)
        require(page >= 0 && size in 1..50) { "Invalid tenant payment correction page" }
        if (!enabled) return TenantSubscriptionReviewPage(emptyList(), page, size, false)
        val result = corrections.findAllByStatusOrderByCreatedAtAsc(PENDING, PageRequest.of(page, size))
        return TenantSubscriptionReviewPage(result.content.map(::response), result.number, result.size, result.hasNext())
    }

    @Transactional
    fun review(jwt: Jwt, correctionId: UUID, idempotencyKey: UUID, request: ReviewTenantPaymentCorrectionRequest): TenantPaymentCorrectionResponse {
        requireEnabled()
        val actor = platformAccess.requirePlatformAdmin(jwt)
        val reason = request.reason.trim()
        require(reason.length in 3..1000) { "A review reason of 3 to 1000 characters is required" }
        val payloadHash = sha256("$correctionId|${request.approved}|$reason")
        corrections.findByReviewedByUserIdAndReviewIdempotencyKey(actor.id, idempotencyKey)?.let { existing ->
            if (existing.reviewPayloadHash != payloadHash) throw TenantSubscriptionIdempotencyConflict()
            return response(existing)
        }
        val initial = corrections.findById(correctionId).orElseThrow { IllegalArgumentException("Tenant payment correction was not found") }
        val payment = payments.findWithLockById(initial.paymentId) ?: throw IllegalArgumentException("Tenant payment was not found")
        val correction = corrections.findWithLockById(correctionId) ?: throw IllegalArgumentException("Tenant payment correction was not found")
        require(correction.status == PENDING) { "Tenant payment correction is no longer awaiting review" }
        require(payment.organizationId == correction.organizationId) { "Tenant payment was not found" }
        val subscription = subscriptions.findByOrganizationId(correction.organizationId) ?: throw IllegalArgumentException("Tenant subscription was not found")
        correction.status = if (request.approved) APPROVED else REJECTED
        correction.reviewedAt = Instant.now()
        correction.reviewedByUserId = actor.id
        correction.reviewReason = reason
        correction.reviewIdempotencyKey = idempotencyKey
        correction.reviewPayloadHash = payloadHash
        if (request.approved) {
            val proposed = correction.proposedAmount
            val difference = proposed?.subtract(payment.amount)?.abs() ?: BigDecimal.ZERO
            val kind = when {
                proposed == null || difference.compareTo(BigDecimal.ZERO) == 0 -> "REVIEWED_NO_AMOUNT_CHANGE"
                proposed > payment.amount -> "UNDERPAYMENT"
                else -> "EXCESS_CREDIT"
            }
            adjustments.save(TenantPaymentAdjustment(organizationId = correction.organizationId, paymentId = payment.id, correctionRequestId = correction.id, approvedByUserId = actor.id, kind = kind, amount = difference, reason = reason))
        }
        audits.save(TenantSubscriptionAuditEvent(organizationId = correction.organizationId, subscriptionId = subscription.id, actorUserId = actor.id, action = if (request.approved) "PAYMENT_CORRECTION_APPROVED" else "PAYMENT_CORRECTION_REJECTED", reason = reason, beforeValue = "${PENDING}:${correction.category}:${correction.proposedAmount}", afterValue = correction.status, referenceId = correction.id, correlationId = idempotencyKey))
        memberships.findAllByOrganizationId(correction.organizationId).filter { it.active && it.role == Role.STAFF_ADMIN && it.userId == correction.requestedByUserId }.forEach { membership ->
            notifications.notify(correction.organizationId, membership.userId, if (request.approved) "Koreksi pembayaran disetujui" else "Koreksi pembayaran ditolak", "Pengajuan koreksi ${payment.invoiceNumber}: $reason", "/tenant-subscription")
        }
        return response(correction, payment)
    }

    private fun requirePayment(organizationId: UUID, paymentId: UUID) = payments.findById(paymentId).orElseThrow { IllegalArgumentException("Tenant payment was not found") }
        .also { require(it.organizationId == organizationId) { "Tenant payment was not found" } }

    private fun response(correction: TenantPaymentCorrectionRequest): TenantPaymentCorrectionResponse {
        val payment = payments.findById(correction.paymentId).orElseThrow { IllegalStateException("A tenant payment correction references a missing payment") }
        return response(correction, payment)
    }

    private fun response(correction: TenantPaymentCorrectionRequest, payment: com.daycare.api.persistence.TenantPayment): TenantPaymentCorrectionResponse {
        val organization = organizations.findById(correction.organizationId).orElseThrow { IllegalStateException("A tenant payment correction references a missing organization") }
        val adjustment = adjustments.findByCorrectionRequestId(correction.id)
        return TenantPaymentCorrectionResponse(correction.id, correction.organizationId, organization.name, correction.paymentId, payment.invoiceNumber, payment.amount, payment.status, TenantPaymentCorrectionCategory.valueOf(correction.category), correction.description, correction.proposedAmount, correction.proposedReference, correction.status, correction.createdAt, correction.reviewReason, adjustment?.kind, adjustment?.amount)
    }

    private fun requireEnabled() { check(enabled) { "Tenant subscription payment correction is not enabled" } }
    private fun sha256(value: String): String = MessageDigest.getInstance("SHA-256").digest(value.toByteArray(Charsets.UTF_8)).joinToString("") { "%02x".format(it) }

    companion object {
        private const val PENDING = "PENDING"
        private const val APPROVED = "APPROVED"
        private const val REJECTED = "REJECTED"
    }
}
