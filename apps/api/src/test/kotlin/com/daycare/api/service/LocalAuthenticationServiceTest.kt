package com.daycare.api.service

import com.daycare.api.persistence.UserProfileRepository
import com.daycare.api.persistence.UserProfile
import java.util.Optional
import org.junit.jupiter.api.Assertions.assertEquals
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
        val service = LocalAuthenticationService(users, mock(PasswordEncoder::class.java), LocalJwtService("01234567890123456789012345678901"), mock(AccessTokenRevocationService::class.java))

        assertThrows(IllegalArgumentException::class.java) {
            service.register("Parent Baru", "other@example.test", "123123", verifiedIdentity)
        }

        verify(users, never()).save(org.mockito.Mockito.any(com.daycare.api.persistence.UserProfile::class.java))
    }

    @Test
    fun `registers local parent and supports email username login and profile updates`() {
        val users = mock(UserProfileRepository::class.java)
        val encoder = mock(PasswordEncoder::class.java)
        val revocations = mock(AccessTokenRevocationService::class.java)
        val user = UserProfile(firebaseUid = "local:uid", displayName = "Parent", email = "parent@example.test", username = "parent", localPasswordHash = "hash")
        `when`(users.findByEmailIgnoreCase("parent@example.test")).thenReturn(null)
        `when`(encoder.encode("secret")).thenReturn("encoded")
        `when`(users.save(org.mockito.ArgumentMatchers.any(UserProfile::class.java))).thenAnswer { it.getArgument(0) }
        val service = LocalAuthenticationService(users, encoder, LocalJwtService("01234567890123456789012345678901"), revocations)

        val registered = service.register(" Parent ", " PARENT@EXAMPLE.TEST ", "secret")
        assertEquals("parent@example.test", registered.user.email)
        `when`(users.findByEmailIgnoreCase("parent@example.test")).thenReturn(user)
        `when`(users.findByUsernameIgnoreCase("parent")).thenReturn(user)
        `when`(encoder.matches("secret", "hash")).thenReturn(true)
        assertEquals("Parent", service.login("parent@example.test", "secret").user.displayName)
        assertEquals("Parent", service.login(" parent ", "secret").user.displayName)
        assertThrows(InvalidLocalCredentialsException::class.java) { service.login("parent@example.test", "wrong") }
        `when`(users.findByFirebaseUid("local:uid")).thenReturn(user)
        service.changePassword("local:uid", "newpass")
        service.updateDisplayName("local:uid", " New Name ")
        assertEquals("New Name", user.displayName)
        verify(revocations).revokeUserSessions(user)
    }

    @Test
    fun `registration and profile operations reject invalid and duplicate values`() {
        val users = mock(UserProfileRepository::class.java)
        val encoder = mock(PasswordEncoder::class.java)
        val service = LocalAuthenticationService(users, encoder, LocalJwtService("01234567890123456789012345678901"), mock(AccessTokenRevocationService::class.java))
        assertThrows(IllegalArgumentException::class.java) { service.register(" ", "parent@example.test", "secret") }
        assertThrows(IllegalArgumentException::class.java) { service.register("Parent", "invalid", "secret") }
        assertThrows(IllegalArgumentException::class.java) { service.register("Parent", "parent@example.test", "123") }
        val verified = mock(Jwt::class.java)
        `when`(verified.getClaimAsString("email")).thenReturn("parent@example.test")
        `when`(verified.getClaimAsString("phone_number")).thenReturn("08123")
        `when`(users.findByEmailIgnoreCase("parent@example.test")).thenReturn(UserProfile(email = "parent@example.test"))
        assertThrows(IllegalArgumentException::class.java) { service.register("Parent", "parent@example.test", "secret", verified) }
        `when`(users.findByEmailIgnoreCase("parent@example.test")).thenReturn(null)
        `when`(users.findByPhoneNumber("08123")).thenReturn(UserProfile(phoneNumber = "08123"))
        assertThrows(IllegalArgumentException::class.java) { service.register("Parent", "parent@example.test", "secret", verified) }
        assertThrows(IllegalArgumentException::class.java) { service.changePassword("missing", "secret") }
        assertThrows(IllegalArgumentException::class.java) { service.updateDisplayName("missing", " ") }
    }
}
