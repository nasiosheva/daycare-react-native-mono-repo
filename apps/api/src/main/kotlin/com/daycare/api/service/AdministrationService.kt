package com.daycare.api.service

import com.daycare.api.domain.InvitationStatus
import com.daycare.api.domain.Gender
import com.daycare.api.domain.PushNotificationMuteDuration
import com.daycare.api.domain.Role
import com.daycare.api.persistence.BranchRepository
import com.daycare.api.persistence.Child
import com.daycare.api.persistence.ChildRepository
import com.daycare.api.persistence.DeviceToken
import com.daycare.api.persistence.DeviceTokenRepository
import com.daycare.api.persistence.Invitation
import com.daycare.api.persistence.InvitationRepository
import com.daycare.api.persistence.MembershipRepository
import com.daycare.api.persistence.NotificationRepository
import com.daycare.api.persistence.UserProfileRepository
import com.daycare.api.persistence.Membership
import jakarta.validation.constraints.Email
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.Size
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.LocalDate
import java.time.Duration
import java.time.Instant
import java.util.UUID

data class CreateChildRequest(val firstName: String, val lastName: String?, val nisn: String?, val gender: Gender, val dateOfBirth: LocalDate, val branchId: UUID?, val classroomId: UUID?)
data class CreateInvitationRequest(val email: String?, val phoneNumber: String?, val role: Role, val branchId: UUID?, val classroomId: UUID?)
data class RegisterDeviceRequest(@field:NotBlank val token: String, @field:NotBlank val platform: String, @field:NotBlank @field:Size(max = 128) val installationId: String, @field:NotBlank @field:Size(max = 64) val timeZone: String)
data class UpdateDeviceNotificationPreferenceRequest(@field:NotBlank @field:Size(max = 128) val installationId: String, val muteDuration: PushNotificationMuteDuration?)
data class DeviceNotificationPreferenceResponse(val pushMutedUntil: Instant?)
data class NotificationResponse(val id: UUID, val title: String, val body: String, val actionPath: String?, val createdAt: java.time.Instant, val readAt: java.time.Instant?)
data class TenantUserResponse(val id: UUID, val userId: UUID?, val displayName: String?, val username: String?, val email: String?, val role: Role, val status: String, val branchId: UUID?, val canManageChildPrograms: Boolean, val canManageDevelopmentCategories: Boolean)
data class ChangeTenantUserPasswordRequest(val password: String)
data class UpdateTenantUserChildProgramPermissionRequest(val canManageChildPrograms: Boolean)
data class UpdateTenantUserDevelopmentCategoryPermissionRequest(val canManageDevelopmentCategories: Boolean)
data class UpdateTenantUserRequest(
    @field:NotBlank @field:Size(min = 2, max = 100) val displayName: String,
    @field:Email @field:NotBlank val email: String,
    @field:Size(max = 100) val username: String? = null,
    val branchId: UUID,
    val canManageChildPrograms: Boolean = false,
    val canManageDevelopmentCategories: Boolean = false,
)
data class CreateTenantUserRequest(
    @field:NotBlank @field:Size(min = 2, max = 100) val displayName: String,
    @field:Email @field:NotBlank val email: String,
    @field:NotBlank @field:Size(min = 6, max = 128) val password: String,
    val role: Role,
    @field:Size(max = 100) val username: String? = null,
    val branchId: UUID? = null,
    val canManageChildPrograms: Boolean = false,
    val canManageDevelopmentCategories: Boolean = false,
)

@Service
class AdministrationService(
    private val access: AccessService,
    private val branches: BranchRepository,
    private val children: ChildRepository,
    private val invitations: InvitationRepository,
    private val memberships: MembershipRepository,
    private val users: UserProfileRepository,
    private val deviceTokens: DeviceTokenRepository,
    private val notifications: NotificationRepository,
    private val tenantUserAccounts: TenantUserAccountService,
    private val branchFilters: BranchListFilterService,
) {
    @Transactional
    fun createChild(jwt: Jwt, organizationId: UUID, request: CreateChildRequest): ChildResponse {
        access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN))
        require(request.firstName.isNotBlank()) { "First name is required" }
        require(request.gender != Gender.UNSPECIFIED) { "Gender is required" }
        val branchId = request.branchId ?: branches.findByOrganizationIdAndPrimaryTrue(organizationId)?.id ?: throw IllegalArgumentException("Primary branch was not found")
        val branch = branches.findById(branchId).orElseThrow { IllegalArgumentException("Branch was not found") }
        require(branch.organizationId == organizationId && branch.active) { "Branch is not available for this organization" }
        val child = children.save(Child(organizationId = organizationId, branchId = branchId, classroomId = request.classroomId, firstName = request.firstName.trim(), lastName = request.lastName?.trim()?.ifBlank { null }, nisn = request.nisn?.trim()?.ifBlank { null }, gender = request.gender, dateOfBirth = request.dateOfBirth))
        return ChildResponse(child.id, child.organizationId, child.branchId, child.classroomId, child.firstName, child.lastName, child.nisn, child.gender, child.dateOfBirth)
    }

    @Transactional
    fun invite(jwt: Jwt, organizationId: UUID, request: CreateInvitationRequest): UUID {
        access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN))
        require(!request.email.isNullOrBlank() || !request.phoneNumber.isNullOrBlank()) { "An email or phone number is required" }
        require(request.role in setOf(Role.STAFF, Role.PARENT)) { "Tenant staff administrators can invite only STAFF or PARENT users" }
        if (request.role == Role.STAFF) {
            val branchId = request.branchId ?: throw IllegalArgumentException("A branch is required for Staff accounts")
            val branch = branches.findById(branchId).orElseThrow { IllegalArgumentException("Branch was not found") }
            require(branch.organizationId == organizationId && branch.active) { "Branch is not available for this organization" }
        }
        return invitations.save(Invitation(organizationId = organizationId, email = request.email?.trim()?.lowercase(), phoneNumber = request.phoneNumber?.trim(), role = request.role, branchId = request.branchId, classroomId = request.classroomId)).id
    }

    @Transactional
    fun createTenantUser(jwt: Jwt, organizationId: UUID, request: CreateTenantUserRequest): TenantUserResponse {
        access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN))
        require(request.role in setOf(Role.STAFF_ADMIN, Role.STAFF)) { "Tenant staff administrators can create only STAFF_ADMIN or STAFF users" }
        val branchId = if (request.role == Role.STAFF) {
            val id = request.branchId ?: throw IllegalArgumentException("A branch is required for Staff accounts")
            val branch = branches.findById(id).orElseThrow { IllegalArgumentException("Branch was not found") }
            require(branch.organizationId == organizationId && branch.active) { "Branch is not available for this organization" }
            id
        } else null
        val user = tenantUserAccounts.create(request.displayName, request.email, request.password, request.username)
        val membership = memberships.save(Membership(userId = user.id, organizationId = organizationId, role = request.role, branchId = branchId, canManageChildPrograms = request.role == Role.STAFF && request.canManageChildPrograms, canManageDevelopmentCategories = request.role == Role.STAFF && request.canManageDevelopmentCategories))
        return tenantUserResponse(membership, user)
    }

    @Transactional(readOnly = true)
    fun tenantUsers(jwt: Jwt, organizationId: UUID, filter: BranchListFilter = BranchListFilter()): List<TenantUserResponse> {
        access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN), readOnly = true)
        branchFilters.validate(organizationId, filter)
        val scopedMemberships = membershipsFor(organizationId).filter { filter.branchId == null || it.branchId == filter.branchId || it.role == Role.STAFF_ADMIN }
        val activeUsers = users.findAllById(scopedMemberships.map { it.userId }).associateBy { it.id }
        val memberships = scopedMemberships.map { membership ->
            val user = activeUsers[membership.userId]
            tenantUserResponse(membership, user)
        }
        val invitations = invitations.findAllByOrganizationIdAndStatus(organizationId, InvitationStatus.PENDING)
            .filter { it.role in setOf(Role.STAFF, Role.PARENT) }
            .filter { filter.branchId == null || it.branchId == filter.branchId }
            .map { invitation -> TenantUserResponse(invitation.id, null, null, null, invitation.email ?: invitation.phoneNumber, invitation.role, "PENDING", invitation.branchId, false, false) }
        return memberships + invitations
    }

    @Transactional
    fun changeTenantUserPassword(jwt: Jwt, organizationId: UUID, userId: UUID, request: ChangeTenantUserPasswordRequest) {
        access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN))
        require(request.password.length >= 6) { TenantUserAccountError.PASSWORD_TOO_SHORT }
        val membership = memberships.findAllByUserIdAndOrganizationId(userId, organizationId).firstOrNull { it.active && it.role in setOf(Role.STAFF_ADMIN, Role.STAFF) }
            ?: throw IllegalArgumentException("Only active Staff Admin or Staff users in this tenant can have their password changed")
        val user = users.findById(membership.userId).orElseThrow { IllegalArgumentException("Tenant user was not found") }
        tenantUserAccounts.changePassword(user, request.password)
    }

    @Transactional
    fun deactivateTenantUser(jwt: Jwt, organizationId: UUID, userId: UUID) {
        val scope = access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN))
        require(scope.user.id != userId) { "You cannot deactivate your own tenant access" }
        val membership = memberships.findAllByUserIdAndOrganizationId(userId, organizationId).firstOrNull { it.active && it.role in setOf(Role.STAFF_ADMIN, Role.STAFF) }
            ?: throw IllegalArgumentException("Only active Staff Admin or Staff users in this tenant can be deactivated")
        if (membership.role == Role.STAFF_ADMIN) {
            require(!membership.primaryStaffAdmin) { "Primary Staff Admin cannot be removed" }
            require(membershipsFor(organizationId).count { it.active && it.role == Role.STAFF_ADMIN } > 1) { "At least one active Staff Admin is required" }
        }
        membership.active = false
        membership.deactivatedAt = Instant.now()
    }

    @Transactional
    fun updateTenantUser(jwt: Jwt, organizationId: UUID, userId: UUID, request: UpdateTenantUserRequest): TenantUserResponse {
        access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN))
        val membership = memberships.findAllByUserIdAndOrganizationId(userId, organizationId).firstOrNull { it.active && it.role == Role.STAFF }
            ?: throw IllegalArgumentException(TenantUserAccountError.STAFF_EDIT_NOT_ALLOWED)
        val branch = branches.findById(request.branchId).orElseThrow { IllegalArgumentException("Branch was not found") }
        require(branch.organizationId == organizationId && branch.active) { "Branch is not available for this organization" }
        val user = users.findById(membership.userId).orElseThrow { IllegalArgumentException("Tenant user was not found") }
        tenantUserAccounts.update(user, request.displayName, request.email, request.username)
        membership.branchId = branch.id
        membership.canManageChildPrograms = request.canManageChildPrograms
        membership.canManageDevelopmentCategories = request.canManageDevelopmentCategories
        return tenantUserResponse(membership, user)
    }

    @Transactional
    fun updateTenantUserChildProgramPermission(jwt: Jwt, organizationId: UUID, userId: UUID, request: UpdateTenantUserChildProgramPermissionRequest): TenantUserResponse {
        access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN))
        val membership = memberships.findAllByUserIdAndOrganizationId(userId, organizationId).firstOrNull { it.active && it.role == Role.STAFF }
            ?: throw IllegalArgumentException("Only active Staff users in this tenant can have child program permission changed")
        membership.canManageChildPrograms = request.canManageChildPrograms
        val user = users.findById(membership.userId).orElseThrow { IllegalArgumentException("Tenant user was not found") }
        return tenantUserResponse(membership, user)
    }

    @Transactional
    fun updateTenantUserDevelopmentCategoryPermission(jwt: Jwt, organizationId: UUID, userId: UUID, request: UpdateTenantUserDevelopmentCategoryPermissionRequest): TenantUserResponse {
        access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN))
        val membership = memberships.findAllByUserIdAndOrganizationId(userId, organizationId).firstOrNull { it.active && it.role == Role.STAFF }
            ?: throw IllegalArgumentException("Only active Staff users in this tenant can have development category permission changed")
        membership.canManageDevelopmentCategories = request.canManageDevelopmentCategories
        val user = users.findById(membership.userId).orElseThrow { IllegalArgumentException("Tenant user was not found") }
        return tenantUserResponse(membership, user)
    }

    @Transactional
    fun registerDevice(jwt: Jwt, organizationId: UUID, request: RegisterDeviceRequest) {
        val scope = access.require(jwt, organizationId, Role.entries.toSet())
        access.requireWritable(scope)
        require(request.token.isNotBlank() && request.platform in setOf("ios", "android")) { "A valid native device token is required" }
        val device = deviceTokens.findByInstallationId(request.installationId) ?: deviceTokens.findByToken(request.token) ?: DeviceToken(token = request.token)
        device.organizationId = organizationId
        device.userId = scope.user.id
        device.token = request.token
        device.platform = request.platform
        device.installationId = request.installationId
        device.timeZone = request.timeZone
        deviceTokens.save(device)
    }

    @Transactional(readOnly = true)
    fun deviceNotificationPreference(jwt: Jwt, organizationId: UUID, installationId: String): DeviceNotificationPreferenceResponse {
        return DeviceNotificationPreferenceResponse(currentDevice(jwt, organizationId, installationId).pushMutedUntil?.takeIf { it.isAfter(Instant.now()) })
    }

    @Transactional
    fun updateDeviceNotificationPreference(jwt: Jwt, organizationId: UUID, request: UpdateDeviceNotificationPreferenceRequest): DeviceNotificationPreferenceResponse {
        val device = currentDevice(jwt, organizationId, request.installationId)
        device.pushMutedUntil = request.muteDuration?.let { duration -> Instant.now().plus(muteDuration(duration)) }
        return DeviceNotificationPreferenceResponse(device.pushMutedUntil)
    }

    @Transactional(readOnly = true)
    fun notifications(jwt: Jwt, organizationId: UUID, search: String?): List<NotificationResponse> {
        val scope = access.require(jwt, organizationId, Role.entries.toSet(), readOnly = true)
        val query = search?.trim().orEmpty()
        val results = if (query.isEmpty()) notifications.findAllByRecipientUserIdAndOrganizationIdOrderByCreatedAtDesc(scope.user.id, organizationId)
            else notifications.searchByRecipientUserIdAndOrganizationId(scope.user.id, organizationId, query)
        return results.map(::notificationResponse)
    }

    @Transactional
    fun markNotificationRead(jwt: Jwt, organizationId: UUID, notificationId: UUID): NotificationResponse {
        val scope = access.require(jwt, organizationId, Role.entries.toSet(), readOnly = true)
        val notification = notifications.findById(notificationId).orElseThrow { IllegalArgumentException("Notification was not found") }
        require(notification.organizationId == organizationId && notification.recipientUserId == scope.user.id) { "Notification is not available" }
        if (notification.readAt == null) notification.readAt = java.time.Instant.now()
        return notificationResponse(notification)
    }

    private fun currentDevice(jwt: Jwt, organizationId: UUID, installationId: String): DeviceToken {
        val scope = access.require(jwt, organizationId, Role.entries.toSet(), readOnly = true)
        val device = deviceTokens.findByInstallationId(installationId) ?: throw IllegalArgumentException("Device notification preference is not available")
        require(device.organizationId == organizationId && device.userId == scope.user.id) { "Device notification preference is not available" }
        return device
    }

    private fun muteDuration(duration: PushNotificationMuteDuration): Duration = when (duration) {
        PushNotificationMuteDuration.ONE_HOUR -> Duration.ofHours(1)
        PushNotificationMuteDuration.ONE_WEEK -> Duration.ofDays(7)
        PushNotificationMuteDuration.ONE_MONTH -> Duration.ofDays(30)
    }

    private fun notificationResponse(notification: com.daycare.api.persistence.Notification) = NotificationResponse(notification.id, notification.title, notification.body, notification.actionPath, notification.createdAt, notification.readAt)

    private fun tenantUserResponse(membership: Membership, user: com.daycare.api.persistence.UserProfile?) = TenantUserResponse(membership.id, membership.userId, user?.displayName, user?.username, user?.email, membership.role, if (membership.active) "ACTIVE" else "INACTIVE", membership.branchId, membership.canManageChildPrograms, membership.canManageDevelopmentCategories)

    private fun membershipsFor(organizationId: UUID) = memberships.findAllByOrganizationId(organizationId).filter { it.role in setOf(Role.STAFF_ADMIN, Role.STAFF, Role.PARENT) }
}
