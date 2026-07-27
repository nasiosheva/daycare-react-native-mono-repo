package com.daycare.api.service

import com.daycare.api.persistence.UserProfileRepository
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Test
import org.mockito.Mockito.mock
import org.mockito.Mockito.never
import org.mockito.Mockito.verify
import org.mockito.Mockito.`when`
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.security.oauth2.jwt.Jwt

class LocalAuthenticationServiceTest {
    @Test
    fun `rejects a registration email that differs from the verified Google email`() {
        val users = mock(UserProfileRepository::class.java)
        val verifiedIdentity = mock(Jwt::class.java)
        `when`(verifiedIdentity.getClaimAsString("email")).thenReturn("verified@example.test")
        `when`(verifiedIdentity.getClaimAsString("phone_number")).thenReturn(null)
        val service = LocalAuthenticationService(users, mock(PasswordEncoder::class.java), LocalJwtService("01234567890123456789012345678901"))

        assertThrows(IllegalArgumentException::class.java) {
            service.register("Parent Baru", "other@example.test", "123123", verifiedIdentity)
        }

        verify(users, never()).save(org.mockito.Mockito.any(com.daycare.api.persistence.UserProfile::class.java))
    }
}
