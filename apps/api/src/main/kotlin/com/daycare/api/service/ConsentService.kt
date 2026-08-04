package com.daycare.api.service

import com.daycare.api.domain.ConsentPurpose
import com.daycare.api.domain.ConsentStatus
import com.daycare.api.domain.InstitutionCapability
import com.daycare.api.domain.Role
import com.daycare.api.persistence.AuditLog
import com.daycare.api.persistence.AuditLogRepository
import com.daycare.api.persistence.ConsentDefinition
import com.daycare.api.persistence.ConsentDefinitionRepository
import com.daycare.api.persistence.ConsentRecord
import com.daycare.api.persistence.ConsentRecordRepository
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.NotNull
import jakarta.validation.constraints.Size
import org.springframework.security.access.AccessDeniedException
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Instant
import java.util.UUID

data class ConsentDefinitionResponse(
    val id: UUID,
    val purpose: ConsentPurpose,
    val title: String,
    val content: String,
    val revision: Int,
    val active: Boolean,
)

data class ParentConsentResponse(
    val definition: ConsentDefinitionResponse,
    val status: ConsentStatus,
    val decidedAt: Instant?,
    val withdrawnAt: Instant?,
)

data class ConsentDecisionRequest(@field:NotNull val definitionId: UUID, @field:NotNull val granted: Boolean?)
data class CreateConsentDefinitionRequest(
    @field:NotNull val purpose: ConsentPurpose,
    @field:NotBlank @field:Size(max = 160) val title: String,
    @field:NotBlank @field:Size(max = 4000) val content: String,
)
data class ReviseConsentDefinitionRequest(
    @field:NotBlank @field:Size(max = 160) val title: String,
    @field:NotBlank @field:Size(max = 4000) val content: String,
    @field:NotNull val expectedRevision: Int?,
)
data class SetConsentDefinitionActiveRequest(@field:NotNull val active: Boolean?, @field:NotNull val expectedRevision: Int?)
data class ConsentRecordResponse(val definitionId: UUID, val status: ConsentStatus, val revision: Int, val decidedAt: Instant?, val withdrawnAt: Instant?)

@Service
class ConsentService(
    private val access: AccessService,
    private val childScopes: ChildScopeService,
    private val definitions: ConsentDefinitionRepository,
    private val records: ConsentRecordRepository,
    private val audits: AuditLogRepository,
) {
    @Transactional(readOnly = true)
    fun definitions(jwt: Jwt, organizationId: UUID): List<ConsentDefinitionResponse> {
        access.require(jwt, organizationId, setOf(Role.PARENT, Role.STAFF_ADMIN), InstitutionCapability.DAYCARE_OPERATIONS, readOnly = true)
        return definitions.findAllByOrganizationIdAndActiveTrueOrderByCreatedAtDesc(organizationId).map(::definitionResponse)
    }

    @Transactional(readOnly = true)
    fun managedDefinitions(jwt: Jwt, organizationId: UUID): List<ConsentDefinitionResponse> {
        access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN), InstitutionCapability.DAYCARE_OPERATIONS, readOnly = true)
        return definitions.findAllByOrganizationIdOrderByCreatedAtDesc(organizationId).map(::definitionResponse)
    }

    @Transactional(readOnly = true)
    fun parentConsents(jwt: Jwt, organizationId: UUID, childId: UUID): List<ParentConsentResponse> {
        val scope = access.require(jwt, organizationId, setOf(Role.PARENT), InstitutionCapability.DAYCARE_OPERATIONS, readOnly = true)
        childScopes.requireParentLinkedChild(scope, childId, organizationId)
        val currentRecords = records.findAllByOrganizationIdAndChildIdAndGuardianUserId(organizationId, childId, scope.user.id)
            .associateBy { Pair(it.definitionId, it.definitionRevision) }
        return definitions.findAllByOrganizationIdAndActiveTrueOrderByCreatedAtDesc(organizationId).map { definition ->
            val record = currentRecords[Pair(definition.id, definition.revision)]
            ParentConsentResponse(definitionResponse(definition), record?.status ?: ConsentStatus.PENDING, record?.decidedAt, record?.withdrawnAt)
        }
    }

    @Transactional
    fun createDefinition(jwt: Jwt, organizationId: UUID, request: CreateConsentDefinitionRequest): ConsentDefinitionResponse {
        val scope = access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN), InstitutionCapability.DAYCARE_OPERATIONS)
        access.requireWritable(scope)
        val definition = definitions.save(ConsentDefinition(
            organizationId = organizationId,
            purpose = request.purpose,
            title = request.title.trim(),
            content = request.content.trim(),
        ))
        audit(organizationId, scope.user.id, definition.id, "CREATED")
        return definitionResponse(definition)
    }

    @Transactional
    fun reviseDefinition(jwt: Jwt, organizationId: UUID, definitionId: UUID, request: ReviseConsentDefinitionRequest): ConsentDefinitionResponse {
        val scope = access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN), InstitutionCapability.DAYCARE_OPERATIONS)
        access.requireWritable(scope)
        val definition = requireDefinition(organizationId, definitionId)
        requireExpectedRevision(definition, request.expectedRevision ?: throw IllegalArgumentException("Revision definisi persetujuan wajib diisi"))
        definition.title = request.title.trim()
        definition.content = request.content.trim()
        definition.revision += 1
        audit(organizationId, scope.user.id, definition.id, "REVISED")
        return definitionResponse(definition)
    }

    @Transactional
    fun setDefinitionActive(jwt: Jwt, organizationId: UUID, definitionId: UUID, request: SetConsentDefinitionActiveRequest): ConsentDefinitionResponse {
        val scope = access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN), InstitutionCapability.DAYCARE_OPERATIONS)
        access.requireWritable(scope)
        val definition = requireDefinition(organizationId, definitionId)
        requireExpectedRevision(definition, request.expectedRevision ?: throw IllegalArgumentException("Revision definisi persetujuan wajib diisi"))
        val active = request.active ?: throw IllegalArgumentException("Status aktif definisi persetujuan wajib diisi")
        if (definition.active != active) {
            definition.active = active
            definition.revision += 1
            audit(organizationId, scope.user.id, definition.id, if (active) "ACTIVATED" else "DEACTIVATED")
        }
        return definitionResponse(definition)
    }

    @Transactional
    fun decide(jwt: Jwt, organizationId: UUID, childId: UUID, request: ConsentDecisionRequest): ConsentRecordResponse {
        val scope = access.require(jwt, organizationId, setOf(Role.PARENT), InstitutionCapability.DAYCARE_OPERATIONS)
        access.requireWritable(scope)
        childScopes.requireParentLinkedChild(scope, childId, organizationId)
        val definition = requireDefinition(organizationId, request.definitionId)
        require(definition.active) { "Definisi persetujuan tidak aktif" }
        val record = records.findByOrganizationIdAndChildIdAndDefinitionIdAndGuardianUserIdAndDefinitionRevision(
            organizationId, childId, definition.id, scope.user.id, definition.revision,
        ) ?: ConsentRecord(
            organizationId = organizationId,
            childId = childId,
            definitionId = definition.id,
            definitionRevision = definition.revision,
            titleSnapshot = definition.title,
            contentSnapshot = definition.content,
            guardianUserId = scope.user.id,
        )
        val granted = request.granted ?: throw IllegalArgumentException("Keputusan persetujuan wajib diisi")
        record.status = if (granted) ConsentStatus.GRANTED else ConsentStatus.DECLINED
        record.decidedAt = Instant.now()
        record.withdrawnAt = null
        records.save(record)
        audit(organizationId, scope.user.id, record.id, if (granted) "GRANTED" else "DECLINED")
        return recordResponse(record)
    }

    @Transactional
    fun withdraw(jwt: Jwt, organizationId: UUID, childId: UUID, definitionId: UUID): ConsentRecordResponse {
        val scope = access.require(jwt, organizationId, setOf(Role.PARENT), InstitutionCapability.DAYCARE_OPERATIONS)
        access.requireWritable(scope)
        childScopes.requireParentLinkedChild(scope, childId, organizationId)
        val definition = requireDefinition(organizationId, definitionId)
        require(definition.active) { "Definisi persetujuan tidak aktif" }
        val record = records.findByOrganizationIdAndChildIdAndDefinitionIdAndGuardianUserIdAndDefinitionRevision(
            organizationId, childId, definition.id, scope.user.id, definition.revision,
        ) ?: throw IllegalArgumentException("Persetujuan aktif tidak ditemukan")
        if (record.status != ConsentStatus.GRANTED) throw AccessDeniedException("Hanya persetujuan yang diberikan dapat ditarik")
        record.status = ConsentStatus.WITHDRAWN
        record.withdrawnAt = Instant.now()
        records.save(record)
        audit(organizationId, scope.user.id, record.id, "WITHDRAWN")
        return recordResponse(record)
    }

    private fun requireDefinition(organizationId: UUID, definitionId: UUID): ConsentDefinition = definitions.findById(definitionId)
        .orElseThrow { IllegalArgumentException("Definisi persetujuan tidak ditemukan") }
        .also { if (it.organizationId != organizationId) throw AccessDeniedException("Definisi persetujuan bukan milik tenant ini") }

    private fun requireExpectedRevision(definition: ConsentDefinition, expectedRevision: Int) {
        require(definition.revision == expectedRevision) { "Definisi persetujuan sudah berubah. Muat ulang data sebelum menyimpan." }
    }

    private fun definitionResponse(value: ConsentDefinition) = ConsentDefinitionResponse(value.id, value.purpose, value.title, value.content, value.revision, value.active)
    private fun recordResponse(value: ConsentRecord) = ConsentRecordResponse(value.definitionId, value.status, value.definitionRevision, value.decidedAt, value.withdrawnAt)
    private fun audit(organizationId: UUID, actorUserId: UUID, entityId: UUID, action: String) = audits.save(AuditLog(organizationId = organizationId, actorUserId = actorUserId, entityType = "CONSENT", entityId = entityId, action = action, source = "CONSENT_V1"))
}
