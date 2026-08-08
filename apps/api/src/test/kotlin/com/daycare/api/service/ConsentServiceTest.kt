package com.daycare.api.service

import com.daycare.api.domain.ConsentDefinitionScope
import com.daycare.api.domain.ConsentPurpose
import com.daycare.api.domain.ConsentStatus
import com.daycare.api.domain.InstitutionCapability
import com.daycare.api.domain.Role
import com.daycare.api.persistence.AuditLogRepository
import com.daycare.api.persistence.Branch
import com.daycare.api.persistence.BranchRepository
import com.daycare.api.persistence.Child
import com.daycare.api.persistence.ConsentDefinition
import com.daycare.api.persistence.ConsentDefinitionRepository
import com.daycare.api.persistence.ConsentRecord
import com.daycare.api.persistence.ConsentRecordRepository
import com.daycare.api.persistence.EducationOfferingRepository
import com.daycare.api.persistence.Membership
import com.daycare.api.persistence.UserProfile
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.mockito.ArgumentMatchers.any
import org.mockito.Mockito.mock
import org.mockito.Mockito.`when`
import org.springframework.security.oauth2.jwt.Jwt
import java.time.Instant
import java.util.Optional
import java.util.UUID

class ConsentServiceTest {
    private val access = mock(AccessService::class.java)
    private val childScopes = mock(ChildScopeService::class.java)
    private val definitions = mock(ConsentDefinitionRepository::class.java)
    private val records = mock(ConsentRecordRepository::class.java)
    private val branches = mock(BranchRepository::class.java)
    private val service = ConsentService(access, childScopes, definitions, records, mock(AuditLogRepository::class.java), branches, mock(EducationOfferingRepository::class.java))

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

    @Test
    fun `creating a branch-scoped definition requires a branch that belongs to the tenant`() {
        val jwt = mock(Jwt::class.java)
        val organizationId = UUID.randomUUID()
        val branch = Branch(organizationId = organizationId)
        val scope = AccessScope(UserProfile(), Membership(organizationId = organizationId, role = Role.STAFF_ADMIN), emptySet(), setOf(InstitutionCapability.DAYCARE_OPERATIONS))
        `when`(access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN), InstitutionCapability.DAYCARE_OPERATIONS)).thenReturn(scope)
        `when`(branches.findById(branch.id)).thenReturn(Optional.of(branch))
        `when`(definitions.save(any(ConsentDefinition::class.java))).thenAnswer { it.arguments[0] }

        val response = service.createDefinition(jwt, organizationId, CreateConsentDefinitionRequest(ConsentPurpose.OUTING, "Kegiatan cabang", "Izin kegiatan", ConsentDefinitionScope.BRANCH, branch.id))

        assertEquals(ConsentDefinitionScope.BRANCH, response.scope)
        assertEquals(branch.id, response.branchId)
    }

    @Test
    fun `creating a branch-scoped definition without a branch is rejected`() {
        val jwt = mock(Jwt::class.java)
        val organizationId = UUID.randomUUID()
        val scope = AccessScope(UserProfile(), Membership(organizationId = organizationId, role = Role.STAFF_ADMIN), emptySet(), setOf(InstitutionCapability.DAYCARE_OPERATIONS))
        `when`(access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN), InstitutionCapability.DAYCARE_OPERATIONS)).thenReturn(scope)

        assertThrows(IllegalArgumentException::class.java) {
            service.createDefinition(jwt, organizationId, CreateConsentDefinitionRequest(ConsentPurpose.OUTING, "Kegiatan cabang", "Izin kegiatan", ConsentDefinitionScope.BRANCH, null))
        }
    }

    @Test
    fun `revising a definition supersedes granted records from the previous revision`() {
        val jwt = mock(Jwt::class.java)
        val organizationId = UUID.randomUUID()
        val definition = ConsentDefinition(organizationId = organizationId, purpose = ConsentPurpose.MEDICATION, title = "Obat", content = "Teks lama", revision = 2)
        val staleRecord = ConsentRecord(organizationId = organizationId, definitionId = definition.id, definitionRevision = 2, status = ConsentStatus.GRANTED)
        val scope = AccessScope(UserProfile(), Membership(organizationId = organizationId, role = Role.STAFF_ADMIN), emptySet(), setOf(InstitutionCapability.DAYCARE_OPERATIONS))
        `when`(access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN), InstitutionCapability.DAYCARE_OPERATIONS)).thenReturn(scope)
        `when`(definitions.findById(definition.id)).thenReturn(Optional.of(definition))
        `when`(records.findAllByOrganizationIdAndDefinitionId(organizationId, definition.id)).thenReturn(listOf(staleRecord))

        service.reviseDefinition(jwt, organizationId, definition.id, ReviseConsentDefinitionRequest("Obat revisi", "Teks baru", 2))

        assertEquals(ConsentStatus.SUPERSEDED, staleRecord.status)
    }

    @Test
    fun `parent view reports an expired status once the definition has passed its effective until`() {
        val jwt = mock(Jwt::class.java)
        val organizationId = UUID.randomUUID()
        val parentId = UUID.randomUUID()
        val child = Child(organizationId = organizationId)
        val definition = ConsentDefinition(organizationId = organizationId, purpose = ConsentPurpose.OUTING, title = "Kegiatan luar", content = "Izinkan", revision = 1, effectiveUntil = Instant.now().minusSeconds(60))
        val record = ConsentRecord(organizationId = organizationId, childId = child.id, definitionId = definition.id, definitionRevision = 1, guardianUserId = parentId, status = ConsentStatus.GRANTED)
        val scope = AccessScope(UserProfile(id = parentId), Membership(organizationId = organizationId, role = Role.PARENT), emptySet(), setOf(InstitutionCapability.DAYCARE_OPERATIONS))
        `when`(access.require(jwt, organizationId, setOf(Role.PARENT), InstitutionCapability.DAYCARE_OPERATIONS, readOnly = true)).thenReturn(scope)
        `when`(childScopes.requireParentLinkedChild(scope, child.id, organizationId)).thenReturn(child)
        `when`(definitions.findAllByOrganizationIdAndActiveTrueOrderByCreatedAtDesc(organizationId)).thenReturn(listOf(definition))
        `when`(records.findAllByOrganizationIdAndChildIdAndGuardianUserId(organizationId, child.id, parentId)).thenReturn(listOf(record))

        val response = service.parentConsents(jwt, organizationId, child.id).single()

        assertEquals(ConsentStatus.EXPIRED, response.status)
    }

    @Test
    fun `parent view hides a branch-scoped definition from a child in a different branch`() {
        val jwt = mock(Jwt::class.java)
        val organizationId = UUID.randomUUID()
        val parentId = UUID.randomUUID()
        val child = Child(organizationId = organizationId, branchId = UUID.randomUUID())
        val definition = ConsentDefinition(organizationId = organizationId, purpose = ConsentPurpose.OUTING, title = "Kegiatan cabang", content = "Izinkan", revision = 1, scope = ConsentDefinitionScope.BRANCH, branchId = UUID.randomUUID())
        val scope = AccessScope(UserProfile(id = parentId), Membership(organizationId = organizationId, role = Role.PARENT), emptySet(), setOf(InstitutionCapability.DAYCARE_OPERATIONS))
        `when`(access.require(jwt, organizationId, setOf(Role.PARENT), InstitutionCapability.DAYCARE_OPERATIONS, readOnly = true)).thenReturn(scope)
        `when`(childScopes.requireParentLinkedChild(scope, child.id, organizationId)).thenReturn(child)
        `when`(definitions.findAllByOrganizationIdAndActiveTrueOrderByCreatedAtDesc(organizationId)).thenReturn(listOf(definition))
        `when`(records.findAllByOrganizationIdAndChildIdAndGuardianUserId(organizationId, child.id, parentId)).thenReturn(emptyList())

        val response = service.parentConsents(jwt, organizationId, child.id)

        assertTrue(response.isEmpty())
    }
}
