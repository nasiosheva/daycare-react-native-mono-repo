package com.daycare.api.service

import com.daycare.api.domain.Role
import com.daycare.api.persistence.Child
import com.daycare.api.persistence.ChildMessage
import com.daycare.api.persistence.ChildMessagePhoto
import com.daycare.api.persistence.ChildMessagePhotoRepository
import com.daycare.api.persistence.ChildMessageRead
import com.daycare.api.persistence.ChildMessageReadRepository
import com.daycare.api.persistence.ChildMessageRepository
import com.daycare.api.persistence.ChildRepository
import com.daycare.api.persistence.ChildStaffAssignmentRepository
import com.daycare.api.persistence.GuardianLinkRepository
import com.daycare.api.persistence.MembershipRepository
import com.daycare.api.persistence.UserProfile
import com.daycare.api.persistence.UserProfileRepository
import com.daycare.api.realtime.ChildMessageRealtimeEvent
import com.daycare.api.realtime.ChildMessageRealtimePayload
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

private const val MAX_CHILD_MESSAGE_PHOTO_BYTES = 5 * 1024 * 1024
private val CHILD_MESSAGE_PHOTO_CONTENT_TYPES = setOf("image/jpeg", "image/png")

data class ChildMessagePhotoInput(@field:NotBlank val contentType: String, @field:NotBlank val dataBase64: String)
/** A message needs text, a photo, or both. */
data class SendChildMessageRequest(@field:Size(max = 2_000) val body: String = "", val replyToMessageId: UUID? = null, @field:Valid val photo: ChildMessagePhotoInput? = null)
data class ChildMessagePhotoResponse(val contentType: String, val dataBase64: String)
object ChildMessageError {
    const val REPLY_UNAVAILABLE = "Child message reply is not available"
    const val CONTENT_REQUIRED = "child_message.content_required"
    const val PHOTO_MISSING = "child_message.photo_missing"
    const val PHOTO_TYPE = "child_message.photo_type"
    const val PHOTO_INVALID = "child_message.photo_invalid"
    const val PHOTO_TOO_LARGE = "child_message.photo_too_large"
}
enum class ChildMessageDeliveryStatus { SENT, READ }
data class ChildMessageSummaryResponse(val unreadCount: Int)
data class ChildMessageChildUnreadCount(val childId: UUID, val unreadCount: Int)
data class ChildMessageUnreadSummaryResponse(val totalUnreadCount: Int, val children: List<ChildMessageChildUnreadCount>)
data class ChildMessageReplyResponse(
    val id: UUID,
    val senderName: String,
    val body: String,
    val createdAt: Instant,
    val hasPhoto: Boolean,
)
data class ChildMessageResponse(
    val id: UUID,
    val childId: UUID,
    val senderUserId: UUID,
    val senderName: String,
    val senderRole: Role,
    val body: String,
    val createdAt: Instant,
    val mine: Boolean,
    val deliveryStatus: ChildMessageDeliveryStatus,
    val readAt: Instant?,
    val replyTo: ChildMessageReplyResponse?,
    val hasPhoto: Boolean,
)

@Service
class ChildMessageService(
    private val access: AccessService,
    private val childScopes: ChildScopeService,
    private val messages: ChildMessageRepository,
    private val photos: ChildMessagePhotoRepository,
    private val reads: ChildMessageReadRepository,
    private val guardians: GuardianLinkRepository,
    private val staffAssignments: ChildStaffAssignmentRepository,
    private val children: ChildRepository,
    private val memberships: MembershipRepository,
    private val users: UserProfileRepository,
    private val notifications: NotificationService,
    private val realtime: RealtimePublisher,
) {
    @Transactional(readOnly = true)
    fun list(jwt: Jwt, organizationId: UUID, childId: UUID): List<ChildMessageResponse> {
        val scope = access.require(jwt, organizationId, Role.entries.toSet())
        val child = requireChildAccess(scope, childId, organizationId)
        val forChild = messages.findAllByOrganizationIdAndChildIdOrderByCreatedAtAsc(organizationId, childId)
        val namesByUserId = users.findAllById(forChild.map { it.senderUserId }.distinct()).associateBy { it.id }
        val messagesById = forChild.associateBy { it.id }
        val readAtByUserId = reads.findAllByChildId(childId).associateBy { it.userId }
        val recipientIdsBySenderRole = forChild.map { it.senderRole }.distinct().associateWith { readRecipientUserIds(child, it).toSet() }
        return forChild.map { message ->
            val readAt = readAtFor(message, recipientIdsBySenderRole[message.senderRole].orEmpty(), readAtByUserId)
            response(message, namesByUserId[message.senderUserId]?.displayName ?: "Unknown", scope.user.id, readAt, messagesById, namesByUserId)
        }
    }

    /**
     * Unread badge across the threads where the caller is a new-message
     * recipient: a Parent's linked children in this tenant; a Staff member's
     * directly assigned children; for a Staff Admin, directly assigned children
     * plus every active child without an assigned Staff (the notification
     * fallback). Only children with unread messages are listed.
     */
    @Transactional(readOnly = true)
    fun unreadSummary(jwt: Jwt, organizationId: UUID): ChildMessageUnreadSummaryResponse {
        val scope = access.require(jwt, organizationId, setOf(Role.PARENT, Role.STAFF, Role.STAFF_ADMIN))
        val childIds = recipientChildIds(scope, organizationId)
        if (childIds.isEmpty()) return ChildMessageUnreadSummaryResponse(0, emptyList())
        val counts = messages.countUnreadByChild(organizationId, childIds, scope.user.id)
            .filter { it.unreadCount > 0 }
            .map { ChildMessageChildUnreadCount(it.childId, it.unreadCount.coerceAtMost(Int.MAX_VALUE.toLong()).toInt()) }
            .sortedBy { it.childId }
        val total = counts.sumOf { it.unreadCount.toLong() }.coerceAtMost(Int.MAX_VALUE.toLong()).toInt()
        return ChildMessageUnreadSummaryResponse(total, counts)
    }

    private fun recipientChildIds(scope: AccessScope, organizationId: UUID): Set<UUID> {
        if (scope.membership.role == Role.PARENT) {
            val linkedChildIds = guardians.findAllByUserId(scope.user.id).map { it.childId }.toSet()
            if (linkedChildIds.isEmpty()) return emptySet()
            return children.findAllById(linkedChildIds).filter { it.organizationId == organizationId }.map { it.id }.toSet()
        }
        val directlyAssigned = staffAssignments.findAllByOrganizationIdAndUserId(organizationId, scope.user.id).map { it.childId }.toSet()
        if (scope.membership.role != Role.STAFF_ADMIN) return directlyAssigned
        val childrenWithStaff = staffAssignments.findAllByOrganizationId(organizationId).map { it.childId }.toSet()
        val unassigned = children.findAllByOrganizationId(organizationId).filter { it.active && it.id !in childrenWithStaff }.map { it.id }
        return directlyAssigned + unassigned
    }

    @Transactional(readOnly = true)
    fun summary(jwt: Jwt, organizationId: UUID, childId: UUID): ChildMessageSummaryResponse {
        val scope = access.require(jwt, organizationId, Role.entries.toSet())
        requireChildAccess(scope, childId, organizationId)
        val lastReadAt = reads.findByChildIdAndUserId(childId, scope.user.id)?.lastReadAt
        val unreadCount = if (lastReadAt == null) {
            messages.countByOrganizationIdAndChildIdAndSenderUserIdNot(organizationId, childId, scope.user.id)
        } else {
            messages.countByOrganizationIdAndChildIdAndSenderUserIdNotAndCreatedAtAfter(organizationId, childId, scope.user.id, lastReadAt)
        }
        return ChildMessageSummaryResponse(unreadCount.coerceAtMost(Int.MAX_VALUE.toLong()).toInt())
    }

    @Transactional
    fun send(jwt: Jwt, organizationId: UUID, childId: UUID, request: SendChildMessageRequest): ChildMessageResponse {
        val scope = access.require(jwt, organizationId, setOf(Role.PARENT, Role.STAFF, Role.STAFF_ADMIN))
        access.requireWritable(scope)
        val child = requireChildAccess(scope, childId, organizationId)
        val replyTo = request.replyToMessageId?.let { replyId ->
            messages.findByIdAndOrganizationIdAndChildId(replyId, organizationId, child.id)
                ?: throw IllegalArgumentException(ChildMessageError.REPLY_UNAVAILABLE)
        }
        val body = request.body.trim()
        val photo = request.photo?.let(::decodePhoto)
        require(body.isNotEmpty() || photo != null) { ChildMessageError.CONTENT_REQUIRED }
        val message = messages.save(ChildMessage(organizationId = organizationId, childId = child.id, senderUserId = scope.user.id, senderRole = scope.membership.role, body = body, replyToMessageId = replyTo?.id, photoContentType = photo?.first, createdAt = Instant.now()))
        photo?.let { (_, bytes) -> photos.save(ChildMessagePhoto(messageId = message.id, data = bytes)) }
        touchRead(child.id, scope.user.id)
        notifyOtherSide(child, scope.membership.role, scope.user.displayName, message)
        val replySenderName = replyTo?.let { users.findById(it.senderUserId).map { sender -> sender.displayName }.orElse("Unknown") }
        return response(message, scope.user.displayName, scope.user.id, null, replyTo = replyTo, replySenderName = replySenderName)
    }

    /** Photo bytes are authorized exactly like the thread itself: same tenant and child scope. */
    @Transactional(readOnly = true)
    fun photo(jwt: Jwt, organizationId: UUID, childId: UUID, messageId: UUID): ChildMessagePhotoResponse {
        val scope = access.require(jwt, organizationId, Role.entries.toSet())
        val child = requireChildAccess(scope, childId, organizationId)
        val message = messages.findByIdAndOrganizationIdAndChildId(messageId, organizationId, child.id)
            ?: throw IllegalArgumentException(ChildMessageError.PHOTO_MISSING)
        val contentType = message.photoContentType ?: throw IllegalArgumentException(ChildMessageError.PHOTO_MISSING)
        val data = photos.findById(message.id).orElseThrow { IllegalArgumentException(ChildMessageError.PHOTO_MISSING) }.data
        return ChildMessagePhotoResponse(contentType, Base64.getEncoder().encodeToString(data))
    }

    @Transactional
    fun markRead(jwt: Jwt, organizationId: UUID, childId: UUID) {
        val scope = access.require(jwt, organizationId, Role.entries.toSet())
        val child = requireChildAccess(scope, childId, organizationId)
        touchRead(childId, scope.user.id)
        val latestIncoming = messages.findAllByOrganizationIdAndChildIdOrderByCreatedAtAsc(organizationId, childId)
            .lastOrNull { it.senderUserId != scope.user.id }
        if (latestIncoming != null) {
            readRecipientUserIds(child, scope.membership.role).forEach { userId ->
                realtime.publishToUser(organizationId, userId, setOf(RealtimeFlag.CHILD_MESSAGES), ChildMessageRealtimePayload(child.id, latestIncoming.id, ChildMessageRealtimeEvent.MESSAGE_READ))
            }
        }
    }

    private fun requireChildAccess(scope: AccessScope, childId: UUID, organizationId: UUID): Child =
        if (scope.membership.role == Role.PARENT) childScopes.requireParentLinkedChild(scope, childId, organizationId) else childScopes.requireStaffManagedChild(scope, childId, organizationId)

    private fun touchRead(childId: UUID, userId: UUID) {
        val existing = reads.findByChildIdAndUserId(childId, userId)
        if (existing != null) existing.lastReadAt = Instant.now() else reads.save(ChildMessageRead(childId = childId, userId = userId, lastReadAt = Instant.now()))
    }

    private fun response(
        message: ChildMessage,
        senderName: String,
        viewerUserId: UUID,
        readAt: Instant?,
        messagesById: Map<UUID, ChildMessage> = emptyMap(),
        namesByUserId: Map<UUID, UserProfile> = emptyMap(),
        replyTo: ChildMessage? = message.replyToMessageId?.let { messagesById[it] },
        replySenderName: String? = replyTo?.let { namesByUserId[it.senderUserId]?.displayName },
    ) = ChildMessageResponse(
        message.id,
        message.childId,
        message.senderUserId,
        senderName,
        message.senderRole,
        message.body,
        message.createdAt,
        message.senderUserId == viewerUserId,
        if (readAt != null) ChildMessageDeliveryStatus.READ else ChildMessageDeliveryStatus.SENT,
        readAt,
        replyTo?.let { ChildMessageReplyResponse(it.id, replySenderName ?: "Unknown", it.body, it.createdAt, it.photoContentType != null) },
        message.photoContentType != null,
    )

    /** Same JPEG/PNG, size, and magic-byte checks as incident photos. Returns the normalized content type and bytes. */
    private fun decodePhoto(input: ChildMessagePhotoInput): Pair<String, ByteArray> {
        val contentType = input.contentType.lowercase()
        require(contentType in CHILD_MESSAGE_PHOTO_CONTENT_TYPES) { ChildMessageError.PHOTO_TYPE }
        val bytes = try { Base64.getDecoder().decode(input.dataBase64) } catch (_: IllegalArgumentException) { throw IllegalArgumentException(ChildMessageError.PHOTO_INVALID) }
        require(bytes.isNotEmpty()) { ChildMessageError.PHOTO_INVALID }
        require(bytes.size <= MAX_CHILD_MESSAGE_PHOTO_BYTES) { ChildMessageError.PHOTO_TOO_LARGE }
        val isJpeg = bytes.size >= 3 && bytes[0] == 0xFF.toByte() && bytes[1] == 0xD8.toByte() && bytes[2] == 0xFF.toByte()
        val isPng = bytes.size >= 8 && bytes.copyOfRange(0, 8).contentEquals(byteArrayOf(0x89.toByte(), 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A))
        require(isJpeg || isPng) { ChildMessageError.PHOTO_INVALID }
        return contentType to bytes
    }

    // A Parent's message notifies the Staff directly assigned to the child, falling back to active
    // Staff Admins when no Staff is assigned yet. A Staff/Staff Admin's message always notifies every
    // guardian, mirroring ChildIncidentService.notifyGuardians.
    private fun notifyOtherSide(child: Child, senderRole: Role, senderName: String, message: ChildMessage) {
        val title = "Pesan baru"
        val body = "Ada pesan baru di chat anak."
        val path = "/child-messages?childId=${child.id}"
        notificationRecipientUserIds(child, senderRole).forEach { userId -> notifyRecipient(child, userId, title, body, path, message) }
    }

    private fun notificationRecipientUserIds(child: Child, senderRole: Role): List<UUID> = if (senderRole == Role.PARENT) {
        val assignedStaffUserIds = staffAssignments.findAllByOrganizationIdAndChildIdOrderByCreatedAtDesc(child.organizationId, child.id).map { it.userId }.distinct()
        assignedStaffUserIds.ifEmpty {
            memberships.findAllByOrganizationId(child.organizationId).filter { it.active && it.role == Role.STAFF_ADMIN }.map { it.userId }.distinct()
        }
    } else {
        guardians.findAllByChildId(child.id).map { it.userId }.distinct()
    }

    private fun readRecipientUserIds(child: Child, senderRole: Role): List<UUID> = if (senderRole == Role.PARENT) {
        (staffAssignments.findAllByOrganizationIdAndChildIdOrderByCreatedAtDesc(child.organizationId, child.id).map { it.userId } +
            memberships.findAllByOrganizationId(child.organizationId).filter { it.active && it.role == Role.STAFF_ADMIN }.map { it.userId }).distinct()
    } else {
        guardians.findAllByChildId(child.id).map { it.userId }.distinct()
    }

    private fun readAtFor(message: ChildMessage, recipientUserIds: Set<UUID>, readAtByUserId: Map<UUID, ChildMessageRead>): Instant? =
        recipientUserIds.mapNotNull { readAtByUserId[it]?.lastReadAt }
            .filter { !it.isBefore(message.createdAt) }
            .minOrNull()

    private fun notifyRecipient(child: Child, userId: UUID, title: String, body: String, path: String, message: ChildMessage) {
        // WebSocket is the active chat transport. The event contains
        // identifiers only; the client must refetch the authorized thread over
        // REST. No inbox row or generic NOTIFICATIONS event is created.
        notifications.notifyChat(child.organizationId, userId, title, body, path, message.id)
        realtime.publishToUser(
            child.organizationId,
            userId,
            setOf(RealtimeFlag.CHILD_MESSAGES),
            ChildMessageRealtimePayload(child.id, message.id, ChildMessageRealtimeEvent.MESSAGE_CREATED),
        )
    }
}
