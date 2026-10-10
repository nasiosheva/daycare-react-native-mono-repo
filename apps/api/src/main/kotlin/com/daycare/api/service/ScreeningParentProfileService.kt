package com.daycare.api.service

import com.daycare.api.persistence.ScreeningChildProfile
import com.daycare.api.persistence.ScreeningChildProfileRepository
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Instant
import java.time.LocalDate
import java.util.UUID

data class ScreeningChildProfileRequest(
    val subjectName: String,
    val dateOfBirth: LocalDate,
    val prematureBirth: Boolean? = null,
)

data class ScreeningChildProfileResponse(
    val id: UUID,
    val subjectName: String,
    val dateOfBirth: LocalDate,
    val prematureBirth: Boolean?,
    val active: Boolean,
    val createdAt: Instant,
    val updatedAt: Instant,
)

/**
 * Parent-owned screening profiles are intentionally account-level records.
 * This service does not accept a tenant or child ID and therefore cannot
 * accidentally turn a global profile into a tenant-visible child record.
 */
@Service
class ScreeningParentProfileService(
    private val identity: IdentityService,
    private val profiles: ScreeningChildProfileRepository,
) {
    @Transactional(readOnly = true)
    fun mine(jwt: Jwt): List<ScreeningChildProfileResponse> {
        val parent = requireRegisteredParent(identity.sync(jwt))
        return profiles.findAllByOwnerUserIdAndActiveTrueOrderByCreatedAtDesc(parent.id).map { it.toResponse() }
    }

    @Transactional
    fun create(jwt: Jwt, request: ScreeningChildProfileRequest): ScreeningChildProfileResponse {
        val parent = requireRegisteredParent(identity.sync(jwt))
        val now = Instant.now()
        return profiles.save(
            ScreeningChildProfile(
                ownerUserId = parent.id,
                subjectName = normalizedName(request.subjectName),
                dateOfBirth = validDateOfBirth(request.dateOfBirth),
                prematureBirth = request.prematureBirth,
                createdAt = now,
                updatedAt = now,
            ),
        ).toResponse()
    }

    @Transactional
    fun update(jwt: Jwt, profileId: UUID, request: ScreeningChildProfileRequest): ScreeningChildProfileResponse {
        val parent = requireRegisteredParent(identity.sync(jwt))
        val profile = profiles.findByIdAndOwnerUserId(profileId, parent.id)
            ?: throw IllegalArgumentException("Screening profile was not found")
        check(profile.active) { "Archived screening profile cannot be edited" }
        profile.subjectName = normalizedName(request.subjectName)
        profile.dateOfBirth = validDateOfBirth(request.dateOfBirth)
        profile.prematureBirth = request.prematureBirth
        profile.updatedAt = Instant.now()
        return profiles.save(profile).toResponse()
    }

    @Transactional
    fun archive(jwt: Jwt, profileId: UUID): ScreeningChildProfileResponse {
        val parent = requireRegisteredParent(identity.sync(jwt))
        val profile = profiles.findByIdAndOwnerUserId(profileId, parent.id)
            ?: throw IllegalArgumentException("Screening profile was not found")
        if (profile.active) {
            profile.active = false
            profile.archivedAt = Instant.now()
            profile.updatedAt = Instant.now()
            profiles.save(profile)
        }
        return profile.toResponse()
    }

    private fun normalizedName(value: String): String = value.trim().also {
        require(it.isNotBlank()) { "Screening profile name is required" }
        require(it.length <= 160) { "Screening profile name is too long" }
    }

    private fun validDateOfBirth(value: LocalDate): LocalDate = value.also {
        require(!it.isAfter(LocalDate.now())) { "Screening profile date of birth cannot be in the future" }
    }
}

private fun ScreeningChildProfile.toResponse() = ScreeningChildProfileResponse(
    id = id,
    subjectName = subjectName,
    dateOfBirth = dateOfBirth,
    prematureBirth = prematureBirth,
    active = active,
    createdAt = createdAt,
    updatedAt = updatedAt,
)
