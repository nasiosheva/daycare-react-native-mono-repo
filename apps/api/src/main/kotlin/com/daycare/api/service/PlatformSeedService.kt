package com.daycare.api.service

import com.daycare.api.persistence.PlatformAdministrator
import com.daycare.api.persistence.PlatformAdministratorRepository
import com.daycare.api.persistence.UserProfile
import com.daycare.api.persistence.UserProfileRepository
import org.springframework.beans.factory.annotation.Value
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

enum class SeederName {
    PLATFORM_ADMIN,
}

@Service
class PlatformSeedService(
    private val users: UserProfileRepository,
    private val platformAdministrators: PlatformAdministratorRepository,
    private val identityProvisioner: EmailPasswordIdentityProvisioner,
    private val passwordEncoder: PasswordEncoder,
    @Value("\${daycare.local-seed-admin-email:}") private val email: String,
    @Value("\${daycare.local-seed-admin-username:admin}") private val username: String,
    @Value("\${daycare.local-seed-admin-display-name:}") private val displayName: String,
    @Value("\${daycare.local-seed-admin-password:}") private val password: String,
    @Value("\${daycare.local-auth-enabled:false}") private val localAuthEnabled: Boolean,
) {
    @Transactional
    fun run(name: SeederName) {
        when (name) {
            SeederName.PLATFORM_ADMIN -> seedPlatformAdmin()
        }
    }

    fun seedPlatformAdmin() {
        require(email.isNotBlank() && displayName.isNotBlank() && password.isNotBlank()) { "Platform admin seed properties are not configured" }
        val firebaseUid = if (localAuthEnabled) "local:$username" else identityProvisioner.findOrCreateEmailPasswordUser(email, displayName, password)
        val user = users.findByFirebaseUid(firebaseUid)
            ?: users.findByEmailIgnoreCase(email)
            ?: users.findByUsernameIgnoreCase(username)
            ?: UserProfile(firebaseUid = firebaseUid)
        user.firebaseUid = firebaseUid
        user.username = username
        user.email = email
        user.displayName = displayName
        if (localAuthEnabled && user.localPasswordHash == null) user.localPasswordHash = passwordEncoder.encode(password)
        val savedUser = users.save(user)

        if (!platformAdministrators.existsById(savedUser.id)) {
            platformAdministrators.save(PlatformAdministrator(userId = savedUser.id))
        }
    }
}
