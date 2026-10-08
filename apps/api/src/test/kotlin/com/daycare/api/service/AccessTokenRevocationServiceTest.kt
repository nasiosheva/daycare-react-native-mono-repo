package com.daycare.api.service

import com.daycare.api.persistence.RevokedAccessToken
import com.daycare.api.persistence.RevokedAccessTokenRepository
import com.daycare.api.persistence.UserProfile
import com.daycare.api.persistence.UserProfileRepository
import com.daycare.api.realtime.RealtimeSessionRegistry
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNotEquals
import org.junit.jupiter.api.Test
import org.mockito.ArgumentCaptor
import org.mockito.Mockito.mock
import org.mockito.Mockito.verify
import org.mockito.Mockito.`when`
import org.springframework.security.oauth2.jwt.Jwt
import java.time.Instant

class AccessTokenRevocationServiceTest {
    @Test
    fun `stores only a hash for an active token`() {
        val tokens = mock(RevokedAccessTokenRepository::class.java)
        val users = mock(UserProfileRepository::class.java)
        val realtimeSessions = mock(RealtimeSessionRegistry::class.java)
        `when`(tokens.existsByTokenHash(org.mockito.Mockito.anyString())).thenReturn(false)
        val tokenValue = "access-token-value"
        val jwt = Jwt.withTokenValue(tokenValue)
            .header("alg", "HS256")
            .subject("local:user")
            .issuedAt(Instant.now())
            .expiresAt(Instant.now().plusSeconds(3_600))
            .build()

        AccessTokenRevocationService(tokens, users, realtimeSessions).revoke(jwt)

        val tokenCaptor = ArgumentCaptor.forClass(RevokedAccessToken::class.java)
        verify(tokens).save(tokenCaptor.capture())
        assertNotEquals(tokenValue, tokenCaptor.value.tokenHash)
        assertEquals(64, tokenCaptor.value.tokenHash.length)
    }

    @Test
    fun `revokes all local sessions and closes realtime sessions`() {
        val tokens = mock(RevokedAccessTokenRepository::class.java)
        val users = mock(UserProfileRepository::class.java)
        val realtimeSessions = mock(RealtimeSessionRegistry::class.java)
        val user = UserProfile(firebaseUid = "local:user")
        val service = AccessTokenRevocationService(tokens, users, realtimeSessions)

        service.revokeUserSessions(user)

        verify(users).save(user)
        verify(realtimeSessions).closeForUser(user.id)
    }

    @Test
    fun `rejects tokens issued at or before the session revocation timestamp`() {
        val tokens = mock(RevokedAccessTokenRepository::class.java)
        val users = mock(UserProfileRepository::class.java)
        val realtimeSessions = mock(RealtimeSessionRegistry::class.java)
        val revokedAt = Instant.parse("2026-10-08T10:00:00Z")
        `when`(users.findByFirebaseUid("local:user")).thenReturn(UserProfile(firebaseUid = "local:user", sessionsRevokedAt = revokedAt))
        val service = AccessTokenRevocationService(tokens, users, realtimeSessions)

        assertEquals(true, service.isUserSessionRevoked("local:user", revokedAt.minusSeconds(1)))
        assertEquals(true, service.isUserSessionRevoked("local:user", revokedAt))
        assertEquals(false, service.isUserSessionRevoked("local:user", revokedAt.plusSeconds(1)))
    }
}
