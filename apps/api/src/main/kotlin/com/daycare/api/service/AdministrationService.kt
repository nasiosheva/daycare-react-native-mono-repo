package com.daycare.api.service

import com.daycare.api.domain.Role
import com.daycare.api.persistence.BranchRepository
import com.daycare.api.persistence.Child
import com.daycare.api.persistence.ChildRepository
import com.daycare.api.persistence.DeviceToken
import com.daycare.api.persistence.DeviceTokenRepository
import com.daycare.api.persistence.Invitation
import com.daycare.api.persistence.InvitationRepository
import com.daycare.api.persistence.NotificationRepository
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.LocalDate
import java.util.UUID

data class CreateChildRequest(val firstName: String, val lastName: String?, val dateOfBirth: LocalDate, val branchId: UUID, val classroomId: UUID?)
data class CreateInvitationRequest(val email: String?, val phoneNumber: String?, val role: Role, val branchId: UUID?, val classroomId: UUID?)
data class RegisterDeviceRequest(val token: String, val platform: String)
data class NotificationResponse(val id: UUID, val title: String, val body: String, val createdAt: java.time.Instant, val readAt: java.time.Instant?)

@Service
class AdministrationService(
    private val access: AccessService,
    private val branches: BranchRepository,
    private val children: ChildRepository,
    private val invitations: InvitationRepository,
    private val deviceTokens: DeviceTokenRepository,
    private val notifications: NotificationRepository,
) {
    @Transactional
    fun createChild(jwt: Jwt, organizationId: UUID, request: CreateChildRequest): ChildResponse {
        access.require(jwt, organizationId, setOf(Role.ADMIN))
        require(request.firstName.isNotBlank()) { "First name is required" }
        val branch = branches.findById(request.branchId).orElseThrow { IllegalArgumentException("Branch was not found") }
        require(branch.organizationId == organizationId) { "Branch belongs to a different organization" }
        val child = children.save(Child(organizationId = organizationId, branchId = request.branchId, classroomId = request.classroomId, firstName = request.firstName.trim(), lastName = request.lastName?.trim()?.ifBlank { null }, dateOfBirth = request.dateOfBirth))
        return ChildResponse(child.id, child.organizationId, child.branchId, child.classroomId, child.firstName, child.lastName, child.dateOfBirth)
    }

    @Transactional
    fun invite(jwt: Jwt, organizationId: UUID, request: CreateInvitationRequest): UUID {
        access.require(jwt, organizationId, setOf(Role.ADMIN))
        require(!request.email.isNullOrBlank() || !request.phoneNumber.isNullOrBlank()) { "An email or phone number is required" }
        return invitations.save(Invitation(organizationId = organizationId, email = request.email?.trim()?.lowercase(), phoneNumber = request.phoneNumber?.trim(), role = request.role, branchId = request.branchId, classroomId = request.classroomId)).id
    }

    @Transactional
    fun registerDevice(jwt: Jwt, organizationId: UUID, request: RegisterDeviceRequest) {
        val scope = access.require(jwt, organizationId, Role.entries.toSet())
        require(request.token.isNotBlank() && request.platform in setOf("ios", "android")) { "A valid native device token is required" }
        val device = deviceTokens.findByToken(request.token) ?: DeviceToken(token = request.token)
        device.organizationId = organizationId
        device.userId = scope.user.id
        device.platform = request.platform
        deviceTokens.save(device)
    }

    @Transactional(readOnly = true)
    fun notifications(jwt: Jwt, organizationId: UUID): List<NotificationResponse> {
        val scope = access.require(jwt, organizationId, Role.entries.toSet())
        return notifications.findAllByRecipientUserIdAndOrganizationIdOrderByCreatedAtDesc(scope.user.id, organizationId).map { NotificationResponse(it.id, it.title, it.body, it.createdAt, it.readAt) }
    }
}
