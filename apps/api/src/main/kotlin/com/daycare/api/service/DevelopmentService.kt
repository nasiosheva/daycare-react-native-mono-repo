package com.daycare.api.service

import com.daycare.api.domain.DevelopmentCategory
import com.daycare.api.domain.Role
import com.daycare.api.persistence.AuditLog
import com.daycare.api.persistence.AuditLogRepository
import com.daycare.api.persistence.DevelopmentEntry
import com.daycare.api.persistence.DevelopmentEntryRepository
import com.daycare.api.persistence.GuardianLinkRepository
import com.daycare.api.persistence.UserProfileRepository
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.Size
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Instant
import java.util.UUID

data class CreateDevelopmentEntryRequest(
    val category: DevelopmentCategory,
    @field:NotBlank @field:Size(max = 120) val title: String,
    @field:NotBlank @field:Size(max = 2_000) val content: String,
)

data class DevelopmentEntryResponse(
    val id: UUID,
    val childId: UUID,
    val category: DevelopmentCategory,
    val title: String,
    val content: String,
    val recordedAt: Instant,
    val recordedBy: String,
)

@Service
class DevelopmentService(
    private val access: AccessService,
    private val childScopes: ChildScopeService,
    private val entries: DevelopmentEntryRepository,
    private val guardians: GuardianLinkRepository,
    private val users: UserProfileRepository,
    private val audits: AuditLogRepository,
    private val notifications: NotificationService,
) {
    @Transactional
    fun list(jwt: Jwt, organizationId: UUID, childId: UUID): List<DevelopmentEntryResponse> {
        val scope = access.require(jwt, organizationId, Role.entries.toSet())
        if (scope.membership.role == Role.PARENT) childScopes.requireParentLinkedChild(scope, childId, organizationId)
        else childScopes.requireStaffManagedChild(scope, childId, organizationId)
        return entries.findAllByOrganizationIdAndChildIdOrderByRecordedAtDesc(organizationId, childId).map(::toResponse)
    }

    @Transactional
    fun create(jwt: Jwt, organizationId: UUID, childId: UUID, request: CreateDevelopmentEntryRequest): DevelopmentEntryResponse {
        val scope = access.require(jwt, organizationId, setOf(Role.ADMIN, Role.STAFF))
        val child = childScopes.requireStaffManagedChild(scope, childId, organizationId)
        val entry = entries.save(DevelopmentEntry(
            organizationId = organizationId,
            branchId = child.branchId,
            childId = child.id,
            authorUserId = scope.user.id,
            category = request.category,
            title = request.title.trim(),
            content = request.content.trim(),
        ))
        audits.save(AuditLog(organizationId = organizationId, actorUserId = scope.user.id, entityType = "DEVELOPMENT_ENTRY", entityId = entry.id, action = "CREATED", source = "STAFF_NOTE"))
        guardians.findAllByChildId(child.id).forEach { guardian ->
            notifications.notify(organizationId, guardian.userId, "Perkembangan ${child.firstName}", "${categoryLabel(entry.category)}: ${entry.title}")
        }
        return toResponse(entry)
    }

    private fun toResponse(entry: DevelopmentEntry): DevelopmentEntryResponse {
        val author = users.findById(entry.authorUserId).map { it.displayName }.orElse("Staf daycare")
        return DevelopmentEntryResponse(entry.id, entry.childId, entry.category, entry.title, entry.content, entry.recordedAt, author)
    }

    private fun categoryLabel(category: DevelopmentCategory) = when (category) {
        DevelopmentCategory.ACTIVITY -> "Aktivitas"
        DevelopmentCategory.MEAL -> "Makan"
        DevelopmentCategory.NAP -> "Tidur"
        DevelopmentCategory.OBSERVATION -> "Observasi"
    }
}
