package com.daycare.api.realtime

import com.daycare.api.domain.Role
import org.junit.jupiter.api.Test
import org.mockito.Mockito.mock
import org.mockito.Mockito.verify
import org.mockito.Mockito.`when`
import org.springframework.web.socket.TextMessage
import org.springframework.web.socket.WebSocketSession
import java.util.UUID

class RealtimeSessionRegistryTest {
    @Test
    fun `registered user session receives messages and can be closed`() {
        val session = mock(WebSocketSession::class.java)
        `when`(session.id).thenReturn("session-1")
        val userId = UUID.randomUUID()
        val organizationId = UUID.randomUUID()
        val registry = RealtimeSessionRegistry()
        registry.register(session, userId, organizationId, Role.STAFF, platformAdmin = false)
        registry.sendToUser(organizationId, userId, "hello")
        verify(session).sendMessage(TextMessage("hello"))
        registry.closeForUser(userId)
        verify(session).close(org.springframework.web.socket.CloseStatus.POLICY_VIOLATION)
    }

    @Test
    fun `tenant and platform filters do not cross deliver`() {
        val tenantSession = mock(WebSocketSession::class.java)
        val platformSession = mock(WebSocketSession::class.java)
        `when`(tenantSession.id).thenReturn("tenant")
        `when`(platformSession.id).thenReturn("platform")
        val registry = RealtimeSessionRegistry()
        registry.register(tenantSession, UUID.randomUUID(), UUID.randomUUID(), Role.STAFF, platformAdmin = false)
        registry.register(platformSession, UUID.randomUUID(), null, null, platformAdmin = true)
        registry.sendToPlatformAdmins("platform")
        verify(platformSession).sendMessage(TextMessage("platform"))
    }
}
