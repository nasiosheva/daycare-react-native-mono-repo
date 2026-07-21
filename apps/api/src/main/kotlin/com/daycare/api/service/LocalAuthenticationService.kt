package com.daycare.api.service

import com.daycare.api.persistence.UserProfile
import com.daycare.api.persistence.UserProfileRepository
import com.nimbusds.jose.JWSAlgorithm
import com.nimbusds.jose.JWSHeader
import com.nimbusds.jose.crypto.MACSigner
import com.nimbusds.jwt.JWTClaimsSet
import com.nimbusds.jwt.SignedJWT
import org.springframework.beans.factory.annotation.Value
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.security.oauth2.jose.jws.MacAlgorithm
import org.springframework.security.oauth2.jwt.JwtDecoder
import org.springframework.security.oauth2.jwt.JwtValidators
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.nio.charset.StandardCharsets
import java.time.Duration
import java.time.Instant
import java.util.Date
import javax.crypto.spec.SecretKeySpec

private const val localTokenIssuer = "daycare-local"
private const val localTokenLifetimeHours = 12L

data class LocalLoginResponse(val token: String, val user: LocalAuthenticatedUser)
data class LocalAuthenticatedUser(val uid: String, val email: String?, val displayName: String)
class InvalidLocalCredentialsException : RuntimeException()

@Service
@ConditionalOnProperty(prefix = "daycare", name = ["local-auth-enabled"], havingValue = "true")
class LocalJwtService(@Value("\${daycare.local-auth-jwt-secret}") secret: String) {
    private val secretBytes = secret.toByteArray(StandardCharsets.UTF_8).also {
        require(it.size >= 32) { "LOCAL_AUTH_JWT_SECRET must be at least 32 bytes" }
    }
    private val key = SecretKeySpec(secretBytes, "HmacSHA256")

    fun issue(user: UserProfile): String {
        val now = Instant.now()
        val claims = JWTClaimsSet.Builder()
            .issuer(localTokenIssuer)
            .subject(user.firebaseUid)
            .issueTime(Date.from(now))
            .expirationTime(Date.from(now.plus(Duration.ofHours(localTokenLifetimeHours))))
            .claim("email", user.email)
            .claim("name", user.displayName)
            .build()
        return SignedJWT(JWSHeader(JWSAlgorithm.HS256), claims).apply { sign(MACSigner(secretBytes)) }.serialize()
    }

    fun decoder(): JwtDecoder = NimbusJwtDecoder.withSecretKey(key)
        .macAlgorithm(MacAlgorithm.HS256)
        .build()
        .apply { setJwtValidator(JwtValidators.createDefaultWithIssuer(localTokenIssuer)) }
}

@Service
@ConditionalOnProperty(prefix = "daycare", name = ["local-auth-enabled"], havingValue = "true")
class LocalAuthenticationService(
    private val users: UserProfileRepository,
    private val passwordEncoder: PasswordEncoder,
    private val localJwt: LocalJwtService,
) {
    @Transactional(readOnly = true)
    fun login(identifier: String, password: String): LocalLoginResponse {
        val normalizedIdentifier = identifier.trim()
        val user = if (normalizedIdentifier.contains("@")) users.findByEmailIgnoreCase(normalizedIdentifier) else users.findByUsernameIgnoreCase(normalizedIdentifier)
        if (user?.localPasswordHash == null || !passwordEncoder.matches(password, user.localPasswordHash)) throw InvalidLocalCredentialsException()
        return LocalLoginResponse(localJwt.issue(user), LocalAuthenticatedUser(user.firebaseUid, user.email, user.displayName))
    }

    @Transactional
    fun changePassword(firebaseUid: String, password: String) {
        require(password.length >= 6) { "Password must contain at least 6 characters" }
        val user = users.findByFirebaseUid(firebaseUid) ?: throw IllegalArgumentException("Local user was not found")
        user.localPasswordHash = passwordEncoder.encode(password)
    }

    @Transactional
    fun updateDisplayName(firebaseUid: String, displayName: String): LocalAuthenticatedUser {
        val normalizedName = displayName.trim()
        require(normalizedName.isNotBlank()) { "Display name is required" }
        val user = users.findByFirebaseUid(firebaseUid) ?: throw IllegalArgumentException("Local user was not found")
        user.displayName = normalizedName
        return LocalAuthenticatedUser(user.firebaseUid, user.email, user.displayName)
    }
}
