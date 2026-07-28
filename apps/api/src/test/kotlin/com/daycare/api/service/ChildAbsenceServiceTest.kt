package com.daycare.api.service

import com.daycare.api.domain.ChildAbsencePurpose
import com.daycare.api.domain.ChildAbsenceRequestStatus
import com.daycare.api.domain.Role
import com.daycare.api.persistence.Branch
import com.daycare.api.persistence.BranchRepository
import com.daycare.api.persistence.Child
import com.daycare.api.persistence.ChildAbsenceRequest
import com.daycare.api.persistence.ChildAbsenceRequestRepository
import com.daycare.api.persistence.GuardianLink
import com.daycare.api.persistence.GuardianLinkRepository
import com.daycare.api.persistence.Membership
import com.daycare.api.persistence.MembershipRepository
import com.daycare.api.persistence.UserProfile
import com.daycare.api.realtime.RealtimeFlag
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Test
import org.mockito.Mockito.mock
import org.mockito.Mockito.verify
import org.mockito.Mockito.verifyNoInteractions
import org.mockito.Mockito.`when`
import org.springframework.security.oauth2.jwt.Jwt
import java.time.LocalDate
import java.util.Optional
import java.util.UUID

class ChildAbsenceServiceTest {
    @Test
    fun `Parent creates a future absence request without changing booking data`() {
        val fixture = ChildAbsenceFixture()
        val jwt = mock(Jwt::class.java)
        val organizationId = UUID.randomUUID()
        val parentId = UUID.randomUUID()
        val child = Child(organizationId = organizationId, firstName = "Naya")
        val scope = fixture.scope(organizationId, parentId, Role.PARENT)
        val tomorrow = LocalDate.now().plusDays(1)
        `when`(fixture.access.require(jwt, organizationId, setOf(Role.PARENT))).thenReturn(scope)
        `when`(fixture.childScopes.requireParentLinkedChild(scope, child.id, organizationId)).thenReturn(child)
        `when`(fixture.branches.findById(child.branchId)).thenReturn(Optional.of(Branch(id = child.branchId, organizationId = organizationId)))
        `when`(fixture.requests.findAllByChildIdAndStatusIn(child.id, listOf(ChildAbsenceRequestStatus.PENDING, ChildAbsenceRequestStatus.APPROVED))).thenReturn(emptyList())
        `when`(fixture.requests.save(org.mockito.ArgumentMatchers.any(ChildAbsenceRequest::class.java))).thenAnswer { it.arguments[0] }
        `when`(fixture.memberships.findAllByOrganizationId(organizationId)).thenReturn(emptyList())

        val response = fixture.service.create(jwt, organizationId, CreateChildAbsenceRequest(child.id, ChildAbsencePurpose.SICK, tomorrow, tomorrow, "Demam"))

        assertEquals(ChildAbsenceRequestStatus.PENDING, response.status)
        assertEquals(ChildAbsencePurpose.SICK, response.purpose)
    }

    @Test
    fun `Parent cannot create other absence request without a note`() {
        val fixture = ChildAbsenceFixture()
        val jwt = mock(Jwt::class.java)
        val organizationId = UUID.randomUUID()
        val child = Child(organizationId = organizationId)
        val scope = fixture.scope(organizationId, UUID.randomUUID(), Role.PARENT)
        val tomorrow = LocalDate.now().plusDays(1)
        `when`(fixture.access.require(jwt, organizationId, setOf(Role.PARENT))).thenReturn(scope)
        `when`(fixture.childScopes.requireParentLinkedChild(scope, child.id, organizationId)).thenReturn(child)
        `when`(fixture.branches.findById(child.branchId)).thenReturn(Optional.of(Branch(id = child.branchId, organizationId = organizationId)))

        val error = assertThrows(IllegalArgumentException::class.java) {
            fixture.service.create(jwt, organizationId, CreateChildAbsenceRequest(child.id, ChildAbsencePurpose.OTHER, tomorrow, tomorrow))
        }

        assertEquals("A note is required when the purpose is OTHER", error.message)
        verifyNoInteractions(fixture.requests)
    }

    @Test
    fun `in-scope Staff can approve a pending request and Parent is notified`() {
        val fixture = ChildAbsenceFixture()
        val jwt = mock(Jwt::class.java)
        val organizationId = UUID.randomUUID()
        val staffId = UUID.randomUUID()
        val child = Child(organizationId = organizationId, firstName = "Naya")
        val request = ChildAbsenceRequest(organizationId = organizationId, branchId = child.branchId, childId = child.id, requesterUserId = UUID.randomUUID(), purpose = ChildAbsencePurpose.SICK, startDate = LocalDate.now().plusDays(1), endDate = LocalDate.now().plusDays(1))
        val scope = fixture.scope(organizationId, staffId, Role.STAFF)
        `when`(fixture.access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN, Role.STAFF))).thenReturn(scope)
        `when`(fixture.requests.findById(request.id)).thenReturn(Optional.of(request))
        `when`(fixture.childScopes.requireStaffManagedChild(scope, child.id, organizationId)).thenReturn(child)
        val guardianId = UUID.randomUUID()
        `when`(fixture.guardians.findAllByChildId(child.id)).thenReturn(listOf(GuardianLink(childId = child.id, userId = guardianId)))

        val response = fixture.service.decide(jwt, organizationId, request.id, DecideChildAbsenceRequest(approved = true))

        assertEquals(ChildAbsenceRequestStatus.APPROVED, response.status)
        assertEquals(staffId, request.decidedByUserId)
        verify(fixture.notifications).notify(organizationId, guardianId, "Pengajuan tidak masuk disetujui", "Pengajuan Naya untuk ${request.startDate} s.d. ${request.endDate} telah disetujui.", "/absence-requests?childId=${child.id}", setOf(RealtimeFlag.ABSENCE_REQUESTS))
    }
}

private class ChildAbsenceFixture {
    val access = mock(AccessService::class.java)
    val childScopes = mock(ChildScopeService::class.java)
    val branches = mock(BranchRepository::class.java)
    val requests = mock(ChildAbsenceRequestRepository::class.java)
    val guardians = mock(GuardianLinkRepository::class.java)
    val memberships = mock(MembershipRepository::class.java)
    val branchFilters = mock(BranchListFilterService::class.java)
    val notifications = mock(NotificationService::class.java)
    val service = ChildAbsenceService(access, childScopes, branches, requests, guardians, memberships, branchFilters, notifications)

    fun scope(organizationId: UUID, userId: UUID, role: Role) = AccessScope(UserProfile(id = userId), Membership(userId = userId, organizationId = organizationId, role = role), emptySet(), emptySet())
}
