package com.daycare.api.service

import com.daycare.api.persistence.PlatformAdministratorRepository
import com.daycare.api.persistence.UserProfile
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Test
import org.mockito.Mockito.mock
import org.mockito.Mockito.verify
import org.mockito.Mockito.`when`
import org.springframework.security.access.AccessDeniedException
import org.springframework.security.oauth2.jwt.Jwt

class PlatformAccessServiceTest {
    @Test
    fun `configured bootstrap email cannot become a second platform admin`() {
        val administrators = mock(PlatformAdministratorRepository::class.java)
        val user = UserProfile(email = "second@example.com")
        `when`(administrators.count()).thenReturn(1L)
        `when`(administrators.existsById(user.id)).thenReturn(false)

        val service = PlatformAccessService(mock(IdentityService::class.java), administrators, "second@example.com")

        assertFalse(service.isPlatformAdmin(user))
        verify(administrators, org.mockito.Mockito.never()).insertIfAbsent(user.id)
    }

    @Test
    fun `configured bootstrap email becomes the first platform admin`() {
        val administrators = mock(PlatformAdministratorRepository::class.java)
        val user = UserProfile(email = "first@example.com")
        `when`(administrators.count()).thenReturn(0L)
        `when`(administrators.existsById(user.id)).thenReturn(false, true)
        `when`(administrators.insertIfAbsent(user.id)).thenReturn(1)

        val service = PlatformAccessService(mock(IdentityService::class.java), administrators, "first@example.com")

        assertTrue(service.isPlatformAdmin(user))
        verify(administrators).insertIfAbsent(user.id)
    }

    @Test
    fun `platform access handles blank configuration, existing admin, and denied callers`() {
        val administrators = mock(PlatformAdministratorRepository::class.java)
        val identity = mock(IdentityService::class.java)
        val jwt = mock(Jwt::class.java)
        val user = UserProfile(email = "admin@example.com")
        `when`(identity.sync(jwt)).thenReturn(user)

        val blankConfig = PlatformAccessService(identity, administrators, " ,  ")
        `when`(administrators.existsById(user.id)).thenReturn(false)
        `when`(administrators.count()).thenReturn(0L)
        assertFalse(blankConfig.isPlatformAdmin(user))

        val existing = PlatformAccessService(identity, administrators, "ADMIN@EXAMPLE.COM")
        `when`(administrators.existsById(user.id)).thenReturn(true)
        assertTrue(existing.isPlatformAdmin(user))
        assertTrue(existing.requirePlatformAdmin(jwt) == user)

        `when`(administrators.existsById(user.id)).thenReturn(false)
        assertThrows(AccessDeniedException::class.java) { existing.requirePlatformAdmin(jwt) }
    }

    @Test
    fun `bootstrap email comparison is case insensitive and null safe`() {
        val administrators = mock(PlatformAdministratorRepository::class.java)
        val service = PlatformAccessService(mock(IdentityService::class.java), administrators, "ADMIN@EXAMPLE.COM")
        val user = UserProfile(email = null)
        `when`(administrators.existsById(user.id)).thenReturn(false)
        `when`(administrators.count()).thenReturn(0L)
        assertFalse(service.isPlatformAdmin(user))
    }
}
