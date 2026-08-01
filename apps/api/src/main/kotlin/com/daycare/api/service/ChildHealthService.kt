package com.daycare.api.service

import com.daycare.api.domain.Role
import com.daycare.api.persistence.AuditLog
import com.daycare.api.persistence.AuditLogRepository
import com.daycare.api.persistence.ChildHealthRecord
import com.daycare.api.persistence.ChildHealthRecordRepository
import jakarta.validation.constraints.Size
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Instant
import java.util.UUID

data class UpsertChildHealthRecordRequest(
    @field:Size(max = 10) val bloodType: String? = null,
    @field:Size(max = 2_000) val allergies: String? = null,
    @field:Size(max = 2_000) val medicalConditions: String? = null,
    @field:Size(max = 2_000) val medications: String? = null,
    @field:Size(max = 2_000) val emergencyInstructions: String? = null,
)
data class ChildHealthRecordResponse(
    val childId: UUID,
    val bloodType: String?,
    val allergies: String?,
    val medicalConditions: String?,
    val medications: String?,
    val emergencyInstructions: String?,
    val updatedByUserId: UUID,
    val updatedAt: Instant,
)

@Service
class ChildHealthService(
    private val access: AccessService,
    private val childScopes: ChildScopeService,
    private val records: ChildHealthRecordRepository,
    private val audits: AuditLogRepository,
) {
    @Transactional(readOnly = true)
    fun get(jwt: Jwt, organizationId: UUID, childId: UUID): ChildHealthRecordResponse? {
        val scope = access.require(jwt, organizationId, Role.entries.toSet(), readOnly = true)
        if (scope.membership.role == Role.PARENT) childScopes.requireParentLinkedChild(scope, childId, organizationId) else childScopes.requireStaffManagedChild(scope, childId, organizationId)
        return records.findByOrganizationIdAndChildId(organizationId, childId)?.let(::response)
    }

    @Transactional
    fun upsert(jwt: Jwt, organizationId: UUID, childId: UUID, request: UpsertChildHealthRecordRequest): ChildHealthRecordResponse {
        val scope = access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN, Role.STAFF))
        access.requireWritable(scope)
        childScopes.requireStaffManagedChild(scope, childId, organizationId)
        val record = records.findByOrganizationIdAndChildId(organizationId, childId) ?: ChildHealthRecord(organizationId = organizationId, childId = childId)
        record.bloodType = request.bloodType?.trim()?.ifBlank { null }
        record.allergies = request.allergies?.trim()?.ifBlank { null }
        record.medicalConditions = request.medicalConditions?.trim()?.ifBlank { null }
        record.medications = request.medications?.trim()?.ifBlank { null }
        record.emergencyInstructions = request.emergencyInstructions?.trim()?.ifBlank { null }
        record.updatedByUserId = scope.user.id
        record.updatedAt = Instant.now()
        val saved = records.save(record)
        audits.save(AuditLog(organizationId = organizationId, actorUserId = scope.user.id, entityType = "CHILD_HEALTH_RECORD", entityId = saved.id, action = "UPSERTED", source = "STAFF_NOTE"))
        return response(saved)
    }

    private fun response(record: ChildHealthRecord) = ChildHealthRecordResponse(record.childId, record.bloodType, record.allergies, record.medicalConditions, record.medications, record.emergencyInstructions, record.updatedByUserId, record.updatedAt)
}
