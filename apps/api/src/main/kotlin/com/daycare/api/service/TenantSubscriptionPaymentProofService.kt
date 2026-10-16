// Mories Deo Hutapea,S.E.,S.Kom
package com.daycare.api.service

import com.daycare.api.domain.Role
import com.daycare.api.domain.TenantPaymentStatus
import com.daycare.api.persistence.MembershipRepository
import com.daycare.api.persistence.OrganizationRepository
import com.daycare.api.persistence.TenantPaymentProof
import com.daycare.api.persistence.TenantPaymentProofRepository
import com.daycare.api.persistence.TenantPaymentRepository
import com.daycare.api.persistence.TenantSubscriptionAuditEvent
import com.daycare.api.persistence.TenantSubscriptionAuditEventRepository
import com.daycare.api.persistence.TenantSubscriptionRepository
import com.daycare.api.persistence.UserProfileRepository
import org.springframework.beans.factory.annotation.Value
import org.springframework.data.domain.PageRequest
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.security.MessageDigest
import java.time.Instant
import java.util.Base64
import java.util.UUID

data class SubmitTenantPaymentProofRequest(
    val fileName: String,
    val contentType: String,
    val fileBase64: String,
)

data class TenantPaymentProofResponse(
    val id: UUID,
    val paymentId: UUID,
    val organizationId: UUID,
    val organizationName: String,
    val invoiceNumber: String,
    val paymentAmount: java.math.BigDecimal,
    val dueDate: java.time.LocalDate,
    val version: Int,
    val fileName: String,
    val contentType: String,
    val status: String,
    val uploadedAt: Instant,
    val reviewedAt: Instant?,
    val rejectionReason: String?,
)

data class TenantPaymentProofContentResponse(
    val id: UUID,
    val fileName: String,
    val contentType: String,
    val fileBase64: String,
)

data class ReviewTenantPaymentProofRequest(val approved: Boolean, val reason: String)
data class TenantSubscriptionFeatureStatus(val paymentProofEnabled: Boolean, val correctionEnabled: Boolean)
data class TenantSubscriptionReviewPage<T>(val items: List<T>, val page: Int, val size: Int, val hasNext: Boolean)

@Service
class TenantSubscriptionPaymentProofService(
    private val access: AccessService,
    private val platformAccess: PlatformAccessService,
    private val memberships: MembershipRepository,
    private val organizations: OrganizationRepository,
    private val subscriptions: TenantSubscriptionRepository,
    private val payments: TenantPaymentRepository,
    private val proofs: TenantPaymentProofRepository,
    private val audits: TenantSubscriptionAuditEventRepository,
    private val platformAdministration: PlatformAdministrationService,
    private val notifications: NotificationService,
    private val users: UserProfileRepository,
    @Value("\${daycare.tenant-subscription.payment-proof-enabled:false}") private val enabled: Boolean,
    @Value("\${daycare.tenant-subscription.correction-enabled:false}") private val correctionEnabled: Boolean = false,
) {
    @Transactional
    fun submit(jwt: Jwt, organizationId: UUID, paymentId: UUID, idempotencyKey: UUID, request: SubmitTenantPaymentProofRequest): TenantPaymentProofResponse {
        requireEnabled()
        val scope = access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN), allowSubscriptionRestrictedForRoles = setOf(Role.STAFF_ADMIN))
        lockActor(scope.user.id)
        val payment = payments.findWithLockById(paymentId) ?: throw IllegalArgumentException("Tenant payment was not found")
        require(payment.organizationId == organizationId) { "Tenant payment was not found" }
        val bytes = decodeAndValidate(request)
        val payloadHash = sha256("$paymentId|${request.fileName.trim()}|${request.contentType}|${sha256(bytes)}")
        proofs.findByOrganizationIdAndUploadedByUserIdAndUploadIdempotencyKey(organizationId, scope.user.id, idempotencyKey)?.let { existing ->
            if (existing.uploadPayloadHash != payloadHash) throw TenantSubscriptionIdempotencyConflict()
            return response(existing, payment)
        }
        require(payment.status == TenantPaymentStatus.PENDING) { "Only pending tenant payments accept proof" }
        val current = proofs.findFirstByPaymentIdOrderByVersionNumberDesc(paymentId)
        require(current == null || current.status == REJECTED) { "A tenant payment proof is already awaiting review or has been verified" }
        val subscription = subscriptions.findByOrganizationId(organizationId) ?: throw IllegalArgumentException("Tenant subscription was not found")
        val proof = proofs.save(
            TenantPaymentProof(
                paymentId = paymentId,
                organizationId = organizationId,
                versionNumber = (current?.versionNumber ?: 0) + 1,
                uploadedByUserId = scope.user.id,
                fileName = safeFileName(request.fileName),
                contentType = request.contentType,
                fileData = bytes,
                uploadIdempotencyKey = idempotencyKey,
                uploadPayloadHash = payloadHash,
            ),
        )
        audits.save(TenantSubscriptionAuditEvent(organizationId = organizationId, subscriptionId = subscription.id, actorUserId = scope.user.id, action = "PAYMENT_PROOF_SUBMITTED", reason = "Private payment proof submitted", afterValue = "version=${proof.versionNumber};type=${proof.contentType};bytes=${bytes.size}", referenceId = proof.id, correlationId = idempotencyKey))
        return response(proof, payment)
    }

    @Transactional(readOnly = true)
    fun ownProofs(jwt: Jwt, organizationId: UUID, paymentId: UUID): List<TenantPaymentProofResponse> {
        requireEnabled()
        access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN), allowSubscriptionRestrictedForRoles = setOf(Role.STAFF_ADMIN))
        val payment = requirePayment(organizationId, paymentId)
        return proofs.findAllByPaymentIdOrderByVersionNumberDesc(paymentId).map { response(it, payment) }
    }

    @Transactional(readOnly = true)
    fun reviewQueue(jwt: Jwt, page: Int, size: Int): TenantSubscriptionReviewPage<TenantPaymentProofResponse> {
        platformAccess.requirePlatformAdmin(jwt)
        require(page >= 0 && size in 1..50) { "Invalid tenant payment proof page" }
        if (!enabled) return TenantSubscriptionReviewPage(emptyList(), page, size, false)
        val result = proofs.findAllByStatusOrderBySubmittedAtAsc(SUBMITTED, PageRequest.of(page, size))
        val items = result.content.mapNotNull { proof ->
            payments.findById(proof.paymentId).orElse(null)?.let { response(proof, it) }
        }
        return TenantSubscriptionReviewPage(items, result.number, result.size, result.hasNext())
    }

    fun featureStatus(jwt: Jwt): TenantSubscriptionFeatureStatus {
        platformAccess.requirePlatformAdmin(jwt)
        return TenantSubscriptionFeatureStatus(enabled, correctionEnabled)
    }

    @Transactional
    fun content(jwt: Jwt, proofId: UUID): TenantPaymentProofContentResponse {
        requireEnabled()
        val proof = proofs.findById(proofId).orElseThrow { IllegalArgumentException("Tenant payment proof was not found") }
        val platformUser = runCatching { platformAccess.requirePlatformAdmin(jwt) }.getOrNull()
        val actor = platformUser?.id ?: run {
            val scope = access.require(jwt, proof.organizationId, setOf(Role.STAFF_ADMIN), allowSubscriptionRestrictedForRoles = setOf(Role.STAFF_ADMIN))
            require(scope.membership.active && scope.membership.organizationId == proof.organizationId) { "Tenant payment proof is not available" }
            scope.user.id
        }
        val payment = requirePayment(proof.organizationId, proof.paymentId)
        val subscription = subscriptions.findByOrganizationId(proof.organizationId) ?: throw IllegalArgumentException("Tenant subscription was not found")
        audits.save(TenantSubscriptionAuditEvent(organizationId = proof.organizationId, subscriptionId = subscription.id, actorUserId = actor, action = "PAYMENT_PROOF_ACCESSED", reason = "Private payment proof accessed", afterValue = "version=${proof.versionNumber}", referenceId = proof.id))
        return TenantPaymentProofContentResponse(proof.id, proof.fileName, proof.contentType, Base64.getEncoder().encodeToString(proof.fileData))
    }

    @Transactional
    fun review(jwt: Jwt, proofId: UUID, idempotencyKey: UUID, request: ReviewTenantPaymentProofRequest): TenantPaymentProofResponse {
        requireEnabled()
        val actor = platformAccess.requirePlatformAdmin(jwt)
        lockActor(actor.id)
        val reason = request.reason.trim()
        require(reason.length in 3..1000) { "A review reason of 3 to 1000 characters is required" }
        val reviewPayloadHash = sha256("$proofId|${request.approved}|$reason")
        proofs.findByReviewedByUserIdAndReviewIdempotencyKey(actor.id, idempotencyKey)?.let { existing ->
            if (existing.reviewPayloadHash != reviewPayloadHash) throw TenantSubscriptionIdempotencyConflict()
            val existingPayment = requirePayment(existing.organizationId, existing.paymentId)
            return response(existing, existingPayment)
        }
        val initialProof = proofs.findById(proofId).orElseThrow { IllegalArgumentException("Tenant payment proof was not found") }
        val payment = payments.findWithLockById(initialProof.paymentId) ?: throw IllegalArgumentException("Tenant payment was not found")
        require(payment.organizationId == initialProof.organizationId) { "Tenant payment was not found" }
        val proof = proofs.findWithLockById(proofId) ?: throw IllegalArgumentException("Tenant payment proof was not found")
        require(proof.status == SUBMITTED) { "Tenant payment proof is no longer awaiting review" }
        require(payment.id == proof.paymentId && payment.organizationId == proof.organizationId) { "Tenant payment was not found" }
        require(payment.status == TenantPaymentStatus.PENDING) { "Tenant payment is no longer awaiting payment" }
        val subscription = subscriptions.findByOrganizationId(proof.organizationId) ?: throw IllegalArgumentException("Tenant subscription was not found")
        if (request.approved) {
            platformAdministration.markPaymentPaid(jwt, proof.organizationId, payment.id, idempotencyKey)
            proof.status = VERIFIED
        } else {
            proof.status = REJECTED
        }
        proof.reviewedAt = Instant.now()
        proof.reviewedByUserId = actor.id
        proof.reviewReason = reason
        proof.reviewIdempotencyKey = idempotencyKey
        proof.reviewPayloadHash = reviewPayloadHash
        audits.save(TenantSubscriptionAuditEvent(organizationId = proof.organizationId, subscriptionId = subscription.id, actorUserId = actor.id, action = if (request.approved) "PAYMENT_PROOF_VERIFIED" else "PAYMENT_PROOF_REJECTED", reason = reason, beforeValue = SUBMITTED, afterValue = proof.status, referenceId = proof.id, correlationId = idempotencyKey))
        memberships.findAllByOrganizationId(proof.organizationId).filter { it.active && it.role == Role.STAFF_ADMIN }.forEach { membership ->
            notifications.notify(proof.organizationId, membership.userId, if (request.approved) "Pembayaran langganan diterima" else "Bukti pembayaran perlu diperbaiki", if (request.approved) "Pembayaran ${payment.invoiceNumber} telah dikonfirmasi." else "Bukti ${payment.invoiceNumber} ditolak: $reason", "/tenant-subscription")
        }
        return response(proof, payment)
    }

    private fun requirePayment(organizationId: UUID, paymentId: UUID) = payments.findById(paymentId).orElseThrow { IllegalArgumentException("Tenant payment was not found") }
        .also { require(it.organizationId == organizationId) { "Tenant payment was not found" } }

    private fun decodeAndValidate(request: SubmitTenantPaymentProofRequest): ByteArray {
        val type = request.contentType.lowercase()
        require(type in ALLOWED_TYPES) { "Tenant payment proof must be PDF, JPEG, or PNG" }
        require(request.fileBase64.length <= MAX_BASE64_LENGTH) { "Tenant payment proof must be at most 2 MB" }
        val bytes = runCatching { Base64.getDecoder().decode(request.fileBase64) }.getOrElse { throw IllegalArgumentException("Tenant payment proof is invalid") }
        require(bytes.isNotEmpty() && bytes.size <= MAX_FILE_BYTES) { "Tenant payment proof must be at most 2 MB" }
        val valid = when (type) {
            "application/pdf" -> bytes.size >= 5 && bytes.copyOfRange(0, 5).toString(Charsets.US_ASCII) == "%PDF-"
            "image/jpeg" -> bytes.size >= 3 && bytes[0] == 0xFF.toByte() && bytes[1] == 0xD8.toByte() && bytes[2] == 0xFF.toByte()
            else -> bytes.size >= 8 && bytes.copyOfRange(0, 8).contentEquals(PNG_SIGNATURE)
        }
        require(valid) { "Tenant payment proof content does not match its file type" }
        return bytes
    }

    private fun response(proof: TenantPaymentProof, payment: com.daycare.api.persistence.TenantPayment): TenantPaymentProofResponse {
        val organization = organizations.findById(proof.organizationId).orElseThrow { IllegalStateException("A tenant payment proof references a missing organization") }
        return TenantPaymentProofResponse(proof.id, proof.paymentId, proof.organizationId, organization.name, payment.invoiceNumber, payment.amount, payment.dueDate, proof.versionNumber, proof.fileName, proof.contentType, proof.status, proof.submittedAt, proof.reviewedAt, proof.reviewReason)
    }
    private fun safeFileName(fileName: String): String {
        val name = fileName.substringAfterLast('/').substringAfterLast('\\').trim()
        require(name.isNotBlank() && name.length <= 255 && name.none { it.isISOControl() }) { "Tenant payment proof file name is invalid" }
        return name
    }
    private fun requireEnabled() { check(enabled) { "Tenant subscription payment proof is not enabled" } }
    private fun lockActor(actorUserId: UUID) {
        // Authentication already resolved the actor; the pessimistic lookup serializes
        // retries that reuse a key across different payment/proof rows.
        users.findWithLockById(actorUserId) ?: throw IllegalArgumentException("Payment proof actor was not found")
    }
    private fun sha256(bytes: ByteArray): String = MessageDigest.getInstance("SHA-256").digest(bytes).joinToString("") { "%02x".format(it) }
    private fun sha256(value: String): String = sha256(value.toByteArray(Charsets.UTF_8))

    companion object {
        private const val SUBMITTED = "SUBMITTED"
        private const val VERIFIED = "VERIFIED"
        private const val REJECTED = "REJECTED"
        private const val MAX_FILE_BYTES = 2 * 1024 * 1024
        private const val MAX_BASE64_LENGTH = 2_800_000
        private val PNG_SIGNATURE = byteArrayOf(0x89.toByte(), 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A)
        private val ALLOWED_TYPES = setOf("application/pdf", "image/jpeg", "image/png")
    }
}
