package com.daycare.api.realtime

import com.daycare.api.domain.Role
import com.fasterxml.jackson.databind.ObjectMapper
import org.springframework.stereotype.Service
import org.springframework.transaction.support.TransactionSynchronization
import org.springframework.transaction.support.TransactionSynchronizationManager
import java.util.UUID

@Service
class RealtimePublisher(
    private val sessions: RealtimeSessionRegistry,
    private val objectMapper: ObjectMapper,
) {
    fun publishToUser(organizationId: UUID, userId: UUID, flags: Set<RealtimeFlag>, payload: Any? = null) = afterCommit {
        sessions.sendToUser(organizationId, userId, serialize(organizationId, flags, payload))
    }

    fun publishToTenantRoles(organizationId: UUID, roles: Set<Role>, flags: Set<RealtimeFlag>, payload: Any? = null) = afterCommit {
        sessions.sendToTenantRoles(organizationId, roles, serialize(organizationId, flags, payload))
    }

    fun publishToPlatformAdmins(flags: Set<RealtimeFlag>, payload: Any? = null) = afterCommit {
        sessions.sendToPlatformAdmins(serialize(null, flags, payload))
    }

    private fun serialize(organizationId: UUID?, flags: Set<RealtimeFlag>, payload: Any?): String = objectMapper.writeValueAsString(
        RealtimeEvent(organizationId = organizationId, flags = flags, payload = payload?.let(objectMapper::valueToTree)),
    )

    private fun afterCommit(action: () -> Unit) {
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            action()
            return
        }
        TransactionSynchronizationManager.registerSynchronization(object : TransactionSynchronization {
            override fun afterCommit() = action()
        })
    }
}
