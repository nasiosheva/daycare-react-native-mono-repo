package com.daycare.api.service

import com.daycare.api.domain.IncidentCategory
import com.daycare.api.domain.IncidentSeverity
import com.daycare.api.domain.Role
import com.daycare.api.persistence.Child
import com.daycare.api.persistence.ChildIncidentAcknowledgement
import com.daycare.api.persistence.ChildIncidentAcknowledgementRepository
import com.daycare.api.persistence.ChildIncidentReport
import com.daycare.api.persistence.ChildIncidentReportRepository
import com.daycare.api.persistence.GuardianLinkRepository
import com.daycare.api.persistence.MembershipRepository
import com.daycare.api.realtime.RealtimeFlag
import jakarta.validation.Valid
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.NotNull
import jakarta.validation.constraints.Size
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Instant
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
    val createdAt: Instant,
)
data class ChildIncidentPhotoResponse(val contentType: String, val dataBase64: String)

@Service
class ChildIncidentService(
    private val access: AccessService,
    private val childScopes: ChildScopeService,
    private val reports: ChildIncidentReportRepository,
    private val acknowledgements: ChildIncidentAcknowledgementRepository,
    private val guardians: GuardianLinkRepository,
    private val memberships: MembershipRepository,
    private val notifications: NotificationService,
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
    private fun response(report: ChildIncidentReport, acknowledgedByMe: Boolean) = ChildIncidentResponse(report.id, report.childId, report.severity, report.category, report.description, report.actionTaken, report.occurredAt, report.photoData != null, acknowledgedByMe, report.createdAt)
    private fun Child.fullName() = listOfNotNull(firstName, lastName).joinToString(" ")

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
