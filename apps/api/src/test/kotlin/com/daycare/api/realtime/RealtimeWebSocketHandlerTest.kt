package com.daycare.api.realtime

import com.daycare.api.domain.Gender
import com.daycare.api.domain.Role
import com.daycare.api.service.AccessService
import com.daycare.api.service.CurrentUserResponse
import com.daycare.api.service.MembershipResponse
import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import org.mockito.Mockito.mock
import org.mockito.Mockito.verify
import org.mockito.Mockito.verifyNoMoreInteractions
import org.mockito.Mockito.`when`
import org.mockito.Mockito.clearInvocations
import org.mockito.Mockito.never
import org.mockito.Mockito.times
import org.mockito.ArgumentMatchers.any
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.security.oauth2.jwt.JwtDecoder
import org.springframework.web.socket.CloseStatus
import org.springframework.web.socket.TextMessage
import org.springframework.web.socket.WebSocketSession
import java.util.UUID

class RealtimeWebSocketHandlerTest {
    private val objectMapper: ObjectMapper = jacksonObjectMapper()
    private val decoder = mock(JwtDecoder::class.java)
    private val access = mock(AccessService::class.java)
    private val sessions = RealtimeSessionRegistry()
    private val handler = RealtimeWebSocketHandler(objectMapper, decoder, access, sessions)

    @Test
    fun `malformed and invalid connect messages close with the right status`() {
        val malformed = session("malformed")
        handle(malformed, "not-json")
        verify(malformed).close(CloseStatus.BAD_DATA)

        val wrongType = session("wrong-type")
        handle(wrongType, "{\"type\":\"PING\",\"token\":\"x\"}")
        verify(wrongType).close(CloseStatus.POLICY_VIOLATION)

        val blankToken = session("blank-token")
        handle(blankToken, "{\"type\":\"CONNECT\",\"token\":\" \"}")
        verify(blankToken).close(CloseStatus.POLICY_VIOLATION)
    }

    @Test
    fun `invalid token or tenant membership closes without registering`() {
        val tokenSession = session("invalid-token")
        val token = mock(Jwt::class.java)
        `when`(decoder.decode("token")).thenThrow(IllegalArgumentException("expired"))
        handle(tokenSession, "{\"type\":\"CONNECT\",\"token\":\"token\"}")
        verify(tokenSession).close(CloseStatus.NOT_ACCEPTABLE)

        val organizationId = UUID.randomUUID()
        val membershipSession = session("missing-membership")
        `when`(decoder.decode("tenant-token")).thenReturn(token)
        `when`(access.currentUser(token)).thenReturn(currentUser(emptyList()))
        handle(membershipSession, objectMapper.writeValueAsString(mapOf("type" to "CONNECT", "token" to "tenant-token", "organizationId" to organizationId)))
        verify(membershipSession).close(CloseStatus.NOT_ACCEPTABLE)
    }

    @Test
    fun `valid global and tenant connections acknowledge once and ignore later payloads`() {
        val token = mock(Jwt::class.java)
        `when`(decoder.decode("global-token")).thenReturn(token)
        `when`(access.currentUser(token)).thenReturn(currentUser(emptyList()))
        val global = session("global")
        handle(global, "{\"type\":\"CONNECT\",\"token\":\"global-token\"}")
        verify(global).sendMessage(org.mockito.ArgumentMatchers.argThat<TextMessage> { it.payload.contains("CONNECTED") })
        clearInvocations(global)
        handle(global, "{\"type\":\"CONNECT\",\"token\":\"other\"}")
        verify(global, never()).sendMessage(any(TextMessage::class.java))
        verify(global, never()).close(any(CloseStatus::class.java))

        val organizationId = UUID.randomUUID()
        `when`(decoder.decode("tenant-token")).thenReturn(token)
        `when`(access.currentUser(token)).thenReturn(currentUser(listOf(MembershipResponse(organizationId, "Tenant", Role.STAFF, true, null, null, false, false, emptySet(), emptySet()))))
        val tenant = session("tenant")
        handle(tenant, objectMapper.writeValueAsString(mapOf("type" to "CONNECT", "token" to "tenant-token", "organizationId" to organizationId)))
        verify(tenant).sendMessage(org.mockito.ArgumentMatchers.argThat<TextMessage> { it.payload.contains("CONNECTED") })
        assertEquals(true, tenant.attributes["realtime.connected"])
    }

    private fun session(id: String): WebSocketSession = mock(WebSocketSession::class.java).also {
        `when`(it.id).thenReturn(id)
        `when`(it.attributes).thenReturn(mutableMapOf())
    }

    private fun handle(session: WebSocketSession, payload: String) {
        RealtimeWebSocketHandler::class.java
            .getDeclaredMethod("handleTextMessage", WebSocketSession::class.java, TextMessage::class.java)
            .apply { isAccessible = true }
            .invoke(handler, session, TextMessage(payload))
    }

    private fun currentUser(memberships: List<MembershipResponse>) = CurrentUserResponse(UUID.randomUUID(), "User", null, Gender.UNSPECIFIED, null, null, false, memberships, null)
}
