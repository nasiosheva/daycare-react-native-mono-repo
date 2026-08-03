package com.daycare.api.service

import com.daycare.api.domain.ConsentPurpose
import com.daycare.api.domain.ConsentStatus
import com.daycare.api.domain.Role
import com.daycare.api.persistence.ConsentDefinition
import com.daycare.api.persistence.ConsentDefinitionRepository
import com.daycare.api.persistence.ConsentRecord
import com.daycare.api.persistence.ConsentRecordRepository
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Instant
import java.util.UUID

data class ConsentDefinitionResponse(val id: UUID, val purpose: ConsentPurpose, val title: String, val content: String, val revision: Int)
data class ConsentDecisionRequest(val definitionId: UUID, val granted: Boolean)
data class ConsentRecordResponse(val definitionId: UUID, val status: ConsentStatus, val revision: Int, val decidedAt: Instant?)

@Service class ConsentService(private val access: AccessService, private val childScopes: ChildScopeService, private val definitions: ConsentDefinitionRepository, private val records: ConsentRecordRepository) {
 @Transactional(readOnly = true) fun definitions(jwt: Jwt, organizationId: UUID): List<ConsentDefinitionResponse> { access.require(jwt, organizationId, setOf(Role.PARENT, Role.STAFF_ADMIN), readOnly = true); return definitions.findAllByOrganizationIdAndActiveTrue(organizationId).map { ConsentDefinitionResponse(it.id, it.purpose, it.title, it.content, it.revision) } }
 @Transactional fun decide(jwt: Jwt, organizationId: UUID, childId: UUID, request: ConsentDecisionRequest): ConsentRecordResponse { val scope = access.require(jwt, organizationId, setOf(Role.PARENT)); access.requireWritable(scope); childScopes.requireParentLinkedChild(scope, childId, organizationId); val definition = definitions.findById(request.definitionId).orElseThrow { IllegalArgumentException("Definisi consent tidak ditemukan") }; require(definition.organizationId == organizationId && definition.active); val record = records.findAllByOrganizationIdAndChildIdAndGuardianUserId(organizationId, childId, scope.user.id).firstOrNull { it.definitionId == definition.id } ?: ConsentRecord(organizationId = organizationId, childId = childId, definitionId = definition.id, guardianUserId = scope.user.id); record.status = if (request.granted) ConsentStatus.GRANTED else ConsentStatus.DECLINED; record.definitionRevision = definition.revision; record.contentSnapshot = definition.content; record.decidedAt = Instant.now(); records.save(record); return ConsentRecordResponse(record.definitionId, record.status, record.definitionRevision, record.decidedAt) }
}
