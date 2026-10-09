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
import com.daycare.api.realtime.RealtimeFlag
import com.daycare.api.realtime.RealtimePublisher
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Test
import org.mockito.Mockito.any
import org.mockito.Mockito.mock
import org.mockito.Mockito.verify
import org.mockito.Mockito.`when`
import org.springframework.security.oauth2.jwt.Jwt
import java.time.Instant
import java.time.LocalDate
import java.util.Optional
import java.util.Base64
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

    @Test
    fun `list marks only incidents acknowledged by the current parent`() {
        val fixture = fixture()
        val first = ChildIncidentReport(organizationId = fixture.organizationId, childId = fixture.child.id, description = "Pertama")
        val second = ChildIncidentReport(organizationId = fixture.organizationId, childId = fixture.child.id, description = "Kedua")
        `when`(fixture.access.require(fixture.jwt, fixture.organizationId, Role.entries.toSet())).thenReturn(fixture.parentScope)
        `when`(fixture.childScopes.requireParentLinkedChild(fixture.parentScope, fixture.child.id, fixture.organizationId)).thenReturn(fixture.child)
        `when`(fixture.reports.findAllByOrganizationIdAndChildIdOrderByOccurredAtDesc(fixture.organizationId, fixture.child.id)).thenReturn(listOf(first, second))
        `when`(fixture.acknowledgements.findAllByIncidentIdIn(listOf(first.id, second.id))).thenReturn(listOf(ChildIncidentAcknowledgement(incidentId = second.id, userId = fixture.parent.id)))

        val result = fixture.service.list(fixture.jwt, fixture.organizationId, fixture.child.id)

        assertEquals(listOf(false, true), result.map { it.acknowledgedByMe })
    }

    @Test
    fun `staff creates minor incident with a valid png photo without serious escalation`() {
        val fixture = fixture()
        val png = byteArrayOf(0x89.toByte(), 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A)
        `when`(fixture.reports.save(any(ChildIncidentReport::class.java))).thenAnswer { it.arguments[0] }

        val result = fixture.service.create(
            fixture.jwt,
            fixture.organizationId,
            fixture.child.id,
            CreateChildIncidentRequest(IncidentSeverity.MINOR, IncidentCategory.OTHER, "  Terpeleset  ", "  Dibersihkan  ", Instant.now(), IncidentPhotoInput("IMAGE/PNG", Base64.getEncoder().encodeToString(png))),
        )

        assertEquals("Terpeleset", result.description)
        assertEquals("Dibersihkan", result.actionTaken)
        assertEquals(true, result.hasPhoto)
        assertEquals(GuardianContactStatus.NOT_REQUIRED, result.guardianContactStatus)
        org.mockito.Mockito.verify(fixture.notifications, org.mockito.Mockito.never()).notify(fixture.organizationId, fixture.staff.id, "Insiden serius: Ayu", "Terpeleset", "/incident-reports?childId=${fixture.child.id}", setOf(RealtimeFlag.INCIDENT_REPORTS))
    }

    @Test
    fun `serious incident notifies guardians and active staff admins`() {
        val fixture = fixture()
        val guardianId = UUID.randomUUID()
        val adminId = UUID.randomUUID()
        val duplicateAdmin = Membership(organizationId = fixture.organizationId, userId = adminId, role = Role.STAFF_ADMIN, active = true)
        `when`(fixture.reports.save(any(ChildIncidentReport::class.java))).thenAnswer { it.arguments[0] }
        `when`(fixture.guardians.findAllByChildId(fixture.child.id)).thenReturn(listOf(com.daycare.api.persistence.GuardianLink(childId = fixture.child.id, userId = guardianId)))
        `when`(fixture.memberships.findAllByOrganizationId(fixture.organizationId)).thenReturn(listOf(duplicateAdmin, duplicateAdmin, Membership(organizationId = fixture.organizationId, userId = UUID.randomUUID(), role = Role.STAFF_ADMIN, active = false)))

        fixture.service.create(fixture.jwt, fixture.organizationId, fixture.child.id, CreateChildIncidentRequest(IncidentSeverity.SERIOUS, IncidentCategory.INJURY, "Jatuh", occurredAt = Instant.now()))

        verify(fixture.notifications).notify(fixture.organizationId, guardianId, "Laporan insiden Ayu", "Jatuh", "/incident-reports?childId=${fixture.child.id}", setOf(RealtimeFlag.INCIDENT_REPORTS))
        verify(fixture.notifications).notify(fixture.organizationId, adminId, "Insiden serius: Ayu", "Jatuh", "/incident-reports?childId=${fixture.child.id}", setOf(RealtimeFlag.INCIDENT_REPORTS))
    }

    @Test
    fun `invalid incident photo content and bytes are rejected`() {
        val fixture = fixture()
        val encoded = Base64.getEncoder().encodeToString(byteArrayOf(1, 2, 3))
        val cases = listOf(
            IncidentPhotoInput("application/pdf", encoded),
            IncidentPhotoInput("image/png", "not-base64"),
            IncidentPhotoInput("image/png", Base64.getEncoder().encodeToString(byteArrayOf())),
            IncidentPhotoInput("image/png", encoded),
        )
        cases.forEach { photo ->
            assertThrows(IllegalArgumentException::class.java) {
                fixture.service.create(fixture.jwt, fixture.organizationId, fixture.child.id, CreateChildIncidentRequest(IncidentSeverity.MINOR, IncidentCategory.OTHER, "x", occurredAt = Instant.now(), photo = photo))
            }
        }
    }

    @Test
    fun `acknowledge is idempotent and does not duplicate an existing acknowledgement`() {
        val fixture = fixture()
        val report = ChildIncidentReport(id = UUID.randomUUID(), organizationId = fixture.organizationId, childId = fixture.child.id, description = "x")
        `when`(fixture.reports.findById(report.id)).thenReturn(Optional.of(report))
        `when`(fixture.childScopes.requireParentLinkedChild(fixture.parentScope, fixture.child.id, fixture.organizationId)).thenReturn(fixture.child)
        `when`(fixture.access.require(fixture.jwt, fixture.organizationId, setOf(Role.PARENT))).thenReturn(fixture.parentScope)
        `when`(fixture.acknowledgements.existsByIncidentIdAndUserId(report.id, fixture.parent.id)).thenReturn(true)

        val result = fixture.service.acknowledge(fixture.jwt, fixture.organizationId, fixture.child.id, report.id)

        assertEquals(true, result.acknowledgedByMe)
        verify(fixture.acknowledgements, org.mockito.Mockito.never()).save(any(ChildIncidentAcknowledgement::class.java))
    }

    @Test
    fun `lifecycle reopens a closed incident and trims optional fields`() {
        val fixture = fixture()
        val report = ChildIncidentReport(id = UUID.randomUUID(), organizationId = fixture.organizationId, childId = fixture.child.id, description = "x", incidentStatus = IncidentStatus.CLOSED, closedAt = Instant.now(), closedByUserId = fixture.staff.id)
        `when`(fixture.reports.findById(report.id)).thenReturn(Optional.of(report))
        `when`(fixture.access.require(fixture.jwt, fixture.organizationId, setOf(Role.STAFF_ADMIN, Role.STAFF))).thenReturn(fixture.staffScope)
        `when`(fixture.childScopes.requireStaffManagedChild(fixture.staffScope, fixture.child.id, fixture.organizationId)).thenReturn(fixture.child)
        `when`(fixture.acknowledgements.existsByIncidentIdAndUserId(report.id, fixture.staff.id)).thenReturn(false)
        `when`(fixture.followUps.existsByIncidentIdAndStatus(report.id, IncidentFollowUpStatus.OPEN)).thenReturn(false)

        val result = fixture.service.updateLifecycle(fixture.jwt, fixture.organizationId, fixture.child.id, report.id, UpdateChildIncidentLifecycleRequest(IncidentStatus.IN_PROGRESS, GuardianContactStatus.ATTEMPTED, "  contacted  ", followUpDueOn = LocalDate.now().plusDays(1)))

        assertEquals(IncidentStatus.IN_PROGRESS, result.incidentStatus)
        assertEquals("contacted", result.guardianContactOutcome)
        assertEquals(null, result.closedAt)
    }

    @Test
    fun `serious incident cannot close before confirmed guardian contact and completed followups`() {
        val fixture = fixture()
        val report = ChildIncidentReport(id = UUID.randomUUID(), organizationId = fixture.organizationId, childId = fixture.child.id, severity = IncidentSeverity.SERIOUS, description = "x")
        `when`(fixture.reports.findById(report.id)).thenReturn(Optional.of(report))
        `when`(fixture.access.require(fixture.jwt, fixture.organizationId, setOf(Role.STAFF_ADMIN, Role.STAFF))).thenReturn(fixture.staffScope)
        `when`(fixture.childScopes.requireStaffManagedChild(fixture.staffScope, fixture.child.id, fixture.organizationId)).thenReturn(fixture.child)
        `when`(fixture.followUps.existsByIncidentIdAndStatus(report.id, IncidentFollowUpStatus.OPEN)).thenReturn(true)

        assertThrows(IllegalArgumentException::class.java) {
            fixture.service.updateLifecycle(fixture.jwt, fixture.organizationId, fixture.child.id, report.id, UpdateChildIncidentLifecycleRequest(IncidentStatus.CLOSED, GuardianContactStatus.CONFIRMED, "ok"))
        }
        `when`(fixture.followUps.existsByIncidentIdAndStatus(report.id, IncidentFollowUpStatus.OPEN)).thenReturn(false)
        assertThrows(IllegalArgumentException::class.java) {
            fixture.service.updateLifecycle(fixture.jwt, fixture.organizationId, fixture.child.id, report.id, UpdateChildIncidentLifecycleRequest(IncidentStatus.CLOSED, GuardianContactStatus.CONFIRMED))
        }
    }

    @Test
    fun `assigned staff must belong to the tenant and manage the child`() {
        val fixture = fixture()
        val report = ChildIncidentReport(id = UUID.randomUUID(), organizationId = fixture.organizationId, childId = fixture.child.id, description = "x")
        val ownerId = UUID.randomUUID()
        val owner = UserProfile(id = ownerId, displayName = "Owner")
        val membership = Membership(organizationId = fixture.organizationId, userId = ownerId, role = Role.STAFF, active = true)
        `when`(fixture.reports.findById(report.id)).thenReturn(Optional.of(report))
        `when`(fixture.access.require(fixture.jwt, fixture.organizationId, setOf(Role.STAFF_ADMIN, Role.STAFF))).thenReturn(fixture.staffScope)
        `when`(fixture.childScopes.requireStaffManagedChild(fixture.staffScope, fixture.child.id, fixture.organizationId)).thenReturn(fixture.child)
        `when`(fixture.users.findById(ownerId)).thenReturn(Optional.of(owner))
        `when`(fixture.memberships.findAllByUserIdAndOrganizationId(ownerId, fixture.organizationId)).thenReturn(listOf(membership))
        `when`(fixture.childScopes.isStaffManagedChild(AccessScope(owner, membership, emptySet(), emptySet()), fixture.child.id, fixture.organizationId)).thenReturn(true)
        `when`(fixture.acknowledgements.existsByIncidentIdAndUserId(report.id, fixture.staff.id)).thenReturn(false)

        val result = fixture.service.updateLifecycle(fixture.jwt, fixture.organizationId, fixture.child.id, report.id, UpdateChildIncidentLifecycleRequest(IncidentStatus.IN_PROGRESS, GuardianContactStatus.ATTEMPTED, followUpOwnerUserId = ownerId))

        assertEquals(ownerId, result.followUpOwnerUserId)
    }

    @Test
    fun `followup listing and completion preserve already completed state`() {
        val fixture = fixture()
        val report = ChildIncidentReport(id = UUID.randomUUID(), organizationId = fixture.organizationId, childId = fixture.child.id, description = "x")
        val completed = ChildIncidentFollowUp(organizationId = fixture.organizationId, incidentId = report.id, title = "Selesai", status = IncidentFollowUpStatus.COMPLETED, completedAt = Instant.now())
        `when`(fixture.reports.findById(report.id)).thenReturn(Optional.of(report))
        `when`(fixture.access.require(fixture.jwt, fixture.organizationId, setOf(Role.STAFF_ADMIN, Role.STAFF))).thenReturn(fixture.staffScope)
        `when`(fixture.childScopes.requireStaffManagedChild(fixture.staffScope, fixture.child.id, fixture.organizationId)).thenReturn(fixture.child)
        `when`(fixture.followUps.findAllByIncidentIdOrderByCreatedAtAsc(report.id)).thenReturn(listOf(completed))
        `when`(fixture.followUps.findById(completed.id)).thenReturn(Optional.of(completed))

        assertEquals(listOf(completed.id), fixture.service.listFollowUps(fixture.jwt, fixture.organizationId, fixture.child.id, report.id).map { it.id })
        assertEquals(IncidentFollowUpStatus.COMPLETED, fixture.service.completeFollowUp(fixture.jwt, fixture.organizationId, fixture.child.id, report.id, completed.id).status)
    }

    @Test
    fun `photo returns encoded data and rejects missing photo`() {
        val fixture = fixture()
        val png = byteArrayOf(0x89.toByte(), 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A)
        val report = ChildIncidentReport(id = UUID.randomUUID(), organizationId = fixture.organizationId, childId = fixture.child.id, photoContentType = "image/png", photoData = png)
        `when`(fixture.reports.findById(report.id)).thenReturn(Optional.of(report))
        `when`(fixture.access.require(fixture.jwt, fixture.organizationId, Role.entries.toSet())).thenReturn(fixture.staffScope)
        `when`(fixture.childScopes.requireStaffManagedChild(fixture.staffScope, fixture.child.id, fixture.organizationId)).thenReturn(fixture.child)
        assertEquals(Base64.getEncoder().encodeToString(png), fixture.service.photo(fixture.jwt, fixture.organizationId, fixture.child.id, report.id).dataBase64)

        report.photoData = null
        assertThrows(IllegalArgumentException::class.java) { fixture.service.photo(fixture.jwt, fixture.organizationId, fixture.child.id, report.id) }
    }

    private data class Fixture(
        val organizationId: UUID,
        val jwt: Jwt,
        val child: Child,
        val staff: UserProfile,
        val parent: UserProfile,
        val staffScope: AccessScope,
        val parentScope: AccessScope,
        val access: AccessService,
        val childScopes: ChildScopeService,
        val reports: ChildIncidentReportRepository,
        val acknowledgements: ChildIncidentAcknowledgementRepository,
        val followUps: ChildIncidentFollowUpRepository,
        val memberships: MembershipRepository,
        val guardians: GuardianLinkRepository,
        val users: UserProfileRepository,
        val notifications: NotificationService,
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
        return Fixture(organizationId, jwt, child, staff, parent, staffScope, parentScope, access, childScopes, reports, acknowledgements, followUps, memberships, guardians, users, notifications, ChildIncidentService(access, childScopes, reports, acknowledgements, followUps, guardians, memberships, users, audits, notifications, realtime))
    }
}
