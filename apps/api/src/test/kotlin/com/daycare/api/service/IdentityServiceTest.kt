package com.daycare.api.service

import com.daycare.api.persistence.InvitationRepository
import com.daycare.api.persistence.MembershipRepository
import com.daycare.api.persistence.UserProfile
import com.daycare.api.persistence.UserProfileRepository
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.mockito.Mockito.mock
import org.mockito.Mockito.never
import org.mockito.Mockito.verify
import org.mockito.Mockito.`when`
import org.springframework.security.oauth2.jwt.Jwt

class IdentityServiceTest {
    @Test
    fun `matches a verified Google email to an existing application account`() {
        val users = mock(UserProfileRepository::class.java)
        val jwt = mock(Jwt::class.java)
        val existing = UserProfile(email = "parent@example.test")
        `when`(jwt.subject).thenReturn("firebase-google-id")
        `when`(jwt.getClaimAsString("email")).thenReturn("parent@example.test")
        `when`(jwt.getClaimAsString("phone_number")).thenReturn(null)
        `when`(users.findByFirebaseUid("firebase-google-id")).thenReturn(null)
        `when`(users.findByEmailIgnoreCase("parent@example.test")).thenReturn(existing)
        val service = IdentityService(users, mock(MembershipRepository::class.java), mock(InvitationRepository::class.java))

        val result = service.checkIdentity(jwt)

        assertTrue(result.exists)
        verify(users, never()).save(org.mockito.Mockito.any(UserProfile::class.java))
    }

    @Test
    fun `does not create an account for an unknown Firebase identity`() {
        val users = mock(UserProfileRepository::class.java)
        val jwt = mock(Jwt::class.java)
        `when`(jwt.subject).thenReturn("firebase-new-id")
        `when`(jwt.getClaimAsString("email")).thenReturn("new@example.test")
        `when`(jwt.getClaimAsString("phone_number")).thenReturn(null)
        `when`(users.findByFirebaseUid("firebase-new-id")).thenReturn(null)
        `when`(users.findByEmailIgnoreCase("new@example.test")).thenReturn(null)
        val service = IdentityService(users, mock(MembershipRepository::class.java), mock(InvitationRepository::class.java))

        assertThrows(IdentityRegistrationRequiredException::class.java) { service.sync(jwt) }

        assertFalse(service.checkIdentity(jwt).exists)
        verify(users, never()).save(org.mockito.Mockito.any(UserProfile::class.java))
    }
}
