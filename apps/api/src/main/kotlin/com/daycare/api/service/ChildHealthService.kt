package com.daycare.api.service

import com.daycare.api.domain.Role
import com.daycare.api.persistence.AuditLog
import com.daycare.api.persistence.AuditLogRepository
import com.daycare.api.persistence.Child
import com.daycare.api.persistence.ChildHealthNote
import com.daycare.api.persistence.ChildHealthNoteRepository
import com.daycare.api.persistence.ChildHealthRecord
import com.daycare.api.persistence.ChildHealthRecordRepository
import com.daycare.api.persistence.GuardianLinkRepository
import com.daycare.api.persistence.UserProfileRepository
import com.daycare.api.realtime.RealtimeFlag
import jakarta.validation.constraints.NotBlank
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
data class CreateChildHealthNoteRequest(@field:NotBlank @field:Size(max = 2_000) val note: String)
data class ChildHealthNoteResponse(val id: UUID, val note: String, val authorName: String, val recordedAt: Instant)

@Service
class ChildHealthService(
    private val access: AccessService,
    private val childScopes: ChildScopeService,
    private val records: ChildHealthRecordRepository,
    private val notes: ChildHealthNoteRepository,
    private val audits: AuditLogRepository,
    private val guardians: GuardianLinkRepository,
    private val notifications: NotificationService,
    private val users: UserProfileRepository,
) {
    @Transactional(readOnly = true)
    fun get(jwt: Jwt, organizationId: UUID, childId: UUID): ChildHealthRecordResponse? {
        val scope = access.require(jwt, organizationId, Role.entries.toSet())
        if (scope.membership.role == Role.PARENT) childScopes.requireParentLinkedChild(scope, childId, organizationId) else childScopes.requireStaffManagedChild(scope, childId, organizationId)
        return records.findByOrganizationIdAndChildId(organizationId, childId)?.let(::response)
    }

    @Transactional
    fun upsert(jwt: Jwt, organizationId: UUID, childId: UUID, request: UpsertChildHealthRecordRequest): ChildHealthRecordResponse {
        val scope = access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN, Role.STAFF))
        access.requireWritable(scope)
        val child = childScopes.requireStaffManagedChild(scope, childId, organizationId)
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
        notifyGuardians(child)
        return response(saved)
    }

    @Transactional(readOnly = true)
    fun listNotes(jwt: Jwt, organizationId: UUID, childId: UUID): List<ChildHealthNoteResponse> {
        val scope = access.require(jwt, organizationId, Role.entries.toSet())
        if (scope.membership.role == Role.PARENT) childScopes.requireParentLinkedChild(scope, childId, organizationId) else childScopes.requireStaffManagedChild(scope, childId, organizationId)
        return notes.findAllByOrganizationIdAndChildIdOrderByRecordedAtDesc(organizationId, childId).map(::noteResponse)
    }

    @Transactional
    fun addNote(jwt: Jwt, organizationId: UUID, childId: UUID, request: CreateChildHealthNoteRequest): ChildHealthNoteResponse {
        val scope = access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN, Role.STAFF))
        access.requireWritable(scope)
        val child = childScopes.requireStaffManagedChild(scope, childId, organizationId)
        val note = notes.save(ChildHealthNote(organizationId = organizationId, childId = childId, authorUserId = scope.user.id, note = request.note.trim(), recordedAt = Instant.now()))
        audits.save(AuditLog(organizationId = organizationId, actorUserId = scope.user.id, entityType = "CHILD_HEALTH_NOTE", entityId = note.id, action = "CREATED", source = "STAFF_NOTE"))
        notifyGuardians(child)
        return noteResponse(note)
    }

    private fun noteResponse(note: ChildHealthNote) = ChildHealthNoteResponse(note.id, note.note, users.findById(note.authorUserId).map { it.displayName }.orElse("Unknown"), note.recordedAt)
    private fun response(record: ChildHealthRecord) = ChildHealthRecordResponse(record.childId, record.bloodType, record.allergies, record.medicalConditions, record.medications, record.emergencyInstructions, record.updatedByUserId, record.updatedAt)
    private fun Child.fullName() = listOfNotNull(firstName, lastName).joinToString(" ")

    private fun notifyGuardians(child: Child) {
        val childName = child.fullName()
        guardians.findAllByChildId(child.id).map { it.userId }.distinct().forEach { userId ->
            notifications.notify(child.organizationId, userId, "Catatan kesehatan $childName diperbarui", "Staf telah memperbarui informasi kesehatan $childName.", "/child-health?childId=${child.id}", setOf(RealtimeFlag.HEALTH))
        }
    }
}
