package com.daycare.api.service

import com.daycare.api.persistence.UserProfile
import com.daycare.api.persistence.UserProfileRepository
import org.springframework.beans.factory.annotation.Value
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.stereotype.Service
import org.springframework.transaction.support.TransactionSynchronization
import org.springframework.transaction.support.TransactionSynchronizationManager
import java.util.UUID

@Service
class TenantUserAccountService(
    private val users: UserProfileRepository,
    private val firebaseAdminIdentity: FirebaseAdminIdentityService,
    private val passwordEncoder: PasswordEncoder,
    @Value("\${daycare.local-auth-enabled:false}") private val localAuthEnabled: Boolean,
) {
    fun create(displayName: String, email: String, password: String): UserProfile {
        val normalizedName = displayName.trim()
        val normalizedEmail = email.trim().lowercase()
        require(users.findByEmailIgnoreCase(normalizedEmail) == null) { "Email is already registered" }

        val firebaseUid = if (localAuthEnabled) "local:${UUID.randomUUID()}" else firebaseAdminIdentity.createEmailPasswordUser(normalizedEmail, normalizedName, password)
        if (!localAuthEnabled) registerFirebaseRollback(firebaseUid)
        return users.save(UserProfile(
            firebaseUid = firebaseUid,
            email = normalizedEmail,
            displayName = normalizedName,
            localPasswordHash = if (localAuthEnabled) passwordEncoder.encode(password) else null,
        ))
    }

    fun changePassword(user: UserProfile, password: String) {
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
