package com.daycare.api.service

import com.daycare.api.domain.Role
import com.daycare.api.domain.StaffLeaveRequestStatus
import com.daycare.api.domain.StaffLeaveRequestType
import com.daycare.api.persistence.AuditLog
import com.daycare.api.persistence.AuditLogRepository
import com.daycare.api.persistence.MembershipRepository
import com.daycare.api.persistence.StaffLeaveRequest
import com.daycare.api.persistence.StaffLeaveRequestRepository
import com.daycare.api.persistence.UserProfileRepository
import com.daycare.api.realtime.RealtimeFlag
import com.daycare.api.realtime.RealtimePublisher
import jakarta.validation.Valid
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.Size
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Instant
import java.time.LocalDate
import java.util.Base64
import java.util.UUID

private const val MAX_STAFF_LEAVE_EVIDENCE_BYTES = 5 * 1024 * 1024
private val staffLeaveEvidenceContentTypes = setOf("image/jpeg", "image/png")
private const val STAFF_LEAVE_AUDIT_ENTITY = "STAFF_LEAVE_REQUEST"
private const val STAFF_LEAVE_AUDIT_SOURCE = "STAFF_LEAVE"
private const val STAFF_LEAVE_REQUEST_NOTIFICATION_TITLE = "Pengajuan cuti/sakit baru"
private const val STAFF_LEAVE_DECISION_NOTIFICATION_TITLE = "Status pengajuan cuti/sakit"

object StaffLeaveRequestError {
    const val NOT_FOUND = "staff_leave_request.not_found"
    const val UNAVAILABLE = "staff_leave_request.unavailable"
    const val EVIDENCE_MISSING = "staff_leave_request.evidence_missing"
    const val EVIDENCE_TYPE = "staff_leave_request.evidence_type"
    const val EVIDENCE_INVALID = "staff_leave_request.evidence_invalid"
    const val EVIDENCE_TOO_LARGE = "staff_leave_request.evidence_too_large"
    const val START_DATE_PAST = "staff_leave_request.start_date_past"
    const val DATE_RANGE = "staff_leave_request.date_range"
    const val PERIOD_CONFLICT = "staff_leave_request.period_conflict"
    const val REASON_REQUIRED = "staff_leave_request.reason_required"
    const val NOT_PENDING = "staff_leave_request.not_pending"
    const val REJECTION_REASON_REQUIRED = "staff_leave_request.rejection_reason_required"
}

data class StaffLeaveEvidenceInput(@field:NotBlank val contentType: String, @field:NotBlank val dataBase64: String)
data class CreateStaffLeaveRequest(
    val type: StaffLeaveRequestType,
    val startsOn: LocalDate,
    val endsOn: LocalDate,
    @field:NotBlank @field:Size(max = 2_000) val reason: String,
    @field:Valid val evidence: StaffLeaveEvidenceInput? = null,
)
data class DecideStaffLeaveRequest(val approved: Boolean, @field:Size(max = 2_000) val rejectionReason: String? = null)
data class StaffLeaveRequestResponse(
    val id: UUID,
    val requesterUserId: UUID,
    val requesterName: String,
    val type: StaffLeaveRequestType,
    val startsOn: LocalDate,
    val endsOn: LocalDate,
    val reason: String,
    val status: StaffLeaveRequestStatus,
    val hasEvidence: Boolean,
    val rejectionReason: String?,
    val reviewedAt: Instant?,
    val createdAt: Instant,
)
data class StaffLeaveEvidenceResponse(val contentType: String, val dataBase64: String)

@Service
class StaffLeaveRequestService(
    private val access: AccessService,
    private val requests: StaffLeaveRequestRepository,
    private val memberships: MembershipRepository,
    private val users: UserProfileRepository,
    private val audits: AuditLogRepository,
    private val notifications: NotificationService,
    private val realtime: RealtimePublisher,
) {
    @Transactional(readOnly = true)
    fun mine(jwt: Jwt, organizationId: UUID): List<StaffLeaveRequestResponse> {
        val scope = access.require(jwt, organizationId, setOf(Role.STAFF), readOnly = true)
        return requests.findAllByOrganizationIdAndRequesterUserIdOrderByCreatedAtDesc(organizationId, scope.user.id).map(::response)
    }

    @Transactional
    fun create(jwt: Jwt, organizationId: UUID, request: CreateStaffLeaveRequest): StaffLeaveRequestResponse {
        val scope = access.require(jwt, organizationId, setOf(Role.STAFF)); access.requireWritable(scope)
        require(request.reason.isNotBlank()) { StaffLeaveRequestError.REASON_REQUIRED }
        validatePeriod(organizationId, scope.user.id, request.startsOn, request.endsOn)
        val leaveRequest = StaffLeaveRequest(organizationId = organizationId, requesterUserId = scope.user.id, type = request.type, startsOn = request.startsOn, endsOn = request.endsOn, reason = request.reason.trim())
        request.evidence?.let { evidence -> leaveRequest.evidenceContentType = evidence.contentType.lowercase(); leaveRequest.evidenceData = decodeEvidence(evidence) }
        requests.save(leaveRequest)
        audits.save(AuditLog(organizationId = organizationId, actorUserId = scope.user.id, entityType = STAFF_LEAVE_AUDIT_ENTITY, entityId = leaveRequest.id, action = "CREATED", source = STAFF_LEAVE_AUDIT_SOURCE))
        memberships.findAllByOrganizationId(organizationId).filter { it.active && it.role == Role.STAFF_ADMIN }.forEach { admin ->
            notifications.notify(organizationId, admin.userId, STAFF_LEAVE_REQUEST_NOTIFICATION_TITLE, "${scope.user.displayName} mengajukan ${leaveRequest.type.notificationLabel()}.", "/staff-leave-approvals", setOf(RealtimeFlag.STAFF_LEAVE_REQUESTS))
        }
        return response(leaveRequest)
    }

    @Transactional
    fun cancel(jwt: Jwt, organizationId: UUID, requestId: UUID): StaffLeaveRequestResponse {
        val scope = access.require(jwt, organizationId, setOf(Role.STAFF)); access.requireWritable(scope)
        val leaveRequest = owned(requestId, organizationId, scope.user.id)
        require(leaveRequest.status == StaffLeaveRequestStatus.PENDING) { StaffLeaveRequestError.NOT_PENDING }
        leaveRequest.status = StaffLeaveRequestStatus.CANCELLED
        audits.save(AuditLog(organizationId = organizationId, actorUserId = scope.user.id, entityType = STAFF_LEAVE_AUDIT_ENTITY, entityId = leaveRequest.id, action = "CANCELLED", source = STAFF_LEAVE_AUDIT_SOURCE))
        publishToStaffAdmins(organizationId)
        return response(leaveRequest)
    }

    @Transactional(readOnly = true)
    fun pending(jwt: Jwt, organizationId: UUID): List<StaffLeaveRequestResponse> {
        access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN), readOnly = true)
        return requests.findAllByOrganizationIdAndStatusOrderByCreatedAtAsc(organizationId, StaffLeaveRequestStatus.PENDING).map(::response)
    }

    @Transactional
    fun decide(jwt: Jwt, organizationId: UUID, requestId: UUID, decision: DecideStaffLeaveRequest): StaffLeaveRequestResponse {
        val scope = access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN)); access.requireWritable(scope)
        val leaveRequest = requestForOrganization(requestId, organizationId)
        require(leaveRequest.status == StaffLeaveRequestStatus.PENDING) { StaffLeaveRequestError.NOT_PENDING }
        val rejectionReason = decision.rejectionReason?.trim()?.ifBlank { null }
        require(decision.approved || rejectionReason != null) { StaffLeaveRequestError.REJECTION_REASON_REQUIRED }
        leaveRequest.status = if (decision.approved) StaffLeaveRequestStatus.APPROVED else StaffLeaveRequestStatus.REJECTED
        leaveRequest.rejectionReason = if (decision.approved) null else rejectionReason
        leaveRequest.reviewedByUserId = scope.user.id
        leaveRequest.reviewedAt = Instant.now()
        audits.save(AuditLog(organizationId = organizationId, actorUserId = scope.user.id, entityType = STAFF_LEAVE_AUDIT_ENTITY, entityId = leaveRequest.id, action = leaveRequest.status.name, source = STAFF_LEAVE_AUDIT_SOURCE))
        val body = if (decision.approved) "Pengajuan ${leaveRequest.type.notificationLabel()} Anda disetujui." else "Pengajuan ${leaveRequest.type.notificationLabel()} Anda ditolak."
        notifications.notify(organizationId, leaveRequest.requesterUserId, STAFF_LEAVE_DECISION_NOTIFICATION_TITLE, body, "/staff-leave-requests", setOf(RealtimeFlag.STAFF_LEAVE_REQUESTS))
        publishToStaffAdmins(organizationId)
        return response(leaveRequest)
    }

    @Transactional(readOnly = true)
    fun evidence(jwt: Jwt, organizationId: UUID, requestId: UUID): StaffLeaveEvidenceResponse {
        val scope = access.require(jwt, organizationId, setOf(Role.STAFF, Role.STAFF_ADMIN), readOnly = true)
        val leaveRequest = requestForOrganization(requestId, organizationId)
        require(scope.membership.role == Role.STAFF_ADMIN || leaveRequest.requesterUserId == scope.user.id) { StaffLeaveRequestError.UNAVAILABLE }
        val bytes = leaveRequest.evidenceData ?: throw IllegalArgumentException(StaffLeaveRequestError.EVIDENCE_MISSING)
        return StaffLeaveEvidenceResponse(leaveRequest.evidenceContentType ?: "image/jpeg", Base64.getEncoder().encodeToString(bytes))
    }

    private fun validatePeriod(organizationId: UUID, requesterUserId: UUID, startsOn: LocalDate, endsOn: LocalDate) {
        require(!startsOn.isBefore(LocalDate.now())) { StaffLeaveRequestError.START_DATE_PAST }
        require(!endsOn.isBefore(startsOn)) { StaffLeaveRequestError.DATE_RANGE }
        val statuses = setOf(StaffLeaveRequestStatus.PENDING, StaffLeaveRequestStatus.APPROVED)
        val overlaps = requests.findAllByOrganizationIdAndRequesterUserIdAndStatusIn(organizationId, requesterUserId, statuses).any { existing -> !existing.endsOn.isBefore(startsOn) && !existing.startsOn.isAfter(endsOn) }
        require(!overlaps) { StaffLeaveRequestError.PERIOD_CONFLICT }
    }

    private fun owned(id: UUID, organizationId: UUID, userId: UUID) = requestForOrganization(id, organizationId).also { require(it.requesterUserId == userId) { StaffLeaveRequestError.UNAVAILABLE } }
    private fun requestForOrganization(id: UUID, organizationId: UUID) = requests.findById(id).orElseThrow { IllegalArgumentException(StaffLeaveRequestError.NOT_FOUND) }.also { require(it.organizationId == organizationId) { StaffLeaveRequestError.UNAVAILABLE } }
    private fun response(request: StaffLeaveRequest) = StaffLeaveRequestResponse(request.id, request.requesterUserId, users.findById(request.requesterUserId).map { it.displayName }.orElse("Staff"), request.type, request.startsOn, request.endsOn, request.reason, request.status, request.evidenceData != null, request.rejectionReason, request.reviewedAt, request.createdAt)
    private fun publishToStaffAdmins(organizationId: UUID) = realtime.publishToTenantRoles(organizationId, setOf(Role.STAFF_ADMIN), setOf(RealtimeFlag.STAFF_LEAVE_REQUESTS))
    private fun decodeEvidence(input: StaffLeaveEvidenceInput): ByteArray {
        require(input.contentType.lowercase() in staffLeaveEvidenceContentTypes) { StaffLeaveRequestError.EVIDENCE_TYPE }
        val bytes = try { Base64.getDecoder().decode(input.dataBase64) } catch (_: IllegalArgumentException) { throw IllegalArgumentException(StaffLeaveRequestError.EVIDENCE_INVALID) }
        require(bytes.isNotEmpty() && bytes.size <= MAX_STAFF_LEAVE_EVIDENCE_BYTES) { StaffLeaveRequestError.EVIDENCE_TOO_LARGE }
        val jpeg = bytes.size >= 3 && bytes[0] == 0xFF.toByte() && bytes[1] == 0xD8.toByte() && bytes[2] == 0xFF.toByte()
        val png = bytes.size >= 8 && bytes.copyOfRange(0, 8).contentEquals(byteArrayOf(0x89.toByte(), 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A))
        require(jpeg || png) { StaffLeaveRequestError.EVIDENCE_INVALID }
        return bytes
    }
}

private fun StaffLeaveRequestType.notificationLabel(): String = when (this) {
    StaffLeaveRequestType.LEAVE -> "cuti"
    StaffLeaveRequestType.SICK -> "sakit"
}
