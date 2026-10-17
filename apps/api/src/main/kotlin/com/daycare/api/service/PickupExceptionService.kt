package com.daycare.api.service

// Mories Deo Hutapea,S.E.,S.Kom

import com.daycare.api.domain.EducationOfferingStatus
import com.daycare.api.domain.InstitutionCapability
import com.daycare.api.domain.PickupExceptionStatus
import com.daycare.api.domain.PickupExceptionVerificationMethod
import com.daycare.api.domain.PickupVerificationMethod
import com.daycare.api.domain.Role
import com.daycare.api.persistence.AttendanceRepository
import com.daycare.api.persistence.AuditLog
import com.daycare.api.persistence.AuditLogRepository
import com.daycare.api.persistence.BranchRepository
import com.daycare.api.persistence.Child
import com.daycare.api.persistence.ChildRepository
import com.daycare.api.persistence.EducationOfferingRepository
import com.daycare.api.persistence.PickupAuthorizationRepository
import com.daycare.api.persistence.PickupExceptionRequest
import com.daycare.api.persistence.PickupExceptionRequestRepository
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.NotNull
import jakarta.validation.constraints.Size
import org.springframework.security.access.AccessDeniedException
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.util.UUID

data class CreatePickupExceptionRequest(
    @field:NotBlank @field:Size(max = 160) val pickupPersonName: String,
    @field:NotBlank @field:Size(max = 100) val relationship: String,
    @field:NotBlank @field:Size(max = 500) val reason: String,
)

data class ApprovePickupExceptionRequest(
    @field:NotNull val verificationMethod: PickupExceptionVerificationMethod,
    @field:NotBlank @field:Size(max = 500) val verificationNote: String,
)

data class RejectPickupExceptionRequest(@field:NotBlank @field:Size(max = 500) val reason: String)

data class PickupExceptionResponse(
    val id: UUID,
    val childId: UUID,
    val childName: String,
    val branchId: UUID,
    val requestedByUserId: UUID,
    val pickupPersonName: String,
    val relationship: String,
    val reason: String,
    val requestedAt: Instant,
    val requestExpiresAt: Instant,
    val status: PickupExceptionStatus,
    val reviewedByUserId: UUID?,
    val reviewedAt: Instant?,
    val verificationMethod: PickupExceptionVerificationMethod?,
    val verificationNote: String?,
    val approvalExpiresAt: Instant?,
    val rejectionReason: String?,
)

data class PickupExceptionCheckoutGrant(
    val requestId: UUID,
    val pickupPersonName: String,
    val verificationMethod: PickupVerificationMethod,
    val reason: String,
)

@Service
class PickupExceptionService(
    private val access: AccessService,
    private val childScopes: ChildScopeService,
    private val requests: PickupExceptionRequestRepository,
    private val attendance: AttendanceRepository,
    private val offerings: EducationOfferingRepository,
    private val audits: AuditLogRepository,
    private val branches: BranchRepository,
    private val authorizations: PickupAuthorizationRepository,
    private val children: ChildRepository,
) {
    @Transactional
    fun request(jwt: Jwt, organizationId: UUID, childId: UUID, request: CreatePickupExceptionRequest): PickupExceptionResponse {
        val scope = access.require(jwt, organizationId, setOf(Role.STAFF), allowGraceForRoles = setOf(Role.STAFF))
        access.requireWritable(scope)
        val scopedChild = childScopes.requireStaffManagedChild(scope, childId, organizationId)
        val child = children.findWithLockById(scopedChild.id)
            ?: throw IllegalArgumentException("Child was not found")
        if (child.organizationId != organizationId || child.branchId != scopedChild.branchId) {
            throw AccessDeniedException("Child scope changed while creating pickup exception")
        }
        requireDaycareOffering(child)
        val now = Instant.now()
        require(!hasActivePickupAuthorization(organizationId, child.id, now)) { "An active pickup authorization is available; use it for check-out" }
        val branch = branches.findById(child.branchId).orElseThrow { IllegalArgumentException("Child branch was not found") }
        val operationalDate = LocalDate.now(ZoneId.of(branch.timezone))
        val todayAttendance = attendance.findByChildIdAndOperationalDate(child.id, operationalDate)
        require(todayAttendance?.checkedInAt != null && todayAttendance.checkedOutAt == null) { "A pickup exception can only be requested for a child currently checked in" }
        val existingPending = requests.findAllByOrganizationIdAndChildIdOrderByRequestedAtDesc(organizationId, child.id)
            .map { normalizeExpired(it, now, scope.user.id) }
            .firstOrNull { it.status == PickupExceptionStatus.PENDING }
        if (existingPending != null) {
            if (existingPending.requestedByUserId != scope.user.id) throw IllegalArgumentException("A pickup exception request is already waiting for this child")
            return response(existingPending, child)
        }

        val saved = requests.save(PickupExceptionRequest(
            organizationId = organizationId,
            branchId = child.branchId,
            childId = child.id,
            requestedByUserId = scope.user.id,
            pickupPersonName = request.pickupPersonName.trim(),
            relationship = request.relationship.trim(),
            reason = request.reason.trim(),
            requestedAt = now,
            requestExpiresAt = now.plusSeconds(REQUEST_TTL_SECONDS),
        ))
        audit(organizationId, scope.user.id, saved, "REQUESTED")
        return response(saved, child)
    }

    @Transactional
    fun forChild(jwt: Jwt, organizationId: UUID, childId: UUID): List<PickupExceptionResponse> {
        val scope = access.require(jwt, organizationId, setOf(Role.STAFF, Role.STAFF_ADMIN), allowGraceForRoles = setOf(Role.STAFF, Role.STAFF_ADMIN))
        val child = childScopes.requireStaffManagedChild(scope, childId, organizationId)
        requireDaycareOffering(child)
        val now = Instant.now()
        return requests.findAllByOrganizationIdAndChildIdOrderByRequestedAtDesc(organizationId, childId)
            .map { normalizeExpired(it, now, scope.user.id) }
            .map { response(it, child) }
    }

    @Transactional
    fun pending(jwt: Jwt, organizationId: UUID): List<PickupExceptionResponse> {
        val scope = access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN), allowGraceForRoles = setOf(Role.STAFF_ADMIN))
        val childrenById = childScopes.visibleChildren(scope, organizationId).associateBy { it.id }
        val now = Instant.now()
        return requests.findAllByOrganizationIdAndStatusOrderByRequestedAtAsc(organizationId, PickupExceptionStatus.PENDING)
            .filter { it.branchId == childrenById[it.childId]?.branchId }
            .map { normalizeExpired(it, now, scope.user.id) }
            .filter { it.status == PickupExceptionStatus.PENDING }
            .mapNotNull { request -> childrenById[request.childId]?.let { response(request, it) } }
    }

    @Transactional
    fun approve(jwt: Jwt, organizationId: UUID, requestId: UUID, decision: ApprovePickupExceptionRequest): PickupExceptionResponse {
        val scope = access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN), allowGraceForRoles = setOf(Role.STAFF_ADMIN))
        access.requireWritable(scope)
        val request = requireRequestForUpdate(requestId, organizationId)
        val child = childScopes.requireStaffManagedChild(scope, request.childId, organizationId)
        requireDaycareOffering(child)
        val now = Instant.now()
        if (expireIfNeeded(request, now)) {
            val expired = requests.save(request)
            audit(organizationId, scope.user.id, expired, "EXPIRED")
            return response(expired, child)
        }
        require(request.status == PickupExceptionStatus.PENDING) { "Pickup exception request is no longer pending" }
        require(!hasActivePickupAuthorization(organizationId, child.id, Instant.now())) { "An active pickup authorization is available; do not approve an exception" }
        request.status = PickupExceptionStatus.APPROVED
        request.reviewedByUserId = scope.user.id
        request.reviewedAt = now
        request.verificationMethod = decision.verificationMethod
        request.verificationNote = decision.verificationNote.trim()
        request.approvalExpiresAt = now.plusSeconds(GRANT_TTL_SECONDS)
        val saved = requests.save(request)
        audit(organizationId, scope.user.id, saved, "APPROVED")
        return response(saved, child)
    }

    @Transactional
    fun reject(jwt: Jwt, organizationId: UUID, requestId: UUID, decision: RejectPickupExceptionRequest): PickupExceptionResponse {
        val scope = access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN), allowGraceForRoles = setOf(Role.STAFF_ADMIN))
        access.requireWritable(scope)
        val request = requireRequestForUpdate(requestId, organizationId)
        val child = childScopes.requireStaffManagedChild(scope, request.childId, organizationId)
        requireDaycareOffering(child)
        val now = Instant.now()
        if (expireIfNeeded(request, now)) {
            val expired = requests.save(request)
            audit(organizationId, scope.user.id, expired, "EXPIRED")
            return response(expired, child)
        }
        require(request.status == PickupExceptionStatus.PENDING) { "Pickup exception request is no longer pending" }
        request.status = PickupExceptionStatus.REJECTED
        request.reviewedByUserId = scope.user.id
        request.reviewedAt = Instant.now()
        request.rejectionReason = decision.reason.trim()
        val saved = requests.save(request)
        audit(organizationId, scope.user.id, saved, "REJECTED")
        return response(saved, child)
    }

    @Transactional
    fun consumeCheckoutGrant(scope: AccessScope, child: Child, requestId: UUID): PickupExceptionCheckoutGrant {
        if (scope.membership.role != Role.STAFF) throw AccessDeniedException("Only Staff can consume a pickup exception grant")
        val scopedChild = childScopes.requireStaffManagedChild(scope, child.id, child.organizationId)
        requireDaycareOffering(scopedChild)
        val request = requireRequestForUpdate(requestId, child.organizationId)
        if (request.childId != child.id || request.branchId != child.branchId) throw AccessDeniedException("Pickup exception grant belongs to a different child or branch")
        expireIfNeeded(request, Instant.now())
        if (request.status != PickupExceptionStatus.APPROVED || request.approvalExpiresAt?.isAfter(Instant.now()) != true) {
            throw AccessDeniedException("A current approved pickup exception is required for check-out")
        }
        if (hasActivePickupAuthorization(child.organizationId, child.id, Instant.now())) {
            throw AccessDeniedException("An active pickup authorization is available; use it for check-out")
        }
        request.status = PickupExceptionStatus.CONSUMED
        request.consumedAt = Instant.now()
        requests.save(request)
        audit(child.organizationId, scope.user.id, request, "CONSUMED")
        return PickupExceptionCheckoutGrant(
            requestId = request.id,
            pickupPersonName = request.pickupPersonName,
            verificationMethod = PickupVerificationMethod.OTHER,
            reason = request.reason,
        )
    }

    private fun requireRequestForUpdate(requestId: UUID, organizationId: UUID) = requests.findByIdForUpdate(requestId)
        .orElseThrow { IllegalArgumentException("Pickup exception request was not found") }
        .also { if (it.organizationId != organizationId) throw AccessDeniedException("Pickup exception request belongs to a different organization") }

    private fun normalizeExpired(request: PickupExceptionRequest, now: Instant, actorUserId: UUID): PickupExceptionRequest {
        if (expireIfNeeded(request, now)) {
            requests.save(request)
            audit(request.organizationId, actorUserId, request, "EXPIRED")
        }
        return request
    }

    private fun expireIfNeeded(request: PickupExceptionRequest, now: Instant): Boolean {
        val expired = (request.status == PickupExceptionStatus.PENDING && !now.isBefore(request.requestExpiresAt)) ||
            (request.status == PickupExceptionStatus.APPROVED && request.approvalExpiresAt?.let { !now.isBefore(it) } == true)
        if (!expired) return false
        request.status = PickupExceptionStatus.EXPIRED
        return true
    }

    private fun hasActivePickupAuthorization(organizationId: UUID, childId: UUID, now: Instant): Boolean =
        authorizations.findAllByOrganizationIdAndChildIdOrderByCreatedAtDesc(organizationId, childId).any { authorization ->
            authorization.status == com.daycare.api.domain.PickupAuthorizationStatus.ACTIVE &&
                !now.isBefore(authorization.effectiveFrom) &&
                (authorization.effectiveUntil == null || now.isBefore(authorization.effectiveUntil))
        }

    private fun requireDaycareOffering(child: Child) {
        val hasDaycare = offerings.findAllByOrganizationIdAndBranchIdAndStatus(child.organizationId, child.branchId, EducationOfferingStatus.PUBLISHED)
            .any { InstitutionCapability.DAYCARE_OPERATIONS.name in it.capabilities.split(',') }
        if (!hasDaycare) throw AccessDeniedException("Pickup exceptions are available only for a published Daycare offering at the child's branch")
    }

    private fun response(request: PickupExceptionRequest, child: Child) = PickupExceptionResponse(
        id = request.id,
        childId = request.childId,
        childName = child.fullName(),
        branchId = request.branchId,
        requestedByUserId = request.requestedByUserId,
        pickupPersonName = request.pickupPersonName,
        relationship = request.relationship,
        reason = request.reason,
        requestedAt = request.requestedAt,
        requestExpiresAt = request.requestExpiresAt,
        status = request.status,
        reviewedByUserId = request.reviewedByUserId,
        reviewedAt = request.reviewedAt,
        verificationMethod = request.verificationMethod,
        verificationNote = request.verificationNote,
        approvalExpiresAt = request.approvalExpiresAt,
        rejectionReason = request.rejectionReason,
    )

    private fun Child.fullName() = listOfNotNull(firstName, lastName).joinToString(" ")

    private fun audit(organizationId: UUID, actorUserId: UUID, request: PickupExceptionRequest, action: String) =
        audits.save(AuditLog(organizationId = organizationId, actorUserId = actorUserId, entityType = "PICKUP_EXCEPTION_REQUEST", entityId = request.id, action = action))

    private companion object {
        const val REQUEST_TTL_SECONDS = 15 * 60L
        const val GRANT_TTL_SECONDS = 5 * 60L
    }
}
