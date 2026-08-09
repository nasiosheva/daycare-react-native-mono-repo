package com.daycare.api.service

import com.daycare.api.domain.PickupAuthorizationStatus
import com.daycare.api.domain.PickupVerificationMethod
import com.daycare.api.domain.EducationOfferingStatus
import com.daycare.api.domain.InstitutionCapability
import com.daycare.api.domain.Role
import com.daycare.api.persistence.AuditLog
import com.daycare.api.persistence.AuditLogRepository
import com.daycare.api.persistence.Child
import com.daycare.api.persistence.EducationOfferingRepository
import com.daycare.api.persistence.PickupAuthorization
import com.daycare.api.persistence.PickupAuthorizationRepository
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.NotNull
import jakarta.validation.constraints.Size
import org.springframework.security.access.AccessDeniedException
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Instant
import java.util.UUID

data class CreatePickupAuthorizationRequest(
    @field:NotBlank @field:Size(max = 160) val pickupPersonName: String,
    @field:NotBlank @field:Size(max = 100) val relationship: String,
    @field:NotNull val verificationMethod: PickupVerificationMethod,
    val effectiveFrom: Instant? = null,
    val effectiveUntil: Instant? = null,
)
data class RevokePickupAuthorizationRequest(@field:NotBlank @field:Size(max = 500) val reason: String)
data class PickupAuthorizationResponse(
    val id: UUID,
    val childId: UUID,
    val pickupPersonName: String,
    val relationship: String,
    val verificationMethod: PickupVerificationMethod,
    val status: PickupAuthorizationStatus,
    val effectiveFrom: Instant,
    val effectiveUntil: Instant?,
    val createdAt: Instant,
    val canRevoke: Boolean,
)
data class PickupCheckoutVerification(val authorizationId: UUID?, val pickupPersonName: String?, val verificationMethod: PickupVerificationMethod?, val exceptionReason: String?)

@Service
class PickupAuthorizationService(
    private val access: AccessService,
    private val childScopes: ChildScopeService,
    private val authorizations: PickupAuthorizationRepository,
    private val audits: AuditLogRepository,
    private val offerings: EducationOfferingRepository,
) {
    @Transactional(readOnly = true)
    fun list(jwt: Jwt, organizationId: UUID, childId: UUID): List<PickupAuthorizationResponse> {
        val scope = access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN, Role.STAFF, Role.PARENT))
        requireDaycareOffering(requireVisibleChild(scope, childId, organizationId))
        return authorizations.findAllByOrganizationIdAndChildIdOrderByCreatedAtDesc(organizationId, childId).map { response(it, canRevoke(scope, it)) }
    }

    @Transactional
    fun create(jwt: Jwt, organizationId: UUID, childId: UUID, request: CreatePickupAuthorizationRequest): PickupAuthorizationResponse {
        val scope = access.require(jwt, organizationId, setOf(Role.PARENT))
        val child = childScopes.requireParentLinkedChild(scope, childId, organizationId)
        access.requireWritable(scope)
        requireDaycareOffering(child)
        val effectiveFrom = request.effectiveFrom ?: Instant.now()
        require(request.effectiveUntil == null || request.effectiveUntil.isAfter(effectiveFrom)) { "Masa berlaku penjemput tidak valid" }
        val authorization = authorizations.save(PickupAuthorization(
            organizationId = organizationId,
            branchId = child.branchId,
            childId = child.id,
            pickupPersonName = request.pickupPersonName.trim(),
            relationship = request.relationship.trim(),
            verificationMethod = request.verificationMethod,
            effectiveFrom = effectiveFrom,
            effectiveUntil = request.effectiveUntil,
            createdByUserId = scope.user.id,
        ))
        audit(organizationId, scope.user.id, authorization, "CREATED")
        return response(authorization, true)
    }

    @Transactional
    fun activate(jwt: Jwt, organizationId: UUID, childId: UUID, authorizationId: UUID): PickupAuthorizationResponse {
        val scope = access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN))
        access.requireWritable(scope)
        requireDaycareOffering(childScopes.requireStaffManagedChild(scope, childId, organizationId))
        val authorization = requireAuthorization(organizationId, childId, authorizationId)
        require(authorization.status == PickupAuthorizationStatus.PENDING_VERIFICATION) { "Otorisasi penjemput tidak dapat diaktifkan" }
        authorization.status = PickupAuthorizationStatus.ACTIVE
        authorization.verifiedByUserId = scope.user.id
        authorization.verifiedAt = Instant.now()
        audit(organizationId, scope.user.id, authorization, "ACTIVATED")
        return response(authorization, true)
    }

    @Transactional
    fun revoke(jwt: Jwt, organizationId: UUID, childId: UUID, authorizationId: UUID, request: RevokePickupAuthorizationRequest): PickupAuthorizationResponse {
        val scope = access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN, Role.PARENT))
        access.requireWritable(scope)
        requireDaycareOffering(requireVisibleChild(scope, childId, organizationId))
        val authorization = requireAuthorization(organizationId, childId, authorizationId)
        if (scope.membership.role == Role.PARENT) {
            if (authorization.createdByUserId != scope.user.id) throw AccessDeniedException("Parent hanya dapat mencabut pengajuan penjemput sendiri")
        }
        require(authorization.status !in setOf(PickupAuthorizationStatus.REVOKED, PickupAuthorizationStatus.EXPIRED)) { "Otorisasi penjemput sudah tidak aktif" }
        authorization.status = PickupAuthorizationStatus.REVOKED
        authorization.revokedByUserId = scope.user.id
        authorization.revokedAt = Instant.now()
        authorization.revocationReason = request.reason.trim()
        audit(organizationId, scope.user.id, authorization, "REVOKED")
        return response(authorization, false)
    }

    fun verifyCheckout(scope: AccessScope, child: Child, authorizationId: UUID?, exceptionReason: String?): PickupCheckoutVerification {
        requireDaycareOffering(child)
        if (authorizationId == null) {
            if (scope.membership.role != Role.STAFF_ADMIN || exceptionReason.isNullOrBlank()) throw AccessDeniedException("Check-out memerlukan otorisasi penjemput aktif")
            return PickupCheckoutVerification(null, null, null, exceptionReason.trim())
        }
        if (!exceptionReason.isNullOrBlank()) throw IllegalArgumentException("Alasan pengecualian hanya dipakai tanpa otorisasi penjemput")
        val authorization = requireAuthorization(child.organizationId, child.id, authorizationId)
        val now = Instant.now()
        val active = authorization.status == PickupAuthorizationStatus.ACTIVE && !now.isBefore(authorization.effectiveFrom) && (authorization.effectiveUntil == null || now.isBefore(authorization.effectiveUntil))
        if (!active) throw AccessDeniedException("Otorisasi penjemput tidak aktif pada waktu check-out")
        return PickupCheckoutVerification(authorization.id, authorization.pickupPersonName, authorization.verificationMethod, null)
    }

    private fun requireVisibleChild(scope: AccessScope, childId: UUID, organizationId: UUID) = when (scope.membership.role) {
        Role.PARENT -> childScopes.requireParentLinkedChild(scope, childId, organizationId)
        Role.STAFF, Role.STAFF_ADMIN -> childScopes.requireStaffManagedChild(scope, childId, organizationId)
        Role.ADMIN -> throw AccessDeniedException("Platform administrator tidak memiliki akses penjemputan tenant")
    }

    private fun requireDaycareOffering(child: Child) {
        val publishedOfferings = offerings.findAllByOrganizationIdAndBranchIdAndStatus(child.organizationId, child.branchId, EducationOfferingStatus.PUBLISHED)
        if (publishedOfferings.none { InstitutionCapability.DAYCARE_OPERATIONS.name in it.capabilities.split(',') }) {
            throw AccessDeniedException("Layanan penjemputan hanya tersedia untuk offering Daycare aktif di cabang anak")
        }
    }

    private fun requireAuthorization(organizationId: UUID, childId: UUID, authorizationId: UUID): PickupAuthorization = authorizations.findById(authorizationId).orElseThrow { IllegalArgumentException("Otorisasi penjemput tidak ditemukan") }.also {
        if (it.organizationId != organizationId || it.childId != childId) throw AccessDeniedException("Otorisasi penjemput bukan milik anak ini")
    }
    private fun canRevoke(scope: AccessScope, value: PickupAuthorization): Boolean = value.status !in setOf(PickupAuthorizationStatus.REVOKED, PickupAuthorizationStatus.EXPIRED) && (scope.membership.role == Role.STAFF_ADMIN || (scope.membership.role == Role.PARENT && value.createdByUserId == scope.user.id))
    private fun response(value: PickupAuthorization, canRevoke: Boolean) = PickupAuthorizationResponse(value.id, value.childId, value.pickupPersonName, value.relationship, value.verificationMethod, value.status, value.effectiveFrom, value.effectiveUntil, value.createdAt, canRevoke)
    private fun audit(organizationId: UUID, actorUserId: UUID, authorization: PickupAuthorization, action: String) = audits.save(AuditLog(organizationId = organizationId, actorUserId = actorUserId, entityType = "PICKUP_AUTHORIZATION", entityId = authorization.id, action = action))
}
