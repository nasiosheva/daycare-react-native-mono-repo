package com.daycare.api.service

import com.daycare.api.domain.GuardianContactStatus
import com.daycare.api.domain.IncidentCategory
import com.daycare.api.domain.IncidentFollowUpStatus
import com.daycare.api.domain.IncidentSeverity
import com.daycare.api.domain.IncidentStatus
import com.daycare.api.domain.Role
import com.daycare.api.persistence.Child
import com.daycare.api.persistence.ChildIncidentAcknowledgement
import com.daycare.api.persistence.ChildIncidentAcknowledgementRepository
import com.daycare.api.persistence.ChildIncidentFollowUp
import com.daycare.api.persistence.ChildIncidentFollowUpRepository
import com.daycare.api.persistence.ChildIncidentReport
import com.daycare.api.persistence.ChildIncidentReportRepository
import com.daycare.api.persistence.GuardianLinkRepository
import com.daycare.api.persistence.Membership
import com.daycare.api.persistence.MembershipRepository
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
import java.time.Instant
import java.util.Optional
import java.util.UUID

class ChildIncidentServiceTest {
    @Test
    fun `staff creates serious incident and parent can acknowledge it`() {
        val fixture = fixture()
        `when`(fixture.reports.save(any(ChildIncidentReport::class.java))).thenAnswer { it.arguments[0] }
        val created = fixture.service.create(fixture.jwt, fixture.organizationId, fixture.child.id, CreateChildIncidentRequest(IncidentSeverity.SERIOUS, IncidentCategory.INJURY, "  Terpeleset  ", " Dibersihkan ", Instant.now()))
        assertEquals("Terpeleset", created.description)
        assertEquals(GuardianContactStatus.PENDING, created.guardianContactStatus)

        `when`(fixture.reports.findById(created.id)).thenReturn(Optional.of(ChildIncidentReport(id = created.id, organizationId = fixture.organizationId, childId = fixture.child.id, branchId = fixture.child.branchId, reportedByUserId = fixture.staff.id, severity = IncidentSeverity.SERIOUS, category = IncidentCategory.INJURY, description = "Terpeleset", guardianContactStatus = GuardianContactStatus.PENDING)))
        `when`(fixture.childScopes.requireParentLinkedChild(fixture.parentScope, fixture.child.id, fixture.organizationId)).thenReturn(fixture.child)
        `when`(fixture.acknowledgements.existsByIncidentIdAndUserId(created.id, fixture.parent.id)).thenReturn(false)
        `when`(fixture.acknowledgements.save(any(ChildIncidentAcknowledgement::class.java))).thenAnswer { it.arguments[0] }
        val acknowledged = fixture.service.acknowledge(fixture.jwt, fixture.organizationId, fixture.child.id, created.id)
        assertEquals(true, acknowledged.acknowledgedByMe)
    }

    @Test
    fun `lifecycle requires serious incident guardian confirmation and closes after followups complete`() {
        val fixture = fixture()
        val report = ChildIncidentReport(id = UUID.randomUUID(), organizationId = fixture.organizationId, childId = fixture.child.id, branchId = fixture.child.branchId, reportedByUserId = fixture.staff.id, severity = IncidentSeverity.SERIOUS, category = IncidentCategory.ILLNESS, description = "Demam")
        `when`(fixture.reports.findById(report.id)).thenReturn(Optional.of(report))
        assertThrows(IllegalArgumentException::class.java) {
            fixture.service.updateLifecycle(fixture.jwt, fixture.organizationId, fixture.child.id, report.id, UpdateChildIncidentLifecycleRequest(IncidentStatus.CLOSED, GuardianContactStatus.PENDING))
        }
        `when`(fixture.followUps.existsByIncidentIdAndStatus(report.id, IncidentFollowUpStatus.OPEN)).thenReturn(false)
        `when`(fixture.acknowledgements.existsByIncidentIdAndUserId(report.id, fixture.staff.id)).thenReturn(false)
        val result = fixture.service.updateLifecycle(fixture.jwt, fixture.organizationId, fixture.child.id, report.id, UpdateChildIncidentLifecycleRequest(IncidentStatus.CLOSED, GuardianContactStatus.CONFIRMED, "Dihubungi"))
        assertEquals(IncidentStatus.CLOSED, result.incidentStatus)
        assertNotNull(report.closedAt)
    }

    @Test
    fun `followup can be added and completed, while closed incident rejects new followup`() {
        val fixture = fixture()
        val report = ChildIncidentReport(id = UUID.randomUUID(), organizationId = fixture.organizationId, childId = fixture.child.id, branchId = fixture.child.branchId, reportedByUserId = fixture.staff.id, incidentStatus = IncidentStatus.OPEN)
        `when`(fixture.reports.findById(report.id)).thenReturn(Optional.of(report))
        val followUp = ChildIncidentFollowUp(organizationId = fixture.organizationId, incidentId = report.id, title = "  Pantau  ")
        `when`(fixture.followUps.save(any(ChildIncidentFollowUp::class.java))).thenAnswer { it.arguments[0] }
        `when`(fixture.followUps.findById(followUp.id)).thenReturn(Optional.of(followUp))
        val added = fixture.service.addFollowUp(fixture.jwt, fixture.organizationId, fixture.child.id, report.id, CreateChildIncidentFollowUpRequest(" Pantau ", " Catatan "))
        assertEquals("Pantau", added.title)
        val completed = fixture.service.completeFollowUp(fixture.jwt, fixture.organizationId, fixture.child.id, report.id, followUp.id)
        assertEquals(IncidentFollowUpStatus.COMPLETED, completed.status)
        report.incidentStatus = IncidentStatus.CLOSED
        assertThrows(IllegalArgumentException::class.java) { fixture.service.addFollowUp(fixture.jwt, fixture.organizationId, fixture.child.id, report.id, CreateChildIncidentFollowUpRequest("x")) }
    }

    private data class Fixture(
        val organizationId: UUID,
        val jwt: Jwt,
        val child: Child,
        val staff: UserProfile,
        val parent: UserProfile,
        val parentScope: AccessScope,
        val access: AccessService,
        val childScopes: ChildScopeService,
        val reports: ChildIncidentReportRepository,
        val acknowledgements: ChildIncidentAcknowledgementRepository,
        val followUps: ChildIncidentFollowUpRepository,
        val memberships: MembershipRepository,
        val guardians: GuardianLinkRepository,
        val users: UserProfileRepository,
        val service: ChildIncidentService,
    )

    private fun fixture(): Fixture {
        val organizationId = UUID.randomUUID()
        val jwt = mock(Jwt::class.java)
        val staff = UserProfile(displayName = "Staff")
        val parent = UserProfile(displayName = "Parent")
        val child = Child(organizationId = organizationId, firstName = "Ayu")
        val access = mock(AccessService::class.java)
        val childScopes = mock(ChildScopeService::class.java)
        val reports = mock(ChildIncidentReportRepository::class.java)
        val acknowledgements = mock(ChildIncidentAcknowledgementRepository::class.java)
        val followUps = mock(ChildIncidentFollowUpRepository::class.java)
        val memberships = mock(MembershipRepository::class.java)
        val guardians = mock(GuardianLinkRepository::class.java)
        val users = mock(UserProfileRepository::class.java)
        val audits = mock(com.daycare.api.persistence.AuditLogRepository::class.java)
        val notifications = mock(NotificationService::class.java)
        val realtime = mock(RealtimePublisher::class.java)
        val staffScope = AccessScope(staff, Membership(organizationId = organizationId, role = Role.STAFF, active = true), emptySet(), emptySet())
        `when`(access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN, Role.STAFF))).thenReturn(staffScope)
        `when`(access.require(jwt, organizationId, Role.entries.toSet())).thenReturn(staffScope)
        val parentScope = AccessScope(parent, Membership(organizationId = organizationId, role = Role.PARENT, active = true), emptySet(), emptySet())
        `when`(access.require(jwt, organizationId, setOf(Role.PARENT))).thenReturn(parentScope)
        `when`(childScopes.requireStaffManagedChild(staffScope, child.id, organizationId)).thenReturn(child)
        `when`(guardians.findAllByChildId(child.id)).thenReturn(emptyList())
        `when`(memberships.findAllByOrganizationId(organizationId)).thenReturn(emptyList())
        return Fixture(organizationId, jwt, child, staff, parent, parentScope, access, childScopes, reports, acknowledgements, followUps, memberships, guardians, users, ChildIncidentService(access, childScopes, reports, acknowledgements, followUps, guardians, memberships, users, audits, notifications, realtime))
    }
}
