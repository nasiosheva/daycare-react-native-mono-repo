package com.daycare.api.service

import com.daycare.api.domain.IncidentCategory
import com.daycare.api.domain.IncidentFollowUpStatus
import com.daycare.api.domain.IncidentStatus
import com.daycare.api.domain.IncidentSeverity
import com.daycare.api.domain.GuardianContactStatus
import com.daycare.api.domain.Role
import com.daycare.api.persistence.Child
import com.daycare.api.persistence.ChildIncidentAcknowledgement
import com.daycare.api.persistence.ChildIncidentAcknowledgementRepository
import com.daycare.api.persistence.ChildIncidentFollowUp
import com.daycare.api.persistence.ChildIncidentFollowUpRepository
import com.daycare.api.persistence.ChildIncidentReport
import com.daycare.api.persistence.ChildIncidentReportRepository
import com.daycare.api.persistence.AuditLog
import com.daycare.api.persistence.AuditLogRepository
import com.daycare.api.persistence.GuardianLinkRepository
import com.daycare.api.persistence.MembershipRepository
import com.daycare.api.persistence.UserProfileRepository
import com.daycare.api.realtime.RealtimeFlag
import com.daycare.api.realtime.RealtimePublisher
import jakarta.validation.Valid
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.NotNull
import jakarta.validation.constraints.Size
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Instant
import java.time.LocalDate
import java.util.Base64
import java.util.UUID

private const val MAX_INCIDENT_PHOTO_BYTES = 5 * 1024 * 1024
private val INCIDENT_PHOTO_CONTENT_TYPES = setOf("image/jpeg", "image/png")

object ChildIncidentError {
    const val NOT_FOUND = "child_incident.not_found"
    const val UNAVAILABLE = "child_incident.unavailable"
    const val PHOTO_MISSING = "child_incident.photo_missing"
    const val PHOTO_TYPE = "child_incident.photo_type"
    const val PHOTO_INVALID = "child_incident.photo_invalid"
    const val PHOTO_TOO_LARGE = "child_incident.photo_too_large"
}

data class IncidentPhotoInput(@field:NotBlank val contentType: String, @field:NotBlank val dataBase64: String)
data class CreateChildIncidentRequest(
    @field:NotNull val severity: IncidentSeverity,
    @field:NotNull val category: IncidentCategory,
    @field:NotBlank @field:Size(max = 2_000) val description: String,
    @field:Size(max = 2_000) val actionTaken: String? = null,
    @field:NotNull val occurredAt: Instant,
    @field:Valid val photo: IncidentPhotoInput? = null,
)
data class ChildIncidentResponse(
    val id: UUID,
    val childId: UUID,
    val severity: IncidentSeverity,
    val category: IncidentCategory,
    val description: String,
    val actionTaken: String?,
    val occurredAt: Instant,
    val hasPhoto: Boolean,
    val acknowledgedByMe: Boolean,
    val incidentStatus: IncidentStatus,
    val guardianContactStatus: GuardianContactStatus,
    val guardianContactOutcome: String?,
    val followUpOwnerUserId: UUID?,
    val followUpDueOn: LocalDate?,
    val closedAt: Instant?,
    val createdAt: Instant,
)
data class ChildIncidentPhotoResponse(val contentType: String, val dataBase64: String)
data class UpdateChildIncidentLifecycleRequest(
    @field:NotNull val incidentStatus: IncidentStatus,
    @field:NotNull val guardianContactStatus: GuardianContactStatus,
    @field:Size(max = 2_000) val guardianContactOutcome: String? = null,
    val followUpOwnerUserId: UUID? = null,
    val followUpDueOn: LocalDate? = null,
)
data class CreateChildIncidentFollowUpRequest(
    @field:NotBlank @field:Size(max = 500) val title: String,
    @field:Size(max = 2_000) val note: String? = null,
)
data class ChildIncidentFollowUpResponse(
    val id: UUID,
    val incidentId: UUID,
    val title: String,
    val note: String?,
    val status: IncidentFollowUpStatus,
    val completedAt: Instant?,
    val createdAt: Instant,
)

@Service
class ChildIncidentService(
    private val access: AccessService,
    private val childScopes: ChildScopeService,
    private val reports: ChildIncidentReportRepository,
    private val acknowledgements: ChildIncidentAcknowledgementRepository,
    private val followUps: ChildIncidentFollowUpRepository,
    private val guardians: GuardianLinkRepository,
    private val memberships: MembershipRepository,
    private val users: UserProfileRepository,
    private val audits: AuditLogRepository,
    private val notifications: NotificationService,
    private val realtime: RealtimePublisher,
) {
    @Transactional(readOnly = true)
    fun list(jwt: Jwt, organizationId: UUID, childId: UUID): List<ChildIncidentResponse> {
        val scope = access.require(jwt, organizationId, Role.entries.toSet())
        if (scope.membership.role == Role.PARENT) childScopes.requireParentLinkedChild(scope, childId, organizationId) else childScopes.requireStaffManagedChild(scope, childId, organizationId)
        val reportsForChild = reports.findAllByOrganizationIdAndChildIdOrderByOccurredAtDesc(organizationId, childId)
        val acknowledgedIncidentIds = acknowledgements.findAllByIncidentIdIn(reportsForChild.map { it.id })
            .filter { it.userId == scope.user.id }.map { it.incidentId }.toSet()
        return reportsForChild.map { response(it, it.id in acknowledgedIncidentIds) }
    }

    @Transactional
    fun create(jwt: Jwt, organizationId: UUID, childId: UUID, request: CreateChildIncidentRequest): ChildIncidentResponse {
        val scope = access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN, Role.STAFF))
        access.requireWritable(scope)
        val child = childScopes.requireStaffManagedChild(scope, childId, organizationId)
        val report = ChildIncidentReport(
            organizationId = organizationId, branchId = child.branchId, childId = child.id, reportedByUserId = scope.user.id,
            severity = request.severity, category = request.category, description = request.description.trim(),
            actionTaken = request.actionTaken?.trim()?.ifBlank { null }, occurredAt = request.occurredAt,
            guardianContactStatus = if (request.severity == IncidentSeverity.SERIOUS) GuardianContactStatus.PENDING else GuardianContactStatus.NOT_REQUIRED,
        )
        request.photo?.let { photo ->
            report.photoContentType = photo.contentType.lowercase()
            report.photoData = decodePhoto(photo)
        }
        reports.save(report)
        val childName = child.fullName()
        notifyGuardians(child, "Laporan insiden $childName", describeIncident(report))
        if (request.severity == IncidentSeverity.SERIOUS) notifyStaffAdmins(child, "Insiden serius: $childName", describeIncident(report))
        return response(report, acknowledgedByMe = false)
    }

    @Transactional
    fun acknowledge(jwt: Jwt, organizationId: UUID, childId: UUID, incidentId: UUID): ChildIncidentResponse {
        val scope = access.require(jwt, organizationId, setOf(Role.PARENT))
        access.requireWritable(scope)
        childScopes.requireParentLinkedChild(scope, childId, organizationId)
        val report = requireReport(incidentId, organizationId, childId)
        if (!acknowledgements.existsByIncidentIdAndUserId(report.id, scope.user.id)) {
            acknowledgements.save(ChildIncidentAcknowledgement(incidentId = report.id, userId = scope.user.id, acknowledgedAt = Instant.now()))
        }
        return response(report, acknowledgedByMe = true)
    }

    @Transactional
    fun updateLifecycle(jwt: Jwt, organizationId: UUID, childId: UUID, incidentId: UUID, request: UpdateChildIncidentLifecycleRequest): ChildIncidentResponse {
        val scope = access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN, Role.STAFF))
        access.requireWritable(scope)
        val child = childScopes.requireStaffManagedChild(scope, childId, organizationId)
        val report = requireReport(incidentId, organizationId, child.id)
        request.followUpOwnerUserId?.let { ownerId -> requireAssignedStaff(ownerId, child, organizationId) }
        if (request.incidentStatus == IncidentStatus.CLOSED) {
            require(request.guardianContactStatus != GuardianContactStatus.PENDING) { DaycareOperationError.STATE }
            require(!followUps.existsByIncidentIdAndStatus(report.id, IncidentFollowUpStatus.OPEN)) { DaycareOperationError.STATE }
            if (report.severity == IncidentSeverity.SERIOUS) {
                require(request.guardianContactStatus == GuardianContactStatus.CONFIRMED && !request.guardianContactOutcome.isNullOrBlank()) { DaycareOperationError.STATE }
            }
        }
        report.incidentStatus = request.incidentStatus
        report.guardianContactStatus = request.guardianContactStatus
        report.guardianContactOutcome = request.guardianContactOutcome?.trim()?.ifBlank { null }
        report.followUpOwnerUserId = request.followUpOwnerUserId
        report.followUpDueOn = request.followUpDueOn
        if (request.incidentStatus == IncidentStatus.CLOSED) {
            report.closedAt = report.closedAt ?: Instant.now()
            report.closedByUserId = report.closedByUserId ?: scope.user.id
        } else {
            report.closedAt = null
            report.closedByUserId = null
        }
        audits.save(AuditLog(organizationId = organizationId, actorUserId = scope.user.id, entityType = "CHILD_INCIDENT", entityId = report.id, action = "LIFECYCLE_UPDATED", source = "CHILD_SAFETY"))
        notifyGuardians(child, "Pembaruan laporan insiden ${child.fullName()}", describeIncident(report))
        realtime.publishToTenantRoles(organizationId, setOf(Role.STAFF_ADMIN, Role.STAFF), setOf(RealtimeFlag.INCIDENT_REPORTS), mapOf("childId" to child.id))
        return response(report, acknowledgedByMe = acknowledgements.existsByIncidentIdAndUserId(report.id, scope.user.id))
    }

    @Transactional(readOnly = true)
    fun listFollowUps(jwt: Jwt, organizationId: UUID, childId: UUID, incidentId: UUID): List<ChildIncidentFollowUpResponse> {
        val scope = access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN, Role.STAFF))
        childScopes.requireStaffManagedChild(scope, childId, organizationId)
        requireReport(incidentId, organizationId, childId)
        return followUps.findAllByIncidentIdOrderByCreatedAtAsc(incidentId).map(::followUpResponse)
    }

    @Transactional
    fun addFollowUp(jwt: Jwt, organizationId: UUID, childId: UUID, incidentId: UUID, request: CreateChildIncidentFollowUpRequest): ChildIncidentFollowUpResponse {
        val scope = access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN, Role.STAFF))
        access.requireWritable(scope)
        val child = childScopes.requireStaffManagedChild(scope, childId, organizationId)
        val report = requireReport(incidentId, organizationId, child.id)
        require(report.incidentStatus != IncidentStatus.CLOSED) { DaycareOperationError.STATE }
        val followUp = followUps.save(ChildIncidentFollowUp(organizationId = organizationId, incidentId = report.id, createdByUserId = scope.user.id, title = request.title.trim(), note = request.note?.trim()?.ifBlank { null }))
        audits.save(AuditLog(organizationId = organizationId, actorUserId = scope.user.id, entityType = "CHILD_INCIDENT_FOLLOW_UP", entityId = followUp.id, action = "CREATED", source = "CHILD_SAFETY"))
        return followUpResponse(followUp)
    }

    @Transactional
    fun completeFollowUp(jwt: Jwt, organizationId: UUID, childId: UUID, incidentId: UUID, followUpId: UUID): ChildIncidentFollowUpResponse {
        val scope = access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN, Role.STAFF))
        access.requireWritable(scope)
        childScopes.requireStaffManagedChild(scope, childId, organizationId)
        requireReport(incidentId, organizationId, childId)
        val followUp = followUps.findById(followUpId).orElseThrow { IllegalArgumentException(DaycareOperationError.UNAVAILABLE) }
        require(followUp.organizationId == organizationId && followUp.incidentId == incidentId) { DaycareOperationError.UNAVAILABLE }
        if (followUp.status == IncidentFollowUpStatus.OPEN) {
            followUp.status = IncidentFollowUpStatus.COMPLETED
            followUp.completedAt = Instant.now()
            followUp.completedByUserId = scope.user.id
            audits.save(AuditLog(organizationId = organizationId, actorUserId = scope.user.id, entityType = "CHILD_INCIDENT_FOLLOW_UP", entityId = followUp.id, action = "COMPLETED", source = "CHILD_SAFETY"))
        }
        return followUpResponse(followUp)
    }

    @Transactional(readOnly = true)
    fun photo(jwt: Jwt, organizationId: UUID, childId: UUID, incidentId: UUID): ChildIncidentPhotoResponse {
        val scope = access.require(jwt, organizationId, Role.entries.toSet())
        if (scope.membership.role == Role.PARENT) childScopes.requireParentLinkedChild(scope, childId, organizationId) else childScopes.requireStaffManagedChild(scope, childId, organizationId)
        val report = requireReport(incidentId, organizationId, childId)
        val data = report.photoData ?: throw IllegalArgumentException(ChildIncidentError.PHOTO_MISSING)
        return ChildIncidentPhotoResponse(report.photoContentType ?: "image/jpeg", Base64.getEncoder().encodeToString(data))
    }

    private fun requireReport(incidentId: UUID, organizationId: UUID, childId: UUID) = reports.findById(incidentId).orElseThrow { IllegalArgumentException(ChildIncidentError.NOT_FOUND) }
        .also { require(it.organizationId == organizationId && it.childId == childId) { ChildIncidentError.UNAVAILABLE } }

    private fun decodePhoto(input: IncidentPhotoInput): ByteArray {
        require(input.contentType.lowercase() in INCIDENT_PHOTO_CONTENT_TYPES) { ChildIncidentError.PHOTO_TYPE }
        val bytes = try { Base64.getDecoder().decode(input.dataBase64) } catch (_: IllegalArgumentException) { throw IllegalArgumentException(ChildIncidentError.PHOTO_INVALID) }
        require(bytes.isNotEmpty()) { ChildIncidentError.PHOTO_INVALID }
        require(bytes.size <= MAX_INCIDENT_PHOTO_BYTES) { ChildIncidentError.PHOTO_TOO_LARGE }
        val isJpeg = bytes.size >= 3 && bytes[0] == 0xFF.toByte() && bytes[1] == 0xD8.toByte() && bytes[2] == 0xFF.toByte()
        val isPng = bytes.size >= 8 && bytes.copyOfRange(0, 8).contentEquals(byteArrayOf(0x89.toByte(), 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A))
        require(isJpeg || isPng) { ChildIncidentError.PHOTO_INVALID }
        return bytes
    }

    private fun describeIncident(report: ChildIncidentReport) = report.description.take(200)
    private fun response(report: ChildIncidentReport, acknowledgedByMe: Boolean) = ChildIncidentResponse(report.id, report.childId, report.severity, report.category, report.description, report.actionTaken, report.occurredAt, report.photoData != null, acknowledgedByMe, report.incidentStatus, report.guardianContactStatus, report.guardianContactOutcome, report.followUpOwnerUserId, report.followUpDueOn, report.closedAt, report.createdAt)
    private fun followUpResponse(followUp: ChildIncidentFollowUp) = ChildIncidentFollowUpResponse(followUp.id, followUp.incidentId, followUp.title, followUp.note, followUp.status, followUp.completedAt, followUp.createdAt)
    private fun Child.fullName() = listOfNotNull(firstName, lastName).joinToString(" ")

    private fun requireAssignedStaff(userId: UUID, child: Child, organizationId: UUID) {
        val user = users.findById(userId).orElseThrow { IllegalArgumentException(DaycareOperationError.UNAVAILABLE) }
        val membership = memberships.findAllByUserIdAndOrganizationId(user.id, organizationId).firstOrNull { it.active && it.role in setOf(Role.STAFF_ADMIN, Role.STAFF) }
            ?: throw IllegalArgumentException(DaycareOperationError.UNAVAILABLE)
        require(childScopes.isStaffManagedChild(AccessScope(user, membership, emptySet(), emptySet()), child.id, organizationId)) { DaycareOperationError.UNAVAILABLE }
    }

    private fun notifyGuardians(child: Child, title: String, body: String) {
        guardians.findAllByChildId(child.id).map { it.userId }.distinct()
            .forEach { userId -> notifications.notify(child.organizationId, userId, title, body, "/incident-reports?childId=${child.id}", setOf(RealtimeFlag.INCIDENT_REPORTS)) }
    }

    private fun notifyStaffAdmins(child: Child, title: String, body: String) {
        memberships.findAllByOrganizationId(child.organizationId)
            .filter { it.active && it.role == Role.STAFF_ADMIN }
            .map { it.userId }
            .distinct()
            .forEach { userId -> notifications.notify(child.organizationId, userId, title, body, "/incident-reports?childId=${child.id}", setOf(RealtimeFlag.INCIDENT_REPORTS)) }
    }
}
