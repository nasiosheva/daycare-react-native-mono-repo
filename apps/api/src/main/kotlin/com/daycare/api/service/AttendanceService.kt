package com.daycare.api.service

import com.daycare.api.domain.AttendanceAction
import com.daycare.api.domain.AttendanceMethod
import com.daycare.api.domain.InstitutionCapability
import com.daycare.api.domain.Gender
import com.daycare.api.domain.RegistrationRole
import com.daycare.api.domain.Role
import com.daycare.api.persistence.AttendanceRecord
import com.daycare.api.persistence.AttendanceRepository
import com.daycare.api.persistence.AuditLog
import com.daycare.api.persistence.AuditLogRepository
import com.daycare.api.persistence.BranchRepository
import com.daycare.api.persistence.Child
import com.daycare.api.persistence.ClassroomRepository
import com.daycare.api.persistence.GuardianLinkRepository
import com.daycare.api.persistence.LearningLevelRepository
import com.daycare.api.persistence.UserProfileRepository
import com.daycare.api.realtime.RealtimeFlag
import org.springframework.security.access.AccessDeniedException
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Instant
import java.time.ZoneId
import java.time.LocalDate
import java.util.UUID

class AttendanceConflict(message: String) : RuntimeException(message)
enum class ChildGuardianStatus { LINKED, UNLINKED, REVIEW_REQUIRED }
enum class AttendancePolicy { DAYCARE_BOOKING_REQUIRED, NONE }
data class AttendanceContext(
    val operationalDate: LocalDate,
    val timezone: String,
    val attendancePolicy: AttendancePolicy,
    val allowedActions: Set<AttendanceAction>,
    val unavailableReason: String? = null,
)
data class ChildResponse(val id: UUID, val organizationId: UUID, val branchId: UUID, val classroomId: UUID?, val firstName: String, val lastName: String?, val nisn: String?, val gender: Gender, val dateOfBirth: LocalDate, val todayCheckedInAt: Instant? = null, val todayCheckedOutAt: Instant? = null, val guardianStatus: ChildGuardianStatus? = null, val attendanceContext: AttendanceContext? = null) { val fullName get() = listOfNotNull(firstName, lastName).joinToString(" ") }
data class ChildListFilter(val branchId: UUID? = null, val learningLevelId: UUID? = null, val classroomId: UUID? = null, val guardianStatus: ChildGuardianStatus? = null)
data class AttendanceResponse(val id: UUID, val childId: UUID, val operationalDate: LocalDate, val checkedInAt: Instant?, val checkedOutAt: Instant?, val method: AttendanceMethod)
data class ChildAttendanceSummary(val childId: UUID, val fullName: String, val nisn: String?, val totalCheckIns: Int, val totalCheckOuts: Int, val pendingCheckOuts: Int)
data class ChildAttendanceReport(val branchName: String, val startsOn: LocalDate, val endsOn: LocalDate, val rows: List<ChildAttendanceSummary>)

enum class ChildAttendanceReportError { DATE_RANGE }

@Service
class AttendanceService(
    private val access: AccessService,
    private val guardians: GuardianLinkRepository,
    private val users: UserProfileRepository,
    private val childScopes: ChildScopeService,
    private val branches: BranchRepository,
    private val learningLevels: LearningLevelRepository,
    private val classrooms: ClassroomRepository,
    private val attendance: AttendanceRepository,
    private val audits: AuditLogRepository,
    private val qr: AttendanceQrService,
    private val notifications: NotificationService,
    private val bookingEligibility: BookingEligibilityService,
    private val pickupAuthorizations: PickupAuthorizationService,
    private val publishedOfferingCapabilities: PublishedOfferingCapabilityService,
) {
    @Transactional
    fun listChildren(jwt: Jwt, organizationId: UUID, filter: ChildListFilter = ChildListFilter()): List<ChildResponse> {
        val scope = access.require(jwt, organizationId, Role.entries.toSet())
        if (filter.guardianStatus != null && scope.membership.role != Role.STAFF_ADMIN) throw AccessDeniedException("Guardian status filtering is only available to Staff Admin")
        validateFilter(organizationId, filter)
        val scopedChildren = childScopes.visibleChildren(scope, organizationId).filter { child -> matchesFilter(child, filter) }
        val guardianStatusByChild = if (scope.membership.role == Role.STAFF_ADMIN) guardianStatuses(scopedChildren) else emptyMap()
        val visibleChildren = scopedChildren.filter { child -> filter.guardianStatus == null || guardianStatusByChild[child.id] == filter.guardianStatus }
        val timezoneByBranch = branches.findAllById(visibleChildren.map { it.branchId }.distinct()).associate { it.id to it.timezone }
        val operationalDateByChild = visibleChildren.associate { child -> child.id to LocalDate.now(ZoneId.of(timezoneByBranch[child.branchId] ?: "Asia/Jakarta")) }
        val recordByChildAndDate = attendance.findAllByChildIdInAndOperationalDateIn(visibleChildren.map { it.id }, operationalDateByChild.values.distinct())
            .associateBy { it.childId to it.operationalDate }
        return visibleChildren.map { child ->
            val timezone = timezoneByBranch[child.branchId] ?: "Asia/Jakarta"
            val operationalDate = operationalDateByChild.getValue(child.id)
            val todayRecord = recordByChildAndDate[child.id to operationalDate]
            toResponse(child, todayRecord, guardianStatusByChild[child.id], attendanceContext(scope, child, timezone, operationalDate, todayRecord))
        }
    }

    @Transactional(readOnly = true)
    fun childAttendanceReport(jwt: Jwt, organizationId: UUID, branchId: UUID, startsOn: LocalDate, endsOn: LocalDate): ChildAttendanceReport {
        val scope = access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN))
        require(!endsOn.isBefore(startsOn)) { ChildAttendanceReportError.DATE_RANGE.name }
        val branch = branches.findById(branchId).orElseThrow { IllegalArgumentException("Branch was not found") }
        require(branch.organizationId == organizationId) { "Branch belongs to a different organization" }
        val children = childScopes.visibleChildren(scope, organizationId).filter { it.branchId == branchId }.sortedBy { it.fullName() }
        if (children.isEmpty()) return ChildAttendanceReport(branch.name, startsOn, endsOn, emptyList())

        val recordsByChildId = attendance.findAllByChildIdInAndOperationalDateBetween(children.map { it.id }, startsOn, endsOn)
            .filter { it.organizationId == organizationId && it.branchId == branchId }
            .groupBy { it.childId }
        val rows = children.map { child ->
            val records = recordsByChildId[child.id].orEmpty()
            ChildAttendanceSummary(
                childId = child.id,
                fullName = child.fullName(),
                nisn = child.nisn,
                totalCheckIns = records.count { it.checkedInAt != null },
                totalCheckOuts = records.count { it.checkedOutAt != null },
                pendingCheckOuts = records.count { it.checkedInAt != null && it.checkedOutAt == null },
            )
        }
        return ChildAttendanceReport(branch.name, startsOn, endsOn, rows)
    }

    @Transactional
    fun record(jwt: Jwt, organizationId: UUID, childId: UUID, command: AttendanceCommand): AttendanceResponse {
        val scope = access.require(jwt, organizationId, setOf(Role.STAFF))
        access.requireWritable(scope)
        val child = childScopes.requireStaffManagedChild(scope, childId, organizationId)
        if (command.method == AttendanceMethod.QR) qr.verify(child.id, child.fullName(), command.qrToken ?: throw IllegalArgumentException("QR token is required"))
        val timezone = branches.findById(child.branchId).orElseThrow { IllegalArgumentException("Child branch was not found") }.timezone
        val operationalDate = LocalDate.now(ZoneId.of(timezone))
        val current = attendance.findByChildIdAndOperationalDate(child.id, operationalDate)
        val now = Instant.now()
        val eventTime = command.at ?: now
        if (eventTime.isAfter(now)) throw IllegalArgumentException("Attendance time cannot be in the future")
        if (LocalDate.ofInstant(eventTime, ZoneId.of(timezone)) != operationalDate) throw IllegalArgumentException("Attendance time must be within today")
        val record = when (command.action) {
            AttendanceAction.CHECK_IN -> {
                if (current?.checkedInAt != null && current.checkedOutAt == null) throw AttendanceConflict("Child is already checked in")
                if (current?.checkedOutAt != null) throw AttendanceConflict("Attendance for this operational day is closed")
                current ?: AttendanceRecord(organizationId = organizationId, branchId = child.branchId, childId = child.id, operationalDate = operationalDate)
            }
            AttendanceAction.CHECK_OUT -> current?.takeIf { it.checkedInAt != null && it.checkedOutAt == null } ?: throw AttendanceConflict("Child must be checked in before check-out")
        }
        if (command.action == AttendanceAction.CHECK_OUT && record.checkedInAt?.let { eventTime.isBefore(it) } == true) throw IllegalArgumentException("Check-out time cannot be before check-in")
        val hasDaycareOffering = InstitutionCapability.DAYCARE_OPERATIONS in scope.capabilities &&
            hasPublishedDaycareOffering(organizationId, child.branchId)
        if (command.action == AttendanceAction.CHECK_IN && hasDaycareOffering) bookingEligibility.consumeCheckIn(organizationId, child.id, operationalDate)
        if (command.action == AttendanceAction.CHECK_IN) { record.checkedInAt = eventTime; record.checkInMethod = command.method.name }
        else {
            val pickup = if (hasDaycareOffering) pickupAuthorizations.verifyCheckout(scope, child, command.pickupAuthorizationId, command.pickupExceptionReason) else PickupCheckoutVerification(null, null, null, null)
            record.checkedOutAt = eventTime
            record.checkOutMethod = command.method.name
            record.pickupAuthorizationId = pickup.authorizationId
            record.pickupPersonName = pickup.pickupPersonName
            record.pickupVerificationMethod = pickup.verificationMethod?.name
            record.checkoutVerifiedByUserId = scope.user.id
            record.checkoutExceptionReason = pickup.exceptionReason
        }
        val saved = attendance.save(record)
        audits.save(AuditLog(organizationId = organizationId, actorUserId = scope.user.id, entityType = "ATTENDANCE", entityId = saved.id, action = command.action.name, source = command.method.name))
        guardians.findAllByChildId(child.id).forEach { guardian -> notifications.notify(organizationId, guardian.userId, "Kehadiran ${child.firstName}", "${child.fullName()} berhasil ${if (command.action == AttendanceAction.CHECK_IN) "check-in" else "check-out"}.", realtimeFlags = setOf(RealtimeFlag.ATTENDANCE)) }
        return toResponse(saved, command.method)
    }

    @Transactional
    fun issueQr(jwt: Jwt, organizationId: UUID, childId: UUID): IssuedQr {
        val scope = access.require(jwt, organizationId, setOf(Role.PARENT))
        val child = childScopes.requireParentLinkedChild(scope, childId, organizationId)
        return qr.issue(child.id, child.fullName())
    }

    private fun toResponse(child: Child, todayRecord: AttendanceRecord? = null, guardianStatus: ChildGuardianStatus? = null, attendanceContext: AttendanceContext? = null) = ChildResponse(child.id, child.organizationId, child.branchId, child.classroomId, child.firstName, child.lastName, child.nisn, child.gender, child.dateOfBirth, todayRecord?.checkedInAt, todayRecord?.checkedOutAt, guardianStatus, attendanceContext)
    private fun toResponse(record: AttendanceRecord, method: AttendanceMethod) = AttendanceResponse(record.id, record.childId, record.operationalDate, record.checkedInAt, record.checkedOutAt, method)
    private fun Child.fullName() = listOfNotNull(firstName, lastName).joinToString(" ")

    private fun attendanceContext(scope: AccessScope, child: Child, timezone: String, operationalDate: LocalDate, record: AttendanceRecord?): AttendanceContext? {
        if (scope.membership.role !in setOf(Role.STAFF, Role.STAFF_ADMIN)) return null
        if (InstitutionCapability.DAYCARE_OPERATIONS !in scope.capabilities || !hasPublishedDaycareOffering(child.organizationId, child.branchId)) return AttendanceContext(operationalDate, timezone, AttendancePolicy.NONE, emptySet(), "Kehadiran Daycare tidak tersedia untuk cabang ini")
        if (record?.checkedOutAt != null) return AttendanceContext(operationalDate, timezone, AttendancePolicy.DAYCARE_BOOKING_REQUIRED, emptySet(), "Kehadiran hari ini sudah ditutup")
        if (record?.checkedInAt != null) return AttendanceContext(operationalDate, timezone, AttendancePolicy.DAYCARE_BOOKING_REQUIRED, setOf(AttendanceAction.CHECK_OUT))
        val eligibility = bookingEligibility.checkInEligibility(child.organizationId, child.id, operationalDate)
        return AttendanceContext(
            operationalDate,
            timezone,
            AttendancePolicy.DAYCARE_BOOKING_REQUIRED,
            if (eligibility.allowed) setOf(AttendanceAction.CHECK_IN) else emptySet(),
            eligibility.reason,
        )
    }

    private fun hasPublishedDaycareOffering(organizationId: UUID, branchId: UUID) =
        publishedOfferingCapabilities.hasPublishedCapability(organizationId, InstitutionCapability.DAYCARE_OPERATIONS, branchId)

    private fun validateFilter(organizationId: UUID, filter: ChildListFilter) {
        filter.branchId?.let { branchId ->
            val branch = branches.findById(branchId).orElseThrow { IllegalArgumentException("Branch was not found") }
            require(branch.organizationId == organizationId) { "Branch belongs to a different organization" }
        }
        filter.learningLevelId?.let { levelId ->
            val level = learningLevels.findById(levelId).orElseThrow { IllegalArgumentException("Learning level was not found") }
            require(level.organizationId == organizationId) { "Learning level belongs to a different organization" }
        }
        filter.classroomId?.let { classroomId ->
            val classroom = classrooms.findById(classroomId).orElseThrow { IllegalArgumentException("Classroom was not found") }
            require(classroom.organizationId == organizationId) { "Classroom belongs to a different organization" }
            require(filter.branchId == null || classroom.branchId == filter.branchId) { "Classroom does not belong to the selected branch" }
            require(filter.learningLevelId == null || classroom.learningLevelId == filter.learningLevelId) { "Classroom does not belong to the selected learning level" }
        }
    }

    private fun matchesFilter(child: Child, filter: ChildListFilter): Boolean {
        if (filter.branchId != null && child.branchId != filter.branchId) return false
        if (filter.classroomId != null && child.classroomId != filter.classroomId) return false
        if (filter.learningLevelId == null) return true
        val classroomId = child.classroomId ?: return false
        return classrooms.findById(classroomId).orElse(null)?.learningLevelId == filter.learningLevelId
    }

    private fun guardianStatuses(children: List<Child>): Map<UUID, ChildGuardianStatus> {
        if (children.isEmpty()) return emptyMap()
        val linksByChild = guardians.findAllByChildIdIn(children.map { it.id }).groupBy { it.childId }
        val usersById = users.findAllById(linksByChild.values.flatten().map { it.userId }.distinct()).associateBy { it.id }
        return children.associate { child ->
            val links = linksByChild[child.id].orEmpty()
            val status = when {
                links.isEmpty() -> ChildGuardianStatus.UNLINKED
                links.any { usersById[it.userId]?.registrationRole != RegistrationRole.PARENT } -> ChildGuardianStatus.REVIEW_REQUIRED
                else -> ChildGuardianStatus.LINKED
            }
            child.id to status
        }
    }
}

data class AttendanceCommand(val action: AttendanceAction, val method: AttendanceMethod, val qrToken: String? = null, val note: String? = null, val at: Instant? = null, val pickupAuthorizationId: UUID? = null, val pickupExceptionReason: String? = null)
