package com.daycare.api.service

import com.daycare.api.domain.Role
import com.daycare.api.persistence.AuditLog
import com.daycare.api.persistence.AuditLogRepository
import com.daycare.api.persistence.EmergencyContact
import com.daycare.api.persistence.EmergencyContactRepository
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.Size
import org.springframework.security.access.AccessDeniedException
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Instant
import java.util.UUID

data class CreateEmergencyContactRequest(@field:NotBlank @field:Size(max = 160) val name: String, @field:NotBlank @field:Size(max = 100) val relationship: String, @field:NotBlank @field:Size(max = 32) val phoneNumber: String)
data class EmergencyContactResponse(val id: UUID, val childId: UUID, val name: String, val relationship: String, val phoneNumber: String, val canRemove: Boolean)

@Service class EmergencyContactService(private val access: AccessService, private val childScopes: ChildScopeService, private val contacts: EmergencyContactRepository, private val audits: AuditLogRepository) {
 @Transactional(readOnly = true) fun list(jwt: Jwt, organizationId: UUID, childId: UUID): List<EmergencyContactResponse> { val scope = access.require(jwt, organizationId, setOf(Role.PARENT, Role.STAFF, Role.STAFF_ADMIN), readOnly = true); visible(scope, childId, organizationId); return contacts.findAllByOrganizationIdAndChildIdOrderByCreatedAtDesc(organizationId, childId).map { response(it, scope.membership.role == Role.STAFF_ADMIN || it.createdByUserId == scope.user.id) } }
 @Transactional fun create(jwt: Jwt, organizationId: UUID, childId: UUID, request: CreateEmergencyContactRequest): EmergencyContactResponse { val scope = access.require(jwt, organizationId, setOf(Role.PARENT)); access.requireWritable(scope); childScopes.requireParentLinkedChild(scope, childId, organizationId); val contact = contacts.save(EmergencyContact(organizationId = organizationId, childId = childId, name = request.name.trim(), relationship = request.relationship.trim(), phoneNumber = request.phoneNumber.trim(), createdByUserId = scope.user.id)); audits.save(AuditLog(organizationId = organizationId, actorUserId = scope.user.id, entityType = "EMERGENCY_CONTACT", entityId = contact.id, action = "CREATED")); return response(contact, true) }
 @Transactional fun remove(jwt: Jwt, organizationId: UUID, childId: UUID, contactId: UUID) { val scope = access.require(jwt, organizationId, setOf(Role.PARENT, Role.STAFF_ADMIN)); access.requireWritable(scope); visible(scope, childId, organizationId); val contact = contacts.findById(contactId).orElseThrow { IllegalArgumentException("Kontak darurat tidak ditemukan") }; if (contact.organizationId != organizationId || contact.childId != childId) throw AccessDeniedException("Kontak darurat bukan milik anak ini"); if (scope.membership.role != Role.STAFF_ADMIN && contact.createdByUserId != scope.user.id) throw AccessDeniedException("Parent hanya dapat menghapus kontak yang dibuat sendiri"); contacts.delete(contact); audits.save(AuditLog(organizationId = organizationId, actorUserId = scope.user.id, entityType = "EMERGENCY_CONTACT", entityId = contact.id, action = "REMOVED")) }
 private fun visible(scope: AccessScope, childId: UUID, organizationId: UUID) { if (scope.membership.role == Role.PARENT) childScopes.requireParentLinkedChild(scope, childId, organizationId) else childScopes.requireStaffManagedChild(scope, childId, organizationId) }
 private fun response(value: EmergencyContact, canRemove: Boolean) = EmergencyContactResponse(value.id, value.childId, value.name, value.relationship, value.phoneNumber, canRemove)
}
