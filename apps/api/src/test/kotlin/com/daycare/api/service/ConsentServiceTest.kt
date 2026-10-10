package com.daycare.api.service

// Mories Deo Hutapea,S.E.,S.Kom

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
import com.daycare.api.persistence.EducationOffering
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
    private val offerings = mock(EducationOfferingRepository::class.java)
    private val service = ConsentService(access, childScopes, definitions, records, mock(AuditLogRepository::class.java), branches, offerings)

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

    @Test
    fun `consent scope resolution covers tenant branch and offering boundaries`() {
        val jwt = mock(Jwt::class.java)
        val organizationId = UUID.randomUUID()
        val scope = AccessScope(UserProfile(), Membership(organizationId = organizationId, role = Role.STAFF_ADMIN), emptySet(), emptySet())
        `when`(access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN), InstitutionCapability.DAYCARE_OPERATIONS)).thenReturn(scope)
        `when`(definitions.save(any(ConsentDefinition::class.java))).thenAnswer { it.arguments[0] }
        assertEquals(null, service.createDefinition(jwt, organizationId, CreateConsentDefinitionRequest(ConsentPurpose.OUTING, "Tenant", "Content")).branchId)
        assertThrows(IllegalArgumentException::class.java) { service.createDefinition(jwt, organizationId, CreateConsentDefinitionRequest(ConsentPurpose.OUTING, "Tenant", "Content", branchId = UUID.randomUUID())) }
        val branch = Branch(organizationId = organizationId)
        `when`(branches.findById(branch.id)).thenReturn(Optional.of(branch))
        assertEquals(branch.id, service.createDefinition(jwt, organizationId, CreateConsentDefinitionRequest(ConsentPurpose.OUTING, "Branch", "Content", ConsentDefinitionScope.BRANCH, branchId = branch.id)).branchId)
        val foreignBranch = Branch(organizationId = UUID.randomUUID())
        `when`(branches.findById(foreignBranch.id)).thenReturn(Optional.of(foreignBranch))
        assertThrows(IllegalArgumentException::class.java) { service.createDefinition(jwt, organizationId, CreateConsentDefinitionRequest(ConsentPurpose.OUTING, "Branch", "Content", ConsentDefinitionScope.BRANCH, branchId = foreignBranch.id)) }
        val offeringId = UUID.randomUUID()
        assertThrows(IllegalArgumentException::class.java) { service.createDefinition(jwt, organizationId, CreateConsentDefinitionRequest(ConsentPurpose.OUTING, "Offering", "Content", ConsentDefinitionScope.OFFERING)) }
        `when`(offerings.findById(offeringId)).thenReturn(Optional.of(EducationOffering(id = offeringId, organizationId = UUID.randomUUID(), branchId = branch.id)))
        assertThrows(IllegalArgumentException::class.java) { service.createDefinition(jwt, organizationId, CreateConsentDefinitionRequest(ConsentPurpose.OUTING, "Offering", "Content", ConsentDefinitionScope.OFFERING, offeringId = offeringId)) }
    }

    @Test
    fun `consent decisions and withdrawal cover declined existing and invalid records`() {
        val jwt = mock(Jwt::class.java)
        val organizationId = UUID.randomUUID(); val parentId = UUID.randomUUID()
        val child = Child(organizationId = organizationId)
        val definition = ConsentDefinition(organizationId = organizationId, purpose = ConsentPurpose.OUTING, title = "Outing", content = "Content", revision = 1, active = true)
        val scope = AccessScope(UserProfile(id = parentId), Membership(organizationId = organizationId, role = Role.PARENT), emptySet(), emptySet())
        `when`(access.require(jwt, organizationId, setOf(Role.PARENT), InstitutionCapability.DAYCARE_OPERATIONS)).thenReturn(scope)
        `when`(childScopes.requireParentOperationalChild(scope, child.id, organizationId)).thenReturn(child)
        `when`(definitions.findById(definition.id)).thenReturn(Optional.of(definition))
        `when`(records.save(any(ConsentRecord::class.java))).thenAnswer { it.arguments[0] }
        val declined = service.decide(jwt, organizationId, child.id, ConsentDecisionRequest(definition.id, false))
        assertEquals(ConsentStatus.DECLINED, declined.status)
        assertThrows(IllegalArgumentException::class.java) { service.decide(jwt, organizationId, child.id, ConsentDecisionRequest(definition.id, null)) }
        val record = ConsentRecord(organizationId = organizationId, childId = child.id, definitionId = definition.id, definitionRevision = definition.revision, guardianUserId = parentId, status = ConsentStatus.GRANTED)
        `when`(records.findByOrganizationIdAndChildIdAndDefinitionIdAndGuardianUserIdAndDefinitionRevision(organizationId, child.id, definition.id, parentId, definition.revision)).thenReturn(record)
        assertEquals(ConsentStatus.WITHDRAWN, service.withdraw(jwt, organizationId, child.id, definition.id).status)
        record.status = ConsentStatus.DECLINED
        assertThrows(org.springframework.security.access.AccessDeniedException::class.java) { service.withdraw(jwt, organizationId, child.id, definition.id) }
    }

    @Test
    fun `consent revisions enforce expected version, active transitions and expiry`() {
        val jwt = mock(Jwt::class.java)
        val organizationId = UUID.randomUUID(); val definition = ConsentDefinition(organizationId = organizationId, purpose = ConsentPurpose.OUTING, title = "Old", content = "Old", revision = 2, active = true)
        val scope = AccessScope(UserProfile(), Membership(organizationId = organizationId, role = Role.STAFF_ADMIN), emptySet(), emptySet())
        `when`(access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN), InstitutionCapability.DAYCARE_OPERATIONS)).thenReturn(scope)
        `when`(definitions.findById(definition.id)).thenReturn(Optional.of(definition))
        assertThrows(IllegalArgumentException::class.java) { service.reviseDefinition(jwt, organizationId, definition.id, ReviseConsentDefinitionRequest("New", "Content", 1)) }
        assertThrows(IllegalArgumentException::class.java) { service.reviseDefinition(jwt, organizationId, definition.id, ReviseConsentDefinitionRequest("New", "Content", null)) }
        `when`(records.findAllByOrganizationIdAndDefinitionId(organizationId, definition.id)).thenReturn(emptyList())
        assertEquals(false, service.setDefinitionActive(jwt, organizationId, definition.id, SetConsentDefinitionActiveRequest(false, 2)).active)
        assertEquals(3, definition.revision)
        assertEquals(false, service.setDefinitionActive(jwt, organizationId, definition.id, SetConsentDefinitionActiveRequest(false, 3)).active)
        definition.active = true
        definition.effectiveUntil = Instant.now().minusSeconds(1)
        val parentScope = AccessScope(UserProfile(), Membership(organizationId = organizationId, role = Role.PARENT), emptySet(), emptySet())
        `when`(access.require(jwt, organizationId, setOf(Role.PARENT), InstitutionCapability.DAYCARE_OPERATIONS)).thenReturn(parentScope)
        val expiryChildId = UUID.randomUUID()
        `when`(childScopes.requireParentOperationalChild(parentScope, expiryChildId, organizationId)).thenReturn(Child(organizationId = organizationId))
        assertThrows(IllegalArgumentException::class.java) {
            service.decide(jwt, organizationId, expiryChildId, ConsentDecisionRequest(definition.id, true))
        }
    }

    @Test
    fun `managed and public definitions return mapped active and inactive records`() {
        val jwt = mock(Jwt::class.java)
        val organizationId = UUID.randomUUID()
        val staffScope = AccessScope(UserProfile(), Membership(organizationId = organizationId, role = Role.STAFF_ADMIN), emptySet(), setOf(InstitutionCapability.DAYCARE_OPERATIONS))
        `when`(access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN), InstitutionCapability.DAYCARE_OPERATIONS, readOnly = true)).thenReturn(staffScope)
        val active = ConsentDefinition(organizationId = organizationId, purpose = ConsentPurpose.OUTING, title = "Active", content = "Content")
        val inactive = ConsentDefinition(organizationId = organizationId, purpose = ConsentPurpose.MEDICATION, title = "Inactive", content = "Content", active = false)
        `when`(definitions.findAllByOrganizationIdOrderByCreatedAtDesc(organizationId)).thenReturn(listOf(inactive))
        `when`(definitions.findAllByOrganizationIdAndActiveTrueOrderByCreatedAtDesc(organizationId)).thenReturn(listOf(active))

        assertEquals(listOf(inactive.id), service.managedDefinitions(jwt, organizationId).map { it.id })
        assertEquals(listOf(active.id), service.definitions(jwt, organizationId).map { it.id })
    }

    @Test
    fun `offering scope resolves valid offering and rejects missing or foreign references`() {
        val jwt = mock(Jwt::class.java)
        val organizationId = UUID.randomUUID()
        val branch = Branch(organizationId = organizationId)
        val offering = EducationOffering(organizationId = organizationId, branchId = branch.id)
        val scope = AccessScope(UserProfile(), Membership(organizationId = organizationId, role = Role.STAFF_ADMIN), emptySet(), emptySet())
        `when`(access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN), InstitutionCapability.DAYCARE_OPERATIONS)).thenReturn(scope)
        `when`(definitions.save(any(ConsentDefinition::class.java))).thenAnswer { it.arguments[0] }
        `when`(offerings.findById(offering.id)).thenReturn(Optional.of(offering))

        val response = service.createDefinition(jwt, organizationId, CreateConsentDefinitionRequest(ConsentPurpose.OUTING, " Offering ", " Content ", ConsentDefinitionScope.OFFERING, offeringId = offering.id))

        assertEquals(ConsentDefinitionScope.OFFERING, response.scope)
        assertEquals(offering.id, response.offeringId)
        assertEquals(branch.id, response.branchId)
        assertThrows(IllegalArgumentException::class.java) {
            service.createDefinition(jwt, organizationId, CreateConsentDefinitionRequest(ConsentPurpose.OUTING, "Offering", "Content", ConsentDefinitionScope.OFFERING, offeringId = UUID.randomUUID()))
        }
        val foreign = EducationOffering(organizationId = UUID.randomUUID(), branchId = branch.id)
        `when`(offerings.findById(foreign.id)).thenReturn(Optional.of(foreign))
        assertThrows(IllegalArgumentException::class.java) {
            service.createDefinition(jwt, organizationId, CreateConsentDefinitionRequest(ConsentPurpose.OUTING, "Offering", "Content", ConsentDefinitionScope.OFFERING, offeringId = foreign.id))
        }
    }

    @Test
    fun `parent consent list reports pending declined and branch visible statuses`() {
        val jwt = mock(Jwt::class.java)
        val organizationId = UUID.randomUUID(); val parentId = UUID.randomUUID(); val branchId = UUID.randomUUID()
        val child = Child(organizationId = organizationId, branchId = branchId)
        val tenant = ConsentDefinition(organizationId = organizationId, purpose = ConsentPurpose.OUTING, title = "Tenant", content = "Tenant")
        val branch = ConsentDefinition(organizationId = organizationId, purpose = ConsentPurpose.MEDICATION, title = "Branch", content = "Branch", scope = ConsentDefinitionScope.BRANCH, branchId = branchId)
        val record = ConsentRecord(organizationId = organizationId, childId = child.id, definitionId = branch.id, definitionRevision = branch.revision, guardianUserId = parentId, status = ConsentStatus.DECLINED)
        val scope = AccessScope(UserProfile(id = parentId), Membership(organizationId = organizationId, role = Role.PARENT), emptySet(), emptySet())
        `when`(access.require(jwt, organizationId, setOf(Role.PARENT), InstitutionCapability.DAYCARE_OPERATIONS, readOnly = true)).thenReturn(scope)
        `when`(childScopes.requireParentLinkedChild(scope, child.id, organizationId)).thenReturn(child)
        `when`(records.findAllByOrganizationIdAndChildIdAndGuardianUserId(organizationId, child.id, parentId)).thenReturn(listOf(record))
        `when`(definitions.findAllByOrganizationIdAndActiveTrueOrderByCreatedAtDesc(organizationId)).thenReturn(listOf(tenant, branch))

        val response = service.parentConsents(jwt, organizationId, child.id)

        assertEquals(listOf(ConsentStatus.PENDING, ConsentStatus.DECLINED), response.map { it.status })
    }

    @Test
    fun `active transition supersedes both granted and declined stale records`() {
        val jwt = mock(Jwt::class.java)
        val organizationId = UUID.randomUUID()
        val definition = ConsentDefinition(organizationId = organizationId, purpose = ConsentPurpose.OUTING, title = "Title", content = "Content", revision = 1, active = false)
        val granted = ConsentRecord(organizationId = organizationId, definitionId = definition.id, definitionRevision = 1, status = ConsentStatus.GRANTED)
        val declined = ConsentRecord(organizationId = organizationId, definitionId = definition.id, definitionRevision = 1, status = ConsentStatus.DECLINED)
        val withdrawn = ConsentRecord(organizationId = organizationId, definitionId = definition.id, definitionRevision = 1, status = ConsentStatus.WITHDRAWN)
        val scope = AccessScope(UserProfile(), Membership(organizationId = organizationId, role = Role.STAFF_ADMIN), emptySet(), emptySet())
        `when`(access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN), InstitutionCapability.DAYCARE_OPERATIONS)).thenReturn(scope)
        `when`(definitions.findById(definition.id)).thenReturn(Optional.of(definition))
        `when`(records.findAllByOrganizationIdAndDefinitionId(organizationId, definition.id)).thenReturn(listOf(granted, declined, withdrawn))

        val response = service.setDefinitionActive(jwt, organizationId, definition.id, SetConsentDefinitionActiveRequest(true, 1))

        assertTrue(response.active)
        assertEquals(ConsentStatus.SUPERSEDED, granted.status)
        assertEquals(ConsentStatus.SUPERSEDED, declined.status)
        assertEquals(ConsentStatus.WITHDRAWN, withdrawn.status)
    }

    @Test
    fun `decision and withdrawal reject inactive expired missing and non granted records`() {
        val jwt = mock(Jwt::class.java)
        val organizationId = UUID.randomUUID(); val parentId = UUID.randomUUID(); val child = Child(organizationId = organizationId)
        val definition = ConsentDefinition(organizationId = organizationId, purpose = ConsentPurpose.OUTING, title = "Title", content = "Content", active = false)
        val scope = AccessScope(UserProfile(id = parentId), Membership(organizationId = organizationId, role = Role.PARENT), emptySet(), emptySet())
        `when`(access.require(jwt, organizationId, setOf(Role.PARENT), InstitutionCapability.DAYCARE_OPERATIONS)).thenReturn(scope)
        `when`(childScopes.requireParentOperationalChild(scope, child.id, organizationId)).thenReturn(child)
        `when`(definitions.findById(definition.id)).thenReturn(Optional.of(definition))
        assertThrows(IllegalArgumentException::class.java) { service.decide(jwt, organizationId, child.id, ConsentDecisionRequest(definition.id, true)) }
        definition.active = true
        definition.effectiveUntil = Instant.now().minusSeconds(1)
        assertThrows(IllegalArgumentException::class.java) { service.decide(jwt, organizationId, child.id, ConsentDecisionRequest(definition.id, true)) }
        definition.effectiveUntil = null
        assertThrows(IllegalArgumentException::class.java) { service.withdraw(jwt, organizationId, child.id, definition.id) }
        val declined = ConsentRecord(organizationId = organizationId, childId = child.id, definitionId = definition.id, definitionRevision = definition.revision, guardianUserId = parentId, status = ConsentStatus.DECLINED)
        `when`(records.findByOrganizationIdAndChildIdAndDefinitionIdAndGuardianUserIdAndDefinitionRevision(organizationId, child.id, definition.id, parentId, definition.revision)).thenReturn(declined)
        assertThrows(org.springframework.security.access.AccessDeniedException::class.java) { service.withdraw(jwt, organizationId, child.id, definition.id) }
    }

}
