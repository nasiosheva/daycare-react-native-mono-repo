package com.daycare.api.service

import com.daycare.api.domain.Role
import com.daycare.api.persistence.AuditLog
import com.daycare.api.persistence.AuditLogRepository
import com.daycare.api.persistence.DevelopmentCategoryConfig
import com.daycare.api.persistence.DevelopmentCategoryConfigRepository
import com.daycare.api.persistence.DevelopmentEntry
import com.daycare.api.persistence.DevelopmentEntryRepository
import com.daycare.api.persistence.GuardianLinkRepository
import com.daycare.api.persistence.UserProfileRepository
import com.daycare.api.realtime.RealtimeFlag
import com.daycare.api.realtime.RealtimePublisher
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.Size
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Instant
import java.util.UUID

data class CreateDevelopmentEntryRequest(
    @field:NotBlank @field:Size(max = 64) val category: String,
    @field:NotBlank @field:Size(max = 120) val title: String,
    @field:NotBlank @field:Size(max = 2_000) val content: String,
)
data class CreateDevelopmentCategoryRequest(@field:NotBlank @field:Size(max = 120) val name: String)
data class UpdateDevelopmentCategoryRequest(@field:Size(max = 120) val name: String? = null, val active: Boolean? = null)
data class DevelopmentCategoryResponse(val id: String, val name: String, val active: Boolean, val system: Boolean)
data class DevelopmentEntryResponse(val id: UUID, val childId: UUID, val category: String, val categoryName: String, val title: String, val content: String, val recordedAt: Instant, val recordedBy: String)

@Service
class DevelopmentService(
    private val access: AccessService,
    private val childScopes: ChildScopeService,
    private val entries: DevelopmentEntryRepository,
    private val categories: DevelopmentCategoryConfigRepository,
    private val guardians: GuardianLinkRepository,
    private val users: UserProfileRepository,
    private val audits: AuditLogRepository,
    private val notifications: NotificationService,
    private val realtime: RealtimePublisher,
) {
    @Transactional(readOnly = true)
    fun categories(jwt: Jwt, organizationId: UUID): List<DevelopmentCategoryResponse> {
        access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN, Role.STAFF), readOnly = true)
        return systemCategories + categories.findAllByOrganizationIdOrderByNameAsc(organizationId).map { DevelopmentCategoryResponse(it.id.toString(), it.name, it.active, false) }
    }

    @Transactional
    fun createCategory(jwt: Jwt, organizationId: UUID, request: CreateDevelopmentCategoryRequest): DevelopmentCategoryResponse {
        val scope = requireCategoryCreator(jwt, organizationId)
        val name = request.name.trim()
        require(name.isNotBlank()) { "Category name is required" }
        require(!systemCategories.any { it.name.equals(name, ignoreCase = true) }) { "This is already a built-in category" }
        require(!categories.existsByOrganizationIdAndNameIgnoreCase(organizationId, name)) { "A category with this name already exists" }
        val category = categories.save(DevelopmentCategoryConfig(organizationId = organizationId, name = name, createdByUserId = scope.user.id))
        audits.save(AuditLog(organizationId = organizationId, actorUserId = scope.user.id, entityType = "DEVELOPMENT_CATEGORY", entityId = category.id, action = "CREATED", source = "TENANT_CONFIGURATION"))
        realtime.publishToTenantRoles(organizationId, setOf(Role.STAFF_ADMIN, Role.STAFF), setOf(RealtimeFlag.DEVELOPMENT_CATEGORIES))
        return DevelopmentCategoryResponse(category.id.toString(), category.name, category.active, false)
    }

    @Transactional
    fun updateCategory(jwt: Jwt, organizationId: UUID, categoryId: UUID, request: UpdateDevelopmentCategoryRequest): DevelopmentCategoryResponse {
        val scope = requireCategoryCreator(jwt, organizationId)
        val category = categories.findById(categoryId).orElseThrow { IllegalArgumentException("Development category was not found") }
        require(category.organizationId == organizationId) { "Development category is not available" }
        request.name?.trim()?.let { name ->
            require(name.isNotBlank()) { "Category name is required" }
            require(!categories.existsByOrganizationIdAndNameIgnoreCase(organizationId, name) || category.name.equals(name, ignoreCase = true)) { "A category with this name already exists" }
            category.name = name
        }
        request.active?.let { category.active = it }
        audits.save(AuditLog(organizationId = organizationId, actorUserId = scope.user.id, entityType = "DEVELOPMENT_CATEGORY", entityId = category.id, action = "UPDATED", source = "TENANT_CONFIGURATION"))
        realtime.publishToTenantRoles(organizationId, setOf(Role.STAFF_ADMIN, Role.STAFF), setOf(RealtimeFlag.DEVELOPMENT_CATEGORIES))
        return DevelopmentCategoryResponse(category.id.toString(), category.name, category.active, false)
    }

    @Transactional
    fun deleteCategory(jwt: Jwt, organizationId: UUID, categoryId: UUID) {
        val scope = requireCategoryCreator(jwt, organizationId)
        val category = categories.findById(categoryId).orElseThrow { IllegalArgumentException("Development category was not found") }
        require(category.organizationId == organizationId) { "Development category is not available" }
        require(!entries.existsByOrganizationIdAndCategory(organizationId, category.id.toString())) { "This category is used by existing development entries" }
        categories.delete(category)
        audits.save(AuditLog(organizationId = organizationId, actorUserId = scope.user.id, entityType = "DEVELOPMENT_CATEGORY", entityId = category.id, action = "DELETED", source = "TENANT_CONFIGURATION"))
        realtime.publishToTenantRoles(organizationId, setOf(Role.STAFF_ADMIN, Role.STAFF), setOf(RealtimeFlag.DEVELOPMENT_CATEGORIES))
    }

    @Transactional
    fun list(jwt: Jwt, organizationId: UUID, childId: UUID): List<DevelopmentEntryResponse> {
        val scope = access.require(jwt, organizationId, Role.entries.toSet(), readOnly = true)
        if (scope.membership.role == Role.PARENT) childScopes.requireParentLinkedChild(scope, childId, organizationId) else childScopes.requireStaffManagedChild(scope, childId, organizationId)
        return entries.findAllByOrganizationIdAndChildIdOrderByRecordedAtDesc(organizationId, childId).map { toResponse(it, organizationId) }
    }

    @Transactional
    fun create(jwt: Jwt, organizationId: UUID, childId: UUID, request: CreateDevelopmentEntryRequest): DevelopmentEntryResponse {
        val scope = access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN, Role.STAFF))
        access.requireWritable(scope)
        val child = childScopes.requireStaffManagedChild(scope, childId, organizationId)
        val categoryId = request.category.trim()
        val categoryName = categoryName(organizationId, categoryId, requireActive = true)
        val entry = entries.save(DevelopmentEntry(organizationId = organizationId, branchId = child.branchId, childId = child.id, authorUserId = scope.user.id, category = categoryId, title = request.title.trim(), content = request.content.trim()))
        audits.save(AuditLog(organizationId = organizationId, actorUserId = scope.user.id, entityType = "DEVELOPMENT_ENTRY", entityId = entry.id, action = "CREATED", source = "STAFF_NOTE"))
        guardians.findAllByChildId(child.id).forEach { guardian -> notifications.notify(organizationId, guardian.userId, "Perkembangan ${child.firstName}", "$categoryName: ${entry.title}", realtimeFlags = setOf(RealtimeFlag.DEVELOPMENT)) }
        return toResponse(entry, organizationId, categoryName)
    }

    private fun requireCategoryCreator(jwt: Jwt, organizationId: UUID): AccessScope {
        val scope = access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN, Role.STAFF))
        access.requireWritable(scope)
        require(scope.membership.role == Role.STAFF_ADMIN || scope.membership.canManageDevelopmentCategories) { "Staff Admin permission is required to add development categories" }
        return scope
    }

    private fun toResponse(entry: DevelopmentEntry, organizationId: UUID, name: String = categoryName(organizationId, entry.category, requireActive = false)): DevelopmentEntryResponse {
        val author = users.findById(entry.authorUserId).map { it.displayName }.orElse("Staf daycare")
        return DevelopmentEntryResponse(entry.id, entry.childId, entry.category, name, entry.title, entry.content, entry.recordedAt, author)
    }

    private fun categoryName(organizationId: UUID, id: String, requireActive: Boolean): String {
        systemCategories.firstOrNull { it.id == id }?.let { return it.name }
        val category = runCatching { categories.findById(UUID.fromString(id)).orElse(null) }.getOrNull()
        require(category != null && category.organizationId == organizationId && (!requireActive || category.active)) { "Development category is not available" }
        return category.name
    }

    private companion object {
        val systemCategories = listOf(
            DevelopmentCategoryResponse("ACTIVITY", "Aktivitas", true, true),
            DevelopmentCategoryResponse("MEAL", "Makan", true, true),
            DevelopmentCategoryResponse("NAP", "Tidur", true, true),
            DevelopmentCategoryResponse("OBSERVATION", "Observasi", true, true),
        )
    }
}
