package com.daycare.api.service

import com.daycare.api.domain.RegistrationRole
import com.daycare.api.persistence.ScreeningChildProfile
import com.daycare.api.persistence.ScreeningChildProfileRepository
import com.daycare.api.persistence.UserProfile
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Test
import org.mockito.Mockito.mock
import org.mockito.Mockito.`when`
import java.time.LocalDate
import java.util.UUID

class ScreeningParentProfileServiceTest {
    private val identity = mock(IdentityService::class.java)
    private val profiles = mock(ScreeningChildProfileRepository::class.java)
    private val service = ScreeningParentProfileService(identity, profiles)
    private val parent = UserProfile(id = UUID.randomUUID(), registrationRole = RegistrationRole.PARENT)
    private val jwt = mock(org.springframework.security.oauth2.jwt.Jwt::class.java)

    @Test
    fun `create is account level and does not require tenant`() {
        `when`(identity.sync(jwt)).thenReturn(parent)
        `when`(profiles.save(org.mockito.ArgumentMatchers.any(ScreeningChildProfile::class.java))).thenAnswer { it.arguments[0] }

        val result = service.create(jwt, ScreeningChildProfileRequest("  Anak Global  ", LocalDate.of(2024, 1, 1), false))

        assertEquals("Anak Global", result.subjectName)
        assertEquals(false, result.prematureBirth)
    }

    @Test
    fun `non parent cannot create screening profile`() {
        `when`(identity.sync(jwt)).thenReturn(UserProfile(id = parent.id, registrationRole = RegistrationRole.PARENT).also { it.registrationRole = null })

        assertThrows(org.springframework.security.access.AccessDeniedException::class.java) {
            service.create(jwt, ScreeningChildProfileRequest("Anak", LocalDate.of(2024, 1, 1)))
        }
    }

    @Test
    fun `future date and blank name are rejected`() {
        `when`(identity.sync(jwt)).thenReturn(parent)

        assertThrows(IllegalArgumentException::class.java) {
            service.create(jwt, ScreeningChildProfileRequest(" ", LocalDate.now()))
        }
        assertThrows(IllegalArgumentException::class.java) {
            service.create(jwt, ScreeningChildProfileRequest("Anak", LocalDate.now().plusDays(1)))
        }
    }

    @Test
    fun `archive is owner scoped`() {
        `when`(identity.sync(jwt)).thenReturn(parent)
        val profile = ScreeningChildProfile(id = UUID.randomUUID(), ownerUserId = parent.id)
        `when`(profiles.findByIdAndOwnerUserId(profile.id, parent.id)).thenReturn(profile)
        `when`(profiles.save(profile)).thenReturn(profile)

        val result = service.archive(jwt, profile.id)

        assertEquals(false, result.active)
        assertEquals(parent.id, profile.ownerUserId)
    }
}
