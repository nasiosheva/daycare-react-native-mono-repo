package com.daycare.api.service

import com.daycare.api.persistence.UserProfileRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

data class LoginIdentifierResponse(val email: String?)

@Service
class LoginIdentifierService(private val users: UserProfileRepository) {
    @Transactional(readOnly = true)
    fun resolveUsername(username: String): LoginIdentifierResponse =
        LoginIdentifierResponse(users.findByUsernameIgnoreCase(username.trim())?.email)
}
