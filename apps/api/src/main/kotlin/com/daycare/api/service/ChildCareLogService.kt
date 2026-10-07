package com.daycare.api.service

import com.daycare.api.domain.ChildCareLogType
import com.daycare.api.domain.ChildMealAmount
import com.daycare.api.domain.ChildMealType
import com.daycare.api.domain.ChildToiletType
import com.daycare.api.domain.InstitutionCapability
import com.daycare.api.domain.Role
import com.daycare.api.persistence.AuditLog
import com.daycare.api.persistence.AuditLogRepository
import com.daycare.api.persistence.ChildCareLog
import com.daycare.api.persistence.ChildCareLogRepository
import com.daycare.api.persistence.GuardianLinkRepository
import com.daycare.api.realtime.RealtimeFlag
import com.daycare.api.realtime.RealtimePublisher
import jakarta.validation.constraints.NotNull
import jakarta.validation.constraints.Size
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Instant
import java.util.UUID

object DaycareOperationError {
    const val INVALID = "daycare_operation.invalid"
    const val UNAVAILABLE = "daycare_operation.unavailable"
    const val STATE = "daycare_operation.state"
}

data class CreateChildCareLogRequest(
    @field:NotNull val type: ChildCareLogType,
    @field:NotNull val occurredAt: Instant,
    val mealType: ChildMealType? = null,
    val mealAmount: ChildMealAmount? = null,
    val napStartedAt: Instant? = null,
    val napEndedAt: Instant? = null,
    val toiletType: ChildToiletType? = null,
    @field:Size(max = 500) val note: String? = null,
    val correctsLogId: UUID? = null,
    @field:Size(max = 500) val correctionReason: String? = null,
)

data class ChildCareLogResponse(
    val id: UUID,
    val childId: UUID,
    val type: ChildCareLogType,
    val occurredAt: Instant,
    val mealType: ChildMealType?,
    val mealAmount: ChildMealAmount?,
    val napStartedAt: Instant?,
    val napEndedAt: Instant?,
    val toiletType: ChildToiletType?,
    val note: String?,
    val correctsLogId: UUID?,
    val correctionReason: String?,
    val createdAt: Instant,
)

@Service
class ChildCareLogService(
    private val access: AccessService,
    private val childScopes: ChildScopeService,
    private val publishedCapabilities: PublishedOfferingCapabilityService,
    private val logs: ChildCareLogRepository,
    private val guardians: GuardianLinkRepository,
    private val audits: AuditLogRepository,
    private val realtime: RealtimePublisher,
) {
    @Transactional(readOnly = true)
    fun list(jwt: Jwt, organizationId: UUID, childId: UUID): List<ChildCareLogResponse> {
        val scope = access.require(jwt, organizationId, Role.entries.toSet(), InstitutionCapability.DAYCARE_OPERATIONS, readOnly = true)
        val child = if (scope.membership.role == Role.PARENT) childScopes.requireParentLinkedChild(scope, childId, organizationId) else childScopes.requireStaffManagedChild(scope, childId, organizationId)
        publishedCapabilities.requirePublishedCapability(organizationId, InstitutionCapability.DAYCARE_OPERATIONS, child.branchId)
        return logs.findAllByOrganizationIdAndChildIdOrderByOccurredAtDesc(organizationId, childId).map(::response)
    }

    @Transactional
    fun create(jwt: Jwt, organizationId: UUID, childId: UUID, request: CreateChildCareLogRequest): ChildCareLogResponse {
        val scope = access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN, Role.STAFF), InstitutionCapability.DAYCARE_OPERATIONS)
        access.requireWritable(scope)
        val child = childScopes.requireStaffManagedChild(scope, childId, organizationId)
        publishedCapabilities.requirePublishedCapability(organizationId, InstitutionCapability.DAYCARE_OPERATIONS, child.branchId)
        validate(request, organizationId, childId)
        val log = logs.save(ChildCareLog(
            organizationId = organizationId,
            branchId = child.branchId,
            childId = child.id,
            recordedByUserId = scope.user.id,
            type = request.type,
            occurredAt = request.occurredAt,
            mealType = request.mealType,
            mealAmount = request.mealAmount,
            napStartedAt = request.napStartedAt,
            napEndedAt = request.napEndedAt,
            toiletType = request.toiletType,
            note = request.note?.trim()?.ifBlank { null },
            correctsLogId = request.correctsLogId,
            correctionReason = request.correctionReason?.trim()?.ifBlank { null },
        ))
        audits.save(AuditLog(organizationId = organizationId, actorUserId = scope.user.id, entityType = "CHILD_CARE_LOG", entityId = log.id, action = if (log.correctsLogId == null) "CREATED" else "CORRECTED", source = "DAYCARE_CARE"))
        realtime.publishToTenantRoles(organizationId, setOf(Role.STAFF_ADMIN, Role.STAFF), setOf(RealtimeFlag.CHILD_CARE_LOGS), mapOf("childId" to child.id))
        guardians.findAllByChildId(child.id).map { it.userId }.distinct().forEach { guardianId ->
            realtime.publishToUser(organizationId, guardianId, setOf(RealtimeFlag.CHILD_CARE_LOGS), mapOf("childId" to child.id))
        }
        return response(log)
    }

    private fun validate(request: CreateChildCareLogRequest, organizationId: UUID, childId: UUID) {
        when (request.type) {
            ChildCareLogType.MEAL -> {
                require(request.mealType != null && request.mealAmount != null) { DaycareOperationError.INVALID }
                require(request.napStartedAt == null && request.napEndedAt == null && request.toiletType == null) { DaycareOperationError.INVALID }
            }
            ChildCareLogType.NAP -> {
                require(request.napStartedAt != null && request.napEndedAt != null) { DaycareOperationError.INVALID }
                require(request.napEndedAt.isAfter(request.napStartedAt)) { DaycareOperationError.INVALID }
                require(request.mealType == null && request.mealAmount == null && request.toiletType == null) { DaycareOperationError.INVALID }
            }
            ChildCareLogType.TOILET -> {
                require(request.toiletType != null) { DaycareOperationError.INVALID }
                require(request.mealType == null && request.mealAmount == null && request.napStartedAt == null && request.napEndedAt == null) { DaycareOperationError.INVALID }
            }
        }
        if (request.correctsLogId != null) {
            val original = logs.findById(request.correctsLogId).orElseThrow { IllegalArgumentException(DaycareOperationError.UNAVAILABLE) }
            require(original.organizationId == organizationId && original.childId == childId) { DaycareOperationError.UNAVAILABLE }
            require(!request.correctionReason.isNullOrBlank()) { DaycareOperationError.INVALID }
        } else require(request.correctionReason.isNullOrBlank()) { DaycareOperationError.INVALID }
    }

    private fun response(log: ChildCareLog) = ChildCareLogResponse(log.id, log.childId, log.type, log.occurredAt, log.mealType, log.mealAmount, log.napStartedAt, log.napEndedAt, log.toiletType, log.note, log.correctsLogId, log.correctionReason, log.createdAt)
}
