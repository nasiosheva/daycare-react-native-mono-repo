package com.daycare.api.service

import com.daycare.api.domain.ConsentPurpose
import com.daycare.api.domain.ConsentStatus
import com.daycare.api.domain.InstitutionCapability
import com.daycare.api.domain.Role
import com.daycare.api.persistence.AuditLogRepository
import com.daycare.api.persistence.Child
import com.daycare.api.persistence.ConsentDefinition
import com.daycare.api.persistence.ConsentDefinitionRepository
import com.daycare.api.persistence.ConsentRecord
import com.daycare.api.persistence.ConsentRecordRepository
import com.daycare.api.persistence.Membership
import com.daycare.api.persistence.UserProfile
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import org.mockito.ArgumentMatchers.any
import org.mockito.Mockito.mock
import org.mockito.Mockito.`when`
import org.springframework.security.oauth2.jwt.Jwt
import java.util.Optional
import java.util.UUID

class ConsentServiceTest {
    private val access = mock(AccessService::class.java)
    private val childScopes = mock(ChildScopeService::class.java)
    private val definitions = mock(ConsentDefinitionRepository::class.java)
    private val records = mock(ConsentRecordRepository::class.java)
    private val service = ConsentService(access, childScopes, definitions, records, mock(AuditLogRepository::class.java))

    @Test
    fun `Parent decision stores the current immutable definition snapshot`() {
        val jwt = mock(Jwt::class.java)
        val organizationId = UUID.randomUUID()
        val parentId = UUID.randomUUID()
        val child = Child(organizationId = organizationId)
        val definition = ConsentDefinition(organizationId = organizationId, purpose = ConsentPurpose.OUTING, title = "Kegiatan luar", content = "Izinkan kegiatan luar", revision = 3)
        val scope = AccessScope(UserProfile(id = parentId), Membership(organizationId = organizationId, role = Role.PARENT), emptySet(), setOf(InstitutionCapability.DAYCARE_OPERATIONS))
        var saved: ConsentRecord? = null
        `when`(access.require(jwt, organizationId, setOf(Role.PARENT), InstitutionCapability.DAYCARE_OPERATIONS)).thenReturn(scope)
        `when`(childScopes.requireParentLinkedChild(scope, child.id, organizationId)).thenReturn(child)
        `when`(definitions.findById(definition.id)).thenReturn(Optional.of(definition))
        `when`(records.findByOrganizationIdAndChildIdAndDefinitionIdAndGuardianUserIdAndDefinitionRevision(organizationId, child.id, definition.id, parentId, definition.revision)).thenReturn(null)
        `when`(records.save(any(ConsentRecord::class.java))).thenAnswer { invocation -> (invocation.arguments[0] as ConsentRecord).also { saved = it } }

        val response = service.decide(jwt, organizationId, child.id, ConsentDecisionRequest(definition.id, true))

        assertEquals(ConsentStatus.GRANTED, response.status)
        assertEquals(definition.revision, saved?.definitionRevision)
        assertEquals(definition.title, saved?.titleSnapshot)
        assertEquals(definition.content, saved?.contentSnapshot)
        assertEquals(parentId, saved?.guardianUserId)
    }

    @Test
    fun `Staff Admin revision increments definition revision without changing its purpose`() {
        val jwt = mock(Jwt::class.java)
        val organizationId = UUID.randomUUID()
        val definition = ConsentDefinition(organizationId = organizationId, purpose = ConsentPurpose.MEDICATION, title = "Obat", content = "Teks lama", revision = 2)
        val scope = AccessScope(UserProfile(), Membership(organizationId = organizationId, role = Role.STAFF_ADMIN), emptySet(), setOf(InstitutionCapability.DAYCARE_OPERATIONS))
        `when`(access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN), InstitutionCapability.DAYCARE_OPERATIONS)).thenReturn(scope)
        `when`(definitions.findById(definition.id)).thenReturn(Optional.of(definition))

        val response = service.reviseDefinition(jwt, organizationId, definition.id, ReviseConsentDefinitionRequest("Obat revisi", "Teks baru", 2))

        assertEquals(3, response.revision)
        assertEquals(ConsentPurpose.MEDICATION, response.purpose)
        assertEquals("Obat revisi", response.title)
        assertEquals("Teks baru", response.content)
    }
}
