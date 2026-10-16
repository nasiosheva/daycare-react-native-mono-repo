// Mories Deo Hutapea,S.E.,S.Kom
package com.daycare.api.config

import com.daycare.api.persistence.UserProfile
import com.daycare.api.service.AccessTokenRevocationService
import com.daycare.api.service.LocalJwtService
import com.nimbusds.jose.JWSAlgorithm
import com.nimbusds.jose.JWSHeader
import com.nimbusds.jose.crypto.MACSigner
import com.nimbusds.jwt.JWTClaimsSet
import com.nimbusds.jwt.SignedJWT
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.mockito.MockedStatic
import org.mockito.Mockito
import org.mockito.Mockito.mock
import org.mockito.stubbing.OngoingStubbing
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.security.oauth2.jwt.JwtDecoder
import org.springframework.security.oauth2.jwt.JwtDecoders
import java.util.Date
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

    @Test
    fun `local jwt decoder does not require Firebase discovery during startup`() {
        val localJwt = LocalJwtService("01234567890123456789012345678901")
        val token = localJwt.issue(UserProfile(firebaseUid = "local:integration"))
        val decoder = config.jwtDecoder(localJwt, mock(AccessTokenRevocationService::class.java), "https://issuer.invalid")

        assertEquals("local:integration", decoder.decode(token).subject)
    }

    @Test
    fun `Firebase issuer decoder is loaded on first Firebase token`() {
        val issuer = "https://firebase.example.test/issuer"
        val firebaseDecoder = mock(JwtDecoder::class.java)
        val token = SignedJWT(
            JWSHeader(JWSAlgorithm.HS256),
            JWTClaimsSet.Builder().issuer(issuer).subject("firebase-user").issueTime(Date()).build(),
        ).apply { sign(MACSigner("01234567890123456789012345678901")) }.serialize()
        val expected = Jwt.withTokenValue(token)
            .header("alg", "HS256")
            .claim("iss", issuer)
            .subject("firebase-user")
            .build()

        Mockito.mockStatic(JwtDecoders::class.java).use { decoders ->
            val issuerLookup = object : MockedStatic.Verification {
                override fun apply() {
                    val ignored: JwtDecoder = JwtDecoders.fromIssuerLocation(issuer)
                }
            }
            val stub: OngoingStubbing<JwtDecoder> = decoders.`when`(issuerLookup)
            stub.thenReturn(firebaseDecoder)
            Mockito.`when`(firebaseDecoder.decode(token)).thenReturn(expected)

            val decoder = config.jwtDecoder(LocalJwtService("01234567890123456789012345678901"), mock(AccessTokenRevocationService::class.java), issuer)
            decoders.verifyNoInteractions()

            assertEquals("firebase-user", decoder.decode(token).subject)
            Mockito.verify(firebaseDecoder).decode(token)
        }
    }

}
