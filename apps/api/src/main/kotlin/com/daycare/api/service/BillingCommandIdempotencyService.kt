// Mories Deo Hutapea,S.E.,S.Kom
package com.daycare.api.service

import com.daycare.api.persistence.BillingIdempotencyRecord
import com.daycare.api.persistence.BillingIdempotencyRecordRepository
import com.daycare.api.persistence.UserProfileRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.nio.ByteBuffer
import java.security.MessageDigest
import java.time.Instant
import java.util.UUID

@Service
class BillingCommandIdempotencyService(
    private val users: UserProfileRepository,
    private val records: BillingIdempotencyRecordRepository,
) {
    /** Locks the actor row so concurrent retries from that account serialize before lookup. */
    @Transactional
    fun replayResourceId(
        organizationId: UUID,
        actorUserId: UUID,
        operation: String,
        idempotencyKey: UUID,
        payloadHash: String,
    ): UUID? {
        users.findWithLockById(actorUserId) ?: throw IllegalArgumentException("Billing actor was not found")
        val record = records.findByOrganizationIdAndActorUserIdAndOperationAndIdempotencyKey(
            organizationId, actorUserId, operation, idempotencyKey,
        ) ?: return null
        if (record.payloadHash != payloadHash) throw TenantSubscriptionIdempotencyConflict()
        return record.resourceId
    }

    @Transactional
    fun record(
        organizationId: UUID,
        actorUserId: UUID,
        operation: String,
        idempotencyKey: UUID,
        payloadHash: String,
        resourceType: String,
        resourceId: UUID,
    ) {
        records.save(
            BillingIdempotencyRecord(
                organizationId = organizationId,
                actorUserId = actorUserId,
                operation = operation,
                idempotencyKey = idempotencyKey,
                payloadHash = payloadHash,
                resourceType = resourceType,
                resourceId = resourceId,
                createdAt = Instant.now(),
            ),
        )
    }

    fun payloadHash(vararg values: String): String {
        val digest = MessageDigest.getInstance("SHA-256")
        values.forEach { value ->
            val bytes = value.toByteArray(Charsets.UTF_8)
            digest.update(ByteBuffer.allocate(Int.SIZE_BYTES).putInt(bytes.size).array())
            digest.update(bytes)
        }
        return digest.digest().toHex()
    }

    fun payloadHash(bytes: ByteArray): String = MessageDigest.getInstance("SHA-256")
        .digest(bytes)
        .toHex()

    private fun ByteArray.toHex(): String = joinToString("") { "%02x".format(it) }
}
