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
import jakarta.validation.Valid
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.Size
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Instant
import java.util.Base64
import java.util.UUID

private const val MAX_DEVELOPMENT_PHOTO_BYTES = 5 * 1024 * 1024
private val DEVELOPMENT_PHOTO_CONTENT_TYPES = setOf("image/jpeg", "image/png")

object DevelopmentEntryMediaError {
    const val NOT_FOUND = "development_entry.not_found"
    const val UNAVAILABLE = "development_entry.unavailable"
    const val PHOTO_MISSING = "development_entry.photo_missing"
    const val PHOTO_TYPE = "development_entry.photo_type"
    const val PHOTO_INVALID = "development_entry.photo_invalid"
    const val PHOTO_TOO_LARGE = "development_entry.photo_too_large"
}

data class DevelopmentPhotoInput(@field:NotBlank val contentType: String, @field:NotBlank val dataBase64: String)
data class CreateDevelopmentEntryRequest(
    @field:NotBlank @field:Size(max = 64) val category: String,
    @field:NotBlank @field:Size(max = 120) val title: String,
    @field:NotBlank @field:Size(max = 2_000) val content: String,
    @field:Valid val photo: DevelopmentPhotoInput? = null,
)
data class CreateDevelopmentCategoryRequest(@field:NotBlank @field:Size(max = 120) val name: String)
data class UpdateDevelopmentCategoryRequest(@field:Size(max = 120) val name: String? = null, val active: Boolean? = null)
data class DevelopmentCategoryResponse(val id: String, val name: String, val active: Boolean, val system: Boolean)
data class DevelopmentEntryResponse(val id: UUID, val childId: UUID, val category: String, val categoryName: String, val title: String, val content: String, val hasPhoto: Boolean, val recordedAt: Instant, val recordedBy: String)
data class DevelopmentEntryPhotoResponse(val contentType: String, val dataBase64: String)

@Service
class DevelopmentService(
    private val access: AccessService,
    private val platformAccess: PlatformAccessService,
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
        return categories.findAllByOrganizationIdIsNullOrderByNameAsc().map { response(it, global = true) } +
            categories.findAllByOrganizationIdOrderByNameAsc(organizationId).map { response(it, global = false) }
    }

    @Transactional
    fun createCategory(jwt: Jwt, organizationId: UUID, request: CreateDevelopmentCategoryRequest): DevelopmentCategoryResponse {
        val scope = requireCategoryCreator(jwt, organizationId)
        val name = request.name.trim()
        require(name.isNotBlank()) { "Category name is required" }
        require(!categories.existsByOrganizationIdIsNullAndNameIgnoreCase(name)) { "This is already a built-in category" }
        require(!categories.existsByOrganizationIdAndNameIgnoreCase(organizationId, name)) { "A category with this name already exists" }
        val category = categories.save(DevelopmentCategoryConfig(organizationId = organizationId, name = name, createdByUserId = scope.user.id))
        audits.save(AuditLog(organizationId = organizationId, actorUserId = scope.user.id, entityType = "DEVELOPMENT_CATEGORY", entityId = category.id, action = "CREATED", source = "TENANT_CONFIGURATION"))
        realtime.publishToTenantRoles(organizationId, setOf(Role.STAFF_ADMIN, Role.STAFF), setOf(RealtimeFlag.DEVELOPMENT_CATEGORIES))
        return response(category, global = false)
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
        return response(category, global = false)
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

    @Transactional(readOnly = true)
    fun globalCategories(jwt: Jwt): List<DevelopmentCategoryResponse> {
        platformAccess.requirePlatformAdmin(jwt)
        return categories.findAllByOrganizationIdIsNullOrderByNameAsc().map { response(it, global = true) }
    }

    @Transactional
    fun createGlobalCategory(jwt: Jwt, request: CreateDevelopmentCategoryRequest): DevelopmentCategoryResponse {
        val admin = platformAccess.requirePlatformAdmin(jwt)
        val name = request.name.trim()
        require(name.isNotBlank()) { "Category name is required" }
        require(!categories.existsByOrganizationIdIsNullAndNameIgnoreCase(name)) { "A global category with this name already exists" }
        val category = categories.save(DevelopmentCategoryConfig(organizationId = null, name = name, createdByUserId = admin.id))
        return response(category, global = true)
    }

    @Transactional
    fun updateGlobalCategory(jwt: Jwt, categoryId: UUID, request: UpdateDevelopmentCategoryRequest): DevelopmentCategoryResponse {
        platformAccess.requirePlatformAdmin(jwt)
        val category = categories.findById(categoryId).orElseThrow { IllegalArgumentException("Development category was not found") }
        require(category.organizationId == null) { "This category is not a global category" }
        request.name?.trim()?.let { name ->
            require(name.isNotBlank()) { "Category name is required" }
            require(!categories.existsByOrganizationIdIsNullAndNameIgnoreCase(name) || category.name.equals(name, ignoreCase = true)) { "A global category with this name already exists" }
            category.name = name
        }
        request.active?.let { category.active = it }
        return response(category, global = true)
    }

    @Transactional
    fun deleteGlobalCategory(jwt: Jwt, categoryId: UUID) {
        platformAccess.requirePlatformAdmin(jwt)
        val category = categories.findById(categoryId).orElseThrow { IllegalArgumentException("Development category was not found") }
        require(category.organizationId == null) { "This category is not a global category" }
        require(!entries.existsByCategory(category.id.toString())) { "This category is used by existing development entries" }
        categories.delete(category)
    }

    private fun response(category: DevelopmentCategoryConfig, global: Boolean) = DevelopmentCategoryResponse(category.id.toString(), category.name, category.active, global)

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
        val entry = DevelopmentEntry(organizationId = organizationId, branchId = child.branchId, childId = child.id, authorUserId = scope.user.id, category = categoryId, title = request.title.trim(), content = request.content.trim())
        request.photo?.let { photo ->
            entry.photoContentType = photo.contentType.lowercase()
            entry.photoData = decodePhoto(photo)
        }
        entries.save(entry)
        audits.save(AuditLog(organizationId = organizationId, actorUserId = scope.user.id, entityType = "DEVELOPMENT_ENTRY", entityId = entry.id, action = "CREATED", source = "STAFF_NOTE"))
        guardians.findAllByChildId(child.id).forEach { guardian -> notifications.notify(organizationId, guardian.userId, "Perkembangan ${child.firstName}", "$categoryName: ${entry.title}", realtimeFlags = setOf(RealtimeFlag.DEVELOPMENT)) }
        return toResponse(entry, organizationId, categoryName)
    }

    @Transactional(readOnly = true)
    fun photo(jwt: Jwt, organizationId: UUID, childId: UUID, entryId: UUID): DevelopmentEntryPhotoResponse {
        val scope = access.require(jwt, organizationId, Role.entries.toSet(), readOnly = true)
        if (scope.membership.role == Role.PARENT) childScopes.requireParentLinkedChild(scope, childId, organizationId) else childScopes.requireStaffManagedChild(scope, childId, organizationId)
        val entry = entries.findById(entryId).orElseThrow { IllegalArgumentException(DevelopmentEntryMediaError.NOT_FOUND) }
        require(entry.organizationId == organizationId && entry.childId == childId) { DevelopmentEntryMediaError.UNAVAILABLE }
        val data = entry.photoData ?: throw IllegalArgumentException(DevelopmentEntryMediaError.PHOTO_MISSING)
        return DevelopmentEntryPhotoResponse(entry.photoContentType ?: "image/jpeg", Base64.getEncoder().encodeToString(data))
    }

    private fun requireCategoryCreator(jwt: Jwt, organizationId: UUID): AccessScope {
        val scope = access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN, Role.STAFF))
        access.requireWritable(scope)
        require(scope.membership.role == Role.STAFF_ADMIN || scope.membership.canManageDevelopmentCategories) { "Staff Admin permission is required to add development categories" }
        return scope
    }

    private fun toResponse(entry: DevelopmentEntry, organizationId: UUID, name: String = categoryName(organizationId, entry.category, requireActive = false)): DevelopmentEntryResponse {
        val author = users.findById(entry.authorUserId).map { it.displayName }.orElse("Staf daycare")
        return DevelopmentEntryResponse(entry.id, entry.childId, entry.category, name, entry.title, entry.content, entry.photoData != null, entry.recordedAt, author)
    }

    private fun decodePhoto(input: DevelopmentPhotoInput): ByteArray {
        require(input.contentType.lowercase() in DEVELOPMENT_PHOTO_CONTENT_TYPES) { DevelopmentEntryMediaError.PHOTO_TYPE }
        val bytes = try { Base64.getDecoder().decode(input.dataBase64) } catch (_: IllegalArgumentException) { throw IllegalArgumentException(DevelopmentEntryMediaError.PHOTO_INVALID) }
        require(bytes.isNotEmpty()) { DevelopmentEntryMediaError.PHOTO_INVALID }
        require(bytes.size <= MAX_DEVELOPMENT_PHOTO_BYTES) { DevelopmentEntryMediaError.PHOTO_TOO_LARGE }
        val isJpeg = bytes.size >= 3 && bytes[0] == 0xFF.toByte() && bytes[1] == 0xD8.toByte() && bytes[2] == 0xFF.toByte()
        val isPng = bytes.size >= 8 && bytes.copyOfRange(0, 8).contentEquals(byteArrayOf(0x89.toByte(), 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A))
        require(isJpeg || isPng) { DevelopmentEntryMediaError.PHOTO_INVALID }
        return bytes
    }

    private fun categoryName(organizationId: UUID, id: String, requireActive: Boolean): String {
        val category = runCatching { categories.findById(UUID.fromString(id)).orElse(null) }.getOrNull()
        require(category != null && (category.organizationId == null || category.organizationId == organizationId) && (!requireActive || category.active)) { "Development category is not available" }
        return category.name
    }
}
