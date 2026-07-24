package com.daycare.api.service

import com.daycare.api.persistence.DeviceToken
import com.daycare.api.persistence.DeviceTokenRepository
import com.daycare.api.persistence.Notification
import com.daycare.api.persistence.NotificationRepository
import com.daycare.api.realtime.RealtimeFlag
import com.daycare.api.realtime.RealtimePublisher
import org.junit.jupiter.api.Test
import org.mockito.Mockito.any
import org.mockito.Mockito.mock
import org.mockito.Mockito.never
import org.mockito.Mockito.spy
import org.mockito.Mockito.verify
import org.mockito.Mockito.`when`
import java.time.Instant
import java.util.UUID

class NotificationServiceTest {
    @Test
    fun `muted device keeps inbox and realtime notification but skips Expo push`() {
        val notifications = mock(NotificationRepository::class.java)
        val devices = mock(DeviceTokenRepository::class.java)
        val realtime = mock(RealtimePublisher::class.java)
        val organizationId = UUID.randomUUID()
        val recipientUserId = UUID.randomUUID()
        val notification = Notification(organizationId = organizationId, recipientUserId = recipientUserId, title = "Title", body = "Body")
        val mutedDevice = DeviceToken(organizationId = organizationId, userId = recipientUserId, token = "ExponentPushToken[muted]", platform = "android", pushMutedUntil = Instant.now().plusSeconds(3_600))
        `when`(notifications.save(any(Notification::class.java))).thenReturn(notification)
        `when`(devices.findAllByUserIdAndOrganizationId(recipientUserId, organizationId)).thenReturn(listOf(mutedDevice))
        val service = spy(NotificationService(notifications, devices, realtime, "http://127.0.0.1:1"))

        service.notify(organizationId, recipientUserId, notification.title, notification.body)

        verify(notifications).save(any(Notification::class.java))
        verify(realtime).publishToUser(organizationId, recipientUserId, setOf(RealtimeFlag.NOTIFICATIONS), mapOf("notificationId" to notification.id, "actionPath" to null))
        verify(service, never()).sendPush(mutedDevice, organizationId, notification.title, notification.body)
    }
}
