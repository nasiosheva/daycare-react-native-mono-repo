package com.daycare.api.service

import com.daycare.api.domain.Role
import com.daycare.api.domain.TenantAnnouncementAudience
import com.daycare.api.domain.TenantAnnouncementStatus
import com.daycare.api.persistence.AuditLog
import com.daycare.api.persistence.AuditLogRepository
import com.daycare.api.persistence.BranchRepository
import com.daycare.api.persistence.Branch
import com.daycare.api.persistence.ChildRepository
import com.daycare.api.persistence.GuardianLink
import com.daycare.api.persistence.GuardianLinkRepository
import com.daycare.api.persistence.Membership
import com.daycare.api.persistence.MembershipRepository
import com.daycare.api.persistence.TenantAnnouncement
import com.daycare.api.persistence.TenantAnnouncementRecipient
import com.daycare.api.persistence.TenantAnnouncementRecipientRepository
import com.daycare.api.persistence.TenantAnnouncementRepository
import com.daycare.api.persistence.UserProfile
import com.daycare.api.realtime.RealtimePublisher
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Test
import org.mockito.Mockito.any
import org.mockito.Mockito.atLeastOnce
import org.mockito.Mockito.mock
import org.mockito.Mockito.verify
import org.mockito.Mockito.`when`
import org.springframework.security.oauth2.jwt.Jwt
import java.util.Optional
import java.util.UUID
import java.time.Instant

class TenantAnnouncementServiceTest {
    @Test
    fun `staff admin creates and publishes tenant announcement to active audience`() {
        val fixture = fixture()
        val staffId = fixture.staff.id
        val parentId = UUID.randomUUID()
        val child = com.daycare.api.persistence.Child(organizationId = fixture.organizationId, branchId = UUID.randomUUID())
        `when`(fixture.memberships.findAllByOrganizationId(fixture.organizationId)).thenReturn(listOf(
            Membership(organizationId = fixture.organizationId, userId = staffId, role = Role.STAFF_ADMIN, active = true),
            Membership(organizationId = fixture.organizationId, userId = parentId, role = Role.PARENT, active = true),
        ))
        `when`(fixture.children.findAllByOrganizationId(fixture.organizationId)).thenReturn(listOf(child))
        `when`(fixture.guardians.findAllByChildIdIn(setOf(child.id))).thenReturn(listOf(GuardianLink(childId = child.id, userId = parentId)))
        `when`(fixture.announcements.save(any(TenantAnnouncement::class.java))).thenAnswer { it.arguments[0] }
        val created = fixture.service.create(fixture.jwt, fixture.organizationId, UpsertTenantAnnouncementRequest(TenantAnnouncementAudience.TENANT, title = "Info", body = "Libur"))
        assertEquals(TenantAnnouncementStatus.DRAFT, created.status)

        `when`(fixture.announcements.findById(created.id)).thenReturn(Optional.of(TenantAnnouncement(id = created.id, organizationId = fixture.organizationId, createdByUserId = staffId, title = "Info", body = "Libur")))
        val published = fixture.service.publish(fixture.jwt, fixture.organizationId, created.id, ScheduleTenantAnnouncementRequest())

        assertEquals(TenantAnnouncementStatus.PUBLISHED, published.status)
        assertNotNull(published.publishedAt)
        verify(fixture.recipients, atLeastOnce()).save(any(TenantAnnouncementRecipient::class.java))
        verify(fixture.notifications).notify(fixture.organizationId, parentId, "Info", "Libur", "/announcements", setOf(com.daycare.api.realtime.RealtimeFlag.TENANT_ANNOUNCEMENTS))
    }

    @Test
    fun `scheduled announcement can be listed and acknowledged only when required`() {
        val fixture = fixture()
        val user = fixture.staff
        val announcement = TenantAnnouncement(organizationId = fixture.organizationId, createdByUserId = user.id, status = TenantAnnouncementStatus.PUBLISHED, requiresAcknowledgement = true)
        val recipient = TenantAnnouncementRecipient(announcementId = announcement.id, recipientUserId = user.id)
        `when`(fixture.announcements.findAllByOrganizationIdAndStatus(fixture.organizationId, TenantAnnouncementStatus.PUBLISHED)).thenReturn(listOf(announcement))
        `when`(fixture.recipients.findAllByRecipientUserId(user.id)).thenReturn(listOf(recipient))
        `when`(fixture.recipients.findAllByAnnouncementId(announcement.id)).thenReturn(listOf(recipient))
        `when`(fixture.announcements.findById(announcement.id)).thenReturn(Optional.of(announcement))
        `when`(fixture.recipients.findByAnnouncementIdAndRecipientUserId(announcement.id, user.id)).thenReturn(recipient)

        assertEquals(1, fixture.service.listMine(fixture.jwt, fixture.organizationId).size)
        fixture.service.acknowledge(fixture.jwt, fixture.organizationId, announcement.id)
        assertNotNull(recipient.acknowledgedAt)
        announcement.requiresAcknowledgement = false
        assertThrows(IllegalArgumentException::class.java) { fixture.service.acknowledge(fixture.jwt, fixture.organizationId, announcement.id) }
    }

    @Test
    fun `branch announcement can be updated scheduled published and closed`() {
        val fixture = fixture()
        val branchId = UUID.randomUUID()
        val branch = Branch(id = branchId, organizationId = fixture.organizationId, name = "Cabang", active = true)
        `when`(fixture.branches.findById(branchId)).thenReturn(Optional.of(branch))
        `when`(fixture.announcements.save(any(TenantAnnouncement::class.java))).thenAnswer { it.arguments[0] }
        val created = fixture.service.create(fixture.jwt, fixture.organizationId, UpsertTenantAnnouncementRequest(TenantAnnouncementAudience.BRANCH, branchId, " Lama ", " Isi ", true))
        val entity = TenantAnnouncement(id = created.id, organizationId = fixture.organizationId, createdByUserId = fixture.staff.id, audience = TenantAnnouncementAudience.BRANCH, branchId = branchId, title = "Lama", body = "Isi", requiresAcknowledgement = true)
        `when`(fixture.announcements.findById(created.id)).thenReturn(Optional.of(entity))
        val updated = fixture.service.update(fixture.jwt, fixture.organizationId, created.id, UpsertTenantAnnouncementRequest(TenantAnnouncementAudience.BRANCH, branchId, " Baru ", " Baru ", true))
        assertEquals("Baru", updated.title)
        val scheduled = fixture.service.publish(fixture.jwt, fixture.organizationId, created.id, ScheduleTenantAnnouncementRequest(Instant.now().plusSeconds(3600)))
        assertEquals(TenantAnnouncementStatus.SCHEDULED, scheduled.status)
        val closed = fixture.service.close(fixture.jwt, fixture.organizationId, created.id)
        assertEquals(TenantAnnouncementStatus.CLOSED, closed.status)
    }

    @Test
    fun `scheduled announcement publishes only matching branch recipients`() {
        val fixture = fixture()
        val branchId = UUID.randomUUID()
        val announcement = TenantAnnouncement(organizationId = fixture.organizationId, createdByUserId = fixture.staff.id, audience = TenantAnnouncementAudience.BRANCH, branchId = branchId, title = "Cabang", body = "Info", status = TenantAnnouncementStatus.SCHEDULED, scheduledAt = Instant.now().minusSeconds(1))
        val inBranchStaff = UUID.randomUUID(); val otherStaff = UUID.randomUUID(); val parent = UUID.randomUUID()
        val inBranchChild = com.daycare.api.persistence.Child(organizationId = fixture.organizationId, branchId = branchId, active = true)
        val otherChild = com.daycare.api.persistence.Child(organizationId = fixture.organizationId, branchId = UUID.randomUUID(), active = true)
        `when`(fixture.announcements.findAll()).thenReturn(listOf(announcement))
        `when`(fixture.memberships.findAllByOrganizationId(fixture.organizationId)).thenReturn(listOf(
            Membership(organizationId = fixture.organizationId, userId = inBranchStaff, role = Role.STAFF, branchId = branchId, active = true),
            Membership(organizationId = fixture.organizationId, userId = otherStaff, role = Role.STAFF, branchId = otherChild.branchId, active = true),
            Membership(organizationId = fixture.organizationId, userId = parent, role = Role.PARENT, active = true),
        ))
        `when`(fixture.children.findAllByOrganizationId(fixture.organizationId)).thenReturn(listOf(inBranchChild, otherChild))
        `when`(fixture.guardians.findAllByChildIdIn(setOf(inBranchChild.id))).thenReturn(listOf(GuardianLink(childId = inBranchChild.id, userId = parent)))
        fixture.service.publishScheduled()
        assertEquals(TenantAnnouncementStatus.PUBLISHED, announcement.status)
        verify(fixture.notifications).notify(fixture.organizationId, inBranchStaff, "Cabang", "Info", "/announcements", setOf(com.daycare.api.realtime.RealtimeFlag.TENANT_ANNOUNCEMENTS))
        verify(fixture.notifications).notify(fixture.organizationId, parent, "Cabang", "Info", "/announcements", setOf(com.daycare.api.realtime.RealtimeFlag.TENANT_ANNOUNCEMENTS))
    }

    @Test
    fun `announcement validation rejects inconsistent or unavailable branch scope`() {
        val fixture = fixture()
        val branchId = UUID.randomUUID()
        `when`(fixture.announcements.save(any(TenantAnnouncement::class.java))).thenAnswer { it.arguments[0] }
        assertThrows(IllegalArgumentException::class.java) { fixture.service.create(fixture.jwt, fixture.organizationId, UpsertTenantAnnouncementRequest(TenantAnnouncementAudience.TENANT, branchId, "T", "B")) }
        assertThrows(IllegalArgumentException::class.java) { fixture.service.create(fixture.jwt, fixture.organizationId, UpsertTenantAnnouncementRequest(TenantAnnouncementAudience.BRANCH, null, "T", "B")) }
        `when`(fixture.branches.findById(branchId)).thenReturn(Optional.empty())
        assertThrows(IllegalArgumentException::class.java) { fixture.service.create(fixture.jwt, fixture.organizationId, UpsertTenantAnnouncementRequest(TenantAnnouncementAudience.BRANCH, branchId, "T", "B")) }
        `when`(fixture.branches.findById(branchId)).thenReturn(Optional.of(Branch(id = branchId, organizationId = UUID.randomUUID(), name = "Foreign", active = true)))
        assertThrows(IllegalArgumentException::class.java) { fixture.service.create(fixture.jwt, fixture.organizationId, UpsertTenantAnnouncementRequest(TenantAnnouncementAudience.BRANCH, branchId, "T", "B")) }
        `when`(fixture.branches.findById(branchId)).thenReturn(Optional.of(Branch(id = branchId, organizationId = fixture.organizationId, name = "Inactive", active = false)))
        assertThrows(IllegalArgumentException::class.java) { fixture.service.create(fixture.jwt, fixture.organizationId, UpsertTenantAnnouncementRequest(TenantAnnouncementAudience.BRANCH, branchId, "T", "B")) }
    }

    @Test
    fun `announcement listing and acknowledgement handle empty and already acknowledged recipients`() {
        val fixture = fixture()
        val announcement = TenantAnnouncement(organizationId = fixture.organizationId, createdByUserId = fixture.staff.id, status = TenantAnnouncementStatus.PUBLISHED, requiresAcknowledgement = true)
        val acknowledged = TenantAnnouncementRecipient(announcementId = announcement.id, recipientUserId = fixture.staff.id, acknowledgedAt = Instant.now())
        `when`(fixture.access.require(fixture.jwt, fixture.organizationId, setOf(Role.STAFF_ADMIN), readOnly = true)).thenReturn(AccessScope(fixture.staff, Membership(organizationId = fixture.organizationId, role = Role.STAFF_ADMIN, active = true), emptySet(), emptySet()))
        `when`(fixture.announcements.findAllByOrganizationIdOrderByCreatedAtDesc(fixture.organizationId)).thenReturn(listOf(announcement))
        `when`(fixture.recipients.findAllByAnnouncementId(announcement.id)).thenReturn(listOf(acknowledged))
        assertEquals(1, fixture.service.listManaged(fixture.jwt, fixture.organizationId).size)
        `when`(fixture.announcements.findAllByOrganizationIdAndStatus(fixture.organizationId, TenantAnnouncementStatus.PUBLISHED)).thenReturn(listOf(announcement))
        `when`(fixture.recipients.findAllByRecipientUserId(fixture.staff.id)).thenReturn(emptyList())
        assertEquals(0, fixture.service.listMine(fixture.jwt, fixture.organizationId).size)
        `when`(fixture.announcements.findById(announcement.id)).thenReturn(Optional.of(announcement))
        `when`(fixture.recipients.findByAnnouncementIdAndRecipientUserId(announcement.id, fixture.staff.id)).thenReturn(acknowledged)
        fixture.service.acknowledge(fixture.jwt, fixture.organizationId, announcement.id)
        assertNotNull(acknowledged.acknowledgedAt)
        `when`(fixture.recipients.findByAnnouncementIdAndRecipientUserId(announcement.id, fixture.staff.id)).thenReturn(null)
        assertThrows(IllegalArgumentException::class.java) { fixture.service.acknowledge(fixture.jwt, fixture.organizationId, announcement.id) }
    }

    @Test
    fun `scheduled publication ignores future and draft announcements`() {
        val fixture = fixture()
        val future = TenantAnnouncement(organizationId = fixture.organizationId, createdByUserId = fixture.staff.id, status = TenantAnnouncementStatus.SCHEDULED, scheduledAt = Instant.now().plusSeconds(3600))
        val draft = TenantAnnouncement(organizationId = fixture.organizationId, createdByUserId = fixture.staff.id, status = TenantAnnouncementStatus.DRAFT)
        `when`(fixture.announcements.findAll()).thenReturn(listOf(future, draft))
        fixture.service.publishScheduled()
        assertEquals(TenantAnnouncementStatus.SCHEDULED, future.status)
        assertEquals(TenantAnnouncementStatus.DRAFT, draft.status)
    }

    @Test
    fun `branch audience excludes inactive or unrelated staff children and parent memberships`() {
        val fixture = fixture()
        val branchId = UUID.randomUUID()
        val matchingStaff = UUID.randomUUID()
        val inactiveStaff = UUID.randomUUID()
        val parent = UUID.randomUUID()
        val nonParent = UUID.randomUUID()
        val activeChild = com.daycare.api.persistence.Child(organizationId = fixture.organizationId, branchId = branchId, active = true)
        val inactiveChild = com.daycare.api.persistence.Child(organizationId = fixture.organizationId, branchId = branchId, active = false)
        val otherChild = com.daycare.api.persistence.Child(organizationId = fixture.organizationId, branchId = UUID.randomUUID(), active = true)
        val announcement = TenantAnnouncement(organizationId = fixture.organizationId, createdByUserId = fixture.staff.id, audience = TenantAnnouncementAudience.BRANCH, branchId = branchId, status = TenantAnnouncementStatus.SCHEDULED, scheduledAt = Instant.now().minusSeconds(1), title = "B", body = "I")
        `when`(fixture.announcements.findAll()).thenReturn(listOf(announcement))
        `when`(fixture.memberships.findAllByOrganizationId(fixture.organizationId)).thenReturn(listOf(
            Membership(organizationId = fixture.organizationId, userId = matchingStaff, role = Role.STAFF, branchId = branchId, active = true),
            Membership(organizationId = fixture.organizationId, userId = inactiveStaff, role = Role.STAFF, branchId = branchId, active = false),
            Membership(organizationId = fixture.organizationId, userId = parent, role = Role.PARENT, active = true),
            Membership(organizationId = fixture.organizationId, userId = nonParent, role = Role.STAFF, branchId = branchId, active = true),
        ))
        `when`(fixture.children.findAllByOrganizationId(fixture.organizationId)).thenReturn(listOf(activeChild, inactiveChild, otherChild))
        `when`(fixture.guardians.findAllByChildIdIn(setOf(activeChild.id))).thenReturn(listOf(GuardianLink(childId = activeChild.id, userId = parent), GuardianLink(childId = activeChild.id, userId = nonParent)))
        fixture.service.publishScheduled()
        verify(fixture.notifications).notify(fixture.organizationId, matchingStaff, "B", "I", "/announcements", setOf(com.daycare.api.realtime.RealtimeFlag.TENANT_ANNOUNCEMENTS))
        verify(fixture.notifications).notify(fixture.organizationId, parent, "B", "I", "/announcements", setOf(com.daycare.api.realtime.RealtimeFlag.TENANT_ANNOUNCEMENTS))
    }

    private data class Fixture(
        val organizationId: UUID,
        val jwt: Jwt,
        val staff: UserProfile,
        val access: AccessService,
        val announcements: TenantAnnouncementRepository,
        val recipients: TenantAnnouncementRecipientRepository,
        val memberships: MembershipRepository,
        val children: ChildRepository,
        val branches: BranchRepository,
        val guardians: GuardianLinkRepository,
        val audits: AuditLogRepository,
        val notifications: NotificationService,
        val service: TenantAnnouncementService,
    )

    private fun fixture(): Fixture {
        val organizationId = UUID.randomUUID()
        val jwt = mock(Jwt::class.java)
        val staff = UserProfile(displayName = "Admin")
        val access = mock(AccessService::class.java)
        val announcements = mock(TenantAnnouncementRepository::class.java)
        val recipients = mock(TenantAnnouncementRecipientRepository::class.java)
        val memberships = mock(MembershipRepository::class.java)
        val children = mock(ChildRepository::class.java)
        val branches = mock(BranchRepository::class.java)
        val guardians = mock(GuardianLinkRepository::class.java)
        val audits = mock(AuditLogRepository::class.java)
        val notifications = mock(NotificationService::class.java)
        val realtime = mock(RealtimePublisher::class.java)
        val scope = AccessScope(staff, Membership(organizationId = organizationId, role = Role.STAFF_ADMIN, active = true), emptySet(), emptySet())
        `when`(access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN))).thenReturn(scope)
        `when`(access.require(jwt, organizationId, Role.entries.toSet(), readOnly = true)).thenReturn(scope)
        `when`(access.require(jwt, organizationId, Role.entries.toSet())).thenReturn(scope)
        `when`(audits.save(any(AuditLog::class.java))).thenAnswer { it.arguments[0] }
        return Fixture(organizationId, jwt, staff, access, announcements, recipients, memberships, children, branches, guardians, audits, notifications, TenantAnnouncementService(access, announcements, recipients, memberships, children, branches, guardians, audits, notifications, realtime))
    }
}
