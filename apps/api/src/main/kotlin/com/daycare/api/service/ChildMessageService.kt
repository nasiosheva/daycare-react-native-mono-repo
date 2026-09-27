package com.daycare.api.service

import com.daycare.api.domain.Role
import com.daycare.api.persistence.Child
import com.daycare.api.persistence.ChildMessage
import com.daycare.api.persistence.ChildMessageRead
import com.daycare.api.persistence.ChildMessageReadRepository
import com.daycare.api.persistence.ChildMessageRepository
import com.daycare.api.persistence.ChildStaffAssignmentRepository
import com.daycare.api.persistence.GuardianLinkRepository
import com.daycare.api.persistence.MembershipRepository
import com.daycare.api.persistence.UserProfileRepository
import com.daycare.api.realtime.RealtimeFlag
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.Size
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Instant
import java.util.UUID

data class SendChildMessageRequest(@field:NotBlank @field:Size(max = 2_000) val body: String)
data class ChildMessageResponse(
    val id: UUID,
    val childId: UUID,
    val senderUserId: UUID,
    val senderName: String,
    val senderRole: Role,
    val body: String,
    val createdAt: Instant,
    val mine: Boolean,
)

@Service
class ChildMessageService(
    private val access: AccessService,
    private val childScopes: ChildScopeService,
    private val messages: ChildMessageRepository,
    private val reads: ChildMessageReadRepository,
    private val guardians: GuardianLinkRepository,
    private val staffAssignments: ChildStaffAssignmentRepository,
    private val memberships: MembershipRepository,
    private val users: UserProfileRepository,
    private val notifications: NotificationService,
) {
    @Transactional(readOnly = true)
    fun list(jwt: Jwt, organizationId: UUID, childId: UUID): List<ChildMessageResponse> {
        val scope = access.require(jwt, organizationId, Role.entries.toSet())
        requireChildAccess(scope, childId, organizationId)
        val forChild = messages.findAllByOrganizationIdAndChildIdOrderByCreatedAtAsc(organizationId, childId)
        val namesByUserId = users.findAllById(forChild.map { it.senderUserId }.distinct()).associateBy { it.id }
        return forChild.map { response(it, namesByUserId[it.senderUserId]?.displayName ?: "Unknown", scope.user.id) }
    }

    @Transactional
    fun send(jwt: Jwt, organizationId: UUID, childId: UUID, request: SendChildMessageRequest): ChildMessageResponse {
        val scope = access.require(jwt, organizationId, setOf(Role.PARENT, Role.STAFF, Role.STAFF_ADMIN))
        access.requireWritable(scope)
        val child = requireChildAccess(scope, childId, organizationId)
        val message = messages.save(ChildMessage(organizationId = organizationId, childId = child.id, senderUserId = scope.user.id, senderRole = scope.membership.role, body = request.body.trim(), createdAt = Instant.now()))
        touchRead(child.id, scope.user.id)
        notifyOtherSide(child, scope.membership.role, scope.user.displayName, message)
        return response(message, scope.user.displayName, scope.user.id)
    }

    @Transactional
    fun markRead(jwt: Jwt, organizationId: UUID, childId: UUID) {
        val scope = access.require(jwt, organizationId, Role.entries.toSet())
        requireChildAccess(scope, childId, organizationId)
        touchRead(childId, scope.user.id)
    }

    private fun requireChildAccess(scope: AccessScope, childId: UUID, organizationId: UUID): Child =
        if (scope.membership.role == Role.PARENT) childScopes.requireParentLinkedChild(scope, childId, organizationId) else childScopes.requireStaffManagedChild(scope, childId, organizationId)

    private fun touchRead(childId: UUID, userId: UUID) {
        val existing = reads.findByChildIdAndUserId(childId, userId)
        if (existing != null) existing.lastReadAt = Instant.now() else reads.save(ChildMessageRead(childId = childId, userId = userId, lastReadAt = Instant.now()))
    }

    private fun response(message: ChildMessage, senderName: String, viewerUserId: UUID) =
        ChildMessageResponse(message.id, message.childId, message.senderUserId, senderName, message.senderRole, message.body, message.createdAt, message.senderUserId == viewerUserId)

    // A Parent's message notifies the Staff directly assigned to the child, falling back to active
    // Staff Admins when no Staff is assigned yet. A Staff/Staff Admin's message always notifies every
    // guardian, mirroring ChildIncidentService.notifyGuardians.
    private fun notifyOtherSide(child: Child, senderRole: Role, senderName: String, message: ChildMessage) {
        val title = "Pesan baru dari $senderName"
        val body = message.body.take(200)
        val path = "/child-messages?childId=${child.id}"
        if (senderRole == Role.PARENT) {
            val assignedStaffUserIds = staffAssignments.findAllByOrganizationIdAndChildIdOrderByCreatedAtDesc(child.organizationId, child.id).map { it.userId }.distinct()
            val recipients = assignedStaffUserIds.ifEmpty {
                memberships.findAllByOrganizationId(child.organizationId).filter { it.active && it.role == Role.STAFF_ADMIN }.map { it.userId }.distinct()
            }
            recipients.forEach { userId -> notifications.notify(child.organizationId, userId, title, body, path, setOf(RealtimeFlag.CHILD_MESSAGES)) }
        } else {
            guardians.findAllByChildId(child.id).map { it.userId }.distinct()
                .forEach { userId -> notifications.notify(child.organizationId, userId, title, body, path, setOf(RealtimeFlag.CHILD_MESSAGES)) }
        }
    }
}
