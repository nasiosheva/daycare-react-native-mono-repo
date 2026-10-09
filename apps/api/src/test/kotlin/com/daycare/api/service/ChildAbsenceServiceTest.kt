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
        `when`(fixture.childScopes.requireParentOperationalChild(scope, child.id, organizationId)).thenReturn(child)
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
        `when`(fixture.childScopes.requireParentOperationalChild(scope, child.id, organizationId)).thenReturn(child)
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

    @Test
    fun `create rejects inverted and past date ranges`() {
        val fixture = ChildAbsenceFixture()
        val jwt = mock(Jwt::class.java)
        val organizationId = UUID.randomUUID()
        val child = Child(organizationId = organizationId)
        val scope = fixture.scope(organizationId, UUID.randomUUID(), Role.PARENT)
        `when`(fixture.access.require(jwt, organizationId, setOf(Role.PARENT))).thenReturn(scope)
        `when`(fixture.childScopes.requireParentOperationalChild(scope, child.id, organizationId)).thenReturn(child)
        `when`(fixture.branches.findById(child.branchId)).thenReturn(Optional.of(Branch(id = child.branchId, organizationId = organizationId)))

        assertThrows(IllegalArgumentException::class.java) {
            fixture.service.create(jwt, organizationId, CreateChildAbsenceRequest(child.id, ChildAbsencePurpose.SICK, LocalDate.now().plusDays(2), LocalDate.now().plusDays(1)))
        }
        assertThrows(IllegalArgumentException::class.java) {
            fixture.service.create(jwt, organizationId, CreateChildAbsenceRequest(child.id, ChildAbsencePurpose.SICK, LocalDate.now().minusDays(1), LocalDate.now().minusDays(1)))
        }
    }

    @Test
    fun `create rejects an existing overlapping pending request`() {
        val fixture = ChildAbsenceFixture()
        val jwt = mock(Jwt::class.java)
        val organizationId = UUID.randomUUID()
        val child = Child(organizationId = organizationId)
        val scope = fixture.scope(organizationId, UUID.randomUUID(), Role.PARENT)
        val date = LocalDate.now().plusDays(2)
        val existing = ChildAbsenceRequest(organizationId = organizationId, childId = child.id, startDate = date, endDate = date)
        `when`(fixture.access.require(jwt, organizationId, setOf(Role.PARENT))).thenReturn(scope)
        `when`(fixture.childScopes.requireParentOperationalChild(scope, child.id, organizationId)).thenReturn(child)
        `when`(fixture.branches.findById(child.branchId)).thenReturn(Optional.of(Branch(id = child.branchId, organizationId = organizationId)))
        `when`(fixture.requests.findAllByChildIdAndStatusIn(child.id, listOf(ChildAbsenceRequestStatus.PENDING, ChildAbsenceRequestStatus.APPROVED))).thenReturn(listOf(existing))

        assertThrows(IllegalArgumentException::class.java) {
            fixture.service.create(jwt, organizationId, CreateChildAbsenceRequest(child.id, ChildAbsencePurpose.SICK, date.minusDays(1), date.plusDays(1), " Demam "))
        }
        verify(fixture.requests, org.mockito.Mockito.never()).save(org.mockito.ArgumentMatchers.any(ChildAbsenceRequest::class.java))
    }

    @Test
    fun `Parent can list linked requests and child is required`() {
        val fixture = ChildAbsenceFixture()
        val jwt = mock(Jwt::class.java)
        val organizationId = UUID.randomUUID()
        val parentId = UUID.randomUUID()
        val child = Child(organizationId = organizationId, firstName = "Naya")
        val scope = fixture.scope(organizationId, parentId, Role.PARENT)
        val request = ChildAbsenceRequest(organizationId = organizationId, childId = child.id, branchId = child.branchId, purpose = ChildAbsencePurpose.FAMILY_EVENT)
        `when`(fixture.access.require(jwt, organizationId, setOf(Role.PARENT, Role.STAFF_ADMIN, Role.STAFF), readOnly = true)).thenReturn(scope)
        `when`(fixture.childScopes.requireParentLinkedChild(scope, child.id, organizationId)).thenReturn(child)
        `when`(fixture.requests.findAllByOrganizationIdAndChildIdOrderByCreatedAtDesc(organizationId, child.id)).thenReturn(listOf(request))

        assertEquals(listOf(request.id), fixture.service.list(jwt, organizationId, child.id).map { it.id })
        assertThrows(IllegalArgumentException::class.java) { fixture.service.list(jwt, organizationId, null) }
    }

    @Test
    fun `staff list filters managed children and branch while admin returns no requests`() {
        val fixture = ChildAbsenceFixture()
        val jwt = mock(Jwt::class.java)
        val organizationId = UUID.randomUUID()
        val staffId = UUID.randomUUID()
        val branchId = UUID.randomUUID()
        val child = Child(organizationId = organizationId, branchId = branchId, firstName = "Ayu")
        val otherChild = Child(organizationId = organizationId, branchId = branchId, firstName = "Bima")
        val managedRequest = ChildAbsenceRequest(organizationId = organizationId, branchId = branchId, childId = child.id)
        val hiddenRequest = ChildAbsenceRequest(organizationId = organizationId, branchId = branchId, childId = otherChild.id)
        val scope = fixture.scope(organizationId, staffId, Role.STAFF)
        `when`(fixture.access.require(jwt, organizationId, setOf(Role.PARENT, Role.STAFF_ADMIN, Role.STAFF), readOnly = true)).thenReturn(scope)
        `when`(fixture.requests.findAllByOrganizationIdAndStatusOrderByStartDateAscCreatedAtAsc(organizationId, ChildAbsenceRequestStatus.PENDING)).thenReturn(listOf(managedRequest, hiddenRequest))
        `when`(fixture.childScopes.requireStaffManagedChild(scope, child.id, organizationId)).thenReturn(child)
        `when`(fixture.childScopes.requireStaffManagedChild(scope, otherChild.id, organizationId)).thenThrow(IllegalArgumentException("hidden"))

        val result = fixture.service.list(jwt, organizationId, null, BranchListFilter(branchId = branchId))
        assertEquals(listOf(managedRequest.id), result.map { it.id })

        val adminScope = fixture.scope(organizationId, UUID.randomUUID(), Role.ADMIN)
        `when`(fixture.access.require(jwt, organizationId, setOf(Role.PARENT, Role.STAFF_ADMIN, Role.STAFF), readOnly = true)).thenReturn(adminScope)
        assertEquals(emptyList<ChildAbsenceResponse>(), fixture.service.list(jwt, organizationId, null))
    }

    @Test
    fun `decide rejects missing rejection reason and non-pending requests`() {
        val fixture = ChildAbsenceFixture()
        val jwt = mock(Jwt::class.java)
        val organizationId = UUID.randomUUID()
        val child = Child(organizationId = organizationId)
        val scope = fixture.scope(organizationId, UUID.randomUUID(), Role.STAFF_ADMIN)
        val request = ChildAbsenceRequest(organizationId = organizationId, childId = child.id, status = ChildAbsenceRequestStatus.PENDING)
        `when`(fixture.access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN, Role.STAFF))).thenReturn(scope)
        `when`(fixture.childScopes.requireStaffManagedChild(scope, child.id, organizationId)).thenReturn(child)
        `when`(fixture.requests.findById(request.id)).thenReturn(Optional.of(request))

        assertThrows(IllegalArgumentException::class.java) {
            fixture.service.decide(jwt, organizationId, request.id, DecideChildAbsenceRequest(approved = false))
        }
        request.status = ChildAbsenceRequestStatus.APPROVED
        assertThrows(IllegalArgumentException::class.java) {
            fixture.service.decide(jwt, organizationId, request.id, DecideChildAbsenceRequest(approved = true))
        }
    }

    @Test
    fun `staff can reject with a trimmed reason and parent can cancel own pending request`() {
        val fixture = ChildAbsenceFixture()
        val jwt = mock(Jwt::class.java)
        val organizationId = UUID.randomUUID()
        val staffId = UUID.randomUUID()
        val requesterId = UUID.randomUUID()
        val child = Child(organizationId = organizationId, firstName = "Naya")
        val request = ChildAbsenceRequest(organizationId = organizationId, childId = child.id, requesterUserId = requesterId)
        val staffScope = fixture.scope(organizationId, staffId, Role.STAFF)
        `when`(fixture.access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN, Role.STAFF))).thenReturn(staffScope)
        `when`(fixture.requests.findById(request.id)).thenReturn(Optional.of(request))
        `when`(fixture.childScopes.requireStaffManagedChild(staffScope, child.id, organizationId)).thenReturn(child)
        val rejected = fixture.service.decide(jwt, organizationId, request.id, DecideChildAbsenceRequest(approved = false, rejectionReason = "  Tidak tersedia  "))
        assertEquals(ChildAbsenceRequestStatus.REJECTED, rejected.status)
        assertEquals("Tidak tersedia", rejected.rejectionReason)

        val parentScope = fixture.scope(organizationId, requesterId, Role.PARENT)
        val pending = ChildAbsenceRequest(organizationId = organizationId, childId = child.id, requesterUserId = requesterId)
        `when`(fixture.access.require(jwt, organizationId, setOf(Role.PARENT))).thenReturn(parentScope)
        `when`(fixture.requests.findById(pending.id)).thenReturn(Optional.of(pending))
        `when`(fixture.childScopes.requireParentOperationalChild(parentScope, child.id, organizationId)).thenReturn(child)
        val cancelled = fixture.service.cancel(jwt, organizationId, pending.id)
        assertEquals(ChildAbsenceRequestStatus.CANCELLED, cancelled.status)
    }

    @Test
    fun `cancel rejects completed request, another requester, and wrong organization`() {
        val fixture = ChildAbsenceFixture()
        val jwt = mock(Jwt::class.java)
        val organizationId = UUID.randomUUID()
        val parentId = UUID.randomUUID()
        val child = Child(organizationId = organizationId)
        val scope = fixture.scope(organizationId, parentId, Role.PARENT)
        `when`(fixture.access.require(jwt, organizationId, setOf(Role.PARENT))).thenReturn(scope)
        val approved = ChildAbsenceRequest(organizationId = organizationId, childId = child.id, status = ChildAbsenceRequestStatus.APPROVED)
        `when`(fixture.requests.findById(approved.id)).thenReturn(Optional.of(approved))
        assertThrows(IllegalArgumentException::class.java) { fixture.service.cancel(jwt, organizationId, approved.id) }

        val otherRequester = ChildAbsenceRequest(organizationId = organizationId, childId = child.id, requesterUserId = UUID.randomUUID())
        `when`(fixture.requests.findById(otherRequester.id)).thenReturn(Optional.of(otherRequester))
        `when`(fixture.childScopes.requireParentOperationalChild(scope, child.id, organizationId)).thenReturn(child)
        assertThrows(IllegalArgumentException::class.java) { fixture.service.cancel(jwt, organizationId, otherRequester.id) }

        val foreign = ChildAbsenceRequest(organizationId = UUID.randomUUID(), childId = child.id)
        `when`(fixture.requests.findById(foreign.id)).thenReturn(Optional.of(foreign))
        assertThrows(IllegalArgumentException::class.java) { fixture.service.cancel(jwt, organizationId, foreign.id) }
    }

    @Test
    fun `create notifies active approvers and only managed staff`() {
        val fixture = ChildAbsenceFixture()
        val jwt = mock(Jwt::class.java)
        val organizationId = UUID.randomUUID()
        val parentId = UUID.randomUUID()
        val child = Child(organizationId = organizationId, branchId = UUID.randomUUID(), firstName = "Naya")
        val scope = fixture.scope(organizationId, parentId, Role.PARENT)
        val adminId = UUID.randomUUID()
        val inactiveId = UUID.randomUUID()
        val unrelatedId = UUID.randomUUID()
        val members = listOf(
            Membership(userId = adminId, organizationId = organizationId, role = Role.STAFF_ADMIN, active = true),
            Membership(userId = inactiveId, organizationId = organizationId, role = Role.STAFF, active = false),
            Membership(userId = unrelatedId, organizationId = organizationId, role = Role.PARENT, active = true),
        )
        `when`(fixture.access.require(jwt, organizationId, setOf(Role.PARENT))).thenReturn(scope)
        `when`(fixture.childScopes.requireParentOperationalChild(scope, child.id, organizationId)).thenReturn(child)
        `when`(fixture.branches.findById(child.branchId)).thenReturn(Optional.of(Branch(id = child.branchId, organizationId = organizationId)))
        `when`(fixture.requests.findAllByChildIdAndStatusIn(child.id, listOf(ChildAbsenceRequestStatus.PENDING, ChildAbsenceRequestStatus.APPROVED))).thenReturn(emptyList())
        `when`(fixture.requests.save(org.mockito.ArgumentMatchers.any(ChildAbsenceRequest::class.java))).thenAnswer { it.arguments[0] }
        `when`(fixture.memberships.findAllByOrganizationId(organizationId)).thenReturn(members)

        val date = LocalDate.now().plusDays(1)
        fixture.service.create(jwt, organizationId, CreateChildAbsenceRequest(child.id, ChildAbsencePurpose.SICK, date, date))

        verify(fixture.notifications).notify(
            organizationId,
            adminId,
            "Pengajuan tidak masuk",
            "Naya mengajukan tidak masuk $date s.d. $date.",
            "/absence-requests",
            setOf(RealtimeFlag.ABSENCE_REQUESTS),
        )
        org.mockito.Mockito.verifyNoMoreInteractions(fixture.notifications)
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
