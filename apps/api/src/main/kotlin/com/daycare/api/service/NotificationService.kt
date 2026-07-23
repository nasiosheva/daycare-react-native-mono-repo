package com.daycare.api.service

import com.daycare.api.persistence.DeviceTokenRepository
import com.daycare.api.persistence.Notification
import com.daycare.api.persistence.NotificationRepository
import com.daycare.api.realtime.RealtimeFlag
import com.daycare.api.realtime.RealtimePublisher
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Service
import org.springframework.web.client.RestClient
import java.util.UUID

@Service
class NotificationService(
    private val notifications: NotificationRepository,
    private val deviceTokens: DeviceTokenRepository,
    private val realtime: RealtimePublisher,
    @Value("\${daycare.expo-push-url}") private val expoPushUrl: String,
) {
    private val logger = LoggerFactory.getLogger(javaClass)
    private val restClient = RestClient.create()

    fun notify(organizationId: UUID, recipientUserId: UUID, title: String, body: String, actionPath: String? = null, realtimeFlags: Set<RealtimeFlag> = emptySet()) {
        val notification = notifications.save(Notification(organizationId = organizationId, recipientUserId = recipientUserId, title = title, body = body, actionPath = actionPath))
        realtime.publishToUser(organizationId, recipientUserId, realtimeFlags + RealtimeFlag.NOTIFICATIONS, mapOf("notificationId" to notification.id, "actionPath" to actionPath))
        deviceTokens.findAllByUserIdAndOrganizationId(recipientUserId, organizationId).forEach { token ->
            runCatching { restClient.post().uri(expoPushUrl).body(mapOf("to" to token.token, "title" to title, "body" to body, "data" to mapOf("actionPath" to actionPath, "organizationId" to organizationId.toString()), "sound" to "default")).retrieve().toBodilessEntity() }
                .onFailure { error -> logger.warn("Unable to deliver Expo push token {}: {}", token.id, error.message) }
        }
    }
}
