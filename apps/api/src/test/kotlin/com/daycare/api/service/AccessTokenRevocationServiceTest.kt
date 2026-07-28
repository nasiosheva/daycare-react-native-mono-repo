package com.daycare.api.service

import com.daycare.api.persistence.RevokedAccessToken
import com.daycare.api.persistence.RevokedAccessTokenRepository
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
        `when`(tokens.existsByTokenHash(org.mockito.Mockito.anyString())).thenReturn(false)
        val tokenValue = "access-token-value"
        val jwt = Jwt.withTokenValue(tokenValue)
            .header("alg", "HS256")
            .subject("local:user")
            .issuedAt(Instant.now())
            .expiresAt(Instant.now().plusSeconds(3_600))
            .build()

        AccessTokenRevocationService(tokens).revoke(jwt)

        val tokenCaptor = ArgumentCaptor.forClass(RevokedAccessToken::class.java)
        verify(tokens).save(tokenCaptor.capture())
        assertNotEquals(tokenValue, tokenCaptor.value.tokenHash)
        assertEquals(64, tokenCaptor.value.tokenHash.length)
    }
}
