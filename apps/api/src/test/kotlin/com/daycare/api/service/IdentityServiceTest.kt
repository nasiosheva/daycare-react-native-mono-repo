package com.daycare.api.service

import com.daycare.api.persistence.UserProfile
import com.daycare.api.persistence.UserProfileRepository
import com.daycare.api.persistence.InvitationRepository
import com.daycare.api.persistence.Invitation
import com.daycare.api.persistence.MembershipRepository
import com.daycare.api.domain.InvitationStatus
import com.daycare.api.domain.Role
import com.daycare.api.domain.Gender
import java.time.Instant
import java.util.UUID
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertEquals
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

    @Test
    fun `sync accepts matching pending email and phone invitations and updates profile`() {
        val users = mock(UserProfileRepository::class.java)
        val memberships = mock(MembershipRepository::class.java)
        val invitations = mock(InvitationRepository::class.java)
        val jwt = mock(Jwt::class.java)
        val user = UserProfile(firebaseUid = "uid", email = "parent@example.test", displayName = "Parent")
        `when`(jwt.subject).thenReturn("uid")
        `when`(jwt.getClaimAsString("email")).thenReturn("parent@example.test")
        `when`(jwt.getClaimAsString("phone_number")).thenReturn("08123")
        `when`(users.findByFirebaseUid("uid")).thenReturn(user)
        val emailInvitation = Invitation(organizationId = UUID.randomUUID(), email = "PARENT@EXAMPLE.TEST", expiresAt = Instant.now().plusSeconds(3600))
        val phoneInvitation = Invitation(organizationId = UUID.randomUUID(), phoneNumber = "08123", expiresAt = Instant.now().plusSeconds(3600), role = Role.STAFF)
        val expired = Invitation(organizationId = UUID.randomUUID(), email = "parent@example.test", expiresAt = Instant.now().minusSeconds(1))
        `when`(invitations.findAllByStatus(InvitationStatus.PENDING)).thenReturn(listOf(emailInvitation, phoneInvitation, expired))
        `when`(users.save(org.mockito.ArgumentMatchers.any(UserProfile::class.java))).thenAnswer { it.getArgument(0) }
        val service = IdentityService(users, memberships, invitations)

        assertEquals(user, service.sync(jwt))
        assertEquals(InvitationStatus.ACCEPTED, emailInvitation.status)
        assertEquals(InvitationStatus.ACCEPTED, phoneInvitation.status)
        assertEquals(InvitationStatus.PENDING, expired.status)
        verify(memberships, org.mockito.Mockito.times(2)).save(org.mockito.ArgumentMatchers.any())
        val updated = service.updatePersonalDetails(jwt, Gender.FEMALE, java.time.LocalDate.of(1990, 1, 1))
        assertEquals(Gender.FEMALE, updated.gender)
    }

    @Test
    fun `username update allows clearing and rejects short or duplicate values`() {
        val users = mock(UserProfileRepository::class.java)
        val user = UserProfile(firebaseUid = "uid", email = "parent@example.test", displayName = "Parent", username = "old")
        val jwt = mock(Jwt::class.java)
        `when`(jwt.subject).thenReturn("uid")
        `when`(jwt.getClaimAsString("email")).thenReturn("parent@example.test")
        `when`(users.findByFirebaseUid("uid")).thenReturn(user)
        `when`(users.findByEmailIgnoreCase("parent@example.test")).thenReturn(user)
        `when`(users.save(org.mockito.ArgumentMatchers.any(UserProfile::class.java))).thenAnswer { it.getArgument(0) }
        val service = IdentityService(users, mock(MembershipRepository::class.java), mock(InvitationRepository::class.java))

        assertEquals(null, service.updateUsername(jwt, null).username)
        assertThrows(IllegalArgumentException::class.java) { service.updateUsername(jwt, " ") }
        assertThrows(IllegalArgumentException::class.java) { service.updateUsername(jwt, "x") }
        `when`(users.findByUsernameIgnoreCase("taken")).thenReturn(UserProfile(firebaseUid = "other"))
        assertThrows(IllegalArgumentException::class.java) { service.updateUsername(jwt, "taken") }
    }
}
