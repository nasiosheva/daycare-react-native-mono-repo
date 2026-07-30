package com.daycare.api.service

import com.daycare.api.domain.Role
import com.daycare.api.persistence.Child
import com.daycare.api.persistence.ChildProgramRepository
import com.daycare.api.persistence.ChildRepository
import com.daycare.api.persistence.ChildStaffAssignmentRepository
import com.daycare.api.persistence.GuardianLink
import com.daycare.api.persistence.GuardianLinkRepository
import com.daycare.api.persistence.Membership
import com.daycare.api.persistence.MembershipRepository
import com.daycare.api.persistence.UserProfile
import com.daycare.api.persistence.UserProfileRepository
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.mockito.Mockito.any
import org.mockito.Mockito.mock
import org.mockito.Mockito.never
import org.mockito.Mockito.verify
import org.mockito.Mockito.`when`
import org.springframework.security.access.AccessDeniedException
import org.springframework.security.oauth2.jwt.Jwt
import java.util.Optional
import java.util.UUID

class ChildManagementServiceTest {
    @Test
    fun `Staff Admin deactivates a child without deleting its record`() {
        val access = mock(AccessService::class.java)
        val children = mock(ChildRepository::class.java)
        val programs = mock(ChildProgramRepository::class.java)
        val assignments = mock(ChildStaffAssignmentRepository::class.java)
        val memberships = mock(MembershipRepository::class.java)
        val users = mock(UserProfileRepository::class.java)
        val guardianLinks = mock(GuardianLinkRepository::class.java)
        val childScopes = mock(ChildScopeService::class.java)
        val jwt = mock(Jwt::class.java)
        val organizationId = UUID.randomUUID()
        val child = Child(organizationId = organizationId)
        `when`(access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN))).thenReturn(AccessScope(UserProfile(), Membership(), emptySet(), emptySet()))
        `when`(children.findById(child.id)).thenReturn(Optional.of(child))
        val service = ChildManagementService(access, children, programs, assignments, memberships, users, guardianLinks, childScopes)

        service.deactivate(jwt, organizationId, child.id)

        assertFalse(child.active)
        verify(children, never()).delete(child)
    }

    @Test
    fun `Staff needs child program permission before adding a program`() {
        val access = mock(AccessService::class.java)
        val children = mock(ChildRepository::class.java)
        val programs = mock(ChildProgramRepository::class.java)
        val assignments = mock(ChildStaffAssignmentRepository::class.java)
        val memberships = mock(MembershipRepository::class.java)
        val users = mock(UserProfileRepository::class.java)
        val guardianLinks = mock(GuardianLinkRepository::class.java)
        val childScopes = mock(ChildScopeService::class.java)
        val jwt = mock(Jwt::class.java)
        val organizationId = UUID.randomUUID()
        val childId = UUID.randomUUID()
        val scope = AccessScope(UserProfile(), Membership(role = Role.STAFF, canManageChildPrograms = false), emptySet(), emptySet())
        `when`(access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN, Role.STAFF))).thenReturn(scope)
        val service = ChildManagementService(access, children, programs, assignments, memberships, users, guardianLinks, childScopes)

        assertThrows(AccessDeniedException::class.java) {
            service.addProgram(jwt, organizationId, childId, CreateChildProgramRequest("Membaca", null))
        }

        verify(childScopes, never()).requireStaffManagedChild(scope, childId, organizationId)
        verify(programs, never()).save(any(com.daycare.api.persistence.ChildProgram::class.java))
    }

    @Test
    fun `permitted Staff can add a program only after assigned child scope is verified`() {
        val access = mock(AccessService::class.java)
        val children = mock(ChildRepository::class.java)
        val programs = mock(ChildProgramRepository::class.java)
        val assignments = mock(ChildStaffAssignmentRepository::class.java)
        val memberships = mock(MembershipRepository::class.java)
        val users = mock(UserProfileRepository::class.java)
        val guardianLinks = mock(GuardianLinkRepository::class.java)
        val childScopes = mock(ChildScopeService::class.java)
        val jwt = mock(Jwt::class.java)
        val organizationId = UUID.randomUUID()
        val child = Child(organizationId = organizationId)
        val scope = AccessScope(UserProfile(), Membership(role = Role.STAFF, canManageChildPrograms = true), emptySet(), emptySet())
        `when`(access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN, Role.STAFF))).thenReturn(scope)
        `when`(childScopes.requireStaffManagedChild(scope, child.id, organizationId)).thenReturn(child)
        `when`(programs.save(any(com.daycare.api.persistence.ChildProgram::class.java))).thenAnswer { it.arguments[0] }
        val service = ChildManagementService(access, children, programs, assignments, memberships, users, guardianLinks, childScopes)

        val response = service.addProgram(jwt, organizationId, child.id, CreateChildProgramRequest("Membaca", "Cerita"))

        assertEquals("Membaca", response.name)
        verify(childScopes).requireStaffManagedChild(scope, child.id, organizationId)
    }

    @Test
    fun `permitted Staff can remove a program only after assigned child scope is verified`() {
        val access = mock(AccessService::class.java)
        val children = mock(ChildRepository::class.java)
        val programs = mock(ChildProgramRepository::class.java)
        val assignments = mock(ChildStaffAssignmentRepository::class.java)
        val memberships = mock(MembershipRepository::class.java)
        val users = mock(UserProfileRepository::class.java)
        val guardianLinks = mock(GuardianLinkRepository::class.java)
        val childScopes = mock(ChildScopeService::class.java)
        val jwt = mock(Jwt::class.java)
        val organizationId = UUID.randomUUID()
        val child = Child(organizationId = organizationId)
        val program = com.daycare.api.persistence.ChildProgram(organizationId = organizationId, childId = child.id, name = "Membaca")
        val scope = AccessScope(UserProfile(), Membership(role = Role.STAFF, canManageChildPrograms = true), emptySet(), emptySet())
        `when`(access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN, Role.STAFF))).thenReturn(scope)
        `when`(childScopes.requireStaffManagedChild(scope, child.id, organizationId)).thenReturn(child)
        `when`(programs.findById(program.id)).thenReturn(Optional.of(program))
        val service = ChildManagementService(access, children, programs, assignments, memberships, users, guardianLinks, childScopes)

        service.removeProgram(jwt, organizationId, child.id, program.id)

        verify(childScopes).requireStaffManagedChild(scope, child.id, organizationId)
        verify(programs).delete(program)
    }

    @Test
    fun `Staff Admin binds a Parent found by email and creates a new active membership`() {
        val access = mock(AccessService::class.java)
        val children = mock(ChildRepository::class.java)
        val programs = mock(ChildProgramRepository::class.java)
        val assignments = mock(ChildStaffAssignmentRepository::class.java)
        val memberships = mock(MembershipRepository::class.java)
        val users = mock(UserProfileRepository::class.java)
        val guardianLinks = mock(GuardianLinkRepository::class.java)
        val childScopes = mock(ChildScopeService::class.java)
        val jwt = mock(Jwt::class.java)
        val organizationId = UUID.randomUUID()
        val child = Child(organizationId = organizationId)
        val parent = UserProfile(displayName = "Budi", email = "budi@gmail.com", username = "budi")
        `when`(access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN))).thenReturn(AccessScope(UserProfile(), Membership(), emptySet(), emptySet()))
        `when`(children.findById(child.id)).thenReturn(Optional.of(child))
        `when`(users.findByEmailIgnoreCase("budi@gmail.com")).thenReturn(parent)
        `when`(memberships.findAllByUserIdAndOrganizationId(parent.id, organizationId)).thenReturn(emptyList())
        `when`(guardianLinks.existsByChildIdAndUserId(child.id, parent.id)).thenReturn(false)
        val service = ChildManagementService(access, children, programs, assignments, memberships, users, guardianLinks, childScopes)

        val response = service.bindGuardian(jwt, organizationId, child.id, BindChildGuardianRequest("budi@gmail.com"))

        assertEquals(parent.id, response.userId)
        assertEquals("Budi", response.displayName)
        val membershipCaptor = org.mockito.ArgumentCaptor.forClass(Membership::class.java)
        verify(memberships).save(membershipCaptor.capture())
        assertEquals(Role.PARENT, membershipCaptor.value.role)
        assertTrue(membershipCaptor.value.active)
        verify(guardianLinks).save(any(GuardianLink::class.java))
    }

    @Test
    fun `binding a Parent found by username reactivates an existing inactive membership instead of duplicating it`() {
        val access = mock(AccessService::class.java)
        val children = mock(ChildRepository::class.java)
        val programs = mock(ChildProgramRepository::class.java)
        val assignments = mock(ChildStaffAssignmentRepository::class.java)
        val memberships = mock(MembershipRepository::class.java)
        val users = mock(UserProfileRepository::class.java)
        val guardianLinks = mock(GuardianLinkRepository::class.java)
        val childScopes = mock(ChildScopeService::class.java)
        val jwt = mock(Jwt::class.java)
        val organizationId = UUID.randomUUID()
        val child = Child(organizationId = organizationId)
        val parent = UserProfile(displayName = "Sinta", email = "sinta@gmail.com", username = "sinta")
        val existingMembership = Membership(userId = parent.id, organizationId = organizationId, role = Role.PARENT, active = false)
        `when`(access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN))).thenReturn(AccessScope(UserProfile(), Membership(), emptySet(), emptySet()))
        `when`(children.findById(child.id)).thenReturn(Optional.of(child))
        `when`(users.findByUsernameIgnoreCase("sinta")).thenReturn(parent)
        `when`(memberships.findAllByUserIdAndOrganizationId(parent.id, organizationId)).thenReturn(listOf(existingMembership))
        `when`(guardianLinks.existsByChildIdAndUserId(child.id, parent.id)).thenReturn(true)
        val service = ChildManagementService(access, children, programs, assignments, memberships, users, guardianLinks, childScopes)

        service.bindGuardian(jwt, organizationId, child.id, BindChildGuardianRequest("sinta"))

        assertTrue(existingMembership.active)
        verify(memberships, never()).save(any())
        verify(guardianLinks, never()).save(any(GuardianLink::class.java))
    }

    @Test
    fun `binding throws when no Parent account matches the identifier`() {
        val access = mock(AccessService::class.java)
        val children = mock(ChildRepository::class.java)
        val programs = mock(ChildProgramRepository::class.java)
        val assignments = mock(ChildStaffAssignmentRepository::class.java)
        val memberships = mock(MembershipRepository::class.java)
        val users = mock(UserProfileRepository::class.java)
        val guardianLinks = mock(GuardianLinkRepository::class.java)
        val childScopes = mock(ChildScopeService::class.java)
        val jwt = mock(Jwt::class.java)
        val organizationId = UUID.randomUUID()
        val child = Child(organizationId = organizationId)
        `when`(access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN))).thenReturn(AccessScope(UserProfile(), Membership(), emptySet(), emptySet()))
        `when`(children.findById(child.id)).thenReturn(Optional.of(child))
        `when`(users.findByUsernameIgnoreCase("unknown")).thenReturn(null)
        val service = ChildManagementService(access, children, programs, assignments, memberships, users, guardianLinks, childScopes)

        val error = assertThrows(IllegalArgumentException::class.java) {
            service.bindGuardian(jwt, organizationId, child.id, BindChildGuardianRequest("unknown"))
        }

        assertEquals("Parent account was not found", error.message)
        verify(memberships, never()).save(any())
    }

    @Test
    fun `unbinding removes the guardian link for the given user`() {
        val access = mock(AccessService::class.java)
        val children = mock(ChildRepository::class.java)
        val programs = mock(ChildProgramRepository::class.java)
        val assignments = mock(ChildStaffAssignmentRepository::class.java)
        val memberships = mock(MembershipRepository::class.java)
        val users = mock(UserProfileRepository::class.java)
        val guardianLinks = mock(GuardianLinkRepository::class.java)
        val childScopes = mock(ChildScopeService::class.java)
        val jwt = mock(Jwt::class.java)
        val organizationId = UUID.randomUUID()
        val child = Child(organizationId = organizationId)
        val parentUserId = UUID.randomUUID()
        val link = GuardianLink(childId = child.id, userId = parentUserId)
        `when`(access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN))).thenReturn(AccessScope(UserProfile(), Membership(), emptySet(), emptySet()))
        `when`(children.findById(child.id)).thenReturn(Optional.of(child))
        `when`(guardianLinks.findAllByChildId(child.id)).thenReturn(listOf(link))
        val service = ChildManagementService(access, children, programs, assignments, memberships, users, guardianLinks, childScopes)

        service.unbindGuardian(jwt, organizationId, child.id, parentUserId)

        verify(guardianLinks).delete(link)
    }
}
