package com.daycare.api.config

import com.daycare.api.persistence.PlatformAdministrator
import com.daycare.api.persistence.PlatformAdministratorRepository
import com.daycare.api.persistence.UserProfile
import com.daycare.api.persistence.UserProfileRepository
import org.springframework.beans.factory.annotation.Value
import org.springframework.boot.ApplicationArguments
import org.springframework.boot.ApplicationRunner
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.context.annotation.Profile
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.stereotype.Component
import org.springframework.transaction.annotation.Transactional

// Requires profile "local" AND both flags below — none of these can be true by
// accident in production, and this never touches Firebase (local-auth only).
@Component
@Profile("local")
@ConditionalOnProperty(prefix = "daycare", name = ["local-seed-enabled", "local-auth-enabled"], havingValue = "true")
class LocalPlatformAdminSeeder(
    private val users: UserProfileRepository,
    private val platformAdministrators: PlatformAdministratorRepository,
    private val passwordEncoder: PasswordEncoder,
    @Value("\${daycare.local-seed-admin-email:admin@local.test}") private val email: String,
    @Value("\${daycare.local-seed-admin-username:admin}") private val username: String,
    @Value("\${daycare.local-seed-admin-display-name:Local Admin}") private val displayName: String,
    @Value("\${daycare.local-seed-admin-password:admin@local.test}") private val password: String,
) : ApplicationRunner {
    @Transactional
    override fun run(args: ApplicationArguments) {
        val firebaseUid = "local:$username"
        val user = users.findByFirebaseUid(firebaseUid)
            ?: users.findByEmailIgnoreCase(email)
            ?: users.findByUsernameIgnoreCase(username)
            ?: UserProfile(firebaseUid = firebaseUid)
        user.firebaseUid = firebaseUid
        user.username = username
        user.email = email
        user.displayName = displayName
        if (user.localPasswordHash == null || !passwordEncoder.matches(password, user.localPasswordHash)) {
            user.localPasswordHash = passwordEncoder.encode(password)
        }
        val savedUser = users.save(user)
        if (!platformAdministrators.existsById(savedUser.id)) {
            platformAdministrators.save(PlatformAdministrator(userId = savedUser.id))
        }
    }
}
