package com.daycare.api.realtime

import com.daycare.api.domain.Role
import org.springframework.stereotype.Component
import org.springframework.web.socket.TextMessage
import org.springframework.web.socket.WebSocketSession
import org.springframework.web.socket.handler.ConcurrentWebSocketSessionDecorator
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap

data class RealtimeSessionContext(
    val session: ConcurrentWebSocketSessionDecorator,
    val userId: UUID,
    val organizationId: UUID?,
    val role: Role?,
    val platformAdmin: Boolean,
)

@Component
class RealtimeSessionRegistry {
    private val sessions = ConcurrentHashMap<String, RealtimeSessionContext>()

    fun register(session: WebSocketSession, userId: UUID, organizationId: UUID?, role: Role?, platformAdmin: Boolean) {
        sessions[session.id] = RealtimeSessionContext(ConcurrentWebSocketSessionDecorator(session, SEND_TIME_LIMIT_MILLIS, SEND_BUFFER_LIMIT_BYTES), userId, organizationId, role, platformAdmin)
    }

    fun remove(sessionId: String) {
        sessions.remove(sessionId)
    }

    fun sendToUser(organizationId: UUID?, userId: UUID, message: String) = send(sessions.values.filter { it.userId == userId && (it.organizationId == organizationId || it.organizationId == null) }, message)

    fun sendToTenantRoles(organizationId: UUID, roles: Set<Role>, message: String) = send(sessions.values.filter { it.organizationId == organizationId && it.role in roles }, message)

    fun sendToPlatformAdmins(message: String) = send(sessions.values.filter { it.platformAdmin && it.organizationId == null }, message)

    private fun send(targets: Collection<RealtimeSessionContext>, message: String) {
        targets.forEach { context -> runCatching { context.session.sendMessage(TextMessage(message)) }.onFailure { remove(context.session.id) } }
    }

    private companion object {
        const val SEND_TIME_LIMIT_MILLIS = 5_000
        const val SEND_BUFFER_LIMIT_BYTES = 512 * 1024
    }
}
