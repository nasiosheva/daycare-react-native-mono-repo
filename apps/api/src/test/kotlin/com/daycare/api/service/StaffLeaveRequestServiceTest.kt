package com.daycare.api.service

import com.daycare.api.domain.Role
import com.daycare.api.domain.StaffLeaveRequestStatus
import com.daycare.api.domain.StaffLeaveRequestType
import com.daycare.api.persistence.AuditLogRepository
import com.daycare.api.persistence.Membership
import com.daycare.api.persistence.MembershipRepository
import com.daycare.api.persistence.StaffLeaveRequest
import com.daycare.api.persistence.StaffLeaveRequestRepository
import com.daycare.api.persistence.UserProfile
import com.daycare.api.persistence.UserProfileRepository
import com.daycare.api.realtime.RealtimePublisher
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Test
import org.mockito.ArgumentCaptor
import org.mockito.Mockito.mock
import org.mockito.Mockito.verify
import org.mockito.Mockito.`when`
import org.springframework.security.oauth2.jwt.Jwt
import java.time.LocalDate
import java.util.Optional
import java.util.UUID

class StaffLeaveRequestServiceTest {
    @Test
    fun `creates a Staff leave request and notifies active Staff Admins`() {
        val fixture = StaffLeaveRequestFixture()
        val jwt = mock(Jwt::class.java)
        val organizationId = UUID.randomUUID()
        val staff = UserProfile(displayName = "Rani")
        `when`(fixture.access.require(jwt, organizationId, setOf(Role.STAFF))).thenReturn(fixture.scope(organizationId, staff, Role.STAFF))
        `when`(fixture.requests.findAllByOrganizationIdAndRequesterUserIdAndStatusIn(organizationId, staff.id, setOf(StaffLeaveRequestStatus.PENDING, StaffLeaveRequestStatus.APPROVED))).thenReturn(emptyList())
        `when`(fixture.memberships.findAllByOrganizationId(organizationId)).thenReturn(listOf(Membership(organizationId = organizationId, userId = UUID.randomUUID(), role = Role.STAFF_ADMIN)))
        `when`(fixture.users.findById(staff.id)).thenReturn(Optional.of(staff))

        val response = fixture.service.create(jwt, organizationId, CreateStaffLeaveRequest(StaffLeaveRequestType.LEAVE, LocalDate.now(), LocalDate.now().plusDays(1), "Keperluan keluarga"))

        assertEquals(StaffLeaveRequestStatus.PENDING, response.status)
        assertEquals("Rani", response.requesterName)
        val requestCaptor = ArgumentCaptor.forClass(StaffLeaveRequest::class.java)
        verify(fixture.requests).save(requestCaptor.capture())
        assertEquals("Keperluan keluarga", requestCaptor.value.reason)
        val adminUserId = fixture.memberships.findAllByOrganizationId(organizationId).single().userId
        verify(fixture.notifications).notify(organizationId, adminUserId, "Pengajuan cuti/sakit baru", "Rani mengajukan cuti.", "/staff-leave-approvals", setOf(com.daycare.api.realtime.RealtimeFlag.STAFF_LEAVE_REQUESTS))
    }

    @Test
    fun `rejects an overlapping pending request`() {
        val fixture = StaffLeaveRequestFixture()
        val jwt = mock(Jwt::class.java)
        val organizationId = UUID.randomUUID()
        val staff = UserProfile(displayName = "Rani")
        val today = LocalDate.now()
        `when`(fixture.access.require(jwt, organizationId, setOf(Role.STAFF))).thenReturn(fixture.scope(organizationId, staff, Role.STAFF))
        `when`(fixture.requests.findAllByOrganizationIdAndRequesterUserIdAndStatusIn(organizationId, staff.id, setOf(StaffLeaveRequestStatus.PENDING, StaffLeaveRequestStatus.APPROVED))).thenReturn(listOf(StaffLeaveRequest(organizationId = organizationId, requesterUserId = staff.id, startsOn = today, endsOn = today.plusDays(2))))

        val error = assertThrows(IllegalArgumentException::class.java) {
            fixture.service.create(jwt, organizationId, CreateStaffLeaveRequest(StaffLeaveRequestType.SICK, today.plusDays(1), today.plusDays(3), "Sakit"))
        }

        assertEquals(StaffLeaveRequestError.PERIOD_CONFLICT, error.message)
    }

    @Test
    fun `requires a rejection reason when a Staff Admin rejects a request`() {
        val fixture = StaffLeaveRequestFixture()
        val jwt = mock(Jwt::class.java)
        val organizationId = UUID.randomUUID()
        val admin = UserProfile(displayName = "Admin")
        val request = StaffLeaveRequest(organizationId = organizationId, requesterUserId = UUID.randomUUID())
        `when`(fixture.access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN))).thenReturn(fixture.scope(organizationId, admin, Role.STAFF_ADMIN))
        `when`(fixture.requests.findById(request.id)).thenReturn(Optional.of(request))

        val error = assertThrows(IllegalArgumentException::class.java) {
            fixture.service.decide(jwt, organizationId, request.id, DecideStaffLeaveRequest(approved = false))
        }

        assertEquals(StaffLeaveRequestError.REJECTION_REASON_REQUIRED, error.message)
    }
}

private class StaffLeaveRequestFixture {
    val access = mock(AccessService::class.java)
    val requests = mock(StaffLeaveRequestRepository::class.java)
    val memberships = mock(MembershipRepository::class.java)
    val users = mock(UserProfileRepository::class.java)
    val audits = mock(AuditLogRepository::class.java)
    val notifications = mock(NotificationService::class.java)
    val realtime = mock(RealtimePublisher::class.java)
    val service = StaffLeaveRequestService(access, requests, memberships, users, audits, notifications, realtime)

    fun scope(organizationId: UUID, user: UserProfile, role: Role) = AccessScope(user, Membership(organizationId = organizationId, userId = user.id, role = role), emptySet(), emptySet())
}
