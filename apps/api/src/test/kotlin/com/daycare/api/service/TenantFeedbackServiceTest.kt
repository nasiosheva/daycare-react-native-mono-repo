package com.daycare.api.service

import com.daycare.api.domain.Role
import com.daycare.api.domain.TenantFeedbackCategory
import com.daycare.api.domain.TenantFeedbackStatus
import com.daycare.api.persistence.Membership
import com.daycare.api.persistence.MembershipRepository
import com.daycare.api.persistence.TenantFeedback
import com.daycare.api.persistence.TenantFeedbackRepository
import com.daycare.api.persistence.UserProfile
import com.daycare.api.persistence.UserProfileRepository
import com.daycare.api.realtime.RealtimeFlag
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import org.mockito.Mockito.any
import org.mockito.Mockito.mock
import org.mockito.Mockito.verify
import org.mockito.Mockito.`when`
import org.springframework.security.oauth2.jwt.Jwt
import java.util.Optional
import java.util.UUID

class TenantFeedbackServiceTest {
    @Test
    fun `submitting feedback notifies every active Staff Admin`() {
        val access = mock(AccessService::class.java)
        val feedback = mock(TenantFeedbackRepository::class.java)
        val users = mock(UserProfileRepository::class.java)
        val memberships = mock(MembershipRepository::class.java)
        val notifications = mock(NotificationService::class.java)
        val jwt = mock(Jwt::class.java)
        val organizationId = UUID.randomUUID()
        val parent = UserProfile(displayName = "Budi")
        val scope = AccessScope(parent, Membership(), emptySet(), emptySet())
        val activeStaffAdminId = UUID.randomUUID()
        val inactiveStaffAdminId = UUID.randomUUID()
        `when`(access.require(jwt, organizationId, setOf(Role.PARENT))).thenReturn(scope)
        `when`(feedback.save(any(TenantFeedback::class.java))).thenAnswer { it.arguments[0] }
        `when`(memberships.findAllByOrganizationId(organizationId)).thenReturn(listOf(
            Membership(organizationId = organizationId, userId = activeStaffAdminId, role = Role.STAFF_ADMIN, active = true),
            Membership(organizationId = organizationId, userId = inactiveStaffAdminId, role = Role.STAFF_ADMIN, active = false),
            Membership(organizationId = organizationId, userId = UUID.randomUUID(), role = Role.STAFF, active = true),
        ))
        val service = TenantFeedbackService(access, feedback, users, memberships, notifications)

        val response = service.create(jwt, organizationId, CreateTenantFeedbackRequest(category = TenantFeedbackCategory.SUGGESTION, message = "Tolong tambah jam operasional"))

        assertEquals("Budi", response.submittedByName)
        assertEquals(TenantFeedbackStatus.NEW, response.status)
        verify(notifications).notify(
            organizationId, activeStaffAdminId, "Saran/masukan baru dari Budi",
            "Tolong tambah jam operasional", "/tenant-feedback-inbox", setOf(RealtimeFlag.TENANT_FEEDBACK),
        )
        org.mockito.Mockito.verifyNoMoreInteractions(notifications)
    }

    @Test
    fun `staff admin updates feedback status`() {
        val access = mock(AccessService::class.java)
        val feedback = mock(TenantFeedbackRepository::class.java)
        val users = mock(UserProfileRepository::class.java)
        val memberships = mock(MembershipRepository::class.java)
        val notifications = mock(NotificationService::class.java)
        val jwt = mock(Jwt::class.java)
        val organizationId = UUID.randomUUID()
        val submitter = UserProfile(displayName = "Budi")
        val scope = AccessScope(UserProfile(), Membership(), emptySet(), emptySet())
        val item = TenantFeedback(organizationId = organizationId, submittedByUserId = submitter.id, category = TenantFeedbackCategory.COMPLAINT, message = "Antrian penjemputan lama")
        `when`(access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN))).thenReturn(scope)
        `when`(feedback.findById(item.id)).thenReturn(Optional.of(item))
        `when`(users.findById(submitter.id)).thenReturn(Optional.of(submitter))
        val service = TenantFeedbackService(access, feedback, users, memberships, notifications)

        val response = service.updateStatus(jwt, organizationId, item.id, UpdateTenantFeedbackStatusRequest(status = TenantFeedbackStatus.RESOLVED))

        assertEquals(TenantFeedbackStatus.RESOLVED, response.status)
        assertEquals("Budi", response.submittedByName)
    }
}
