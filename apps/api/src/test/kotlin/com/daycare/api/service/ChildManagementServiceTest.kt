package com.daycare.api.service

import com.daycare.api.domain.Role
import com.daycare.api.persistence.Child
import com.daycare.api.persistence.ChildProgramRepository
import com.daycare.api.persistence.ChildRepository
import com.daycare.api.persistence.ChildStaffAssignmentRepository
import com.daycare.api.persistence.Membership
import com.daycare.api.persistence.MembershipRepository
import com.daycare.api.persistence.UserProfile
import com.daycare.api.persistence.UserProfileRepository
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Test
import org.mockito.Mockito.mock
import org.mockito.Mockito.never
import org.mockito.Mockito.verify
import org.mockito.Mockito.`when`
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
        val childScopes = mock(ChildScopeService::class.java)
        val jwt = mock(Jwt::class.java)
        val organizationId = UUID.randomUUID()
        val child = Child(organizationId = organizationId)
        `when`(access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN))).thenReturn(AccessScope(UserProfile(), Membership(), emptySet(), emptySet()))
        `when`(children.findById(child.id)).thenReturn(Optional.of(child))
        val service = ChildManagementService(access, children, programs, assignments, memberships, users, childScopes)

        service.deactivate(jwt, organizationId, child.id)

        assertFalse(child.active)
        verify(children, never()).delete(child)
    }
}
