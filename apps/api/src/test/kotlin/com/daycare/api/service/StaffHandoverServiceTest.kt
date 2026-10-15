package com.daycare.api.service

// Mories Deo Hutapea,S.E.,S.Kom

import com.daycare.api.domain.InstitutionCapability
import com.daycare.api.domain.Role
import com.daycare.api.domain.StaffHandoverStatus
import com.daycare.api.persistence.AuditLogRepository
import com.daycare.api.persistence.Child
import com.daycare.api.persistence.Membership
import com.daycare.api.persistence.MembershipRepository
import com.daycare.api.persistence.StaffHandover
import com.daycare.api.persistence.StaffHandoverRepository
import com.daycare.api.persistence.UserProfile
import com.daycare.api.persistence.UserProfileRepository
import com.daycare.api.realtime.RealtimePublisher
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Test
import org.mockito.Mockito.any
import org.mockito.Mockito.mock
import org.mockito.Mockito.`when`
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.security.access.AccessDeniedException
import java.util.Optional
import java.util.UUID

class StaffHandoverServiceTest {
    @Test
    fun `staff can create list recipients and acknowledge handover`() {
        val fixture = fixture()
        val recipientMembership = Membership(organizationId = fixture.organizationId, userId = fixture.recipient.id, role = Role.STAFF, active = true, branchId = fixture.child.branchId)
        `when`(fixture.memberships.findAllByOrganizationId(fixture.organizationId)).thenReturn(listOf(recipientMembership))
        `when`(fixture.memberships.findAllByUserIdAndOrganizationId(fixture.recipient.id, fixture.organizationId)).thenReturn(listOf(recipientMembership))
        `when`(fixture.users.findById(fixture.recipient.id)).thenReturn(Optional.of(fixture.recipient))
        `when`(fixture.childScopes.isStaffManagedChild(AccessScope(fixture.recipient, recipientMembership, emptySet(), emptySet()), fixture.child.id, fixture.organizationId)).thenReturn(true)
        val recipients = fixture.service.recipients(fixture.jwt, fixture.organizationId, fixture.child.id)
        assertEquals(listOf(fixture.recipient.id), recipients.map { it.userId })
        `when`(fixture.handovers.save(any(StaffHandover::class.java))).thenAnswer { it.arguments[0] }
        val created = fixture.service.create(fixture.jwt, fixture.organizationId, fixture.child.id, CreateStaffHandoverRequest(fixture.recipient.id, "  Periksa kondisi  "))
        assertEquals("Periksa kondisi", created.summary)
        val stored = StaffHandover(id = created.id, organizationId = fixture.organizationId, childId = fixture.child.id, branchId = fixture.child.branchId, recipientUserId = fixture.recipient.id, summary = "Periksa kondisi", status = StaffHandoverStatus.OPEN)
        `when`(fixture.handovers.findAllByOrganizationIdAndChildIdOrderByCreatedAtDesc(fixture.organizationId, fixture.child.id)).thenReturn(listOf(stored))
        `when`(fixture.handovers.findById(created.id)).thenReturn(Optional.of(stored))
        assertEquals(1, fixture.service.list(fixture.jwt, fixture.organizationId, fixture.child.id).size)
        val recipientScope = AccessScope(fixture.recipient, recipientMembership, emptySet(), emptySet())
        `when`(fixture.access.require(fixture.jwt, fixture.organizationId, setOf(Role.STAFF_ADMIN, Role.STAFF), InstitutionCapability.DAYCARE_OPERATIONS, allowGraceForRoles = setOf(Role.STAFF_ADMIN, Role.STAFF))).thenReturn(recipientScope)
        `when`(fixture.childScopes.requireStaffManagedChild(recipientScope, fixture.child.id, fixture.organizationId)).thenReturn(fixture.child)
        val acknowledged = fixture.service.acknowledge(fixture.jwt, fixture.organizationId, fixture.child.id, created.id)
        assertEquals(StaffHandoverStatus.ACKNOWLEDGED, acknowledged.status)
        assertNotNull(acknowledged.acknowledgedAt)
    }

    @Test
    fun `recipient filtering and fallback names cover inactive missing and duplicate staff`() {
        val fixture = fixture()
        val duplicate = Membership(organizationId = fixture.organizationId, userId = fixture.recipient.id, role = Role.STAFF_ADMIN, active = true, branchId = fixture.child.branchId)
        val inactive = Membership(organizationId = fixture.organizationId, userId = UUID.randomUUID(), role = Role.STAFF, active = false, branchId = fixture.child.branchId)
        val parent = Membership(organizationId = fixture.organizationId, userId = UUID.randomUUID(), role = Role.PARENT, active = true, branchId = fixture.child.branchId)
        val fallbackUser = UserProfile(email = "fallback@example.com", displayName = "")
        val fallbackMembership = Membership(organizationId = fixture.organizationId, userId = fallbackUser.id, role = Role.STAFF, active = true, branchId = fixture.child.branchId)
        `when`(fixture.memberships.findAllByOrganizationId(fixture.organizationId)).thenReturn(listOf(duplicate, duplicate, inactive, parent, fallbackMembership))
        `when`(fixture.users.findById(fixture.recipient.id)).thenReturn(Optional.of(fixture.recipient))
        `when`(fixture.users.findById(fallbackUser.id)).thenReturn(Optional.of(fallbackUser))
        `when`(fixture.childScopes.isStaffManagedChild(AccessScope(fixture.recipient, duplicate, emptySet(), emptySet()), fixture.child.id, fixture.organizationId)).thenReturn(true)
        `when`(fixture.childScopes.isStaffManagedChild(AccessScope(fallbackUser, fallbackMembership, emptySet(), emptySet()), fixture.child.id, fixture.organizationId)).thenReturn(true)

        val result = fixture.service.recipients(fixture.jwt, fixture.organizationId, fixture.child.id)

        assertEquals(listOf("fallback@example.com", fixture.recipient.displayName).sortedBy { it.lowercase() }, result.map { it.displayName })
    }

    @Test
    fun `create and acknowledge reject unavailable recipients and foreign handovers`() {
        val fixture = fixture()
        val request = CreateStaffHandoverRequest(UUID.randomUUID(), "summary")
        `when`(fixture.users.findById(request.recipientUserId)).thenReturn(Optional.empty())
        assertThrows(IllegalArgumentException::class.java) { fixture.service.create(fixture.jwt, fixture.organizationId, fixture.child.id, request) }

        val inactiveRecipient = UserProfile(displayName = "Inactive")
        val inactiveMembership = Membership(organizationId = fixture.organizationId, userId = inactiveRecipient.id, role = Role.STAFF, active = false)
        `when`(fixture.users.findById(inactiveRecipient.id)).thenReturn(Optional.of(inactiveRecipient))
        `when`(fixture.memberships.findAllByUserIdAndOrganizationId(inactiveRecipient.id, fixture.organizationId)).thenReturn(listOf(inactiveMembership))
        assertThrows(AccessDeniedException::class.java) {
            fixture.service.create(fixture.jwt, fixture.organizationId, fixture.child.id, CreateStaffHandoverRequest(inactiveRecipient.id, "summary"))
        }

        val open = StaffHandover(organizationId = fixture.organizationId, childId = fixture.child.id, branchId = fixture.child.branchId, recipientUserId = fixture.recipient.id, summary = "open")
        `when`(fixture.handovers.findById(open.id)).thenReturn(Optional.of(open))
        assertThrows(IllegalArgumentException::class.java) { fixture.service.acknowledge(fixture.jwt, fixture.organizationId, fixture.child.id, UUID.randomUUID()) }
        val foreign = StaffHandover(id = open.id, organizationId = UUID.randomUUID(), childId = open.childId, branchId = open.branchId, recipientUserId = open.recipientUserId, summary = open.summary)
        `when`(fixture.handovers.findById(foreign.id)).thenReturn(Optional.of(foreign))
        assertThrows(IllegalArgumentException::class.java) { fixture.service.acknowledge(fixture.jwt, fixture.organizationId, fixture.child.id, foreign.id) }
        val wrongRecipient = StaffHandover(id = open.id, organizationId = open.organizationId, childId = open.childId, branchId = open.branchId, recipientUserId = UUID.randomUUID(), summary = open.summary)
        `when`(fixture.handovers.findById(wrongRecipient.id)).thenReturn(Optional.of(wrongRecipient))
        assertThrows(IllegalArgumentException::class.java) { fixture.service.acknowledge(fixture.jwt, fixture.organizationId, fixture.child.id, wrongRecipient.id) }
    }

    @Test
    fun `closed handover is returned without a second acknowledgement`() {
        val fixture = fixture()
        val closed = StaffHandover(organizationId = fixture.organizationId, childId = fixture.child.id, branchId = fixture.child.branchId, recipientUserId = fixture.staff.id, summary = "done", status = StaffHandoverStatus.ACKNOWLEDGED)
        `when`(fixture.handovers.findById(closed.id)).thenReturn(Optional.of(closed))

        val result = fixture.service.acknowledge(fixture.jwt, fixture.organizationId, fixture.child.id, closed.id)

        assertEquals(StaffHandoverStatus.ACKNOWLEDGED, result.status)
    }

    private data class Fixture(
        val organizationId: UUID,
        val jwt: Jwt,
        val child: Child,
        val staff: UserProfile,
        val recipient: UserProfile,
        val memberships: MembershipRepository,
        val users: UserProfileRepository,
        val access: AccessService,
        val childScopes: com.daycare.api.service.ChildScopeService,
        val handovers: StaffHandoverRepository,
        val service: StaffHandoverService,
    )

    private fun fixture(): Fixture {
        val organizationId = UUID.randomUUID()
        val jwt = mock(Jwt::class.java)
        val child = Child(organizationId = organizationId, firstName = "Ayu")
        val staff = UserProfile(displayName = "Staff")
        val recipient = UserProfile(displayName = "Recipient")
        val access = mock(AccessService::class.java)
        val childScopes = mock(ChildScopeService::class.java)
        val published = mock(PublishedOfferingCapabilityService::class.java)
        val handovers = mock(StaffHandoverRepository::class.java)
        val memberships = mock(MembershipRepository::class.java)
        val users = mock(UserProfileRepository::class.java)
        val audits = mock(AuditLogRepository::class.java)
        val realtime = mock(RealtimePublisher::class.java)
        val scope = AccessScope(staff, Membership(organizationId = organizationId, role = Role.STAFF, active = true), setOf("DAYCARE"), setOf(InstitutionCapability.DAYCARE_OPERATIONS))
        `when`(access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN, Role.STAFF), InstitutionCapability.DAYCARE_OPERATIONS, allowGraceForRoles = setOf(Role.STAFF_ADMIN, Role.STAFF))).thenReturn(scope)
        `when`(access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN, Role.STAFF), InstitutionCapability.DAYCARE_OPERATIONS, true, allowGraceForRoles = setOf(Role.STAFF_ADMIN, Role.STAFF))).thenReturn(scope)
        `when`(childScopes.requireStaffManagedChild(scope, child.id, organizationId)).thenReturn(child)
        return Fixture(organizationId, jwt, child, staff, recipient, memberships, users, access, childScopes, handovers, StaffHandoverService(access, childScopes, published, handovers, memberships, users, audits, realtime))
    }
}
