// Mories Deo Hutapea,S.E.,S.Kom
package com.daycare.api.service

import com.daycare.api.persistence.BillingIdempotencyRecord
import com.daycare.api.persistence.BillingIdempotencyRecordRepository
import com.daycare.api.persistence.UserProfile
import com.daycare.api.persistence.UserProfileRepository
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNotEquals
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.mockito.Mockito.mock
import org.mockito.Mockito.verify
import org.mockito.Mockito.`when`
import java.util.UUID

class BillingCommandIdempotencyServiceTest {
    private val users = mock(UserProfileRepository::class.java)
    private val records = mock(BillingIdempotencyRecordRepository::class.java)
    private val service = BillingCommandIdempotencyService(users, records)
    private val organizationId = UUID.randomUUID()
    private val actorId = UUID.randomUUID()
    private val key = UUID.randomUUID()
    private val resourceId = UUID.randomUUID()
    private val operation = "PARENT_SERVICE_PURCHASE"
    private val hash = service.payloadHash("child", "plan", "2026-10-15")

    @Test
    fun `replay returns resource for same scoped key and payload`() {
        `when`(users.findWithLockById(actorId)).thenReturn(UserProfile(id = actorId))
        `when`(records.findByOrganizationIdAndActorUserIdAndOperationAndIdempotencyKey(organizationId, actorId, operation, key))
            .thenReturn(BillingIdempotencyRecord(organizationId = organizationId, actorUserId = actorId, operation = operation, idempotencyKey = key, payloadHash = hash, resourceId = resourceId))

        assertEquals(resourceId, service.replayResourceId(organizationId, actorId, operation, key, hash))
        verify(users).findWithLockById(actorId)
    }

    @Test
    fun `new key has no replay resource`() {
        `when`(users.findWithLockById(actorId)).thenReturn(UserProfile(id = actorId))

        assertNull(service.replayResourceId(organizationId, actorId, operation, key, hash))
    }

    @Test
    fun `same key with different payload conflicts`() {
        `when`(users.findWithLockById(actorId)).thenReturn(UserProfile(id = actorId))
        `when`(records.findByOrganizationIdAndActorUserIdAndOperationAndIdempotencyKey(organizationId, actorId, operation, key))
            .thenReturn(BillingIdempotencyRecord(organizationId = organizationId, actorUserId = actorId, operation = operation, idempotencyKey = key, payloadHash = hash, resourceId = resourceId))

        assertThrows(TenantSubscriptionIdempotencyConflict::class.java) {
            service.replayResourceId(organizationId, actorId, operation, key, service.payloadHash("different"))
        }
    }

    @Test
    fun `record persists command scope and replay resource`() {
        val saved = BillingIdempotencyRecord(organizationId = organizationId, actorUserId = actorId, operation = operation, idempotencyKey = key, payloadHash = hash, resourceType = "INVOICE", resourceId = resourceId)
        `when`(records.save(org.mockito.ArgumentMatchers.any(BillingIdempotencyRecord::class.java))).thenReturn(saved)

        service.record(organizationId, actorId, operation, key, hash, "INVOICE", resourceId)

        verify(records).save(org.mockito.ArgumentMatchers.argThat { record ->
            record.organizationId == organizationId && record.actorUserId == actorId && record.operation == operation &&
                record.idempotencyKey == key && record.payloadHash == hash && record.resourceType == "INVOICE" && record.resourceId == resourceId
        })
    }

    @Test
    fun `hash uses unambiguous field boundaries and hashes binary data directly`() {
        assertNotEquals(service.payloadHash("a|b", "c"), service.payloadHash("a", "b|c"))
        assertEquals(service.payloadHash(byteArrayOf(1, 2, 3)), service.payloadHash(byteArrayOf(1, 2, 3)))
        assertNotEquals(service.payloadHash(byteArrayOf(1, 2, 3)), service.payloadHash(byteArrayOf(1, 2, 4)))
        assertTrue(service.payloadHash("value").matches(Regex("[0-9a-f]{64}")))
    }
}
