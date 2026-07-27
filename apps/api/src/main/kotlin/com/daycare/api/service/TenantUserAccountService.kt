package com.daycare.api.service

import com.daycare.api.persistence.UserProfile
import com.daycare.api.persistence.UserProfileRepository
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.stereotype.Service
import java.util.Locale
import java.util.UUID

object TenantUserAccountError {
    const val DISPLAY_NAME_REQUIRED = "tenant_user.display_name_required"
    const val USERNAME_REQUIRED = "tenant_user.username_required"
    const val USERNAME_REGISTERED = "tenant_user.username_registered"
    const val EMAIL_REQUIRED = "tenant_user.email_required"
    const val PASSWORD_TOO_SHORT = "tenant_user.password_too_short"
    const val EMAIL_REGISTERED = "tenant_user.email_registered"
    const val STAFF_EDIT_NOT_ALLOWED = "tenant_user.staff_edit_not_allowed"
}

@Service
class TenantUserAccountService(
    private val users: UserProfileRepository,
    private val passwordEncoder: PasswordEncoder,
) {
    fun create(displayName: String, email: String, password: String, username: String? = null): UserProfile {
        val normalizedName = displayName.trim()
        val normalizedUsername = username?.trim()?.takeIf(String::isNotBlank)
        val normalizedEmail = email.trim().lowercase(Locale.ROOT)
        require(normalizedName.isNotBlank()) { TenantUserAccountError.DISPLAY_NAME_REQUIRED }
        require(username == null || normalizedUsername != null) { TenantUserAccountError.USERNAME_REQUIRED }
        require(normalizedEmail.contains("@")) { TenantUserAccountError.EMAIL_REQUIRED }
        require(password.length >= 6) { TenantUserAccountError.PASSWORD_TOO_SHORT }
        require(users.findByEmailIgnoreCase(normalizedEmail) == null) { TenantUserAccountError.EMAIL_REGISTERED }
        normalizedUsername?.let { require(users.findByUsernameIgnoreCase(it) == null) { TenantUserAccountError.USERNAME_REGISTERED } }

        return users.save(UserProfile(
            firebaseUid = "local:${UUID.randomUUID()}",
            email = normalizedEmail,
            displayName = normalizedName,
            username = normalizedUsername,
            localPasswordHash = passwordEncoder.encode(password),
        ))
    }

    fun changePassword(user: UserProfile, password: String) {
        require(password.length >= 6) { TenantUserAccountError.PASSWORD_TOO_SHORT }
        user.localPasswordHash = passwordEncoder.encode(password)
    }

    fun update(user: UserProfile, displayName: String, email: String, username: String?) {
        val normalizedName = displayName.trim()
        val normalizedUsername = username?.trim()?.takeIf(String::isNotBlank)
        val normalizedEmail = email.trim().lowercase(Locale.ROOT)
        require(normalizedName.isNotBlank()) { TenantUserAccountError.DISPLAY_NAME_REQUIRED }
        require(normalizedEmail.contains("@")) { TenantUserAccountError.EMAIL_REQUIRED }
        val emailOwner = users.findByEmailIgnoreCase(normalizedEmail)
        require(emailOwner == null || emailOwner.id == user.id) { TenantUserAccountError.EMAIL_REGISTERED }
        normalizedUsername?.let { normalized ->
            val usernameOwner = users.findByUsernameIgnoreCase(normalized)
            require(usernameOwner == null || usernameOwner.id == user.id) { TenantUserAccountError.USERNAME_REGISTERED }
        }
        user.displayName = normalizedName
        user.email = normalizedEmail
        user.username = normalizedUsername
    }
}
