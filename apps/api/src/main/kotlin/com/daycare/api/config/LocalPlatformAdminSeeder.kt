package com.daycare.api.config

import com.daycare.api.service.EmailPasswordIdentityProvisioner
import com.daycare.api.persistence.PlatformAdministrator
import com.daycare.api.persistence.PlatformAdministratorRepository
import com.daycare.api.persistence.UserProfile
import com.daycare.api.persistence.UserProfileRepository
import org.springframework.beans.factory.annotation.Value
import org.springframework.boot.ApplicationArguments
import org.springframework.boot.ApplicationRunner
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.context.annotation.Profile
import org.springframework.core.annotation.Order
import org.springframework.stereotype.Component
import org.springframework.transaction.annotation.Transactional

@Component
@Profile("default")
@Order(0)
@ConditionalOnProperty(prefix = "daycare", name = ["local-seed-enabled"], havingValue = "true", matchIfMissing = true)
class LocalPlatformAdminSeeder(
    private val users: UserProfileRepository,
    private val platformAdministrators: PlatformAdministratorRepository,
    private val identityProvisioner: EmailPasswordIdentityProvisioner,
    private val passwordEncoder: org.springframework.security.crypto.password.PasswordEncoder,
    @Value("\${daycare.local-seed-admin-email}") private val email: String,
    @Value("\${daycare.local-seed-admin-username:admin}") private val username: String,
    @Value("\${daycare.local-seed-admin-display-name}") private val displayName: String,
    @Value("\${daycare.local-seed-admin-password}") private val password: String,
    @Value("\${daycare.local-auth-enabled:false}") private val localAuthEnabled: Boolean,
) : ApplicationRunner {
    @Transactional
    override fun run(args: ApplicationArguments) {
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
