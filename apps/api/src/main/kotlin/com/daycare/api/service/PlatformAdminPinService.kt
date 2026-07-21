package com.daycare.api.service

import com.daycare.api.persistence.PlatformAdministratorRepository
import jakarta.validation.constraints.Pattern
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Instant

data class ChangePlatformAdminPinRequest(@field:Pattern(regexp = "\\d{6}", message = "PIN must contain exactly six digits") val pin: String)

@Service
class PlatformAdminPinService(
    private val platformAccess: PlatformAccessService,
    private val administrators: PlatformAdministratorRepository,
    private val passwordEncoder: PasswordEncoder,
) {
    @Transactional
    fun changePin(jwt: Jwt, request: ChangePlatformAdminPinRequest) {
        val user = platformAccess.requirePlatformAdmin(jwt)
        val administrator = administrators.findById(user.id).orElseThrow { IllegalStateException("Platform administrator record was not found") }
        administrator.pinHash = passwordEncoder.encode(request.pin)
        administrator.pinChangedAt = Instant.now()
    }
}
