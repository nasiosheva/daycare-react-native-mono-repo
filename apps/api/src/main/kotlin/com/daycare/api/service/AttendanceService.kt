package com.daycare.api.service

import com.daycare.api.domain.AttendanceAction
import com.daycare.api.domain.AttendanceMethod
import com.daycare.api.domain.InstitutionCapability
import com.daycare.api.domain.Role
import com.daycare.api.persistence.AttendanceRecord
import com.daycare.api.persistence.AttendanceRepository
import com.daycare.api.persistence.AuditLog
import com.daycare.api.persistence.AuditLogRepository
import com.daycare.api.persistence.BranchRepository
import com.daycare.api.persistence.Child
import com.daycare.api.persistence.GuardianLinkRepository
import org.springframework.security.access.AccessDeniedException
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Instant
import java.time.ZoneId
import java.time.LocalDate
import java.util.UUID

class AttendanceConflict(message: String) : RuntimeException(message)
data class ChildResponse(val id: UUID, val organizationId: UUID, val branchId: UUID, val classroomId: UUID?, val firstName: String, val lastName: String?, val nisn: String?, val dateOfBirth: LocalDate) { val fullName get() = listOfNotNull(firstName, lastName).joinToString(" ") }
data class AttendanceResponse(val id: UUID, val childId: UUID, val operationalDate: LocalDate, val checkedInAt: Instant?, val checkedOutAt: Instant?, val method: AttendanceMethod)

@Service
class AttendanceService(
    private val access: AccessService,
    private val guardians: GuardianLinkRepository,
    private val childScopes: ChildScopeService,
    private val branches: BranchRepository,
    private val attendance: AttendanceRepository,
    private val audits: AuditLogRepository,
    private val qr: AttendanceQrService,
    private val notifications: NotificationService,
    private val bookingEligibility: BookingEligibilityService,
) {
    @Transactional
    fun listChildren(jwt: Jwt, organizationId: UUID): List<ChildResponse> {
        val scope = access.require(jwt, organizationId, Role.entries.toSet(), readOnly = true)
        return childScopes.visibleChildren(scope, organizationId).map(::toResponse)
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
        val record = when (command.action) {
            AttendanceAction.CHECK_IN -> {
                if (current?.checkedInAt != null && current.checkedOutAt == null) throw AttendanceConflict("Child is already checked in")
                if (current?.checkedOutAt != null) throw AttendanceConflict("Attendance for this operational day is closed")
                current ?: AttendanceRecord(organizationId = organizationId, branchId = child.branchId, childId = child.id, operationalDate = operationalDate)
            }
            AttendanceAction.CHECK_OUT -> current?.takeIf { it.checkedInAt != null && it.checkedOutAt == null } ?: throw AttendanceConflict("Child must be checked in before check-out")
        }
        if (command.action == AttendanceAction.CHECK_IN && InstitutionCapability.DAYCARE_OPERATIONS in scope.capabilities) bookingEligibility.consumeCheckIn(organizationId, child.id, operationalDate)
        if (command.action == AttendanceAction.CHECK_IN) { record.checkedInAt = now; record.checkInMethod = command.method.name }
        else { record.checkedOutAt = now; record.checkOutMethod = command.method.name }
        val saved = attendance.save(record)
        audits.save(AuditLog(organizationId = organizationId, actorUserId = scope.user.id, entityType = "ATTENDANCE", entityId = saved.id, action = command.action.name, source = command.method.name))
        guardians.findAllByChildId(child.id).forEach { guardian -> notifications.notify(organizationId, guardian.userId, "Kehadiran ${child.firstName}", "${child.fullName()} berhasil ${if (command.action == AttendanceAction.CHECK_IN) "check-in" else "check-out"}.") }
        return toResponse(saved, command.method)
    }

    @Transactional
    fun issueQr(jwt: Jwt, organizationId: UUID, childId: UUID): IssuedQr {
        val scope = access.require(jwt, organizationId, setOf(Role.PARENT))
        val child = childScopes.requireParentLinkedChild(scope, childId, organizationId)
        return qr.issue(child.id, child.fullName())
    }

    private fun toResponse(child: Child) = ChildResponse(child.id, child.organizationId, child.branchId, child.classroomId, child.firstName, child.lastName, child.nisn, child.dateOfBirth)
    private fun toResponse(record: AttendanceRecord, method: AttendanceMethod) = AttendanceResponse(record.id, record.childId, record.operationalDate, record.checkedInAt, record.checkedOutAt, method)
    private fun Child.fullName() = listOfNotNull(firstName, lastName).joinToString(" ")
}

data class AttendanceCommand(val action: AttendanceAction, val method: AttendanceMethod, val qrToken: String? = null, val note: String? = null)
