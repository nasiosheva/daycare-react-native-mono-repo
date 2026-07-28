package com.daycare.api.service

import com.daycare.api.domain.ParentIncomeRange
import com.daycare.api.domain.ParentOccupation
import com.daycare.api.domain.RegistrationRole
import com.daycare.api.persistence.ParentFamilyProfile
import com.daycare.api.persistence.ParentFamilyProfileRepository
import com.daycare.api.persistence.UserProfile
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Test
import org.mockito.Mockito.mock
import org.mockito.Mockito.`when`
import org.springframework.security.access.AccessDeniedException
import org.springframework.security.oauth2.jwt.Jwt
import java.time.LocalDate
import java.util.UUID

class ParentFamilyProfileServiceTest {
    private val identity = mock(IdentityService::class.java)
    private val profiles = mock(ParentFamilyProfileRepository::class.java)
    private val service = ParentFamilyProfileService(identity, profiles)
    private val jwt = mock(Jwt::class.java)

    @Test
    fun `Parent upserts optional family profile details`() {
        val parent = UserProfile(registrationRole = RegistrationRole.PARENT)
        `when`(identity.sync(jwt)).thenReturn(parent)
        `when`(profiles.findByUserId(parent.id)).thenReturn(null)
        `when`(profiles.save(org.mockito.ArgumentMatchers.any(ParentFamilyProfile::class.java))).thenAnswer { it.arguments[0] }

        val response = service.update(jwt, UpdateParentFamilyProfileRequest(
            husbandDateOfBirth = LocalDate.of(1989, 4, 2),
            husbandOccupation = ParentOccupation.PNS,
            husbandIncomeRange = ParentIncomeRange.THREE_TO_FIVE_MILLION,
        ))

        assertEquals(LocalDate.of(1989, 4, 2), response.husbandDateOfBirth)
        assertEquals(ParentOccupation.PNS, response.husbandOccupation)
        assertEquals(ParentIncomeRange.THREE_TO_FIVE_MILLION, response.husbandIncomeRange)
        assertEquals(null, response.wifeOccupation)
    }

    @Test
    fun `non Parent account cannot access family profile`() {
        `when`(identity.sync(jwt)).thenReturn(UserProfile(registrationRole = null))

        assertThrows(AccessDeniedException::class.java) { service.mine(jwt) }
    }

    @Test
    fun `future family birth date is rejected`() {
        val parent = UserProfile(registrationRole = RegistrationRole.PARENT, id = UUID.randomUUID())
        `when`(identity.sync(jwt)).thenReturn(parent)

        val error = assertThrows(IllegalArgumentException::class.java) {
            service.update(jwt, UpdateParentFamilyProfileRequest(wifeDateOfBirth = LocalDate.now().plusDays(1)))
        }

        assertEquals("Date of birth cannot be in the future", error.message)
    }
}
