package com.daycare.api.realtime

import com.daycare.api.domain.Role
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule
import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.mockito.Mockito.mock
import org.mockito.Mockito.verifyNoInteractions
import org.mockito.Mockito.mockingDetails
import org.springframework.transaction.support.TransactionSynchronizationManager
import java.util.UUID

// Mories Deo Hutapea,S.E.,S.Kom
class RealtimePublisherTest {
    private val sessions = mock(RealtimeSessionRegistry::class.java)
    private val publisher = RealtimePublisher(sessions, jacksonObjectMapper().registerModule(JavaTimeModule()))

    @AfterEach
    fun clearTransactionSynchronization() {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.clearSynchronization()
        }
    }

    @Test
    fun `publishes user event immediately without transaction synchronization`() {
        val organizationId = UUID.randomUUID()
        val userId = UUID.randomUUID()

        publisher.publishToUser(organizationId, userId, setOf(RealtimeFlag.CHILD_MESSAGES))

        val invocation = mockingDetails(sessions).invocations.single()
        assertTrue(invocation.method.name == "sendToUser")
        assertTrue(invocation.arguments[0] == organizationId)
        assertTrue(invocation.arguments[1] == userId)
    }

    @Test
    fun `publishes a user-targeted chat event to sessions across tenant contexts`() {
        val organizationId = UUID.randomUUID()
        val userId = UUID.randomUUID()

        publisher.publishChildMessageToUser(
            organizationId,
            userId,
            ChildMessageRealtimePayload(UUID.randomUUID(), UUID.randomUUID(), ChildMessageRealtimeEvent.MESSAGE_CREATED),
        )

        val invocation = mockingDetails(sessions).invocations.single()
        assertTrue(invocation.method.name == "sendToUserAcrossTenants")
        assertTrue(invocation.arguments[0] == userId)
        val event = invocation.arguments[1] as String
        assertTrue(event.contains(organizationId.toString()))
        assertTrue(event.contains("MESSAGE_CREATED"))
    }

    @Test
    fun `defers tenant role event until transaction commit and serializes payload`() {
        val organizationId = UUID.randomUUID()
        TransactionSynchronizationManager.initSynchronization()

        publisher.publishToTenantRoles(
            organizationId,
            setOf(Role.STAFF, Role.STAFF_ADMIN),
            setOf(RealtimeFlag.NOTIFICATIONS),
            mapOf("unread" to true),
        )

        verifyNoInteractions(sessions)
        TransactionSynchronizationManager.getSynchronizations().single().afterCommit()

        val invocation = mockingDetails(sessions).invocations.single()
        assertTrue(invocation.method.name == "sendToTenantRoles")
        assertTrue(invocation.arguments[0] == organizationId)
        assertTrue(invocation.arguments[1] == setOf(Role.STAFF, Role.STAFF_ADMIN))
        assertTrue((invocation.arguments[2] as String).contains("unread"))
    }

    @Test
    fun `publishes platform event with null organization and null payload`() {
        publisher.publishToPlatformAdmins(setOf(RealtimeFlag.NOTIFICATIONS))

        val invocation = mockingDetails(sessions).invocations.single()
        val payload = invocation.arguments.single() as String
        assertTrue(payload.contains("NOTIFICATIONS"))
        assertTrue(payload.contains("\"organizationId\":null"))
    }
}
