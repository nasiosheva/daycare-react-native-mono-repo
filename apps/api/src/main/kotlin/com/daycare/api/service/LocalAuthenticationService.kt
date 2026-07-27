package com.daycare.api.service

import com.daycare.api.domain.RegistrationRole
import com.daycare.api.persistence.UserProfile
import com.daycare.api.persistence.UserProfileRepository
import com.nimbusds.jose.JWSAlgorithm
import com.nimbusds.jose.JWSHeader
import com.nimbusds.jose.crypto.MACSigner
import com.nimbusds.jwt.JWTClaimsSet
import com.nimbusds.jwt.SignedJWT
import org.springframework.beans.factory.annotation.Value
import org.springframework.security.oauth2.jose.jws.MacAlgorithm
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.security.oauth2.jwt.JwtDecoder
import org.springframework.security.oauth2.jwt.JwtValidators
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.nio.charset.StandardCharsets
import java.time.Duration
import java.time.Instant
import java.util.UUID
import java.util.Date
import javax.crypto.spec.SecretKeySpec

const val LOCAL_TOKEN_ISSUER = "daycare-local"
private const val localTokenLifetimeHours = 12L

data class LocalLoginResponse(val token: String, val user: LocalAuthenticatedUser)
data class LocalAuthenticatedUser(val uid: String, val email: String?, val displayName: String)

object LocalAuthenticationError {
    const val INVALID_CREDENTIALS = "local.invalid_credentials"
    const val DISPLAY_NAME_REQUIRED = "local.display_name_required"
    const val EMAIL_REQUIRED = "local.email_required"
    const val PASSWORD_TOO_SHORT = "local.password_too_short"
    const val EMAIL_REGISTERED = "local.email_registered"
    const val USER_NOT_FOUND = "local.user_not_found"
    const val JWT_SECRET_TOO_SHORT = "local.jwt_secret_too_short"
    const val VERIFIED_EMAIL_MISMATCH = "local.verified_email_mismatch"
    const val PHONE_REGISTERED = "local.phone_registered"
}

class InvalidLocalCredentialsException : RuntimeException(LocalAuthenticationError.INVALID_CREDENTIALS)

@Service
class LocalJwtService(@Value("\${daycare.local-auth-jwt-secret}") secret: String) {
    private val secretBytes = secret.toByteArray(StandardCharsets.UTF_8).also {
        require(it.size >= 32) { LocalAuthenticationError.JWT_SECRET_TOO_SHORT }
    }
    private val key = SecretKeySpec(secretBytes, "HmacSHA256")

    fun issue(user: UserProfile): String {
        val now = Instant.now()
        val claims = JWTClaimsSet.Builder()
            .issuer(LOCAL_TOKEN_ISSUER)
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
        .apply { setJwtValidator(JwtValidators.createDefaultWithIssuer(LOCAL_TOKEN_ISSUER)) }
}

@Service
class LocalAuthenticationService(
    private val users: UserProfileRepository,
    private val passwordEncoder: PasswordEncoder,
    private val localJwt: LocalJwtService,
) {
    @Transactional
    fun register(displayName: String, email: String, password: String, verifiedIdentity: Jwt? = null): LocalLoginResponse {
        val normalizedEmail = email.trim().lowercase()
        val verifiedEmail = verifiedIdentity?.getClaimAsString("email")?.trim()?.lowercase()
        val verifiedPhoneNumber = verifiedIdentity?.getClaimAsString("phone_number")?.trim()?.ifBlank { null }
        require(displayName.trim().isNotBlank()) { LocalAuthenticationError.DISPLAY_NAME_REQUIRED }
        require(normalizedEmail.contains("@")) { LocalAuthenticationError.EMAIL_REQUIRED }
        require(password.length >= 6) { LocalAuthenticationError.PASSWORD_TOO_SHORT }
        require(verifiedEmail == null || verifiedEmail == normalizedEmail) { LocalAuthenticationError.VERIFIED_EMAIL_MISMATCH }
        require(users.findByEmailIgnoreCase(normalizedEmail) == null) { LocalAuthenticationError.EMAIL_REGISTERED }
        require(verifiedPhoneNumber == null || users.findByPhoneNumber(verifiedPhoneNumber) == null) { LocalAuthenticationError.PHONE_REGISTERED }
        val user = users.save(UserProfile(firebaseUid = "local:${UUID.randomUUID()}", displayName = displayName.trim(), email = normalizedEmail, phoneNumber = verifiedPhoneNumber, registrationRole = RegistrationRole.PARENT, localPasswordHash = passwordEncoder.encode(password)))
        return LocalLoginResponse(localJwt.issue(user), LocalAuthenticatedUser(user.firebaseUid, user.email, user.displayName))
    }
    @Transactional(readOnly = true)
    fun login(identifier: String, password: String): LocalLoginResponse {
        val normalizedIdentifier = identifier.trim()
        val user = if (normalizedIdentifier.contains("@")) users.findByEmailIgnoreCase(normalizedIdentifier) else users.findByUsernameIgnoreCase(normalizedIdentifier)
        if (user?.localPasswordHash == null || !passwordEncoder.matches(password, user.localPasswordHash)) throw InvalidLocalCredentialsException()
        return LocalLoginResponse(localJwt.issue(user), LocalAuthenticatedUser(user.firebaseUid, user.email, user.displayName))
    }

    @Transactional
    fun changePassword(firebaseUid: String, password: String) {
        require(password.length >= 6) { LocalAuthenticationError.PASSWORD_TOO_SHORT }
        val user = users.findByFirebaseUid(firebaseUid) ?: throw IllegalArgumentException(LocalAuthenticationError.USER_NOT_FOUND)
        user.localPasswordHash = passwordEncoder.encode(password)
    }

    @Transactional
    fun updateDisplayName(firebaseUid: String, displayName: String): LocalAuthenticatedUser {
        val normalizedName = displayName.trim()
        require(normalizedName.isNotBlank()) { LocalAuthenticationError.DISPLAY_NAME_REQUIRED }
        val user = users.findByFirebaseUid(firebaseUid) ?: throw IllegalArgumentException(LocalAuthenticationError.USER_NOT_FOUND)
        user.displayName = normalizedName
        return LocalAuthenticatedUser(user.firebaseUid, user.email, user.displayName)
    }
}
