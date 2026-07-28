package com.daycare.api.realtime

import com.fasterxml.jackson.databind.JsonNode
import java.time.Instant
import java.util.UUID

enum class RealtimeFlag {
    NOTIFICATIONS,
    PROFILE,
    PARENT_ENROLLMENTS,
    CHILDREN,
    ATTENDANCE,
    ABSENCE_REQUESTS,
    DEVELOPMENT,
    DEVELOPMENT_CATEGORIES,
    BOOKINGS,
    INVOICES,
    ENTITLEMENTS,
    SERVICE_PLANS,
    BRANCHES,
    TENANT_USERS,
    LEARNING,
    ACADEMIC,
    TENANTS,
    GLOBAL_CURRICULUM,
    GOALS,
    STAFF_REMINDERS,
    STAFF_LEAVE_REQUESTS,
}

data class RealtimeConnectRequest(
    val type: String,
    val token: String,
    val organizationId: UUID? = null,
)

data class RealtimeEvent(
    val type: String = "EVENT",
    val id: UUID = UUID.randomUUID(),
    val organizationId: UUID? = null,
    val flags: Set<RealtimeFlag> = emptySet(),
    val payload: JsonNode? = null,
    val occurredAt: Instant = Instant.now(),
)

data class RealtimeConnectedResponse(
    val type: String = "CONNECTED",
    val organizationId: UUID? = null,
)
