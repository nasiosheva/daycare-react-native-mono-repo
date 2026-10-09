package com.daycare.api.service

import com.daycare.api.domain.AttendanceAction
import com.daycare.api.domain.AttendanceMethod
import com.daycare.api.domain.InstitutionCapability
import com.daycare.api.domain.RegistrationRole
import com.daycare.api.domain.Role
import com.daycare.api.domain.PickupVerificationMethod
import com.daycare.api.persistence.AttendanceRepository
import com.daycare.api.persistence.AttendanceRecord
import com.daycare.api.persistence.AuditLogRepository
import com.daycare.api.persistence.Branch
import com.daycare.api.persistence.BranchRepository
import com.daycare.api.persistence.Child
import com.daycare.api.persistence.Classroom
import com.daycare.api.persistence.ClassroomRepository
import com.daycare.api.persistence.GuardianLinkRepository
import com.daycare.api.persistence.GuardianLink
import com.daycare.api.persistence.LearningLevel
import com.daycare.api.persistence.LearningLevelRepository
import com.daycare.api.persistence.Membership
import com.daycare.api.persistence.UserProfile
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Test
import org.mockito.Mockito.any
import org.mockito.Mockito.mock
import org.mockito.Mockito.never
import org.mockito.Mockito.verify
import org.mockito.Mockito.`when`
import org.springframework.security.oauth2.jwt.Jwt
import java.util.Optional
import java.util.UUID
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId

class AttendanceServiceTest {
    @Test
    fun `Staff Admin child list narrows by branch level and classroom`() {
        val fixtures = Fixtures()
        val child = Child(organizationId = fixtures.organizationId, branchId = fixtures.branch.id, classroomId = fixtures.classroom.id, firstName = "Alya")
        val otherChild = Child(organizationId = fixtures.organizationId, branchId = fixtures.branch.id, classroomId = UUID.randomUUID(), firstName = "Bima")
        `when`(fixtures.access.require(fixtures.jwt, fixtures.organizationId, Role.entries.toSet(), allowSubscriptionRestrictedForRoles = setOf(Role.PARENT))).thenReturn(fixtures.scope)
        `when`(fixtures.branches.findById(fixtures.branch.id)).thenReturn(Optional.of(fixtures.branch))
        `when`(fixtures.levels.findById(fixtures.level.id)).thenReturn(Optional.of(fixtures.level))
        `when`(fixtures.classrooms.findById(fixtures.classroom.id)).thenReturn(Optional.of(fixtures.classroom))
        `when`(fixtures.childScopes.visibleChildren(fixtures.scope, fixtures.organizationId)).thenReturn(listOf(child, otherChild))

        val children = fixtures.service.listChildren(fixtures.jwt, fixtures.organizationId, ChildListFilter(fixtures.branch.id, fixtures.level.id, fixtures.classroom.id))

        assertEquals(listOf("Alya"), children.map { it.fullName })
    }

    @Test
    fun `child filter rejects classroom outside the selected branch`() {
        val fixtures = Fixtures()
        val otherBranch = Branch(organizationId = fixtures.organizationId)
        val classroom = Classroom(organizationId = fixtures.organizationId, branchId = otherBranch.id, learningLevelId = fixtures.level.id)
        `when`(fixtures.access.require(fixtures.jwt, fixtures.organizationId, Role.entries.toSet(), allowSubscriptionRestrictedForRoles = setOf(Role.PARENT))).thenReturn(fixtures.scope)
        `when`(fixtures.branches.findById(fixtures.branch.id)).thenReturn(Optional.of(fixtures.branch))
        `when`(fixtures.classrooms.findById(classroom.id)).thenReturn(Optional.of(classroom))

        assertThrows(IllegalArgumentException::class.java) {
            fixtures.service.listChildren(fixtures.jwt, fixtures.organizationId, ChildListFilter(branchId = fixtures.branch.id, classroomId = classroom.id))
        }
    }

    @Test
    fun `Staff Admin sees and filters guardian-link review status`() {
        val fixtures = Fixtures()
        val linkedChild = Child(organizationId = fixtures.organizationId, branchId = fixtures.branch.id, firstName = "Alya")
        val unlinkedChild = Child(organizationId = fixtures.organizationId, branchId = fixtures.branch.id, firstName = "Bima")
        val legacyChild = Child(organizationId = fixtures.organizationId, branchId = fixtures.branch.id, firstName = "Citra")
        val parent = UserProfile(registrationRole = RegistrationRole.PARENT)
        val nonParent = UserProfile()
        `when`(fixtures.access.require(fixtures.jwt, fixtures.organizationId, Role.entries.toSet(), allowSubscriptionRestrictedForRoles = setOf(Role.PARENT))).thenReturn(fixtures.scope)
        `when`(fixtures.childScopes.visibleChildren(fixtures.scope, fixtures.organizationId)).thenReturn(listOf(linkedChild, unlinkedChild, legacyChild))
        `when`(fixtures.guardians.findAllByChildIdIn(listOf(linkedChild.id, unlinkedChild.id, legacyChild.id))).thenReturn(listOf(GuardianLink(childId = linkedChild.id, userId = parent.id), GuardianLink(childId = legacyChild.id, userId = nonParent.id)))
        `when`(fixtures.users.findAllById(listOf(parent.id, nonParent.id))).thenReturn(listOf(parent, nonParent))

        val children = fixtures.service.listChildren(fixtures.jwt, fixtures.organizationId, ChildListFilter(guardianStatus = ChildGuardianStatus.REVIEW_REQUIRED))

        assertEquals(listOf("Citra"), children.map { it.fullName })
        assertEquals(ChildGuardianStatus.REVIEW_REQUIRED, children.single().guardianStatus)
    }

    @Test
    fun `Staff Admin child attendance recap includes children without attendance and totals branch records`() {
        val fixtures = Fixtures()
        val presentChild = Child(organizationId = fixtures.organizationId, branchId = fixtures.branch.id, firstName = "Alya")
        val childWithoutRecords = Child(organizationId = fixtures.organizationId, branchId = fixtures.branch.id, firstName = "Bima")
        val startsOn = LocalDate.of(2026, 7, 1)
        val endsOn = LocalDate.of(2026, 7, 31)
        val checkedOut = AttendanceRecord(organizationId = fixtures.organizationId, branchId = fixtures.branch.id, childId = presentChild.id, operationalDate = startsOn, checkedInAt = Instant.now(), checkedOutAt = Instant.now())
        val pendingCheckOut = AttendanceRecord(organizationId = fixtures.organizationId, branchId = fixtures.branch.id, childId = presentChild.id, operationalDate = endsOn, checkedInAt = Instant.now())
        `when`(fixtures.access.require(fixtures.jwt, fixtures.organizationId, setOf(Role.STAFF_ADMIN))).thenReturn(fixtures.scope)
        `when`(fixtures.branches.findById(fixtures.branch.id)).thenReturn(Optional.of(fixtures.branch))
        `when`(fixtures.childScopes.visibleChildren(fixtures.scope, fixtures.organizationId)).thenReturn(listOf(presentChild, childWithoutRecords))
        `when`(fixtures.attendance.findAllByChildIdInAndOperationalDateBetween(listOf(presentChild.id, childWithoutRecords.id), startsOn, endsOn)).thenReturn(listOf(checkedOut, pendingCheckOut))

        val report = fixtures.service.childAttendanceReport(fixtures.jwt, fixtures.organizationId, fixtures.branch.id, startsOn, endsOn)

        assertEquals(listOf("Alya", "Bima"), report.rows.map { it.fullName })
        assertEquals(listOf(2, 0), report.rows.map { it.totalCheckIns })
        assertEquals(listOf(1, 0), report.rows.map { it.totalCheckOuts })
        assertEquals(listOf(1, 0), report.rows.map { it.pendingCheckOuts })
    }

    @Test
    fun `child attendance recap rejects an inverted date range`() {
        val fixtures = Fixtures()
        `when`(fixtures.access.require(fixtures.jwt, fixtures.organizationId, setOf(Role.STAFF_ADMIN))).thenReturn(fixtures.scope)

        assertThrows(IllegalArgumentException::class.java) {
            fixtures.service.childAttendanceReport(fixtures.jwt, fixtures.organizationId, fixtures.branch.id, LocalDate.of(2026, 7, 2), LocalDate.of(2026, 7, 1))
        }
    }

    @Test
    fun `records a manual check-in at the staff-provided time`() {
        val fixtures = Fixtures()
        val child = Child(organizationId = fixtures.organizationId, branchId = fixtures.branch.id, firstName = "Alya")
        val operationalDate = LocalDate.now(ZoneId.of(fixtures.branch.timezone))
        val at = Instant.now().minusSeconds(90)
        `when`(fixtures.access.require(fixtures.jwt, fixtures.organizationId, setOf(Role.STAFF))).thenReturn(fixtures.scope)
        `when`(fixtures.childScopes.requireStaffManagedChild(fixtures.scope, child.id, fixtures.organizationId)).thenReturn(child)
        `when`(fixtures.branches.findById(child.branchId)).thenReturn(Optional.of(fixtures.branch))
        `when`(fixtures.attendance.findByChildIdAndOperationalDate(child.id, operationalDate)).thenReturn(null)
        `when`(fixtures.attendance.save(any(AttendanceRecord::class.java))).thenAnswer { it.arguments[0] }

        val response = fixtures.service.record(fixtures.jwt, fixtures.organizationId, child.id, AttendanceCommand(AttendanceAction.CHECK_IN, AttendanceMethod.MANUAL, idempotencyKey = "check-in-key", at = at))

        assertEquals(at, response.checkedInAt)
    }

    @Test
    fun `a retried check-out with the same idempotency key replays the original result instead of erroring`() {
        val fixtures = Fixtures()
        val child = Child(organizationId = fixtures.organizationId, branchId = fixtures.branch.id, firstName = "Alya")
        val operationalDate = LocalDate.now(ZoneId.of(fixtures.branch.timezone))
        val checkedOutAt = Instant.now().minusSeconds(60)
        val existing = AttendanceRecord(organizationId = fixtures.organizationId, branchId = fixtures.branch.id, childId = child.id, operationalDate = operationalDate, checkedInAt = Instant.now().minusSeconds(600), checkedOutAt = checkedOutAt, checkOutIdempotencyKey = "checkout-key-1")
        `when`(fixtures.access.require(fixtures.jwt, fixtures.organizationId, setOf(Role.STAFF))).thenReturn(fixtures.scope)
        `when`(fixtures.childScopes.requireStaffManagedChild(fixtures.scope, child.id, fixtures.organizationId)).thenReturn(child)
        `when`(fixtures.branches.findById(child.branchId)).thenReturn(Optional.of(fixtures.branch))
        `when`(fixtures.attendance.findByChildIdAndOperationalDate(child.id, operationalDate)).thenReturn(existing)

        val response = fixtures.service.record(fixtures.jwt, fixtures.organizationId, child.id, AttendanceCommand(AttendanceAction.CHECK_OUT, AttendanceMethod.MANUAL, idempotencyKey = "checkout-key-1"))

        assertEquals(checkedOutAt, response.checkedOutAt)
        verify(fixtures.attendance, never()).save(any(AttendanceRecord::class.java))
    }

    @Test
    fun `a second check-out attempt with a different idempotency key is rejected as a conflict`() {
        val fixtures = Fixtures()
        val child = Child(organizationId = fixtures.organizationId, branchId = fixtures.branch.id, firstName = "Alya")
        val operationalDate = LocalDate.now(ZoneId.of(fixtures.branch.timezone))
        val existing = AttendanceRecord(organizationId = fixtures.organizationId, branchId = fixtures.branch.id, childId = child.id, operationalDate = operationalDate, checkedInAt = Instant.now().minusSeconds(600), checkedOutAt = Instant.now().minusSeconds(60), checkOutIdempotencyKey = "checkout-key-1")
        `when`(fixtures.access.require(fixtures.jwt, fixtures.organizationId, setOf(Role.STAFF))).thenReturn(fixtures.scope)
        `when`(fixtures.childScopes.requireStaffManagedChild(fixtures.scope, child.id, fixtures.organizationId)).thenReturn(child)
        `when`(fixtures.branches.findById(child.branchId)).thenReturn(Optional.of(fixtures.branch))
        `when`(fixtures.attendance.findByChildIdAndOperationalDate(child.id, operationalDate)).thenReturn(existing)

        assertThrows(AttendanceConflict::class.java) {
            fixtures.service.record(fixtures.jwt, fixtures.organizationId, child.id, AttendanceCommand(AttendanceAction.CHECK_OUT, AttendanceMethod.MANUAL, idempotencyKey = "checkout-key-2"))
        }
    }

    @Test
    fun `rejects a check-in time in the future`() {
        val fixtures = Fixtures()
        val child = Child(organizationId = fixtures.organizationId, branchId = fixtures.branch.id, firstName = "Alya")
        `when`(fixtures.access.require(fixtures.jwt, fixtures.organizationId, setOf(Role.STAFF))).thenReturn(fixtures.scope)
        `when`(fixtures.childScopes.requireStaffManagedChild(fixtures.scope, child.id, fixtures.organizationId)).thenReturn(child)
        `when`(fixtures.branches.findById(child.branchId)).thenReturn(Optional.of(fixtures.branch))

        assertThrows(IllegalArgumentException::class.java) {
            fixtures.service.record(fixtures.jwt, fixtures.organizationId, child.id, AttendanceCommand(AttendanceAction.CHECK_IN, AttendanceMethod.MANUAL, idempotencyKey = "check-in-key", at = Instant.now().plusSeconds(3600)))
        }
    }

    @Test
    fun `Parent QR requires an operational entitlement in addition to the guardian link`() {
        val fixtures = Fixtures()
        val parentScope = AccessScope(
            UserProfile(registrationRole = RegistrationRole.PARENT),
            Membership(organizationId = fixtures.organizationId, role = Role.PARENT),
            emptySet(),
            emptySet(),
        )
        val child = Child(organizationId = fixtures.organizationId, branchId = fixtures.branch.id, firstName = "Alya")
        `when`(fixtures.access.require(fixtures.jwt, fixtures.organizationId, setOf(Role.PARENT))).thenReturn(parentScope)
        `when`(fixtures.childScopes.requireParentOperationalChild(parentScope, child.id, fixtures.organizationId)).thenThrow(org.springframework.security.access.AccessDeniedException("entitlement required"))

        assertThrows(org.springframework.security.access.AccessDeniedException::class.java) {
            fixtures.service.issueQr(fixtures.jwt, fixtures.organizationId, child.id)
        }
    }

    @Test
    fun `Parent child list omits staff attendance context and still returns today's record`() {
        val fixtures = Fixtures()
        val parentScope = AccessScope(UserProfile(registrationRole = RegistrationRole.PARENT), Membership(organizationId = fixtures.organizationId, role = Role.PARENT), emptySet(), emptySet())
        val child = Child(organizationId = fixtures.organizationId, branchId = fixtures.branch.id, firstName = "Alya")
        val record = AttendanceRecord(organizationId = fixtures.organizationId, branchId = fixtures.branch.id, childId = child.id, operationalDate = LocalDate.now(ZoneId.of(fixtures.branch.timezone)), checkedInAt = Instant.now())
        `when`(fixtures.access.require(fixtures.jwt, fixtures.organizationId, Role.entries.toSet(), allowSubscriptionRestrictedForRoles = setOf(Role.PARENT))).thenReturn(parentScope)
        `when`(fixtures.childScopes.visibleChildren(parentScope, fixtures.organizationId)).thenReturn(listOf(child))
        `when`(fixtures.branches.findAllById(setOf(child.branchId))).thenReturn(listOf(fixtures.branch))
        `when`(fixtures.attendance.findAllByChildIdInAndOperationalDateIn(listOf(child.id), listOf(record.operationalDate))).thenReturn(listOf(record))
        val result = fixtures.service.listChildren(fixtures.jwt, fixtures.organizationId)
        assertEquals(record.checkedInAt, result.single().todayCheckedInAt)
        assertEquals(null, result.single().attendanceContext)
    }

    @Test
    fun `Staff list exposes unavailable and eligible attendance contexts`() {
        val fixtures = Fixtures()
        val child = Child(organizationId = fixtures.organizationId, branchId = fixtures.branch.id, firstName = "Alya")
        val staffScope = AccessScope(UserProfile(), Membership(organizationId = fixtures.organizationId, role = Role.STAFF), emptySet(), emptySet())
        `when`(fixtures.access.require(fixtures.jwt, fixtures.organizationId, Role.entries.toSet(), allowSubscriptionRestrictedForRoles = setOf(Role.PARENT))).thenReturn(staffScope)
        `when`(fixtures.childScopes.visibleChildren(staffScope, fixtures.organizationId)).thenReturn(listOf(child))
        `when`(fixtures.branches.findAllById(setOf(child.branchId))).thenReturn(listOf(fixtures.branch))
        `when`(fixtures.attendance.findAllByChildIdInAndOperationalDateIn(listOf(child.id), listOf(LocalDate.now(ZoneId.of(fixtures.branch.timezone))))).thenReturn(emptyList())
        val unavailable = fixtures.service.listChildren(fixtures.jwt, fixtures.organizationId).single().attendanceContext
        assertEquals(AttendancePolicy.NONE, unavailable?.attendancePolicy)

        val eligibleScope = AccessScope(staffScope.user, staffScope.membership, emptySet(), setOf(InstitutionCapability.DAYCARE_OPERATIONS))
        `when`(fixtures.access.require(fixtures.jwt, fixtures.organizationId, Role.entries.toSet(), allowSubscriptionRestrictedForRoles = setOf(Role.PARENT))).thenReturn(eligibleScope)
        `when`(fixtures.childScopes.visibleChildren(eligibleScope, fixtures.organizationId)).thenReturn(listOf(child))
        `when`(fixtures.publishedOfferings.hasPublishedCapability(fixtures.organizationId, InstitutionCapability.DAYCARE_OPERATIONS, child.branchId)).thenReturn(true)
        `when`(fixtures.bookingEligibility.checkInEligibility(fixtures.organizationId, child.id, LocalDate.now(ZoneId.of(fixtures.branch.timezone)))).thenReturn(BookingEligibility(true))
        val eligible = fixtures.service.listChildren(fixtures.jwt, fixtures.organizationId).single().attendanceContext
        assertEquals(setOf(AttendanceAction.CHECK_IN), eligible?.allowedActions)
    }

    @Test
    fun `QR check-in verifies the token and records the QR method`() {
        val fixtures = Fixtures()
        val child = Child(organizationId = fixtures.organizationId, branchId = fixtures.branch.id, firstName = "Alya")
        `when`(fixtures.access.require(fixtures.jwt, fixtures.organizationId, setOf(Role.STAFF))).thenReturn(fixtures.scope)
        `when`(fixtures.childScopes.requireStaffManagedChild(fixtures.scope, child.id, fixtures.organizationId)).thenReturn(child)
        `when`(fixtures.branches.findById(child.branchId)).thenReturn(Optional.of(fixtures.branch))
        `when`(fixtures.attendance.findByChildIdAndOperationalDate(child.id, LocalDate.now(ZoneId.of(fixtures.branch.timezone)))).thenReturn(null)
        `when`(fixtures.attendance.save(any(AttendanceRecord::class.java))).thenAnswer { it.arguments[0] }
        fixtures.service.record(fixtures.jwt, fixtures.organizationId, child.id, AttendanceCommand(AttendanceAction.CHECK_IN, AttendanceMethod.QR, "qr-key", qrToken = "token"))
        verify(fixtures.qr).verify(child.id, "Alya", "token")
    }

    @Test
    fun `daycare attendance records checkout verification and consumes check-in entitlement`() {
        val fixtures = Fixtures()
        val staffScope = AccessScope(UserProfile(), Membership(organizationId = fixtures.organizationId, role = Role.STAFF), emptySet(), setOf(InstitutionCapability.DAYCARE_OPERATIONS))
        val child = Child(organizationId = fixtures.organizationId, branchId = fixtures.branch.id, firstName = "Alya")
        val today = LocalDate.now(ZoneId.of(fixtures.branch.timezone))
        val checkedIn = AttendanceRecord(organizationId = fixtures.organizationId, branchId = fixtures.branch.id, childId = child.id, operationalDate = today, checkedInAt = Instant.now().minusSeconds(600), checkInIdempotencyKey = "in")
        val checkedOutAt = Instant.now().minusSeconds(30)
        val authorizationId = UUID.randomUUID()
        `when`(fixtures.access.require(fixtures.jwt, fixtures.organizationId, setOf(Role.STAFF))).thenReturn(staffScope)
        `when`(fixtures.childScopes.requireStaffManagedChild(staffScope, child.id, fixtures.organizationId)).thenReturn(child)
        `when`(fixtures.branches.findById(child.branchId)).thenReturn(Optional.of(fixtures.branch))
        `when`(fixtures.publishedOfferings.hasPublishedCapability(fixtures.organizationId, InstitutionCapability.DAYCARE_OPERATIONS, child.branchId)).thenReturn(true)
        `when`(fixtures.attendance.findByChildIdAndOperationalDate(child.id, today)).thenReturn(checkedIn)
        `when`(fixtures.pickupAuthorizations.verifyCheckout(staffScope, child, authorizationId, "exception")).thenReturn(PickupCheckoutVerification(authorizationId, "Ayah", PickupVerificationMethod.PHOTO_ID, "exception"))
        `when`(fixtures.attendance.save(any(AttendanceRecord::class.java))).thenAnswer { it.arguments[0] }

        val response = fixtures.service.record(fixtures.jwt, fixtures.organizationId, child.id, AttendanceCommand(AttendanceAction.CHECK_OUT, AttendanceMethod.MANUAL, "out", pickupAuthorizationId = authorizationId, pickupExceptionReason = "exception", at = checkedOutAt))

        assertEquals(checkedOutAt, response.checkedOutAt)
        verify(fixtures.pickupAuthorizations).verifyCheckout(staffScope, child, authorizationId, "exception")
    }

    private class Fixtures {
        val organizationId: UUID = UUID.randomUUID()
        val jwt: Jwt = mock(Jwt::class.java)
        val access: AccessService = mock(AccessService::class.java)
        val guardians: GuardianLinkRepository = mock(GuardianLinkRepository::class.java)
        val users: com.daycare.api.persistence.UserProfileRepository = mock(com.daycare.api.persistence.UserProfileRepository::class.java)
        val childScopes: ChildScopeService = mock(ChildScopeService::class.java)
        val branches: BranchRepository = mock(BranchRepository::class.java)
        val levels: LearningLevelRepository = mock(LearningLevelRepository::class.java)
        val classrooms: ClassroomRepository = mock(ClassroomRepository::class.java)
        val attendance: AttendanceRepository = mock(AttendanceRepository::class.java)
        val qr: AttendanceQrService = mock(AttendanceQrService::class.java)
        val bookingEligibility: BookingEligibilityService = mock(BookingEligibilityService::class.java)
        val pickupAuthorizations: PickupAuthorizationService = mock(PickupAuthorizationService::class.java)
        val publishedOfferings: PublishedOfferingCapabilityService = mock(PublishedOfferingCapabilityService::class.java)
        val branch = Branch(organizationId = organizationId)
        val level = LearningLevel(organizationId = organizationId)
        val classroom = Classroom(organizationId = organizationId, branchId = branch.id, learningLevelId = level.id)
        val scope = AccessScope(UserProfile(), Membership(role = Role.STAFF_ADMIN), emptySet(), emptySet())
        val service = AttendanceService(
            access,
            guardians,
            users,
            childScopes,
            branches,
            levels,
            classrooms,
            attendance,
            mock(AuditLogRepository::class.java),
            qr,
            mock(NotificationService::class.java),
            bookingEligibility,
            pickupAuthorizations,
            publishedOfferings,
        )
    }
}
