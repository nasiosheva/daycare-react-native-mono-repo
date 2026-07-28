package com.daycare.api.service

import com.daycare.api.domain.ParentIncomeRange
import com.daycare.api.domain.ParentOccupation
import com.daycare.api.domain.RegistrationRole
import com.daycare.api.persistence.ParentFamilyProfile
import com.daycare.api.persistence.ParentFamilyProfileRepository
import jakarta.validation.constraints.PastOrPresent
import org.springframework.security.access.AccessDeniedException
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Instant
import java.time.LocalDate

data class UpdateParentFamilyProfileRequest(
    @field:PastOrPresent val husbandDateOfBirth: LocalDate? = null,
    val husbandOccupation: ParentOccupation? = null,
    val husbandIncomeRange: ParentIncomeRange? = null,
    @field:PastOrPresent val wifeDateOfBirth: LocalDate? = null,
    val wifeOccupation: ParentOccupation? = null,
    val wifeIncomeRange: ParentIncomeRange? = null,
)

data class ParentFamilyProfileResponse(
    val husbandDateOfBirth: LocalDate?,
    val husbandOccupation: ParentOccupation?,
    val husbandIncomeRange: ParentIncomeRange?,
    val wifeDateOfBirth: LocalDate?,
    val wifeOccupation: ParentOccupation?,
    val wifeIncomeRange: ParentIncomeRange?,
)

@Service
class ParentFamilyProfileService(
    private val identity: IdentityService,
    private val profiles: ParentFamilyProfileRepository,
) {
    @Transactional(readOnly = true)
    fun mine(jwt: Jwt): ParentFamilyProfileResponse? {
        val user = requireParent(jwt)
        return profiles.findByUserId(user.id)?.toResponse()
    }

    @Transactional
    fun update(jwt: Jwt, request: UpdateParentFamilyProfileRequest): ParentFamilyProfileResponse {
        val user = requireParent(jwt)
        requireDateIsNotFuture(request.husbandDateOfBirth)
        requireDateIsNotFuture(request.wifeDateOfBirth)
        val profile = profiles.findByUserId(user.id) ?: ParentFamilyProfile(userId = user.id)
        profile.husbandDateOfBirth = request.husbandDateOfBirth
        profile.husbandOccupation = request.husbandOccupation
        profile.husbandIncomeRange = request.husbandIncomeRange
        profile.wifeDateOfBirth = request.wifeDateOfBirth
        profile.wifeOccupation = request.wifeOccupation
        profile.wifeIncomeRange = request.wifeIncomeRange
        profile.updatedAt = Instant.now()
        return profiles.save(profile).toResponse()
    }

    private fun requireParent(jwt: Jwt) = identity.sync(jwt).also { user ->
        if (user.registrationRole != RegistrationRole.PARENT) throw AccessDeniedException("Parent family profile is only available to Parent accounts")
    }

    private fun requireDateIsNotFuture(value: LocalDate?) {
        require(value == null || !value.isAfter(LocalDate.now())) { "Date of birth cannot be in the future" }
    }
}

fun ParentFamilyProfile.toResponse() = ParentFamilyProfileResponse(husbandDateOfBirth, husbandOccupation, husbandIncomeRange, wifeDateOfBirth, wifeOccupation, wifeIncomeRange)
