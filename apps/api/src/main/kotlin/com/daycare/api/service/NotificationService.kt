package com.daycare.api.service

import com.daycare.api.persistence.DeviceTokenRepository
import com.daycare.api.persistence.DeviceToken
import com.daycare.api.persistence.Notification
import com.daycare.api.persistence.NotificationRepository
import com.daycare.api.realtime.RealtimeFlag
import com.daycare.api.realtime.RealtimePublisher
import com.fasterxml.jackson.annotation.JsonIgnoreProperties
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Service
import org.springframework.web.client.RestClient
import java.time.Instant
import java.util.UUID

enum class ChatNotificationTransport { WEBSOCKET, EXPO, FIREBASE }

@Service
class NotificationService(
    private val notifications: NotificationRepository,
    private val deviceTokens: DeviceTokenRepository,
    private val realtime: RealtimePublisher,
    @Value("\${daycare.expo-push-url}") private val expoPushUrl: String,
    @Value("\${daycare.chat-notification-transport:WEBSOCKET}") private val chatNotificationTransportName: String = ChatNotificationTransport.WEBSOCKET.name,
) {
    private val logger = LoggerFactory.getLogger(javaClass)
    private val restClient = RestClient.create()
    private val chatNotificationTransport = parseChatNotificationTransport(chatNotificationTransportName)

    @JsonIgnoreProperties(ignoreUnknown = true)
    private data class ExpoPushResponse(val data: List<ExpoPushTicket> = emptyList())

    @JsonIgnoreProperties(ignoreUnknown = true)
    private data class ExpoPushTicket(
        val status: String? = null,
        val message: String? = null,
        val details: Map<String, Any?>? = null,
    )

    fun notify(organizationId: UUID, recipientUserId: UUID, title: String, body: String, actionPath: String? = null, realtimeFlags: Set<RealtimeFlag> = emptySet()) {
        val notification = notifications.save(Notification(organizationId = organizationId, recipientUserId = recipientUserId, title = title, body = body, actionPath = actionPath))
        realtime.publishToUser(organizationId, recipientUserId, realtimeFlags + RealtimeFlag.NOTIFICATIONS, mapOf("notificationId" to notification.id, "actionPath" to actionPath))
        push(organizationId, recipientUserId, title, body, actionPath)
    }

    /**
     * Delivers an ephemeral native push without creating an inbox item or a
     * generic NOTIFICATIONS realtime event. Callers that have their own
     * realtime flag (for example CHILD_MESSAGES) can keep that signal separate.
     */
    fun notifyPushOnly(organizationId: UUID, recipientUserId: UUID, title: String, body: String, actionPath: String? = null) {
        push(organizationId, recipientUserId, title, body, actionPath)
    }

    /**
     * Chat remains an ephemeral feature: it never creates an inbox row. The
     * CHILD_MESSAGES WebSocket invalidation is always emitted by
     * ChildMessageService, and the mobile client turns a MESSAGE_CREATED event
     * into a local OS notification. WEBSOCKET is therefore the default; EXPO
     * opts into an additional server push. FIREBASE is retained as a
     * backwards-compatible alias for the Expo push-token delivery path.
     */
    fun notifyChat(organizationId: UUID, recipientUserId: UUID, title: String, body: String, actionPath: String? = null) {
        when (chatNotificationTransport) {
            ChatNotificationTransport.WEBSOCKET -> Unit
            ChatNotificationTransport.EXPO, ChatNotificationTransport.FIREBASE -> push(organizationId, recipientUserId, title, body, actionPath)
        }
    }

    private fun parseChatNotificationTransport(value: String): ChatNotificationTransport = runCatching {
        ChatNotificationTransport.valueOf(value.trim().uppercase())
    }.getOrElse {
        throw IllegalStateException("Unsupported daycare.chat-notification-transport: $value")
    }

    private fun push(organizationId: UUID, recipientUserId: UUID, title: String, body: String, actionPath: String?) {
        val now = Instant.now()
        deviceTokens.findAllByUserIdAndOrganizationId(recipientUserId, organizationId)
            .filter { token -> token.pushMutedUntil?.isAfter(now) != true }
            .forEach { token -> sendPush(token, organizationId, title, body, actionPath) }
    }

    fun sendPush(token: DeviceToken, organizationId: UUID, title: String, body: String, actionPath: String? = null) {
        runCatching {
            restClient.post()
                .uri(expoPushUrl)
                .body(mapOf("to" to token.token, "title" to title, "body" to body, "data" to mapOf("actionPath" to actionPath, "organizationId" to organizationId.toString()), "sound" to "default"))
                .retrieve()
                .body(ExpoPushResponse::class.java)
                ?.data
                .orEmpty()
                .filter { ticket -> ticket.status != "ok" }
                .forEach { ticket -> logger.warn("Expo push ticket failed for device {}: status={}, message={}, details={}", token.id, ticket.status, ticket.message, ticket.details) }
        }
            .onFailure { error -> logger.warn("Unable to deliver Expo push token {}: {}", token.id, error.message) }
    }
}
