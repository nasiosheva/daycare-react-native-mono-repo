package com.daycare.api.service

// Mories Deo Hutapea,S.E.,S.Kom

import com.daycare.api.domain.ChildEnrollmentStatus
import com.daycare.api.domain.Role
import com.daycare.api.persistence.Child
import com.daycare.api.persistence.ChildRepository
import com.daycare.api.persistence.GuardianLinkRepository
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
import org.junit.jupiter.api.Assertions.assertThrows
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
        val children = mock(ChildRepository::class.java)
        val guardians = mock(GuardianLinkRepository::class.java)
        val notifications = mock(NotificationService::class.java)
        val jwt = mock(Jwt::class.java)
        val organizationId = UUID.randomUUID()
        val parent = UserProfile(displayName = "Budi", registrationRole = com.daycare.api.domain.RegistrationRole.PARENT)
        val scope = AccessScope(parent, Membership(), emptySet(), emptySet())
        val activeStaffAdminId = UUID.randomUUID()
        val inactiveStaffAdminId = UUID.randomUUID()
        `when`(access.require(jwt, organizationId, setOf(Role.PARENT))).thenReturn(scope)
        val child = Child(organizationId = organizationId, enrollmentStatus = ChildEnrollmentStatus.ACTIVE)
        `when`(children.findAllByOrganizationId(organizationId)).thenReturn(listOf(child))
        `when`(guardians.existsByChildIdAndUserId(child.id, parent.id)).thenReturn(true)
        `when`(feedback.save(any(TenantFeedback::class.java))).thenAnswer { it.arguments[0] }
        `when`(memberships.findAllByOrganizationId(organizationId)).thenReturn(listOf(
            Membership(organizationId = organizationId, userId = activeStaffAdminId, role = Role.STAFF_ADMIN, active = true),
            Membership(organizationId = organizationId, userId = inactiveStaffAdminId, role = Role.STAFF_ADMIN, active = false),
            Membership(organizationId = organizationId, userId = UUID.randomUUID(), role = Role.STAFF, active = true),
        ))
        val service = TenantFeedbackService(access, feedback, users, memberships, children, guardians, notifications)

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
        val children = mock(ChildRepository::class.java)
        val guardians = mock(GuardianLinkRepository::class.java)
        val notifications = mock(NotificationService::class.java)
        val jwt = mock(Jwt::class.java)
        val organizationId = UUID.randomUUID()
        val submitter = UserProfile(displayName = "Budi")
        val scope = AccessScope(UserProfile(), Membership(), emptySet(), emptySet())
        val item = TenantFeedback(organizationId = organizationId, submittedByUserId = submitter.id, category = TenantFeedbackCategory.COMPLAINT, message = "Antrian penjemputan lama")
        `when`(access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN))).thenReturn(scope)
        `when`(feedback.findById(item.id)).thenReturn(Optional.of(item))
        `when`(users.findById(submitter.id)).thenReturn(Optional.of(submitter))
        val service = TenantFeedbackService(access, feedback, users, memberships, children, guardians, notifications)

        val response = service.updateStatus(jwt, organizationId, item.id, UpdateTenantFeedbackStatusRequest(status = TenantFeedbackStatus.RESOLVED))

        assertEquals(TenantFeedbackStatus.RESOLVED, response.status)
        assertEquals("Budi", response.submittedByName)
    }

    @Test
    fun `parent feedback requires an active linked child`() {
        val access = mock(AccessService::class.java)
        val feedback = mock(TenantFeedbackRepository::class.java)
        val users = mock(UserProfileRepository::class.java)
        val memberships = mock(MembershipRepository::class.java)
        val children = mock(ChildRepository::class.java)
        val guardians = mock(GuardianLinkRepository::class.java)
        val notifications = mock(NotificationService::class.java)
        val jwt = mock(Jwt::class.java)
        val organizationId = UUID.randomUUID()
        val parent = UserProfile(displayName = "Budi")
        val scope = AccessScope(parent, Membership(), emptySet(), emptySet())
        `when`(access.require(jwt, organizationId, setOf(Role.PARENT))).thenReturn(scope)
        `when`(children.findAllByOrganizationId(organizationId)).thenReturn(listOf(
            Child(organizationId = organizationId, active = false, enrollmentStatus = ChildEnrollmentStatus.ACTIVE),
            Child(organizationId = organizationId, active = true, enrollmentStatus = ChildEnrollmentStatus.TRANSFERRED),
        ))
        val service = TenantFeedbackService(access, feedback, users, memberships, children, guardians, notifications)

        assertThrows(IllegalArgumentException::class.java) {
            service.create(jwt, organizationId, CreateTenantFeedbackRequest(TenantFeedbackCategory.SUGGESTION, "Tidak ada akses"))
        }
    }

    @Test
    fun `parent can list own feedback and staff list tolerates deleted submitter`() {
        val access = mock(AccessService::class.java)
        val feedback = mock(TenantFeedbackRepository::class.java)
        val users = mock(UserProfileRepository::class.java)
        val memberships = mock(MembershipRepository::class.java)
        val children = mock(ChildRepository::class.java)
        val guardians = mock(GuardianLinkRepository::class.java)
        val notifications = mock(NotificationService::class.java)
        val jwt = mock(Jwt::class.java)
        val organizationId = UUID.randomUUID()
        val parent = UserProfile(displayName = "Budi")
        val parentScope = AccessScope(parent, Membership(), emptySet(), emptySet())
        val staffScope = AccessScope(UserProfile(), Membership(), emptySet(), emptySet())
        val item = TenantFeedback(organizationId = organizationId, submittedByUserId = parent.id, category = TenantFeedbackCategory.COMPLAINT, message = "Masukan")
        `when`(access.require(jwt, organizationId, setOf(Role.PARENT))).thenReturn(parentScope)
        `when`(access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN))).thenReturn(staffScope)
        `when`(feedback.findAllByOrganizationIdAndSubmittedByUserIdOrderByCreatedAtDesc(organizationId, parent.id)).thenReturn(listOf(item))
        `when`(feedback.findAllByOrganizationIdOrderByCreatedAtDesc(organizationId)).thenReturn(listOf(item))
        `when`(users.findById(parent.id)).thenReturn(Optional.empty())
        val service = TenantFeedbackService(access, feedback, users, memberships, children, guardians, notifications)

        assertEquals("Budi", service.mine(jwt, organizationId).single().submittedByName)
        assertEquals("Unknown", service.list(jwt, organizationId).single().submittedByName)
    }

    @Test
    fun `staff update rejects missing and foreign feedback`() {
        val access = mock(AccessService::class.java)
        val feedback = mock(TenantFeedbackRepository::class.java)
        val users = mock(UserProfileRepository::class.java)
        val service = TenantFeedbackService(access, feedback, users, mock(MembershipRepository::class.java), mock(ChildRepository::class.java), mock(GuardianLinkRepository::class.java), mock(NotificationService::class.java))
        val jwt = mock(Jwt::class.java)
        val organizationId = UUID.randomUUID()
        `when`(access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN))).thenReturn(AccessScope(UserProfile(), Membership(), emptySet(), emptySet()))
        val missingId = UUID.randomUUID()
        `when`(feedback.findById(missingId)).thenReturn(Optional.empty())
        assertThrows(IllegalArgumentException::class.java) { service.updateStatus(jwt, organizationId, missingId, UpdateTenantFeedbackStatusRequest(TenantFeedbackStatus.RESOLVED)) }
        val foreign = TenantFeedback(organizationId = UUID.randomUUID(), submittedByUserId = UUID.randomUUID(), category = TenantFeedbackCategory.SUGGESTION, message = "x")
        `when`(feedback.findById(foreign.id)).thenReturn(Optional.of(foreign))
        assertThrows(IllegalArgumentException::class.java) { service.updateStatus(jwt, organizationId, foreign.id, UpdateTenantFeedbackStatusRequest(TenantFeedbackStatus.RESOLVED)) }
    }
}
