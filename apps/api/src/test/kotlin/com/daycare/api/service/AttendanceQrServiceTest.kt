package com.daycare.api.service

// Mories Deo Hutapea,S.E.,S.Kom

import org.junit.jupiter.api.Assertions.assertDoesNotThrow
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Test
import java.util.UUID
import java.time.Instant
import java.nio.charset.StandardCharsets
import java.util.Base64
import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec

class AttendanceQrServiceTest {
    private val service = AttendanceQrService("this-is-a-test-secret-with-at-least-32-characters")

    @Test
    fun `issued token validates only for its child`() {
        val childId = UUID.randomUUID()
        val childName = "Alya Putri"
        val issued = service.issue(childId, childName)
        assertDoesNotThrow { service.verify(childId, childName, issued.token) }
        assertThrows(IllegalArgumentException::class.java) { service.verify(UUID.randomUUID(), childName, issued.token) }
        assertThrows(IllegalArgumentException::class.java) { service.verify(childId, "Anak Lain", issued.token) }
    }

    @Test
    fun `verify rejects malformed expiry, expired token, and tampered signature`() {
        val childId = UUID.randomUUID()
        val childName = "Alya Putri"
        val issued = service.issue(childId, childName)
        val parts = issued.token.split(".")

        assertThrows(IllegalArgumentException::class.java) { service.verify(childId, childName, issued.token.substringBeforeLast('.')) }
        val malformedExpiry = "${parts[0]}.${parts[1]}.not-a-number.${parts[3]}"
        assertThrows(IllegalArgumentException::class.java) { service.verify(childId, childName, malformedExpiry) }
        val expiredUnsigned = "${parts[0]}.${parts[1]}.${Instant.now().minusSeconds(60).epochSecond}"
        assertThrows(IllegalArgumentException::class.java) { service.verify(childId, childName, "$expiredUnsigned.${sign(expiredUnsigned)}") }
        assertThrows(IllegalArgumentException::class.java) { service.verify(childId, childName, "${parts[0]}.${parts[1]}.${parts[2]}.tampered") }
    }

    private fun sign(value: String): String {
        val mac = Mac.getInstance("HmacSHA256")
        mac.init(SecretKeySpec("this-is-a-test-secret-with-at-least-32-characters".toByteArray(StandardCharsets.UTF_8), "HmacSHA256"))
        return Base64.getUrlEncoder().withoutPadding().encodeToString(mac.doFinal(value.toByteArray(StandardCharsets.UTF_8)))
    }
}
