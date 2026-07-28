package com.daycare.api.service

import com.daycare.api.persistence.RevokedAccessToken
import com.daycare.api.persistence.RevokedAccessTokenRepository
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.nio.charset.StandardCharsets
import java.security.MessageDigest
import java.time.Instant

@Service
class AccessTokenRevocationService(private val revokedTokens: RevokedAccessTokenRepository) {
    @Transactional
    fun revoke(jwt: Jwt) {
        val now = Instant.now()
        val expiresAt = jwt.expiresAt ?: return
        if (!expiresAt.isAfter(now)) return
        revokedTokens.deleteAllByExpiresAtBefore(now)
        val tokenHash = hash(jwt.tokenValue)
        if (!revokedTokens.existsByTokenHash(tokenHash)) revokedTokens.save(RevokedAccessToken(tokenHash = tokenHash, expiresAt = expiresAt, revokedAt = now))
    }

    @Transactional(readOnly = true)
    fun isRevoked(token: String): Boolean = revokedTokens.existsByTokenHash(hash(token))

    private fun hash(token: String): String = MessageDigest.getInstance("SHA-256")
        .digest(token.toByteArray(StandardCharsets.UTF_8))
        .joinToString("") { byte -> "%02x".format(byte) }
}
