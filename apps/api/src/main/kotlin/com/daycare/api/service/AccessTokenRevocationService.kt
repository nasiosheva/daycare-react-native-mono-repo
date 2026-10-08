package com.daycare.api.service

import com.daycare.api.persistence.RevokedAccessToken
import com.daycare.api.persistence.RevokedAccessTokenRepository
import com.daycare.api.persistence.UserProfile
import com.daycare.api.persistence.UserProfileRepository
import com.daycare.api.realtime.RealtimeSessionRegistry
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.nio.charset.StandardCharsets
import java.security.MessageDigest
import java.time.Instant

@Service
class AccessTokenRevocationService(
    private val revokedTokens: RevokedAccessTokenRepository,
    private val users: UserProfileRepository,
    private val realtimeSessions: RealtimeSessionRegistry,
) {
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

    @Transactional
    fun revokeUserSessions(user: UserProfile) {
        user.sessionsRevokedAt = Instant.now()
        users.save(user)
        realtimeSessions.closeForUser(user.id)
    }

    @Transactional(readOnly = true)
    fun isUserSessionRevoked(subject: String?, issuedAt: Instant?): Boolean {
        if (subject.isNullOrBlank() || issuedAt == null) return false
        val revokedAt = users.findByFirebaseUid(subject)?.sessionsRevokedAt ?: return false
        return !issuedAt.isAfter(revokedAt)
    }

    private fun hash(token: String): String = MessageDigest.getInstance("SHA-256")
        .digest(token.toByteArray(StandardCharsets.UTF_8))
        .joinToString("") { byte -> "%02x".format(byte) }
}
