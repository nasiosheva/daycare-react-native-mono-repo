package com.daycare.api.config

import com.daycare.api.service.AccessTokenRevocationService
import com.daycare.api.service.LocalJwtService
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.mockito.Mockito.mock
import org.springframework.security.crypto.password.PasswordEncoder
import java.util.Locale

class SecurityConfigTest {
    private val config = SecurityConfig()

    @Test
    fun `security beans expose local defaults and trimmed cors origins`() {
        val encoder: PasswordEncoder = config.passwordEncoder()
        assertTrue(encoder.matches("secret", encoder.encode("secret")))
        val resolver = config.localeResolver()
        assertEquals(Locale.of("id"), resolver.resolveLocale(org.springframework.mock.web.MockHttpServletRequest()))
        val source = config.corsConfigurationSource(" http://localhost:8081, ,https://example.test ")
        val cors = source.getCorsConfiguration(org.springframework.mock.web.MockHttpServletRequest("GET", "/api"))
        assertEquals(listOf("http://localhost:8081", "https://example.test"), cors?.allowedOrigins)
    }
}
