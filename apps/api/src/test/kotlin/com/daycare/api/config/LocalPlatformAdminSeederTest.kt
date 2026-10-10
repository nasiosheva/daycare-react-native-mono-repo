package com.daycare.api.config

import com.daycare.api.persistence.PlatformAdministratorRepository
import com.daycare.api.persistence.UserProfile
import com.daycare.api.persistence.UserProfileRepository
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.Assertions.assertEquals
import org.mockito.Mockito.mock
import org.mockito.Mockito.verify
import org.mockito.Mockito.never
import org.mockito.Mockito.`when`
import org.springframework.security.core.context.SecurityContextHolder
import org.springframework.security.crypto.password.PasswordEncoder
import java.util.Optional

class LocalPlatformAdminSeederTest {
    private val users = mock(UserProfileRepository::class.java)
    private val administrators = mock(PlatformAdministratorRepository::class.java)
    private val encoder = mock(PasswordEncoder::class.java)
    private val args = mock(org.springframework.boot.ApplicationArguments::class.java)

    @Test
    fun `creates local admin and inserts singleton administrator`() {
        `when`(users.findByFirebaseUid("local:admin")).thenReturn(null)
        `when`(users.findByEmailIgnoreCase("admin@test")).thenReturn(null)
        `when`(users.findByUsernameIgnoreCase("admin")).thenReturn(null)
        val savedUser = UserProfile(id = java.util.UUID.randomUUID())
        `when`(users.save(org.mockito.ArgumentMatchers.any(UserProfile::class.java))).thenReturn(savedUser)
        `when`(encoder.encode("secret")).thenReturn("hash")
        val seeder = LocalPlatformAdminSeeder(users, administrators, encoder, "admin@test", "admin", "Admin", "secret")

        seeder.run(args)

        verify(users).save(org.mockito.ArgumentMatchers.any(UserProfile::class.java))
        verify(administrators).insertIfAbsent(savedUser.id)
    }

    @Test
    fun `reuses existing identity and does not insert when singleton already exists`() {
        val existing = UserProfile(firebaseUid = "old", localPasswordHash = "hash")
        `when`(users.findByFirebaseUid("local:admin")).thenReturn(null)
        `when`(users.findByEmailIgnoreCase("admin@test")).thenReturn(existing)
        `when`(encoder.matches("secret", "hash")).thenReturn(true)
        `when`(users.save(existing)).thenReturn(existing)
        `when`(administrators.existsById(existing.id)).thenReturn(true)
        val seeder = LocalPlatformAdminSeeder(users, administrators, encoder, "admin@test", "admin", "Admin", "secret")

        seeder.run(args)

        assertEquals("local:admin", existing.firebaseUid)
        verify(encoder, never()).encode("secret")
        verify(administrators, never()).insertIfAbsent(existing.id)
    }
}
