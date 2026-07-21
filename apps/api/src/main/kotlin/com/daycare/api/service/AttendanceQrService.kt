package com.daycare.api.service

import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Service
import java.nio.charset.StandardCharsets
import java.security.MessageDigest
import java.time.Instant
import java.util.Base64
import java.util.UUID
import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec

data class IssuedQr(val token: String, val expiresAt: Instant)

@Service
class AttendanceQrService(@Value("\${daycare.qr-signing-secret}") private val secret: String) {
    fun issue(childId: UUID): IssuedQr {
        val expiresAt = Instant.now().plusSeconds(60)
        val unsigned = "$childId.${expiresAt.epochSecond}"
        return IssuedQr("$unsigned.${sign(unsigned)}", expiresAt)
    }

    fun verify(childId: UUID, token: String) {
        val parts = token.split(".")
        require(parts.size == 3 && parts[0] == childId.toString()) { "QR token is invalid" }
        val expiresAt = parts[1].toLongOrNull()?.let(Instant::ofEpochSecond) ?: throw IllegalArgumentException("QR token is invalid")
        require(expiresAt.isAfter(Instant.now())) { "QR token has expired" }
        val expected = sign("${parts[0]}.${parts[1]}")
        require(MessageDigest.isEqual(expected.toByteArray(), parts[2].toByteArray())) { "QR token is invalid" }
    }

    private fun sign(value: String): String {
        val mac = Mac.getInstance("HmacSHA256")
        mac.init(SecretKeySpec(secret.toByteArray(StandardCharsets.UTF_8), "HmacSHA256"))
        return Base64.getUrlEncoder().withoutPadding().encodeToString(mac.doFinal(value.toByteArray(StandardCharsets.UTF_8)))
    }
}
