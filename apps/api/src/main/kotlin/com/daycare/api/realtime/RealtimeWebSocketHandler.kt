package com.daycare.api.realtime

import com.daycare.api.domain.Role
import com.daycare.api.service.AccessService
import com.fasterxml.jackson.databind.ObjectMapper
import org.springframework.security.oauth2.jwt.JwtDecoder
import org.springframework.stereotype.Component
import org.springframework.web.socket.CloseStatus
import org.springframework.web.socket.TextMessage
import org.springframework.web.socket.WebSocketSession
import org.springframework.web.socket.handler.TextWebSocketHandler

@Component
class RealtimeWebSocketHandler(
    private val objectMapper: ObjectMapper,
    private val jwtDecoder: JwtDecoder,
    private val access: AccessService,
    private val sessions: RealtimeSessionRegistry,
) : TextWebSocketHandler() {
    override fun handleTextMessage(session: WebSocketSession, message: TextMessage) {
        if (session.attributes[CONNECTED_ATTRIBUTE] == true) return
        val request = runCatching { objectMapper.readValue(message.payload, RealtimeConnectRequest::class.java) }.getOrElse {
            session.close(CloseStatus.BAD_DATA)
            return
        }
        if (request.type != "CONNECT" || request.token.isBlank()) {
            session.close(CloseStatus.POLICY_VIOLATION)
            return
        }
        val context = runCatching { authenticatedContext(request) }.getOrElse {
            session.close(CloseStatus.NOT_ACCEPTABLE)
            return
        }
        sessions.register(session, context.userId, request.organizationId, context.role, context.platformAdmin)
        session.attributes[CONNECTED_ATTRIBUTE] = true
        session.sendMessage(TextMessage(objectMapper.writeValueAsString(RealtimeConnectedResponse(organizationId = request.organizationId))))
    }

    override fun afterConnectionClosed(session: WebSocketSession, status: CloseStatus) {
        sessions.remove(session.id)
    }

    private fun authenticatedContext(request: RealtimeConnectRequest): ConnectionContext {
        val current = access.currentUser(jwtDecoder.decode(request.token))
        if (request.organizationId == null) {
            return ConnectionContext(current.id, null, current.isPlatformAdmin)
        }
        val membership = current.memberships.firstOrNull { it.organizationId == request.organizationId } ?: error("Tenant access is required")
        return ConnectionContext(current.id, membership.role, current.isPlatformAdmin)
    }

    private data class ConnectionContext(val userId: java.util.UUID, val role: Role?, val platformAdmin: Boolean)

    private companion object {
        const val CONNECTED_ATTRIBUTE = "realtime.connected"
    }
}
