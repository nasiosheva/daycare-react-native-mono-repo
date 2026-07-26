package com.daycare.api.service

import com.daycare.api.persistence.UserProfile
import com.daycare.api.persistence.UserProfileRepository
import org.springframework.beans.factory.annotation.Value
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.stereotype.Service
import org.springframework.transaction.support.TransactionSynchronization
import org.springframework.transaction.support.TransactionSynchronizationManager
import java.util.Locale
import java.util.UUID

object TenantUserAccountError {
    const val DISPLAY_NAME_REQUIRED = "tenant_user.display_name_required"
    const val USERNAME_REQUIRED = "tenant_user.username_required"
    const val USERNAME_REGISTERED = "tenant_user.username_registered"
    const val EMAIL_REQUIRED = "tenant_user.email_required"
    const val PASSWORD_TOO_SHORT = "tenant_user.password_too_short"
    const val EMAIL_REGISTERED = "tenant_user.email_registered"
}

@Service
class TenantUserAccountService(
    private val users: UserProfileRepository,
    private val firebaseAdminIdentity: FirebaseAdminIdentityService,
    private val passwordEncoder: PasswordEncoder,
    @Value("\${daycare.local-auth-enabled:false}") private val localAuthEnabled: Boolean,
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

        val firebaseDisplayName = normalizedUsername ?: normalizedName
        val firebaseUid = if (localAuthEnabled) "local:${UUID.randomUUID()}" else firebaseAdminIdentity.createEmailPasswordUser(normalizedEmail, firebaseDisplayName, password)
        if (!localAuthEnabled) registerFirebaseRollback(firebaseUid)
        return users.save(UserProfile(
            firebaseUid = firebaseUid,
            email = normalizedEmail,
            displayName = normalizedName,
            username = normalizedUsername,
            localPasswordHash = if (localAuthEnabled) passwordEncoder.encode(password) else null,
        ))
    }

    fun changePassword(user: UserProfile, password: String) {
        require(password.length >= 6) { TenantUserAccountError.PASSWORD_TOO_SHORT }
        if (localAuthEnabled) user.localPasswordHash = passwordEncoder.encode(password)
        else firebaseAdminIdentity.updatePassword(user.firebaseUid, password)
    }

    private fun registerFirebaseRollback(firebaseUid: String) {
        if (!TransactionSynchronizationManager.isSynchronizationActive()) return
        TransactionSynchronizationManager.registerSynchronization(object : TransactionSynchronization {
            override fun afterCompletion(status: Int) {
                if (status == TransactionSynchronization.STATUS_ROLLED_BACK) firebaseAdminIdentity.deleteUser(firebaseUid)
            }
        })
    }
}
