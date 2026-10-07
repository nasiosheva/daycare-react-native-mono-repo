package com.daycare.api.service

import com.daycare.api.domain.Role
import com.daycare.api.domain.TenantAnnouncementAudience
import com.daycare.api.domain.TenantAnnouncementStatus
import com.daycare.api.persistence.AuditLog
import com.daycare.api.persistence.AuditLogRepository
import com.daycare.api.persistence.ChildRepository
import com.daycare.api.persistence.BranchRepository
import com.daycare.api.persistence.GuardianLinkRepository
import com.daycare.api.persistence.Membership
import com.daycare.api.persistence.MembershipRepository
import com.daycare.api.persistence.TenantAnnouncement
import com.daycare.api.persistence.TenantAnnouncementRecipient
import com.daycare.api.persistence.TenantAnnouncementRecipientRepository
import com.daycare.api.persistence.TenantAnnouncementRepository
import com.daycare.api.realtime.RealtimeFlag
import com.daycare.api.realtime.RealtimePublisher
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.NotNull
import jakarta.validation.constraints.Size
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Instant
import java.util.UUID

data class UpsertTenantAnnouncementRequest(
    @field:NotNull val audience: TenantAnnouncementAudience,
    val branchId: UUID? = null,
    @field:NotBlank @field:Size(max = 160) val title: String,
    @field:NotBlank @field:Size(max = 4_000) val body: String,
    val requiresAcknowledgement: Boolean = false,
)
data class ScheduleTenantAnnouncementRequest(val scheduledAt: Instant? = null)
data class TenantAnnouncementResponse(val id: UUID, val audience: TenantAnnouncementAudience, val branchId: UUID?, val title: String, val body: String, val requiresAcknowledgement: Boolean, val status: TenantAnnouncementStatus, val scheduledAt: Instant?, val publishedAt: Instant?, val closedAt: Instant?, val acknowledgedByMe: Boolean, val recipientCount: Int, val createdAt: Instant)

@Service
class TenantAnnouncementService(
    private val access: AccessService,
    private val announcements: TenantAnnouncementRepository,
    private val recipients: TenantAnnouncementRecipientRepository,
    private val memberships: MembershipRepository,
    private val children: ChildRepository,
    private val branches: BranchRepository,
    private val guardians: GuardianLinkRepository,
    private val audits: AuditLogRepository,
    private val notifications: NotificationService,
    private val realtime: RealtimePublisher,
) {
    @Transactional(readOnly = true)
    fun listManaged(jwt: Jwt, organizationId: UUID): List<TenantAnnouncementResponse> {
        val scope = access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN), readOnly = true)
        return announcements.findAllByOrganizationIdOrderByCreatedAtDesc(organizationId).map { response(it, scope.user.id) }
    }

    @Transactional(readOnly = true)
    fun listMine(jwt: Jwt, organizationId: UUID): List<TenantAnnouncementResponse> {
        val scope = access.require(jwt, organizationId, Role.entries.toSet(), readOnly = true)
        val recipientIds = recipients.findAllByRecipientUserId(scope.user.id).map { it.announcementId }.toSet()
        return announcements.findAllByOrganizationIdAndStatus(organizationId, TenantAnnouncementStatus.PUBLISHED)
            .filter { it.id in recipientIds }
            .sortedByDescending { it.publishedAt }
            .map { response(it, scope.user.id) }
    }

    @Transactional
    fun create(jwt: Jwt, organizationId: UUID, request: UpsertTenantAnnouncementRequest): TenantAnnouncementResponse {
        val scope = access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN))
        access.requireWritable(scope)
        validateScope(organizationId, request)
        val announcement = announcements.save(TenantAnnouncement(organizationId = organizationId, createdByUserId = scope.user.id, audience = request.audience, branchId = request.branchId, title = request.title.trim(), body = request.body.trim(), requiresAcknowledgement = request.requiresAcknowledgement))
        audits.save(AuditLog(organizationId = organizationId, actorUserId = scope.user.id, entityType = "TENANT_ANNOUNCEMENT", entityId = announcement.id, action = "CREATED", source = "TENANT_COMMUNICATION"))
        notifyManagers(organizationId)
        return response(announcement, scope.user.id)
    }

    @Transactional
    fun update(jwt: Jwt, organizationId: UUID, announcementId: UUID, request: UpsertTenantAnnouncementRequest): TenantAnnouncementResponse {
        val scope = access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN))
        access.requireWritable(scope)
        val announcement = requireAnnouncement(organizationId, announcementId)
        require(announcement.status == TenantAnnouncementStatus.DRAFT) { DaycareOperationError.STATE }
        validateScope(organizationId, request)
        announcement.audience = request.audience
        announcement.branchId = request.branchId
        announcement.title = request.title.trim()
        announcement.body = request.body.trim()
        announcement.requiresAcknowledgement = request.requiresAcknowledgement
        announcement.updatedAt = Instant.now()
        audits.save(AuditLog(organizationId = organizationId, actorUserId = scope.user.id, entityType = "TENANT_ANNOUNCEMENT", entityId = announcement.id, action = "UPDATED", source = "TENANT_COMMUNICATION"))
        notifyManagers(organizationId)
        return response(announcement, scope.user.id)
    }

    @Transactional
    fun publish(jwt: Jwt, organizationId: UUID, announcementId: UUID, request: ScheduleTenantAnnouncementRequest): TenantAnnouncementResponse {
        val scope = access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN))
        access.requireWritable(scope)
        val announcement = requireAnnouncement(organizationId, announcementId)
        require(announcement.status == TenantAnnouncementStatus.DRAFT) { DaycareOperationError.STATE }
        val scheduledAt = request.scheduledAt?.takeIf { it.isAfter(Instant.now()) }
        if (scheduledAt != null) {
            announcement.status = TenantAnnouncementStatus.SCHEDULED
            announcement.scheduledAt = scheduledAt
            announcement.updatedAt = Instant.now()
        } else publishNow(announcement)
        audits.save(AuditLog(organizationId = organizationId, actorUserId = scope.user.id, entityType = "TENANT_ANNOUNCEMENT", entityId = announcement.id, action = if (scheduledAt == null) "PUBLISHED" else "SCHEDULED", source = "TENANT_COMMUNICATION"))
        if (scheduledAt != null) notifyManagers(organizationId)
        return response(announcement, scope.user.id)
    }

    @Transactional
    fun close(jwt: Jwt, organizationId: UUID, announcementId: UUID): TenantAnnouncementResponse {
        val scope = access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN))
        access.requireWritable(scope)
        val announcement = requireAnnouncement(organizationId, announcementId)
        require(announcement.status in setOf(TenantAnnouncementStatus.SCHEDULED, TenantAnnouncementStatus.PUBLISHED)) { DaycareOperationError.STATE }
        announcement.status = TenantAnnouncementStatus.CLOSED
        announcement.closedAt = Instant.now()
        announcement.updatedAt = Instant.now()
        audits.save(AuditLog(organizationId = organizationId, actorUserId = scope.user.id, entityType = "TENANT_ANNOUNCEMENT", entityId = announcement.id, action = "CLOSED", source = "TENANT_COMMUNICATION"))
        notifyManagers(organizationId)
        return response(announcement, scope.user.id)
    }

    @Transactional
    fun acknowledge(jwt: Jwt, organizationId: UUID, announcementId: UUID): TenantAnnouncementResponse {
        val scope = access.require(jwt, organizationId, Role.entries.toSet())
        access.requireWritable(scope)
        val announcement = requireAnnouncement(organizationId, announcementId)
        require(announcement.status == TenantAnnouncementStatus.PUBLISHED && announcement.requiresAcknowledgement) { DaycareOperationError.STATE }
        val recipient = recipients.findByAnnouncementIdAndRecipientUserId(announcement.id, scope.user.id) ?: throw IllegalArgumentException(DaycareOperationError.UNAVAILABLE)
        if (recipient.acknowledgedAt == null) recipient.acknowledgedAt = Instant.now()
        return response(announcement, scope.user.id)
    }

    @Transactional
    @Scheduled(cron = "0 * * * * *", zone = "Asia/Jakarta")
    fun publishScheduled() {
        announcements.findAll().filter { it.status == TenantAnnouncementStatus.SCHEDULED && it.scheduledAt?.isAfter(Instant.now()) == false }.forEach(::publishNow)
    }

    private fun publishNow(announcement: TenantAnnouncement) {
        val now = Instant.now()
        announcement.status = TenantAnnouncementStatus.PUBLISHED
        announcement.publishedAt = now
        announcement.scheduledAt = null
        announcement.updatedAt = now
        val recipientIds = audienceRecipients(announcement)
        recipientIds.forEach { userId ->
            recipients.save(TenantAnnouncementRecipient(announcementId = announcement.id, recipientUserId = userId))
            notifications.notify(announcement.organizationId, userId, announcement.title, announcement.body, "/announcements", setOf(RealtimeFlag.TENANT_ANNOUNCEMENTS))
        }
        notifyManagers(announcement.organizationId)
    }

    private fun audienceRecipients(announcement: TenantAnnouncement): Set<UUID> {
        val membershipsInTenant = memberships.findAllByOrganizationId(announcement.organizationId).filter { it.active }
        val staffRecipients = membershipsInTenant.filter { membership ->
            membership.role == Role.STAFF_ADMIN || membership.role == Role.STAFF && (announcement.audience == TenantAnnouncementAudience.TENANT || membership.branchId == announcement.branchId)
        }.map(Membership::userId)
        val childIds = children.findAllByOrganizationId(announcement.organizationId)
            .filter { it.active && (announcement.audience == TenantAnnouncementAudience.TENANT || it.branchId == announcement.branchId) }
            .map { it.id }.toSet()
        val parentRecipients = guardians.findAllByChildIdIn(childIds).map { it.userId }
            .filter { parentId -> membershipsInTenant.any { it.userId == parentId && it.role == Role.PARENT } }
        return (staffRecipients + parentRecipients).toSet()
    }

    private fun validateScope(organizationId: UUID, request: UpsertTenantAnnouncementRequest) {
        require((request.audience == TenantAnnouncementAudience.TENANT) == (request.branchId == null)) { DaycareOperationError.INVALID }
        request.branchId?.let { branchId ->
            val branch = branches.findById(branchId).orElseThrow { IllegalArgumentException(DaycareOperationError.UNAVAILABLE) }
            require(branch.organizationId == organizationId && branch.active) { DaycareOperationError.UNAVAILABLE }
        }
    }

    private fun requireAnnouncement(organizationId: UUID, announcementId: UUID) = announcements.findById(announcementId).orElseThrow { IllegalArgumentException(DaycareOperationError.UNAVAILABLE) }
        .also { require(it.organizationId == organizationId) { DaycareOperationError.UNAVAILABLE } }

    private fun notifyManagers(organizationId: UUID) = realtime.publishToTenantRoles(organizationId, setOf(Role.STAFF_ADMIN), setOf(RealtimeFlag.TENANT_ANNOUNCEMENTS))

    private fun response(announcement: TenantAnnouncement, userId: UUID): TenantAnnouncementResponse {
        val audience = recipients.findAllByAnnouncementId(announcement.id)
        return TenantAnnouncementResponse(announcement.id, announcement.audience, announcement.branchId, announcement.title, announcement.body, announcement.requiresAcknowledgement, announcement.status, announcement.scheduledAt, announcement.publishedAt, announcement.closedAt, audience.any { it.recipientUserId == userId && it.acknowledgedAt != null }, audience.size, announcement.createdAt)
    }
}
