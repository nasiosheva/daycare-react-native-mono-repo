package com.daycare.api.service

// Mories Deo Hutapea,S.E.,S.Kom

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
import org.springframework.security.access.AccessDeniedException
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
        `when`(fixtures.access.require(fixtures.jwt, fixtures.organizationId, Role.entries.toSet(), allowSubscriptionRestrictedForRoles = setOf(Role.PARENT), allowGraceForRoles = Role.entries.toSet())).thenReturn(fixtures.scope)
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
        `when`(fixtures.access.require(fixtures.jwt, fixtures.organizationId, Role.entries.toSet(), allowSubscriptionRestrictedForRoles = setOf(Role.PARENT), allowGraceForRoles = Role.entries.toSet())).thenReturn(fixtures.scope)
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
        `when`(fixtures.access.require(fixtures.jwt, fixtures.organizationId, Role.entries.toSet(), allowSubscriptionRestrictedForRoles = setOf(Role.PARENT), allowGraceForRoles = Role.entries.toSet())).thenReturn(fixtures.scope)
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
        val localNow = java.time.ZonedDateTime.now(ZoneId.of(fixtures.branch.timezone))
        val candidate = localNow.toLocalDate().atStartOfDay(ZoneId.of(fixtures.branch.timezone)).plusSeconds(30)
        val at = if (candidate.isAfter(localNow)) localNow.minusNanos(1_000_000).toInstant() else candidate.toInstant()
        `when`(fixtures.access.require(fixtures.jwt, fixtures.organizationId, setOf(Role.STAFF), allowGraceForRoles = setOf(Role.STAFF))).thenReturn(fixtures.scope)
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
        `when`(fixtures.access.require(fixtures.jwt, fixtures.organizationId, setOf(Role.STAFF), allowGraceForRoles = setOf(Role.STAFF))).thenReturn(fixtures.scope)
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
        `when`(fixtures.access.require(fixtures.jwt, fixtures.organizationId, setOf(Role.STAFF), allowGraceForRoles = setOf(Role.STAFF))).thenReturn(fixtures.scope)
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
        `when`(fixtures.access.require(fixtures.jwt, fixtures.organizationId, setOf(Role.STAFF), allowGraceForRoles = setOf(Role.STAFF))).thenReturn(fixtures.scope)
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
        `when`(fixtures.access.require(fixtures.jwt, fixtures.organizationId, Role.entries.toSet(), allowSubscriptionRestrictedForRoles = setOf(Role.PARENT), allowGraceForRoles = Role.entries.toSet())).thenReturn(parentScope)
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
        `when`(fixtures.access.require(fixtures.jwt, fixtures.organizationId, Role.entries.toSet(), allowSubscriptionRestrictedForRoles = setOf(Role.PARENT), allowGraceForRoles = Role.entries.toSet())).thenReturn(staffScope)
        `when`(fixtures.childScopes.visibleChildren(staffScope, fixtures.organizationId)).thenReturn(listOf(child))
        `when`(fixtures.branches.findAllById(setOf(child.branchId))).thenReturn(listOf(fixtures.branch))
        `when`(fixtures.attendance.findAllByChildIdInAndOperationalDateIn(listOf(child.id), listOf(LocalDate.now(ZoneId.of(fixtures.branch.timezone))))).thenReturn(emptyList())
        val unavailable = fixtures.service.listChildren(fixtures.jwt, fixtures.organizationId).single().attendanceContext
        assertEquals(AttendancePolicy.NONE, unavailable?.attendancePolicy)

        val eligibleScope = AccessScope(staffScope.user, staffScope.membership, emptySet(), setOf(InstitutionCapability.DAYCARE_OPERATIONS))
        `when`(fixtures.access.require(fixtures.jwt, fixtures.organizationId, Role.entries.toSet(), allowSubscriptionRestrictedForRoles = setOf(Role.PARENT), allowGraceForRoles = Role.entries.toSet())).thenReturn(eligibleScope)
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
        `when`(fixtures.access.require(fixtures.jwt, fixtures.organizationId, setOf(Role.STAFF), allowGraceForRoles = setOf(Role.STAFF))).thenReturn(fixtures.scope)
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
        `when`(fixtures.access.require(fixtures.jwt, fixtures.organizationId, setOf(Role.STAFF), allowGraceForRoles = setOf(Role.STAFF))).thenReturn(staffScope)
        `when`(fixtures.childScopes.requireStaffManagedChild(staffScope, child.id, fixtures.organizationId)).thenReturn(child)
        `when`(fixtures.branches.findById(child.branchId)).thenReturn(Optional.of(fixtures.branch))
        `when`(fixtures.publishedOfferings.hasPublishedCapability(fixtures.organizationId, InstitutionCapability.DAYCARE_OPERATIONS, child.branchId)).thenReturn(true)
        `when`(fixtures.attendance.findByChildIdAndOperationalDate(child.id, today)).thenReturn(checkedIn)
        `when`(fixtures.pickupAuthorizations.verifyCheckout(staffScope, child, authorizationId)).thenReturn(PickupCheckoutVerification(authorizationId, "Ayah", PickupVerificationMethod.PHOTO_ID, null))
        `when`(fixtures.attendance.save(any(AttendanceRecord::class.java))).thenAnswer { it.arguments[0] }

        val response = fixtures.service.record(fixtures.jwt, fixtures.organizationId, child.id, AttendanceCommand(AttendanceAction.CHECK_OUT, AttendanceMethod.MANUAL, "out", pickupAuthorizationId = authorizationId, at = checkedOutAt))

        assertEquals(checkedOutAt, response.checkedOutAt)
        verify(fixtures.pickupAuthorizations).verifyCheckout(staffScope, child, authorizationId)
    }

    @Test
    fun `staff checkout consumes an approved one time pickup exception and records its audit reference`() {
        val fixtures = Fixtures()
        val staffScope = AccessScope(UserProfile(), Membership(organizationId = fixtures.organizationId, role = Role.STAFF), emptySet(), setOf(InstitutionCapability.DAYCARE_OPERATIONS))
        val child = Child(organizationId = fixtures.organizationId, branchId = fixtures.branch.id, firstName = "Alya")
        val today = LocalDate.now(ZoneId.of(fixtures.branch.timezone))
        val checkedIn = AttendanceRecord(organizationId = fixtures.organizationId, branchId = fixtures.branch.id, childId = child.id, operationalDate = today, checkedInAt = Instant.now().minusSeconds(600))
        val requestId = UUID.randomUUID()
        val grant = PickupExceptionCheckoutGrant(requestId, "Bibi Ani", PickupVerificationMethod.OTHER, "Wali menghubungi lembaga")
        `when`(fixtures.access.require(fixtures.jwt, fixtures.organizationId, setOf(Role.STAFF), allowGraceForRoles = setOf(Role.STAFF))).thenReturn(staffScope)
        `when`(fixtures.childScopes.requireStaffManagedChild(staffScope, child.id, fixtures.organizationId)).thenReturn(child)
        `when`(fixtures.branches.findById(child.branchId)).thenReturn(Optional.of(fixtures.branch))
        `when`(fixtures.publishedOfferings.hasPublishedCapability(fixtures.organizationId, InstitutionCapability.DAYCARE_OPERATIONS, child.branchId)).thenReturn(true)
        `when`(fixtures.attendance.findByChildIdAndOperationalDate(child.id, today)).thenReturn(checkedIn)
        `when`(fixtures.pickupExceptions.consumeCheckoutGrant(staffScope, child, requestId)).thenReturn(grant)
        `when`(fixtures.attendance.save(any(AttendanceRecord::class.java))).thenAnswer { it.arguments[0] }

        val result = fixtures.service.record(fixtures.jwt, fixtures.organizationId, child.id, AttendanceCommand(AttendanceAction.CHECK_OUT, AttendanceMethod.MANUAL, "out-exception", pickupExceptionRequestId = requestId))

        assertEquals(requestId, result.pickupExceptionRequestId)
        assertEquals(requestId, checkedIn.pickupExceptionRequestId)
        assertEquals("Bibi Ani", checkedIn.pickupPersonName)
        assertEquals("Wali menghubungi lembaga", checkedIn.checkoutExceptionReason)
        verify(fixtures.pickupExceptions).consumeCheckoutGrant(staffScope, child, requestId)
    }

    @Test
    fun `attendance guards cover qr token, duplicate check-in, closed days, and missing check-in`() {
        val fixtures = Fixtures()
        val child = Child(organizationId = fixtures.organizationId, branchId = fixtures.branch.id, firstName = "Alya")
        val today = LocalDate.now(ZoneId.of(fixtures.branch.timezone))
        `when`(fixtures.access.require(fixtures.jwt, fixtures.organizationId, setOf(Role.STAFF), allowGraceForRoles = setOf(Role.STAFF))).thenReturn(fixtures.scope)
        `when`(fixtures.childScopes.requireStaffManagedChild(fixtures.scope, child.id, fixtures.organizationId)).thenReturn(child)
        `when`(fixtures.branches.findById(child.branchId)).thenReturn(Optional.of(fixtures.branch))
        assertThrows(IllegalArgumentException::class.java) {
            fixtures.service.record(fixtures.jwt, fixtures.organizationId, child.id, AttendanceCommand(AttendanceAction.CHECK_IN, AttendanceMethod.QR, "qr", qrToken = null))
        }

        val open = AttendanceRecord(organizationId = fixtures.organizationId, branchId = child.branchId, childId = child.id, operationalDate = today, checkedInAt = Instant.now().minusSeconds(60), checkInIdempotencyKey = "same")
        `when`(fixtures.attendance.findByChildIdAndOperationalDate(child.id, today)).thenReturn(open)
        assertEquals(open.id, fixtures.service.record(fixtures.jwt, fixtures.organizationId, child.id, AttendanceCommand(AttendanceAction.CHECK_IN, AttendanceMethod.MANUAL, "same")).id)
        assertThrows(AttendanceConflict::class.java) { fixtures.service.record(fixtures.jwt, fixtures.organizationId, child.id, AttendanceCommand(AttendanceAction.CHECK_IN, AttendanceMethod.MANUAL, "different")) }

        open.checkedOutAt = Instant.now().minusSeconds(20)
        assertThrows(AttendanceConflict::class.java) { fixtures.service.record(fixtures.jwt, fixtures.organizationId, child.id, AttendanceCommand(AttendanceAction.CHECK_IN, AttendanceMethod.MANUAL, "closed")) }

        `when`(fixtures.attendance.findByChildIdAndOperationalDate(child.id, today)).thenReturn(null)
        assertThrows(AttendanceConflict::class.java) { fixtures.service.record(fixtures.jwt, fixtures.organizationId, child.id, AttendanceCommand(AttendanceAction.CHECK_OUT, AttendanceMethod.MANUAL, "out")) }
    }

    @Test
    fun `attendance validates operational day and checkout ordering`() {
        val fixtures = Fixtures()
        val child = Child(organizationId = fixtures.organizationId, branchId = fixtures.branch.id, firstName = "Alya")
        val today = LocalDate.now(ZoneId.of(fixtures.branch.timezone))
        val checkInAt = today.atStartOfDay(ZoneId.of(fixtures.branch.timezone)).plusHours(8).toInstant()
        val existing = AttendanceRecord(organizationId = fixtures.organizationId, branchId = child.branchId, childId = child.id, operationalDate = today, checkedInAt = checkInAt, checkInIdempotencyKey = "in")
        `when`(fixtures.access.require(fixtures.jwt, fixtures.organizationId, setOf(Role.STAFF), allowGraceForRoles = setOf(Role.STAFF))).thenReturn(fixtures.scope)
        `when`(fixtures.childScopes.requireStaffManagedChild(fixtures.scope, child.id, fixtures.organizationId)).thenReturn(child)
        `when`(fixtures.branches.findById(child.branchId)).thenReturn(Optional.of(fixtures.branch))
        `when`(fixtures.attendance.findByChildIdAndOperationalDate(child.id, today)).thenReturn(existing)
        assertThrows(IllegalArgumentException::class.java) {
            fixtures.service.record(fixtures.jwt, fixtures.organizationId, child.id, AttendanceCommand(AttendanceAction.CHECK_OUT, AttendanceMethod.MANUAL, "before", at = checkInAt.minusSeconds(1)))
        }
        assertThrows(IllegalArgumentException::class.java) {
            fixtures.service.record(fixtures.jwt, fixtures.organizationId, child.id, AttendanceCommand(AttendanceAction.CHECK_OUT, AttendanceMethod.MANUAL, "past", at = today.minusDays(1).atStartOfDay(ZoneId.of(fixtures.branch.timezone)).toInstant()))
        }
    }

    @Test
    fun `staff child filters and attendance context cover optional references and denied eligibility`() {
        val fixtures = Fixtures()
        val child = Child(organizationId = fixtures.organizationId, branchId = fixtures.branch.id, classroomId = fixtures.classroom.id, firstName = "Alya")
        `when`(fixtures.access.require(fixtures.jwt, fixtures.organizationId, Role.entries.toSet(), allowSubscriptionRestrictedForRoles = setOf(Role.PARENT), allowGraceForRoles = Role.entries.toSet())).thenReturn(fixtures.scope)
        `when`(fixtures.childScopes.visibleChildren(fixtures.scope, fixtures.organizationId)).thenReturn(listOf(child))
        `when`(fixtures.branches.findById(fixtures.branch.id)).thenReturn(Optional.of(fixtures.branch))
        `when`(fixtures.levels.findById(fixtures.level.id)).thenReturn(Optional.of(fixtures.level))
        `when`(fixtures.classrooms.findById(fixtures.classroom.id)).thenReturn(Optional.of(fixtures.classroom))
        `when`(fixtures.branches.findAllById(listOf(child.branchId))).thenReturn(listOf(fixtures.branch))
        `when`(fixtures.attendance.findAllByChildIdInAndOperationalDateIn(listOf(child.id), listOf(LocalDate.now(ZoneId.of(fixtures.branch.timezone))))).thenReturn(emptyList())
        `when`(fixtures.publishedOfferings.hasPublishedCapability(fixtures.organizationId, InstitutionCapability.DAYCARE_OPERATIONS, child.branchId)).thenReturn(true)
        `when`(fixtures.bookingEligibility.checkInEligibility(fixtures.organizationId, child.id, LocalDate.now(ZoneId.of(fixtures.branch.timezone)))).thenReturn(BookingEligibility(false, "Tidak ada booking"))
        assertEquals(emptySet<AttendanceAction>(), fixtures.service.listChildren(fixtures.jwt, fixtures.organizationId).single().attendanceContext?.allowedActions)

        val foreignBranch = Branch(organizationId = UUID.randomUUID())
        assertThrows(IllegalArgumentException::class.java) { fixtures.service.listChildren(fixtures.jwt, fixtures.organizationId, ChildListFilter(branchId = foreignBranch.id)) }
        val foreignLevel = LearningLevel(organizationId = UUID.randomUUID())
        `when`(fixtures.levels.findById(foreignLevel.id)).thenReturn(Optional.of(foreignLevel))
        assertThrows(IllegalArgumentException::class.java) { fixtures.service.listChildren(fixtures.jwt, fixtures.organizationId, ChildListFilter(learningLevelId = foreignLevel.id)) }
    }

    @Test
    fun `attendance report handles foreign branch and filters records by organization`() {
        val fixtures = Fixtures()
        `when`(fixtures.access.require(fixtures.jwt, fixtures.organizationId, setOf(Role.STAFF_ADMIN))).thenReturn(fixtures.scope)
        `when`(fixtures.branches.findById(fixtures.branch.id)).thenReturn(Optional.of(Branch(id = fixtures.branch.id, organizationId = UUID.randomUUID())))
        assertThrows(IllegalArgumentException::class.java) {
            fixtures.service.childAttendanceReport(fixtures.jwt, fixtures.organizationId, fixtures.branch.id, LocalDate.now(), LocalDate.now())
        }

        `when`(fixtures.branches.findById(fixtures.branch.id)).thenReturn(Optional.of(fixtures.branch))
        val child = Child(organizationId = fixtures.organizationId, branchId = fixtures.branch.id, firstName = "Alya")
        `when`(fixtures.childScopes.visibleChildren(fixtures.scope, fixtures.organizationId)).thenReturn(listOf(child))
        val wrong = AttendanceRecord(organizationId = UUID.randomUUID(), branchId = fixtures.branch.id, childId = child.id, operationalDate = LocalDate.now(), checkedInAt = Instant.now())
        `when`(fixtures.attendance.findAllByChildIdInAndOperationalDateBetween(listOf(child.id), LocalDate.now(), LocalDate.now())).thenReturn(listOf(wrong))
        assertEquals(0, fixtures.service.childAttendanceReport(fixtures.jwt, fixtures.organizationId, fixtures.branch.id, LocalDate.now(), LocalDate.now()).rows.single().totalCheckIns)
    }

    @Test
    fun `child filters cover mismatched branch classroom learning level and closed attendance context`() {
        val fixtures = Fixtures()
        val child = Child(organizationId = fixtures.organizationId, branchId = fixtures.branch.id, classroomId = fixtures.classroom.id, firstName = "Alya")
        val noClassroom = Child(organizationId = fixtures.organizationId, branchId = fixtures.branch.id, classroomId = null, firstName = "Bima")
        val otherBranch = Child(organizationId = fixtures.organizationId, branchId = UUID.randomUUID(), classroomId = null, firstName = "Citra")
        val staffScope = AccessScope(UserProfile(), Membership(organizationId = fixtures.organizationId, role = Role.STAFF), emptySet(), setOf(InstitutionCapability.DAYCARE_OPERATIONS))
        `when`(fixtures.access.require(fixtures.jwt, fixtures.organizationId, Role.entries.toSet(), allowSubscriptionRestrictedForRoles = setOf(Role.PARENT), allowGraceForRoles = Role.entries.toSet())).thenReturn(staffScope)
        `when`(fixtures.childScopes.visibleChildren(staffScope, fixtures.organizationId)).thenReturn(listOf(child, noClassroom, otherBranch))
        `when`(fixtures.branches.findById(fixtures.branch.id)).thenReturn(Optional.of(fixtures.branch))
        `when`(fixtures.levels.findById(fixtures.level.id)).thenReturn(Optional.of(fixtures.level))
        `when`(fixtures.classrooms.findById(fixtures.classroom.id)).thenReturn(Optional.of(fixtures.classroom))
        `when`(fixtures.branches.findAllById(listOf(child.branchId))).thenReturn(listOf(fixtures.branch))
        val today = LocalDate.now(ZoneId.of(fixtures.branch.timezone))
        val closed = AttendanceRecord(organizationId = fixtures.organizationId, branchId = child.branchId, childId = child.id, operationalDate = today, checkedInAt = Instant.now().minusSeconds(120), checkedOutAt = Instant.now().minusSeconds(30))
        `when`(fixtures.attendance.findAllByChildIdInAndOperationalDateIn(listOf(child.id), listOf(today))).thenReturn(listOf(closed))
        `when`(fixtures.publishedOfferings.hasPublishedCapability(fixtures.organizationId, InstitutionCapability.DAYCARE_OPERATIONS, child.branchId)).thenReturn(true)

        assertEquals(listOf("Alya"), fixtures.service.listChildren(fixtures.jwt, fixtures.organizationId, ChildListFilter(learningLevelId = fixtures.level.id)).map { it.fullName })
        assertEquals(emptySet<AttendanceAction>(), fixtures.service.listChildren(fixtures.jwt, fixtures.organizationId, ChildListFilter(learningLevelId = fixtures.level.id)).single().attendanceContext?.allowedActions)
        assertThrows(AccessDeniedException::class.java) { fixtures.service.listChildren(fixtures.jwt, fixtures.organizationId, ChildListFilter(guardianStatus = ChildGuardianStatus.LINKED)) }
    }

    @Test
    fun `report returns an empty row set when no child is visible for the branch`() {
        val fixtures = Fixtures()
        `when`(fixtures.access.require(fixtures.jwt, fixtures.organizationId, setOf(Role.STAFF_ADMIN))).thenReturn(fixtures.scope)
        `when`(fixtures.branches.findById(fixtures.branch.id)).thenReturn(Optional.of(fixtures.branch))
        `when`(fixtures.childScopes.visibleChildren(fixtures.scope, fixtures.organizationId)).thenReturn(emptyList())

        val report = fixtures.service.childAttendanceReport(fixtures.jwt, fixtures.organizationId, fixtures.branch.id, LocalDate.now(), LocalDate.now())

        assertEquals(emptyList<Any>(), report.rows)
    }

    @Test
    fun `classroom filter rejects a classroom outside the selected learning level`() {
        val fixtures = Fixtures()
        val otherLevel = LearningLevel(organizationId = fixtures.organizationId)
        `when`(fixtures.access.require(fixtures.jwt, fixtures.organizationId, Role.entries.toSet(), allowSubscriptionRestrictedForRoles = setOf(Role.PARENT), allowGraceForRoles = Role.entries.toSet())).thenReturn(fixtures.scope)
        `when`(fixtures.levels.findById(otherLevel.id)).thenReturn(Optional.of(otherLevel))
        `when`(fixtures.classrooms.findById(fixtures.classroom.id)).thenReturn(Optional.of(fixtures.classroom))

        assertThrows(IllegalArgumentException::class.java) {
            fixtures.service.listChildren(fixtures.jwt, fixtures.organizationId, ChildListFilter(learningLevelId = otherLevel.id, classroomId = fixtures.classroom.id))
        }
    }

    @Test
    fun `classroom level matching rejects a classroom belonging to a different learning level`() {
        val fixtures = Fixtures()
        val mismatchedClassroom = Classroom(organizationId = fixtures.organizationId, branchId = fixtures.branch.id, learningLevelId = UUID.randomUUID())
        val child = Child(organizationId = fixtures.organizationId, branchId = fixtures.branch.id, classroomId = mismatchedClassroom.id, firstName = "Dewi")
        `when`(fixtures.access.require(fixtures.jwt, fixtures.organizationId, Role.entries.toSet(), allowSubscriptionRestrictedForRoles = setOf(Role.PARENT), allowGraceForRoles = Role.entries.toSet())).thenReturn(fixtures.scope)
        `when`(fixtures.levels.findById(fixtures.level.id)).thenReturn(Optional.of(fixtures.level))
        `when`(fixtures.childScopes.visibleChildren(fixtures.scope, fixtures.organizationId)).thenReturn(listOf(child))
        `when`(fixtures.classrooms.findById(mismatchedClassroom.id)).thenReturn(Optional.of(mismatchedClassroom))
        `when`(fixtures.branches.findAllById(listOf(child.branchId))).thenReturn(listOf(fixtures.branch))
        `when`(fixtures.attendance.findAllByChildIdInAndOperationalDateIn(org.mockito.ArgumentMatchers.anyList(), org.mockito.ArgumentMatchers.anyList())).thenReturn(emptyList())

        assertEquals(emptyList<String>(), fixtures.service.listChildren(fixtures.jwt, fixtures.organizationId, ChildListFilter(learningLevelId = fixtures.level.id)).map { it.fullName })
    }

    @Test
    fun `check-in and check-out notify every linked guardian`() {
        val fixtures = Fixtures()
        val child = Child(organizationId = fixtures.organizationId, branchId = fixtures.branch.id, firstName = "Eka")
        val operationalDate = LocalDate.now(ZoneId.of(fixtures.branch.timezone))
        val guardian = GuardianLink(childId = child.id, userId = UUID.randomUUID())
        `when`(fixtures.access.require(fixtures.jwt, fixtures.organizationId, setOf(Role.STAFF), allowGraceForRoles = setOf(Role.STAFF))).thenReturn(fixtures.scope)
        `when`(fixtures.childScopes.requireStaffManagedChild(fixtures.scope, child.id, fixtures.organizationId)).thenReturn(child)
        `when`(fixtures.branches.findById(child.branchId)).thenReturn(Optional.of(fixtures.branch))
        `when`(fixtures.guardians.findAllByChildId(child.id)).thenReturn(listOf(guardian))
        `when`(fixtures.attendance.save(any(AttendanceRecord::class.java))).thenAnswer { it.arguments[0] }

        `when`(fixtures.attendance.findByChildIdAndOperationalDate(child.id, operationalDate)).thenReturn(null)
        fixtures.service.record(fixtures.jwt, fixtures.organizationId, child.id, AttendanceCommand(AttendanceAction.CHECK_IN, AttendanceMethod.MANUAL, idempotencyKey = "in"))
        verify(fixtures.notifications).notify(fixtures.organizationId, guardian.userId, "Kehadiran Eka", "Eka berhasil check-in.", realtimeFlags = setOf(com.daycare.api.realtime.RealtimeFlag.ATTENDANCE))

        val checkedIn = AttendanceRecord(organizationId = fixtures.organizationId, branchId = child.branchId, childId = child.id, operationalDate = operationalDate, checkedInAt = Instant.now().minusSeconds(60))
        `when`(fixtures.attendance.findByChildIdAndOperationalDate(child.id, operationalDate)).thenReturn(checkedIn)
        `when`(fixtures.publishedOfferings.hasPublishedCapability(fixtures.organizationId, InstitutionCapability.DAYCARE_OPERATIONS, child.branchId)).thenReturn(false)
        fixtures.service.record(fixtures.jwt, fixtures.organizationId, child.id, AttendanceCommand(AttendanceAction.CHECK_OUT, AttendanceMethod.MANUAL, idempotencyKey = "out"))
        verify(fixtures.notifications).notify(fixtures.organizationId, guardian.userId, "Kehadiran Eka", "Eka berhasil check-out.", realtimeFlags = setOf(com.daycare.api.realtime.RealtimeFlag.ATTENDANCE))
    }

    @Test
    fun `attendance record covers daycare consumption and non-daycare checkout`() {
        val daycare = Fixtures()
        val child = Child(organizationId = daycare.organizationId, branchId = daycare.branch.id, firstName = "Alya")
        val scope = AccessScope(UserProfile(), Membership(organizationId = daycare.organizationId, role = Role.STAFF), emptySet(), setOf(InstitutionCapability.DAYCARE_OPERATIONS))
        `when`(daycare.access.require(daycare.jwt, daycare.organizationId, setOf(Role.STAFF), allowGraceForRoles = setOf(Role.STAFF))).thenReturn(scope)
        `when`(daycare.childScopes.requireStaffManagedChild(scope, child.id, daycare.organizationId)).thenReturn(child)
        `when`(daycare.branches.findById(child.branchId)).thenReturn(Optional.of(daycare.branch))
        `when`(daycare.attendance.findByChildIdAndOperationalDate(child.id, LocalDate.now(ZoneId.of(daycare.branch.timezone)))).thenReturn(null)
        `when`(daycare.attendance.save(any(AttendanceRecord::class.java))).thenAnswer { it.arguments[0] }
        `when`(daycare.publishedOfferings.hasPublishedCapability(daycare.organizationId, InstitutionCapability.DAYCARE_OPERATIONS, child.branchId)).thenReturn(true)
        `when`(daycare.bookingEligibility.checkInEligibility(daycare.organizationId, child.id, LocalDate.now(ZoneId.of(daycare.branch.timezone)))).thenReturn(BookingEligibility(true))
        daycare.service.record(daycare.jwt, daycare.organizationId, child.id, AttendanceCommand(AttendanceAction.CHECK_IN, AttendanceMethod.MANUAL, "daycare-in"))
        verify(daycare.bookingEligibility).consumeCheckIn(daycare.organizationId, child.id, LocalDate.now(ZoneId.of(daycare.branch.timezone)))

        val plain = Fixtures()
        val plainChild = Child(organizationId = plain.organizationId, branchId = plain.branch.id, firstName = "Bima")
        val plainScope = AccessScope(UserProfile(), Membership(organizationId = plain.organizationId, role = Role.STAFF), emptySet(), emptySet())
        val existing = AttendanceRecord(organizationId = plain.organizationId, branchId = plain.branch.id, childId = plainChild.id, operationalDate = LocalDate.now(ZoneId.of(plain.branch.timezone)), checkedInAt = Instant.now().minusSeconds(60))
        `when`(plain.access.require(plain.jwt, plain.organizationId, setOf(Role.STAFF), allowGraceForRoles = setOf(Role.STAFF))).thenReturn(plainScope)
        `when`(plain.childScopes.requireStaffManagedChild(plainScope, plainChild.id, plain.organizationId)).thenReturn(plainChild)
        `when`(plain.branches.findById(plainChild.branchId)).thenReturn(Optional.of(plain.branch))
        `when`(plain.attendance.findByChildIdAndOperationalDate(plainChild.id, existing.operationalDate)).thenReturn(existing)
        `when`(plain.attendance.save(any(AttendanceRecord::class.java))).thenAnswer { it.arguments[0] }
        val response = plain.service.record(plain.jwt, plain.organizationId, plainChild.id, AttendanceCommand(AttendanceAction.CHECK_OUT, AttendanceMethod.MANUAL, "plain-out"))
        assertEquals(existing.id, response.id)
    }

    @Test
    fun `attendance helper contexts and guardian statuses cover every visibility branch`() {
        val f = Fixtures()
        val child = Child(organizationId = f.organizationId, branchId = f.branch.id, classroomId = f.classroom.id, firstName = "Alya")
        val today = LocalDate.now(ZoneId.of(f.branch.timezone))
        val parentScope = AccessScope(UserProfile(), Membership(organizationId = f.organizationId, role = Role.PARENT), emptySet(), emptySet())
        assertEquals(null, invokePrivate(f.service, "attendanceContext", parentScope, child, f.branch.timezone, today, null))
        val staffAdminScope = AccessScope(UserProfile(), Membership(organizationId = f.organizationId, role = Role.STAFF_ADMIN), emptySet(), setOf(InstitutionCapability.DAYCARE_OPERATIONS))
        `when`(f.publishedOfferings.hasPublishedCapability(f.organizationId, InstitutionCapability.DAYCARE_OPERATIONS, child.branchId)).thenReturn(true)
        `when`(f.bookingEligibility.checkInEligibility(f.organizationId, child.id, today)).thenReturn(BookingEligibility(true))
        val staffAdminContext = invokePrivate(f.service, "attendanceContext", staffAdminScope, child, f.branch.timezone, today, null) as AttendanceContext
        assertEquals(AttendancePolicy.DAYCARE_BOOKING_REQUIRED, staffAdminContext.attendancePolicy)
        assertEquals(emptySet<AttendanceAction>(), staffAdminContext.allowedActions)
        val staffScope = AccessScope(UserProfile(), Membership(organizationId = f.organizationId, role = Role.STAFF), emptySet(), setOf(InstitutionCapability.DAYCARE_OPERATIONS))
        `when`(f.publishedOfferings.hasPublishedCapability(f.organizationId, InstitutionCapability.DAYCARE_OPERATIONS, child.branchId)).thenReturn(false)
        val unavailable = invokePrivate(f.service, "attendanceContext", staffScope, child, f.branch.timezone, today, null) as AttendanceContext
        assertEquals(AttendancePolicy.NONE, unavailable.attendancePolicy)
        `when`(f.publishedOfferings.hasPublishedCapability(f.organizationId, InstitutionCapability.DAYCARE_OPERATIONS, child.branchId)).thenReturn(true)
        val closed = AttendanceRecord(organizationId = f.organizationId, childId = child.id, branchId = child.branchId, operationalDate = today, checkedInAt = Instant.now(), checkedOutAt = Instant.now())
        assertEquals(emptySet<AttendanceAction>(), (invokePrivate(f.service, "attendanceContext", staffScope, child, f.branch.timezone, today, closed) as AttendanceContext).allowedActions)
        val open = AttendanceRecord(organizationId = f.organizationId, childId = child.id, branchId = child.branchId, operationalDate = today, checkedInAt = Instant.now())
        val staffAdminOpenContext = invokePrivate(f.service, "attendanceContext", staffAdminScope, child, f.branch.timezone, today, open) as AttendanceContext
        assertEquals(emptySet<AttendanceAction>(), staffAdminOpenContext.allowedActions)
        assertEquals(setOf(AttendanceAction.CHECK_OUT), (invokePrivate(f.service, "attendanceContext", staffScope, child, f.branch.timezone, today, open) as AttendanceContext).allowedActions)
        `when`(f.bookingEligibility.checkInEligibility(f.organizationId, child.id, today)).thenReturn(BookingEligibility(true))
        assertEquals(setOf(AttendanceAction.CHECK_IN), (invokePrivate(f.service, "attendanceContext", staffScope, child, f.branch.timezone, today, null) as AttendanceContext).allowedActions)
        `when`(f.bookingEligibility.checkInEligibility(f.organizationId, child.id, today)).thenReturn(BookingEligibility(false, "Tidak ada booking"))
        assertEquals(emptySet<AttendanceAction>(), (invokePrivate(f.service, "attendanceContext", staffScope, child, f.branch.timezone, today, null) as AttendanceContext).allowedActions)

        assertEquals(true, invokePrivate(f.service, "matchesFilter", child, ChildListFilter()))
        assertEquals(false, invokePrivate(f.service, "matchesFilter", child, ChildListFilter(branchId = UUID.randomUUID())))
        assertEquals(false, invokePrivate(f.service, "matchesFilter", child, ChildListFilter(classroomId = UUID.randomUUID())))
        assertEquals(false, invokePrivate(f.service, "matchesFilter", Child(organizationId = f.organizationId, branchId = child.branchId), ChildListFilter(learningLevelId = f.level.id)))
        `when`(f.classrooms.findById(child.classroomId!!)).thenReturn(Optional.of(f.classroom))
        assertEquals(true, invokePrivate(f.service, "matchesFilter", child, ChildListFilter(learningLevelId = f.level.id)))
        val noLinks = invokePrivate(f.service, "guardianStatuses", listOf(child, Child(organizationId = f.organizationId, branchId = f.branch.id))) as Map<*, *>
        assertEquals(ChildGuardianStatus.UNLINKED, noLinks[child.id])
        val parent = UserProfile(registrationRole = RegistrationRole.PARENT)
        val nonParent = UserProfile(registrationRole = null)
        `when`(f.guardians.findAllByChildIdIn(listOf(child.id))).thenReturn(listOf(GuardianLink(childId = child.id, userId = parent.id)))
        `when`(f.users.findAllById(listOf(parent.id))).thenReturn(listOf(parent))
        assertEquals(ChildGuardianStatus.LINKED, (invokePrivate(f.service, "guardianStatuses", listOf(child)) as Map<*, *>)[child.id])
        `when`(f.guardians.findAllByChildIdIn(listOf(child.id))).thenReturn(listOf(GuardianLink(childId = child.id, userId = UUID.randomUUID())))
        `when`(f.users.findAllById(any())).thenReturn(listOf(nonParent))
        assertEquals(ChildGuardianStatus.REVIEW_REQUIRED, (invokePrivate(f.service, "guardianStatuses", listOf(child)) as Map<*, *>)[child.id])
        assertEquals(emptyMap<UUID, ChildGuardianStatus>(), invokePrivate(f.service, "guardianStatuses", emptyList<Child>()))
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
        val pickupExceptions: PickupExceptionService = mock(PickupExceptionService::class.java)
        val publishedOfferings: PublishedOfferingCapabilityService = mock(PublishedOfferingCapabilityService::class.java)
        val notifications: NotificationService = mock(NotificationService::class.java)
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
            notifications,
            bookingEligibility,
            pickupAuthorizations,
            pickupExceptions,
            publishedOfferings,
        )
    }
}
