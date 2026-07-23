package com.daycare.api.realtime

import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import java.util.UUID

class RealtimeModelsTest {
    @Test
    fun `event preserves multiple flags and generic JSON payload`() {
        val organizationId = UUID.randomUUID()
        val payload = jacksonObjectMapper().readTree("""{"invoiceId":"invoice-1","retry":false}""")

        val event = RealtimeEvent(
            organizationId = organizationId,
            flags = setOf(RealtimeFlag.NOTIFICATIONS, RealtimeFlag.INVOICES, RealtimeFlag.ENTITLEMENTS),
            payload = payload,
        )

        assertEquals("EVENT", event.type)
        assertEquals(organizationId, event.organizationId)
        assertTrue(event.flags.containsAll(setOf(RealtimeFlag.NOTIFICATIONS, RealtimeFlag.INVOICES, RealtimeFlag.ENTITLEMENTS)))
        assertEquals("invoice-1", event.payload?.path("invoiceId")?.asText())
        assertEquals(false, event.payload?.path("retry")?.asBoolean())
    }
}
