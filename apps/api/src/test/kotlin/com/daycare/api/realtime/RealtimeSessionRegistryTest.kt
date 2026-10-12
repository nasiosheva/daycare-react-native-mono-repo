package com.daycare.api.realtime

// Mories Deo Hutapea,S.E.,S.Kom

import com.daycare.api.domain.Role
import org.junit.jupiter.api.Test
import org.mockito.Mockito.mock
import org.mockito.Mockito.verify
import org.mockito.Mockito.`when`
import org.mockito.Mockito.doThrow
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

    @Test
    fun `user wildcard and tenant role routing target only eligible sessions`() {
        val wildcard = mock(WebSocketSession::class.java)
        val matching = mock(WebSocketSession::class.java)
        val otherRole = mock(WebSocketSession::class.java)
        `when`(wildcard.id).thenReturn("wildcard")
        `when`(matching.id).thenReturn("matching")
        `when`(otherRole.id).thenReturn("other")
        val userId = UUID.randomUUID()
        val organizationId = UUID.randomUUID()
        val registry = RealtimeSessionRegistry()
        registry.register(wildcard, userId, null, null, platformAdmin = false)
        registry.register(matching, UUID.randomUUID(), organizationId, Role.STAFF, platformAdmin = false)
        registry.register(otherRole, UUID.randomUUID(), organizationId, Role.PARENT, platformAdmin = false)

        registry.sendToUser(organizationId, userId, "direct")
        registry.sendToTenantRoles(organizationId, setOf(Role.STAFF), "staff")

        verify(wildcard).sendMessage(TextMessage("direct"))
        verify(matching).sendMessage(TextMessage("staff"))
        org.mockito.Mockito.verify(otherRole, org.mockito.Mockito.never()).sendMessage(org.mockito.ArgumentMatchers.any(TextMessage::class.java))
    }

    @Test
    fun `failed sends remove the session and close failures are ignored`() {
        val session = mock(WebSocketSession::class.java)
        `when`(session.id).thenReturn("broken")
        `when`(session.isOpen).thenReturn(true)
        doThrow(IllegalStateException("closed")).`when`(session).sendMessage(org.mockito.ArgumentMatchers.any(TextMessage::class.java))
        doThrow(IllegalStateException("already closed")).`when`(session).close(org.springframework.web.socket.CloseStatus.POLICY_VIOLATION)
        val userId = UUID.randomUUID()
        val organizationId = UUID.randomUUID()
        val registry = RealtimeSessionRegistry()
        registry.register(session, userId, organizationId, Role.STAFF, platformAdmin = false)

        registry.sendToUser(organizationId, userId, "will fail")
        registry.closeForUser(userId)

        verify(session).sendMessage(TextMessage("will fail"))

        val closeOnly = mock(WebSocketSession::class.java)
        `when`(closeOnly.id).thenReturn("close-only")
        doThrow(IllegalStateException("already closed")).`when`(closeOnly).close(org.springframework.web.socket.CloseStatus.POLICY_VIOLATION)
        val closeOnlyUser = UUID.randomUUID()
        registry.register(closeOnly, closeOnlyUser, organizationId, Role.STAFF, platformAdmin = false)
        registry.closeForUser(closeOnlyUser)
        verify(closeOnly).close(org.springframework.web.socket.CloseStatus.POLICY_VIOLATION)
    }
}
