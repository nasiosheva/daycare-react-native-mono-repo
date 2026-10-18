package com.daycare.api.service

// Mories Deo Hutapea,S.E.,S.Kom

import com.daycare.api.domain.PlatformBannerStatus
import com.daycare.api.domain.PlatformBannerAudience
import com.daycare.api.domain.ParentActionType
import com.daycare.api.domain.Role
import com.daycare.api.persistence.OrganizationRepository
import com.daycare.api.persistence.PlatformBanner
import com.daycare.api.persistence.PlatformBannerRepository
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.Size
import org.springframework.security.access.AccessDeniedException
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Instant
import java.util.UUID

data class UpsertPlatformBannerRequest(
    @field:NotBlank @field:Size(max = 160) val title: String,
    @field:Size(max = 4_000) val body: String = "",
    @field:NotBlank @field:Size(max = 2_048) val imageUrl: String,
    val actionType: ParentActionType = ParentActionType.NONE,
    @field:Size(max = 2_048) val actionTarget: String? = null,
    val expiresAt: Instant? = null,
    val audience: PlatformBannerAudience = PlatformBannerAudience.PARENT_GLOBAL,
    val targetOrganizationId: UUID? = null,
)
data class SchedulePlatformBannerRequest(val scheduledAt: Instant? = null)
data class PlatformBannerResponse(val id: UUID, val title: String, val body: String, val imageUrl: String, val actionType: ParentActionType, val actionTarget: String?, val audience: PlatformBannerAudience, val targetOrganizationId: UUID?, val targetOrganizationName: String?, val status: PlatformBannerStatus, val scheduledAt: Instant?, val publishedAt: Instant?, val expiresAt: Instant?, val closedAt: Instant?, val createdAt: Instant, val updatedAt: Instant)

@Service
class PlatformBannerService(
    private val platformAccess: PlatformAccessService,
    private val identity: IdentityService,
    private val banners: PlatformBannerRepository,
    private val access: AccessService,
    private val organizations: OrganizationRepository,
) {
    @Transactional(readOnly = true)
    fun listManaged(jwt: Jwt): List<PlatformBannerResponse> {
        platformAccess.requirePlatformAdmin(jwt)
        val results = banners.findAllByOrderByCreatedAtDesc()
        val organizationNames = organizations.findAllById(results.mapNotNull { it.targetOrganizationId }.distinct()).associate { it.id to it.name }
        return results.map { response(it, organizationNames[it.targetOrganizationId]) }
    }

    @Transactional(readOnly = true)
    fun listForParent(jwt: Jwt): List<PlatformBannerResponse> {
        requireRegisteredParent(identity.sync(jwt))
        val now = Instant.now()
        return banners.findAllByStatusAndAudienceOrderByPublishedAtDesc(PlatformBannerStatus.PUBLISHED, PlatformBannerAudience.PARENT_GLOBAL)
            .filter { it.publishedAt?.isAfter(now) == false && (it.expiresAt == null || it.expiresAt!!.isAfter(now)) }
            .sortedByDescending { it.publishedAt }
            .map(::response)
    }

    @Transactional(readOnly = true)
    fun listForStaffAdmin(jwt: Jwt, organizationId: UUID): List<PlatformBannerResponse> {
        access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN), allowSubscriptionRestrictedForRoles = setOf(Role.STAFF_ADMIN))
        val now = Instant.now()
        val global = banners.findAllByStatusAndAudienceOrderByPublishedAtDesc(PlatformBannerStatus.PUBLISHED, PlatformBannerAudience.STAFF_ADMIN_GLOBAL)
        val tenant = banners.findAllByStatusAndAudienceAndTargetOrganizationIdOrderByPublishedAtDesc(PlatformBannerStatus.PUBLISHED, PlatformBannerAudience.TENANT_STAFF_ADMIN, organizationId)
        return (global + tenant)
            .filter { it.audience == PlatformBannerAudience.STAFF_ADMIN_GLOBAL || it.targetOrganizationId == organizationId }
            .filter { it.publishedAt?.isAfter(now) == false && (it.expiresAt == null || it.expiresAt!!.isAfter(now)) }
            .sortedByDescending { it.publishedAt }
            .map(::response)
    }

    @Transactional
    fun create(jwt: Jwt, request: UpsertPlatformBannerRequest): PlatformBannerResponse {
        val admin = platformAccess.requirePlatformAdmin(jwt)
        val now = Instant.now()
        validateExpiry(request.expiresAt, now)
        val targetOrganizationId = validateAudience(request.audience, request.targetOrganizationId)
        val banner = banners.save(PlatformBanner(createdByUserId = admin.id, updatedByUserId = admin.id, title = request.title.trim(), body = request.body.trim(), imageUrl = requireHttpsImageUrl(request.imageUrl)!!, actionType = request.actionType, actionTarget = validatePlatformBannerAction(request.audience, request.actionType, request.actionTarget), audience = request.audience, targetOrganizationId = targetOrganizationId, expiresAt = request.expiresAt, createdAt = now, updatedAt = now))
        return response(banner)
    }

    @Transactional
    fun update(jwt: Jwt, bannerId: UUID, request: UpsertPlatformBannerRequest): PlatformBannerResponse {
        val admin = platformAccess.requirePlatformAdmin(jwt)
        val banner = requireBanner(bannerId)
        require(banner.status == PlatformBannerStatus.DRAFT) { DaycareOperationError.STATE }
        validateExpiry(request.expiresAt, Instant.now())
        val targetOrganizationId = validateAudience(request.audience, request.targetOrganizationId)
        banner.title = request.title.trim()
        banner.body = request.body.trim()
        banner.imageUrl = requireHttpsImageUrl(request.imageUrl)!!
        banner.actionType = request.actionType
        banner.actionTarget = validatePlatformBannerAction(request.audience, request.actionType, request.actionTarget)
        banner.audience = request.audience
        banner.targetOrganizationId = targetOrganizationId
        banner.expiresAt = request.expiresAt
        banner.updatedByUserId = admin.id
        banner.updatedAt = Instant.now()
        return response(banner)
    }

    @Transactional
    fun publish(jwt: Jwt, bannerId: UUID, request: SchedulePlatformBannerRequest): PlatformBannerResponse {
        val admin = platformAccess.requirePlatformAdmin(jwt)
        val banner = requireBanner(bannerId)
        require(banner.status == PlatformBannerStatus.DRAFT) { DaycareOperationError.STATE }
        banner.updatedByUserId = admin.id
        val now = Instant.now()
        val scheduledAt = request.scheduledAt
        require(scheduledAt == null || scheduledAt.isAfter(now)) { DaycareOperationError.INVALID }
        validateExpiry(banner.expiresAt, scheduledAt ?: now)
        if (scheduledAt == null) publishNow(banner, now) else {
            banner.status = PlatformBannerStatus.SCHEDULED
            banner.scheduledAt = scheduledAt
            banner.updatedAt = Instant.now()
        }
        return response(banner)
    }

    @Transactional
    fun close(jwt: Jwt, bannerId: UUID): PlatformBannerResponse {
        val admin = platformAccess.requirePlatformAdmin(jwt)
        val banner = requireBanner(bannerId)
        require(banner.status in setOf(PlatformBannerStatus.SCHEDULED, PlatformBannerStatus.PUBLISHED)) { DaycareOperationError.STATE }
        banner.status = PlatformBannerStatus.CLOSED
        val now = Instant.now()
        banner.closedAt = now
        banner.scheduledAt = null
        banner.updatedAt = now
        banner.updatedByUserId = admin.id
        return response(banner)
    }

    @Transactional
    @Scheduled(cron = "0 * * * * *", zone = "Asia/Jakarta")
    fun publishScheduled() {
        val now = Instant.now()
        val expiringStatuses = setOf(PlatformBannerStatus.SCHEDULED, PlatformBannerStatus.PUBLISHED)
        banners.findAllByStatusInAndExpiresAtLessThanEqual(expiringStatuses, now).forEach(::closeExpired)
        banners.findAllByStatusAndScheduledAtLessThanEqual(PlatformBannerStatus.SCHEDULED, now)
            .filter { it.status == PlatformBannerStatus.SCHEDULED && (it.expiresAt == null || it.expiresAt!!.isAfter(now)) }
            .forEach { publishNow(it, now) }
    }

    private fun publishNow(banner: PlatformBanner, publishedAt: Instant) {
        banner.status = PlatformBannerStatus.PUBLISHED
        banner.publishedAt = publishedAt
        banner.scheduledAt = null
        banner.updatedAt = publishedAt
    }

    private fun closeExpired(banner: PlatformBanner) {
        if (banner.status !in setOf(PlatformBannerStatus.SCHEDULED, PlatformBannerStatus.PUBLISHED)) return
        val now = Instant.now()
        banner.status = PlatformBannerStatus.CLOSED
        banner.closedAt = now
        banner.scheduledAt = null
        banner.updatedAt = now
    }

    private fun validateExpiry(expiresAt: Instant?, startAt: Instant) {
        require(expiresAt == null || expiresAt.isAfter(startAt)) { DaycareOperationError.INVALID }
    }

    private fun validateAudience(audience: PlatformBannerAudience, targetOrganizationId: UUID?): UUID? = when (audience) {
        PlatformBannerAudience.PARENT_GLOBAL, PlatformBannerAudience.STAFF_ADMIN_GLOBAL -> {
            require(targetOrganizationId == null) { DaycareOperationError.INVALID }
            null
        }
        PlatformBannerAudience.TENANT_STAFF_ADMIN -> {
            val organizationId = requireNotNull(targetOrganizationId) { DaycareOperationError.INVALID }
            organizations.findById(organizationId).orElseThrow { IllegalArgumentException("Tenant was not found") }
            organizationId
        }
    }

    private fun requireBanner(id: UUID) = banners.findById(id).orElseThrow { IllegalArgumentException(DaycareOperationError.UNAVAILABLE) }
    private fun response(banner: PlatformBanner, targetOrganizationName: String? = null) = PlatformBannerResponse(banner.id, banner.title, banner.body, banner.imageUrl, banner.actionType, banner.actionTarget, banner.audience, banner.targetOrganizationId, targetOrganizationName, banner.status, banner.scheduledAt, banner.publishedAt, banner.expiresAt, banner.closedAt, banner.createdAt, banner.updatedAt)
}
