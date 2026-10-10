package com.daycare.api.service

import com.daycare.api.domain.ChildEnrollmentStatus
import com.daycare.api.domain.RegistrationRole
import com.daycare.api.persistence.Branch
import com.daycare.api.persistence.BranchRepository
import com.daycare.api.persistence.Child
import com.daycare.api.persistence.ChildRepository
import com.daycare.api.persistence.GuardianLink
import com.daycare.api.persistence.GuardianLinkRepository
import com.daycare.api.persistence.Organization
import com.daycare.api.persistence.OrganizationRepository
import com.daycare.api.persistence.UserProfile
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Test
import org.mockito.Mockito.mock
import org.mockito.Mockito.`when`
import org.springframework.security.access.AccessDeniedException
import org.springframework.security.oauth2.jwt.Jwt
import java.time.LocalDate
import java.util.Optional
import java.util.UUID

class ScreeningLinkedChildServiceTest {
    private val identity = mock(IdentityService::class.java)
    private val guardians = mock(GuardianLinkRepository::class.java)
    private val children = mock(ChildRepository::class.java)
    private val organizations = mock(OrganizationRepository::class.java)
    private val branches = mock(BranchRepository::class.java)
    private val service = ScreeningLinkedChildService(identity, guardians, children, organizations, branches)
    private val jwt = mock(Jwt::class.java)

    @Test
    fun `mine returns only distinct active children with stable names and fallback labels`() {
        val parent = UserProfile(id = UUID.randomUUID(), registrationRole = RegistrationRole.PARENT)
        val activeId = UUID.randomUUID()
        val organizationId = UUID.randomUUID()
        val branchId = UUID.randomUUID()
        val active = Child(id = activeId, organizationId = organizationId, branchId = branchId, firstName = " zara ", lastName = null, dateOfBirth = LocalDate.of(2022, 1, 2), enrollmentStatus = ChildEnrollmentStatus.ACTIVE, active = true)
        val pending = Child(id = UUID.randomUUID(), firstName = "Pending", enrollmentStatus = ChildEnrollmentStatus.PENDING, active = true)
        val inactive = Child(id = UUID.randomUUID(), firstName = "Inactive", enrollmentStatus = ChildEnrollmentStatus.ACTIVE, active = false)
        `when`(identity.sync(jwt)).thenReturn(parent)
        `when`(guardians.findAllByUserId(parent.id)).thenReturn(listOf(
            GuardianLink(childId = activeId, userId = parent.id),
            GuardianLink(childId = activeId, userId = parent.id),
            GuardianLink(childId = pending.id, userId = parent.id),
            GuardianLink(childId = inactive.id, userId = parent.id),
            GuardianLink(childId = UUID.randomUUID(), userId = parent.id),
        ))
        `when`(children.findById(activeId)).thenReturn(Optional.of(active))
        `when`(children.findById(pending.id)).thenReturn(Optional.of(pending))
        `when`(children.findById(inactive.id)).thenReturn(Optional.of(inactive))
        `when`(organizations.findById(organizationId)).thenReturn(Optional.empty())
        `when`(branches.findById(branchId)).thenReturn(Optional.empty())

        val result = service.mine(jwt)

        assertEquals(1, result.size)
        assertEquals(" zara ", result.single().childName)
        assertEquals("Unknown organization", result.single().organizationName)
        assertEquals("Unknown branch", result.single().branchName)
    }

    @Test
    fun `mine resolves organization and branch names and sorts children`() {
        val parent = UserProfile(id = UUID.randomUUID(), registrationRole = RegistrationRole.PARENT)
        val organizationId = UUID.randomUUID(); val branchId = UUID.randomUUID()
        val childA = Child(id = UUID.randomUUID(), organizationId = organizationId, branchId = branchId, firstName = "Alya", lastName = "Putri")
        val childB = Child(id = UUID.randomUUID(), organizationId = organizationId, branchId = branchId, firstName = "Budi", lastName = "Santoso")
        `when`(identity.sync(jwt)).thenReturn(parent)
        `when`(guardians.findAllByUserId(parent.id)).thenReturn(listOf(GuardianLink(childId = childB.id, userId = parent.id), GuardianLink(childId = childA.id, userId = parent.id)))
        `when`(children.findById(childA.id)).thenReturn(Optional.of(childA))
        `when`(children.findById(childB.id)).thenReturn(Optional.of(childB))
        `when`(organizations.findById(organizationId)).thenReturn(Optional.of(Organization(id = organizationId, name = "Tenant")))
        `when`(branches.findById(branchId)).thenReturn(Optional.of(Branch(id = branchId, name = "Cabang")))

        val result = service.mine(jwt)

        assertEquals(listOf("Alya Putri", "Budi Santoso"), result.map { it.childName })
        assertEquals("Tenant", result.first().organizationName)
        assertEquals("Cabang", result.first().branchName)
    }

    @Test
    fun `mine rejects non parent accounts`() {
        `when`(identity.sync(jwt)).thenReturn(UserProfile(registrationRole = null))

        assertThrows(AccessDeniedException::class.java) { service.mine(jwt) }
    }
}
