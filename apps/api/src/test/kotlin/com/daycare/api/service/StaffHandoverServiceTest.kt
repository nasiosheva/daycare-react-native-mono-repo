package com.daycare.api.service

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
import org.junit.jupiter.api.Test
import org.mockito.Mockito.any
import org.mockito.Mockito.mock
import org.mockito.Mockito.`when`
import org.springframework.security.oauth2.jwt.Jwt
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
        `when`(fixture.access.require(fixture.jwt, fixture.organizationId, setOf(Role.STAFF_ADMIN, Role.STAFF), InstitutionCapability.DAYCARE_OPERATIONS)).thenReturn(recipientScope)
        `when`(fixture.childScopes.requireStaffManagedChild(recipientScope, fixture.child.id, fixture.organizationId)).thenReturn(fixture.child)
        val acknowledged = fixture.service.acknowledge(fixture.jwt, fixture.organizationId, fixture.child.id, created.id)
        assertEquals(StaffHandoverStatus.ACKNOWLEDGED, acknowledged.status)
        assertNotNull(acknowledged.acknowledgedAt)
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
        `when`(access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN, Role.STAFF), InstitutionCapability.DAYCARE_OPERATIONS)).thenReturn(scope)
        `when`(access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN, Role.STAFF), InstitutionCapability.DAYCARE_OPERATIONS, true)).thenReturn(scope)
        `when`(childScopes.requireStaffManagedChild(scope, child.id, organizationId)).thenReturn(child)
        return Fixture(organizationId, jwt, child, staff, recipient, memberships, users, access, childScopes, handovers, StaffHandoverService(access, childScopes, published, handovers, memberships, users, audits, realtime))
    }
}
