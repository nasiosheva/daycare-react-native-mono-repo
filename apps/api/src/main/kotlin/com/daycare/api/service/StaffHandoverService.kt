package com.daycare.api.service

import com.daycare.api.domain.InstitutionCapability
import com.daycare.api.domain.Role
import com.daycare.api.domain.StaffHandoverStatus
import com.daycare.api.persistence.AuditLog
import com.daycare.api.persistence.AuditLogRepository
import com.daycare.api.persistence.MembershipRepository
import com.daycare.api.persistence.StaffHandover
import com.daycare.api.persistence.StaffHandoverRepository
import com.daycare.api.persistence.UserProfileRepository
import com.daycare.api.realtime.RealtimeFlag
import com.daycare.api.realtime.RealtimePublisher
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.NotNull
import jakarta.validation.constraints.Size
import org.springframework.security.access.AccessDeniedException
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Instant
import java.util.UUID

data class CreateStaffHandoverRequest(@field:NotNull val recipientUserId: UUID, @field:NotBlank @field:Size(max = 2_000) val summary: String)
data class StaffHandoverResponse(val id: UUID, val childId: UUID, val recipientUserId: UUID, val recipientName: String, val summary: String, val status: StaffHandoverStatus, val acknowledgedAt: Instant?, val createdAt: Instant)
data class StaffHandoverRecipientResponse(val userId: UUID, val displayName: String)

@Service
class StaffHandoverService(
    private val access: AccessService,
    private val childScopes: ChildScopeService,
    private val publishedCapabilities: PublishedOfferingCapabilityService,
    private val handovers: StaffHandoverRepository,
    private val memberships: MembershipRepository,
    private val users: UserProfileRepository,
    private val audits: AuditLogRepository,
    private val realtime: RealtimePublisher,
) {
    @Transactional(readOnly = true)
    fun list(jwt: Jwt, organizationId: UUID, childId: UUID): List<StaffHandoverResponse> {
        val scope = access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN, Role.STAFF), InstitutionCapability.DAYCARE_OPERATIONS, readOnly = true)
        val child = childScopes.requireStaffManagedChild(scope, childId, organizationId)
        publishedCapabilities.requirePublishedCapability(organizationId, InstitutionCapability.DAYCARE_OPERATIONS, child.branchId)
        return handovers.findAllByOrganizationIdAndChildIdOrderByCreatedAtDesc(organizationId, childId).map(::response)
    }

    @Transactional(readOnly = true)
    fun recipients(jwt: Jwt, organizationId: UUID, childId: UUID): List<StaffHandoverRecipientResponse> {
        val scope = access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN, Role.STAFF), InstitutionCapability.DAYCARE_OPERATIONS, readOnly = true)
        val child = childScopes.requireStaffManagedChild(scope, childId, organizationId)
        publishedCapabilities.requirePublishedCapability(organizationId, InstitutionCapability.DAYCARE_OPERATIONS, child.branchId)
        return memberships.findAllByOrganizationId(organizationId)
            .asSequence()
            .filter { it.active && it.role in setOf(Role.STAFF_ADMIN, Role.STAFF) }
            .mapNotNull { membership ->
                val user = users.findById(membership.userId).orElse(null) ?: return@mapNotNull null
                if (childScopes.isStaffManagedChild(AccessScope(user, membership, emptySet(), emptySet()), child.id, organizationId)) {
                    StaffHandoverRecipientResponse(user.id, user.displayName.ifBlank { user.email ?: "Staff" })
                } else null
            }
            .distinctBy { it.userId }
            .sortedBy { it.displayName.lowercase() }
            .toList()
    }

    @Transactional
    fun create(jwt: Jwt, organizationId: UUID, childId: UUID, request: CreateStaffHandoverRequest): StaffHandoverResponse {
        val scope = access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN, Role.STAFF), InstitutionCapability.DAYCARE_OPERATIONS)
        access.requireWritable(scope)
        val child = childScopes.requireStaffManagedChild(scope, childId, organizationId)
        publishedCapabilities.requirePublishedCapability(organizationId, InstitutionCapability.DAYCARE_OPERATIONS, child.branchId)
        val recipient = users.findById(request.recipientUserId).orElseThrow { IllegalArgumentException(DaycareOperationError.UNAVAILABLE) }
        val recipientMembership = memberships.findAllByUserIdAndOrganizationId(recipient.id, organizationId).firstOrNull { it.active && it.role in setOf(Role.STAFF_ADMIN, Role.STAFF) }
            ?: throw AccessDeniedException(DaycareOperationError.UNAVAILABLE)
        require(childScopes.isStaffManagedChild(AccessScope(recipient, recipientMembership, emptySet(), emptySet()), child.id, organizationId)) { DaycareOperationError.UNAVAILABLE }
        val handover = handovers.save(StaffHandover(organizationId = organizationId, branchId = child.branchId, childId = child.id, createdByUserId = scope.user.id, recipientUserId = recipient.id, summary = request.summary.trim()))
        audits.save(AuditLog(organizationId = organizationId, actorUserId = scope.user.id, entityType = "STAFF_HANDOVER", entityId = handover.id, action = "CREATED", source = "DAYCARE_HANDOVER"))
        realtime.publishToTenantRoles(organizationId, setOf(Role.STAFF_ADMIN, Role.STAFF), setOf(RealtimeFlag.STAFF_HANDOVERS), mapOf("childId" to child.id))
        return response(handover)
    }

    @Transactional
    fun acknowledge(jwt: Jwt, organizationId: UUID, childId: UUID, handoverId: UUID): StaffHandoverResponse {
        val scope = access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN, Role.STAFF), InstitutionCapability.DAYCARE_OPERATIONS)
        access.requireWritable(scope)
        val child = childScopes.requireStaffManagedChild(scope, childId, organizationId)
        publishedCapabilities.requirePublishedCapability(organizationId, InstitutionCapability.DAYCARE_OPERATIONS, child.branchId)
        val handover = handovers.findById(handoverId).orElseThrow { IllegalArgumentException(DaycareOperationError.UNAVAILABLE) }
        require(handover.organizationId == organizationId && handover.childId == child.id) { DaycareOperationError.UNAVAILABLE }
        require(handover.recipientUserId == scope.user.id) { DaycareOperationError.UNAVAILABLE }
        if (handover.status == StaffHandoverStatus.OPEN) {
            handover.status = StaffHandoverStatus.ACKNOWLEDGED
            handover.acknowledgedAt = Instant.now()
            audits.save(AuditLog(organizationId = organizationId, actorUserId = scope.user.id, entityType = "STAFF_HANDOVER", entityId = handover.id, action = "ACKNOWLEDGED", source = "DAYCARE_HANDOVER"))
            realtime.publishToTenantRoles(organizationId, setOf(Role.STAFF_ADMIN, Role.STAFF), setOf(RealtimeFlag.STAFF_HANDOVERS), mapOf("childId" to child.id))
        }
        return response(handover)
    }

    private fun response(handover: StaffHandover): StaffHandoverResponse {
        val recipientName = users.findById(handover.recipientUserId).map { it.displayName.ifBlank { it.email ?: "Staff" } }.orElse("Staff")
        return StaffHandoverResponse(handover.id, handover.childId, handover.recipientUserId, recipientName, handover.summary, handover.status, handover.acknowledgedAt, handover.createdAt)
    }
}
