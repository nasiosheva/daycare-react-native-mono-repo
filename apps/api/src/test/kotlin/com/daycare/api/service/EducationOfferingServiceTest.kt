package com.daycare.api.service

import com.daycare.api.domain.EducationEnrollmentMode
import com.daycare.api.domain.EducationOfferingStatus
import com.daycare.api.domain.InstitutionCapability
import com.daycare.api.domain.Role
import com.daycare.api.persistence.Branch
import com.daycare.api.persistence.BranchRepository
import com.daycare.api.persistence.EducationOffering
import com.daycare.api.persistence.EducationOfferingRepository
import com.daycare.api.persistence.Membership
import com.daycare.api.persistence.OrganizationTypeAssignment
import com.daycare.api.persistence.OrganizationTypeAssignmentRepository
import com.daycare.api.persistence.UserProfile
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.mockito.Mockito.any
import org.mockito.Mockito.mock
import org.mockito.Mockito.verify
import org.mockito.Mockito.`when`
import org.springframework.security.access.AccessDeniedException
import org.springframework.security.oauth2.jwt.Jwt
import java.util.Optional
import java.util.UUID

class EducationOfferingServiceTest {
    @Test
    fun `context exposes only published offerings and current revision`() {
        val fixture = fixture()
        val draft = EducationOffering(organizationId = fixture.organizationId, branchId = UUID.randomUUID(), institutionType = "TK", status = EducationOfferingStatus.DRAFT, revision = 9)
        val published = EducationOffering(organizationId = fixture.organizationId, branchId = UUID.randomUUID(), institutionType = "TK", enrollmentMode = EducationEnrollmentMode.SCHOOL_ADMISSION, capabilities = InstitutionCapability.ACADEMIC_CURRICULUM.name, status = EducationOfferingStatus.PUBLISHED, revision = 3)
        `when`(fixture.offerings.findAllByOrganizationIdOrderByCreatedAtAsc(fixture.organizationId)).thenReturn(listOf(draft, published))

        val result = fixture.service.context(fixture.jwt, fixture.organizationId)

        assertEquals(Role.STAFF_ADMIN, result.role)
        assertTrue(result.active)
        assertEquals(3, result.revision)
        assertEquals(listOf(published.id), result.offerings.map { it.id })
    }

    @Test
    fun `create normalizes type and program code and derives capability`() {
        val fixture = fixture()
        val branch = Branch(id = UUID.randomUUID(), organizationId = fixture.organizationId, active = true)
        `when`(fixture.branches.findById(branch.id)).thenReturn(Optional.of(branch))
        `when`(fixture.organizationTypes.findAllByOrganizationId(fixture.organizationId)).thenReturn(listOf(OrganizationTypeAssignment(organizationId = fixture.organizationId, type = "TK")))
        `when`(fixture.offerings.save(any(EducationOffering::class.java))).thenAnswer { it.arguments[0] }

        val result = fixture.service.create(fixture.jwt, fixture.organizationId, UpsertEducationOfferingRequest(branch.id, " tk ", EducationEnrollmentMode.SCHOOL_ADMISSION, "  kelas-a "))

        assertEquals("TK", result.institutionType)
        assertEquals("KELAS-A", result.programCode)
        assertEquals(setOf(InstitutionCapability.ACADEMIC_CURRICULUM), result.capabilities)
    }

    @Test
    fun `create rejects unavailable branch, type, and mode`() {
        val fixture = fixture()
        val otherOrg = Branch(id = UUID.randomUUID(), organizationId = UUID.randomUUID(), active = true)
        `when`(fixture.branches.findById(otherOrg.id)).thenReturn(Optional.of(otherOrg))
        assertThrows(IllegalArgumentException::class.java) {
            fixture.service.create(fixture.jwt, fixture.organizationId, UpsertEducationOfferingRequest(otherOrg.id, "TK", EducationEnrollmentMode.SCHOOL_ADMISSION))
        }

        val branch = Branch(id = UUID.randomUUID(), organizationId = fixture.organizationId, active = true)
        `when`(fixture.branches.findById(branch.id)).thenReturn(Optional.of(branch))
        `when`(fixture.organizationTypes.findAllByOrganizationId(fixture.organizationId)).thenReturn(emptyList())
        assertThrows(IllegalArgumentException::class.java) {
            fixture.service.create(fixture.jwt, fixture.organizationId, UpsertEducationOfferingRequest(branch.id, "TK", EducationEnrollmentMode.SCHOOL_ADMISSION))
        }

        `when`(fixture.organizationTypes.findAllByOrganizationId(fixture.organizationId)).thenReturn(listOf(OrganizationTypeAssignment(organizationId = fixture.organizationId, type = "TK")))
        assertThrows(IllegalArgumentException::class.java) {
            fixture.service.create(fixture.jwt, fixture.organizationId, UpsertEducationOfferingRequest(branch.id, "TK", EducationEnrollmentMode.DAYCARE_SERVICE))
        }
    }

    @Test
    fun `status transitions increment revision and reject illegal transitions`() {
        val fixture = fixture()
        val offering = EducationOffering(organizationId = fixture.organizationId, status = EducationOfferingStatus.DRAFT, revision = 2)
        `when`(fixture.offerings.findById(offering.id)).thenReturn(Optional.of(offering))

        val published = fixture.service.changeStatus(fixture.jwt, fixture.organizationId, offering.id, SetEducationOfferingStatusRequest(EducationOfferingStatus.PUBLISHED))
        assertEquals(EducationOfferingStatus.PUBLISHED, published.status)
        assertEquals(3, published.revision)
        assertThrows(IllegalArgumentException::class.java) {
            fixture.service.changeStatus(fixture.jwt, fixture.organizationId, offering.id, SetEducationOfferingStatusRequest(EducationOfferingStatus.DRAFT))
        }
    }

    @Test
    fun `published capability requires matching organization status and capability`() {
        val fixture = fixture()
        val offering = EducationOffering(organizationId = fixture.organizationId, status = EducationOfferingStatus.PUBLISHED, capabilities = InstitutionCapability.ACADEMIC_CURRICULUM.name)
        `when`(fixture.offerings.findById(offering.id)).thenReturn(Optional.of(offering))

        assertEquals(offering, fixture.service.requirePublishedCapability(fixture.organizationId, offering.id, InstitutionCapability.ACADEMIC_CURRICULUM))
        assertThrows(AccessDeniedException::class.java) {
            fixture.service.requirePublishedCapability(fixture.organizationId, offering.id, InstitutionCapability.DAYCARE_OPERATIONS)
        }
        offering.status = EducationOfferingStatus.PAUSED
        assertThrows(AccessDeniedException::class.java) {
            fixture.service.requirePublishedCapability(fixture.organizationId, offering.id, InstitutionCapability.ACADEMIC_CURRICULUM)
        }
        assertThrows(IllegalArgumentException::class.java) {
            fixture.service.requirePublishedCapability(UUID.randomUUID(), offering.id, InstitutionCapability.ACADEMIC_CURRICULUM)
        }
    }

    private data class Fixture(
        val organizationId: UUID,
        val jwt: Jwt,
        val offerings: EducationOfferingRepository,
        val branches: BranchRepository,
        val organizationTypes: OrganizationTypeAssignmentRepository,
        val service: EducationOfferingService,
    )

    private fun fixture(): Fixture {
        val organizationId = UUID.randomUUID()
        val access = mock(AccessService::class.java)
        val jwt = mock(Jwt::class.java)
        val offerings = mock(EducationOfferingRepository::class.java)
        val branches = mock(BranchRepository::class.java)
        val organizationTypes = mock(OrganizationTypeAssignmentRepository::class.java)
        `when`(access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN, Role.STAFF, Role.PARENT), readOnly = true)).thenReturn(
            AccessScope(UserProfile(), Membership(organizationId = organizationId, role = Role.STAFF_ADMIN, active = true), emptySet(), emptySet()),
        )
        `when`(access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN), readOnly = true)).thenReturn(AccessScope(UserProfile(), Membership(), emptySet(), emptySet()))
        `when`(access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN))).thenReturn(AccessScope(UserProfile(), Membership(), emptySet(), emptySet()))
        return Fixture(organizationId, jwt, offerings, branches, organizationTypes, EducationOfferingService(access, offerings, branches, organizationTypes))
    }
}
