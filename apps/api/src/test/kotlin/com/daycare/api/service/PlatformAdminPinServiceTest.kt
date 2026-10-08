package com.daycare.api.service

import com.daycare.api.persistence.PlatformAdministrator
import com.daycare.api.persistence.PlatformAdministratorRepository
import com.daycare.api.persistence.UserProfile
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Test
import org.mockito.Mockito.mock
import org.mockito.Mockito.`when`
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.security.oauth2.jwt.Jwt
import java.util.Optional

class PlatformAdminPinServiceTest {
    @Test
    fun `changing platform pin stores encoded value and timestamp`() {
        val platformAccess = mock(PlatformAccessService::class.java)
        val administrators = mock(PlatformAdministratorRepository::class.java)
        val encoder = mock(PasswordEncoder::class.java)
        val jwt = mock(Jwt::class.java)
        val user = UserProfile()
        val administrator = PlatformAdministrator(userId = user.id)
        `when`(platformAccess.requirePlatformAdmin(jwt)).thenReturn(user)
        `when`(administrators.findById(user.id)).thenReturn(Optional.of(administrator))
        `when`(encoder.encode("123456")).thenReturn("hash")
        PlatformAdminPinService(platformAccess, administrators, encoder).changePin(jwt, ChangePlatformAdminPinRequest("123456"))
        assertEquals("hash", administrator.pinHash)
        assertNotNull(administrator.pinChangedAt)
    }
}
