package com.daycare.api.service

import com.daycare.api.domain.Role
import com.daycare.api.persistence.Child
import com.daycare.api.persistence.ChildMessage
import com.daycare.api.persistence.ChildMessageRead
import com.daycare.api.persistence.ChildMessageReadRepository
import com.daycare.api.persistence.ChildMessageRepository
import com.daycare.api.persistence.ChildStaffAssignment
import com.daycare.api.persistence.ChildStaffAssignmentRepository
import com.daycare.api.persistence.GuardianLink
import com.daycare.api.persistence.GuardianLinkRepository
import com.daycare.api.persistence.Membership
import com.daycare.api.persistence.MembershipRepository
import com.daycare.api.persistence.UserProfile
import com.daycare.api.persistence.UserProfileRepository
import com.daycare.api.realtime.ChildMessageRealtimePayload
import com.daycare.api.realtime.RealtimeFlag
import com.daycare.api.realtime.RealtimePublisher
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Test
import org.mockito.ArgumentCaptor
import org.mockito.Mockito.any
import org.mockito.Mockito.mock
import org.mockito.Mockito.never
import org.mockito.Mockito.verify
import org.mockito.Mockito.verifyNoInteractions
import org.mockito.Mockito.`when`
import org.springframework.security.access.AccessDeniedException
import org.springframework.security.oauth2.jwt.Jwt
import java.util.UUID

private class ChildMessageServiceFixture {
    val access = mock(AccessService::class.java)
    val childScopes = mock(ChildScopeService::class.java)
    val messages = mock(ChildMessageRepository::class.java)
    val reads = mock(ChildMessageReadRepository::class.java)
    val guardians = mock(GuardianLinkRepository::class.java)
    val staffAssignments = mock(ChildStaffAssignmentRepository::class.java)
    val memberships = mock(MembershipRepository::class.java)
    val users = mock(UserProfileRepository::class.java)
    val notifications = mock(NotificationService::class.java)
    val realtime = mock(RealtimePublisher::class.java)
    val service = ChildMessageService(access, childScopes, messages, reads, guardians, staffAssignments, memberships, users, notifications, realtime)

    fun scope(user: UserProfile, organizationId: UUID, role: Role) = AccessScope(user, Membership(organizationId = organizationId, userId = user.id, role = role, active = true), emptySet(), emptySet())
}

class ChildMessageServiceTest {
    @Test
    fun `Parent sends a message that notifies the Staff assigned to the child`() {
        val fixture = ChildMessageServiceFixture()
        val jwt = mock(Jwt::class.java)
        val organizationId = UUID.randomUUID()
        val parent = UserProfile(displayName = "Budi")
        val child = Child(organizationId = organizationId)
        val assignedStaffId = UUID.randomUUID()
        val scope = fixture.scope(parent, organizationId, Role.PARENT)
        `when`(fixture.access.require(jwt, organizationId, setOf(Role.PARENT, Role.STAFF, Role.STAFF_ADMIN))).thenReturn(scope)
        `when`(fixture.childScopes.requireParentLinkedChild(scope, child.id, organizationId)).thenReturn(child)
        `when`(fixture.messages.save(any(ChildMessage::class.java))).thenAnswer { it.arguments[0] }
        `when`(fixture.staffAssignments.findAllByOrganizationIdAndChildIdOrderByCreatedAtDesc(organizationId, child.id)).thenReturn(listOf(
            ChildStaffAssignment(organizationId = organizationId, childId = child.id, userId = assignedStaffId),
        ))

        val response = fixture.service.send(jwt, organizationId, child.id, SendChildMessageRequest("Anak saya belum makan siang"))

        assertEquals("Anak saya belum makan siang", response.body)
        assertEquals(Role.PARENT, response.senderRole)
        assertEquals(true, response.mine)
        verify(fixture.notifications).notify(organizationId, assignedStaffId, "Pesan baru dari Budi", "Anak saya belum makan siang", "/child-messages?childId=${child.id}")
        val saved = ArgumentCaptor.forClass(ChildMessage::class.java)
        verify(fixture.messages).save(saved.capture())
        verify(fixture.realtime).publishToUser(organizationId, assignedStaffId, setOf(RealtimeFlag.CHILD_MESSAGES), ChildMessageRealtimePayload(child.id, saved.value.id))
        verifyNoInteractions(fixture.guardians)
    }

    @Test
    fun `Parent message falls back to active Staff Admins when no Staff is assigned`() {
        val fixture = ChildMessageServiceFixture()
        val jwt = mock(Jwt::class.java)
        val organizationId = UUID.randomUUID()
        val parent = UserProfile(displayName = "Budi")
        val child = Child(organizationId = organizationId)
        val activeStaffAdminId = UUID.randomUUID()
        val inactiveStaffAdminId = UUID.randomUUID()
        val scope = fixture.scope(parent, organizationId, Role.PARENT)
        `when`(fixture.access.require(jwt, organizationId, setOf(Role.PARENT, Role.STAFF, Role.STAFF_ADMIN))).thenReturn(scope)
        `when`(fixture.childScopes.requireParentLinkedChild(scope, child.id, organizationId)).thenReturn(child)
        `when`(fixture.messages.save(any(ChildMessage::class.java))).thenAnswer { it.arguments[0] }
        `when`(fixture.staffAssignments.findAllByOrganizationIdAndChildIdOrderByCreatedAtDesc(organizationId, child.id)).thenReturn(emptyList())
        `when`(fixture.memberships.findAllByOrganizationId(organizationId)).thenReturn(listOf(
            Membership(organizationId = organizationId, userId = activeStaffAdminId, role = Role.STAFF_ADMIN, active = true),
            Membership(organizationId = organizationId, userId = inactiveStaffAdminId, role = Role.STAFF_ADMIN, active = false),
        ))

        fixture.service.send(jwt, organizationId, child.id, SendChildMessageRequest("Halo"))

        verify(fixture.notifications).notify(organizationId, activeStaffAdminId, "Pesan baru dari Budi", "Halo", "/child-messages?childId=${child.id}")
        val saved = ArgumentCaptor.forClass(ChildMessage::class.java)
        verify(fixture.messages).save(saved.capture())
        verify(fixture.realtime).publishToUser(organizationId, activeStaffAdminId, setOf(RealtimeFlag.CHILD_MESSAGES), ChildMessageRealtimePayload(child.id, saved.value.id))
        org.mockito.Mockito.verifyNoMoreInteractions(fixture.notifications)
    }

    @Test
    fun `Staff message notifies every guardian of the child`() {
        val fixture = ChildMessageServiceFixture()
        val jwt = mock(Jwt::class.java)
        val organizationId = UUID.randomUUID()
        val staff = UserProfile(displayName = "Bu Sari")
        val child = Child(organizationId = organizationId)
        val guardianId = UUID.randomUUID()
        val scope = fixture.scope(staff, organizationId, Role.STAFF)
        `when`(fixture.access.require(jwt, organizationId, setOf(Role.PARENT, Role.STAFF, Role.STAFF_ADMIN))).thenReturn(scope)
        `when`(fixture.childScopes.requireStaffManagedChild(scope, child.id, organizationId)).thenReturn(child)
        `when`(fixture.messages.save(any(ChildMessage::class.java))).thenAnswer { it.arguments[0] }
        `when`(fixture.guardians.findAllByChildId(child.id)).thenReturn(listOf(GuardianLink(childId = child.id, userId = guardianId)))

        val response = fixture.service.send(jwt, organizationId, child.id, SendChildMessageRequest("Hari ini ceria sekali"))

        assertEquals(Role.STAFF, response.senderRole)
        verify(fixture.notifications).notify(organizationId, guardianId, "Pesan baru dari Bu Sari", "Hari ini ceria sekali", "/child-messages?childId=${child.id}")
        val saved = ArgumentCaptor.forClass(ChildMessage::class.java)
        verify(fixture.messages).save(saved.capture())
        verify(fixture.realtime).publishToUser(organizationId, guardianId, setOf(RealtimeFlag.CHILD_MESSAGES), ChildMessageRealtimePayload(child.id, saved.value.id))
        verifyNoInteractions(fixture.staffAssignments)
    }

    @Test
    fun `rejects a Staff member who is not assigned to the child`() {
        val fixture = ChildMessageServiceFixture()
        val jwt = mock(Jwt::class.java)
        val organizationId = UUID.randomUUID()
        val staff = UserProfile(displayName = "Bu Sari")
        val child = Child(organizationId = organizationId)
        val scope = fixture.scope(staff, organizationId, Role.STAFF)
        `when`(fixture.access.require(jwt, organizationId, setOf(Role.PARENT, Role.STAFF, Role.STAFF_ADMIN))).thenReturn(scope)
        `when`(fixture.childScopes.requireStaffManagedChild(scope, child.id, organizationId)).thenThrow(AccessDeniedException("Staff member is not assigned to this child"))

        assertThrows(AccessDeniedException::class.java) { fixture.service.send(jwt, organizationId, child.id, SendChildMessageRequest("Halo")) }
        verify(fixture.messages, never()).save(any())
    }

    @Test
    fun `lists messages oldest first with sender name resolved and marks the viewer's own messages`() {
        val fixture = ChildMessageServiceFixture()
        val jwt = mock(Jwt::class.java)
        val organizationId = UUID.randomUUID()
        val parent = UserProfile(displayName = "Budi")
        val staff = UserProfile(displayName = "Bu Sari")
        val child = Child(organizationId = organizationId)
        val scope = fixture.scope(parent, organizationId, Role.PARENT)
        val fromParent = ChildMessage(organizationId = organizationId, childId = child.id, senderUserId = parent.id, senderRole = Role.PARENT, body = "Titip pesan")
        val fromStaff = ChildMessage(organizationId = organizationId, childId = child.id, senderUserId = staff.id, senderRole = Role.STAFF, body = "Baik, siap")
        `when`(fixture.access.require(jwt, organizationId, Role.entries.toSet())).thenReturn(scope)
        `when`(fixture.childScopes.requireParentLinkedChild(scope, child.id, organizationId)).thenReturn(child)
        `when`(fixture.messages.findAllByOrganizationIdAndChildIdOrderByCreatedAtAsc(organizationId, child.id)).thenReturn(listOf(fromParent, fromStaff))
        `when`(fixture.users.findAllById(listOf(parent.id, staff.id))).thenReturn(listOf(parent, staff))

        val response = fixture.service.list(jwt, organizationId, child.id)

        assertEquals(listOf("Budi" to true, "Bu Sari" to false), response.map { it.senderName to it.mine })
    }

    @Test
    fun `marking read creates a read row on the first call and updates it after`() {
        val fixture = ChildMessageServiceFixture()
        val jwt = mock(Jwt::class.java)
        val organizationId = UUID.randomUUID()
        val parent = UserProfile()
        val child = Child(organizationId = organizationId)
        val scope = fixture.scope(parent, organizationId, Role.PARENT)
        `when`(fixture.access.require(jwt, organizationId, Role.entries.toSet())).thenReturn(scope)
        `when`(fixture.childScopes.requireParentLinkedChild(scope, child.id, organizationId)).thenReturn(child)
        `when`(fixture.reads.findByChildIdAndUserId(child.id, parent.id)).thenReturn(null)

        fixture.service.markRead(jwt, organizationId, child.id)

        val captor = ArgumentCaptor.forClass(ChildMessageRead::class.java)
        verify(fixture.reads).save(captor.capture())
        assertEquals(child.id, captor.value.childId)
        assertEquals(parent.id, captor.value.userId)
    }
}
