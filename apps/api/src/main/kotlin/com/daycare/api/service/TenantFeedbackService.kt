package com.daycare.api.service

import com.daycare.api.domain.ChildEnrollmentStatus
import com.daycare.api.domain.Role
import com.daycare.api.domain.TenantFeedbackCategory
import com.daycare.api.domain.TenantFeedbackStatus
import com.daycare.api.persistence.ChildRepository
import com.daycare.api.persistence.GuardianLinkRepository
import com.daycare.api.persistence.MembershipRepository
import com.daycare.api.persistence.TenantFeedback
import com.daycare.api.persistence.TenantFeedbackRepository
import com.daycare.api.persistence.UserProfileRepository
import com.daycare.api.realtime.RealtimeFlag
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.Size
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Instant
import java.util.UUID

object TenantFeedbackError {
    const val NOT_FOUND = "tenant_feedback.not_found"
}

data class CreateTenantFeedbackRequest(
    val category: TenantFeedbackCategory,
    @field:NotBlank @field:Size(max = 2_000) val message: String,
)
data class UpdateTenantFeedbackStatusRequest(val status: TenantFeedbackStatus)
data class TenantFeedbackResponse(
    val id: UUID,
    val submittedByName: String,
    val category: TenantFeedbackCategory,
    val message: String,
    val status: TenantFeedbackStatus,
    val createdAt: Instant,
    val updatedAt: Instant,
)

@Service
class TenantFeedbackService(
    private val access: AccessService,
    private val feedback: TenantFeedbackRepository,
    private val users: UserProfileRepository,
    private val memberships: MembershipRepository,
    private val children: ChildRepository,
    private val guardians: GuardianLinkRepository,
    private val notifications: NotificationService,
) {
    @Transactional
    fun create(jwt: Jwt, organizationId: UUID, request: CreateTenantFeedbackRequest): TenantFeedbackResponse {
        val scope = access.require(jwt, organizationId, setOf(Role.PARENT))
        access.requireWritable(scope)
        require(children.findAllByOrganizationId(organizationId).any { child ->
            child.active && child.enrollmentStatus == ChildEnrollmentStatus.ACTIVE && guardians.existsByChildIdAndUserId(child.id, scope.user.id)
        }) { "Feedback is only available for a tenant with an active linked child" }
        val saved = feedback.save(TenantFeedback(organizationId = organizationId, submittedByUserId = scope.user.id, category = request.category, message = request.message.trim()))
        notifyStaffAdmins(organizationId, scope.user.displayName, saved)
        return response(saved, scope.user.displayName)
    }

    @Transactional(readOnly = true)
    fun mine(jwt: Jwt, organizationId: UUID): List<TenantFeedbackResponse> {
        val scope = access.require(jwt, organizationId, setOf(Role.PARENT))
        return feedback.findAllByOrganizationIdAndSubmittedByUserIdOrderByCreatedAtDesc(organizationId, scope.user.id).map { response(it, scope.user.displayName) }
    }

    @Transactional(readOnly = true)
    fun list(jwt: Jwt, organizationId: UUID): List<TenantFeedbackResponse> {
        access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN))
        return feedback.findAllByOrganizationIdOrderByCreatedAtDesc(organizationId).map { item ->
            response(item, users.findById(item.submittedByUserId).map { it.displayName }.orElse("Unknown"))
        }
    }

    @Transactional
    fun updateStatus(jwt: Jwt, organizationId: UUID, feedbackId: UUID, request: UpdateTenantFeedbackStatusRequest): TenantFeedbackResponse {
        val scope = access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN))
        access.requireWritable(scope)
        val item = feedback.findById(feedbackId).orElseThrow { IllegalArgumentException(TenantFeedbackError.NOT_FOUND) }
        require(item.organizationId == organizationId) { TenantFeedbackError.NOT_FOUND }
        item.status = request.status
        item.updatedAt = Instant.now()
        return response(item, users.findById(item.submittedByUserId).map { it.displayName }.orElse("Unknown"))
    }

    private fun response(item: TenantFeedback, submittedByName: String) = TenantFeedbackResponse(item.id, submittedByName, item.category, item.message, item.status, item.createdAt, item.updatedAt)

    private fun notifyStaffAdmins(organizationId: UUID, parentName: String, item: TenantFeedback) {
        memberships.findAllByOrganizationId(organizationId)
            .filter { it.active && it.role == Role.STAFF_ADMIN }
            .map { it.userId }
            .distinct()
            .forEach { userId ->
                notifications.notify(organizationId, userId, "Saran/masukan baru dari $parentName", item.message.take(200), "/tenant-feedback-inbox", setOf(RealtimeFlag.TENANT_FEEDBACK))
            }
    }
}
