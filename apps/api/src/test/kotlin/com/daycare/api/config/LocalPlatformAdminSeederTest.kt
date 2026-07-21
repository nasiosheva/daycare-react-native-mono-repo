package com.daycare.api.config

import com.daycare.api.persistence.PlatformAdministrator
import com.daycare.api.persistence.PlatformAdministratorRepository
import com.daycare.api.persistence.UserProfile
import com.daycare.api.persistence.UserProfileRepository
import com.daycare.api.service.EmailPasswordIdentityProvisioner
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.Assertions.assertEquals
import org.mockito.ArgumentCaptor
import org.mockito.Mockito.`when`
import org.mockito.Mockito.any
import org.mockito.Mockito.mock
import org.mockito.Mockito.never
import org.mockito.Mockito.verify
import org.springframework.security.crypto.password.PasswordEncoder
import java.util.UUID

class LocalPlatformAdminSeederTest {
    private val firebaseUid = "firebase-local-platform-admin"
    private val email = "admin@local.test"
    private val displayName = "Admin Lokal"
    private val username = "admin"

    @Test
    fun `creates a local platform administrator when no seeded user exists`() {
        val users = mock(UserProfileRepository::class.java)
        val administrators = mock(PlatformAdministratorRepository::class.java)
        val identityProvisioner = mock(EmailPasswordIdentityProvisioner::class.java)
        val passwordEncoder = mock(PasswordEncoder::class.java)
        val user = UserProfile(firebaseUid = firebaseUid, email = email, displayName = displayName)
        `when`(identityProvisioner.findOrCreateEmailPasswordUser(email, displayName, "123123")).thenReturn(firebaseUid)
        `when`(users.findByFirebaseUid(firebaseUid)).thenReturn(null)
        `when`(users.findByEmailIgnoreCase(email)).thenReturn(null)
        `when`(users.save(any(UserProfile::class.java))).thenReturn(user)
        `when`(administrators.existsById(user.id)).thenReturn(false)

        createSeeder(users, administrators, identityProvisioner, passwordEncoder, localAuthEnabled = false).run(mock())

        val userCaptor = ArgumentCaptor.forClass(UserProfile::class.java)
        verify(users).save(userCaptor.capture())
        assertEquals(firebaseUid, userCaptor.value.firebaseUid)
        assertEquals(email, userCaptor.value.email)
        assertEquals(displayName, userCaptor.value.displayName)
        val administratorCaptor = ArgumentCaptor.forClass(PlatformAdministrator::class.java)
        verify(administrators).save(administratorCaptor.capture())
        assertEquals(user.id, administratorCaptor.value.userId)
    }

    @Test
    fun `reuses an existing seeded platform administrator`() {
        val users = mock(UserProfileRepository::class.java)
        val administrators = mock(PlatformAdministratorRepository::class.java)
        val identityProvisioner = mock(EmailPasswordIdentityProvisioner::class.java)
        val passwordEncoder = mock(PasswordEncoder::class.java)
        val user = UserProfile(id = UUID.randomUUID(), firebaseUid = firebaseUid, email = email, displayName = displayName)
        `when`(identityProvisioner.findOrCreateEmailPasswordUser(email, displayName, "123123")).thenReturn(firebaseUid)
        `when`(users.findByFirebaseUid(firebaseUid)).thenReturn(user)
        `when`(users.save(user)).thenReturn(user)
        `when`(administrators.existsById(user.id)).thenReturn(true)

        createSeeder(users, administrators, identityProvisioner, passwordEncoder, localAuthEnabled = false).run(mock())

        verify(users).save(user)
        verify(administrators, never()).save(any(PlatformAdministrator::class.java))
    }

    @Test
    fun `creates database-only credentials when local authentication is enabled`() {
        val users = mock(UserProfileRepository::class.java)
        val administrators = mock(PlatformAdministratorRepository::class.java)
        val identityProvisioner = mock(EmailPasswordIdentityProvisioner::class.java)
        val passwordEncoder = mock(PasswordEncoder::class.java)
        val user = UserProfile(firebaseUid = "local:$username", email = email, displayName = displayName)
        `when`(users.findByFirebaseUid("local:$username")).thenReturn(null)
        `when`(users.findByEmailIgnoreCase(email)).thenReturn(null)
        `when`(users.findByUsernameIgnoreCase(username)).thenReturn(null)
        `when`(passwordEncoder.encode("123123")).thenReturn("encoded-password")
        `when`(users.save(any(UserProfile::class.java))).thenReturn(user)
        `when`(administrators.existsById(user.id)).thenReturn(false)

        createSeeder(users, administrators, identityProvisioner, passwordEncoder, localAuthEnabled = true).run(mock())

        val userCaptor = ArgumentCaptor.forClass(UserProfile::class.java)
        verify(users).save(userCaptor.capture())
        assertEquals("local:$username", userCaptor.value.firebaseUid)
        assertEquals(username, userCaptor.value.username)
        assertEquals("encoded-password", userCaptor.value.localPasswordHash)
        verify(identityProvisioner, never()).findOrCreateEmailPasswordUser(email, displayName, "123123")
    }

    private fun createSeeder(
        users: UserProfileRepository,
        administrators: PlatformAdministratorRepository,
        identityProvisioner: EmailPasswordIdentityProvisioner,
        passwordEncoder: PasswordEncoder,
        localAuthEnabled: Boolean,
    ) = LocalPlatformAdminSeeder(users, administrators, identityProvisioner, passwordEncoder, email, username, displayName, "123123", localAuthEnabled)
}
