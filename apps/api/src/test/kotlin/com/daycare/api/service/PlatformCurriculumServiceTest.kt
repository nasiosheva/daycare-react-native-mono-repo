package com.daycare.api.service

import com.daycare.api.persistence.CurriculumProgramDevelopmentProgramRepository
import com.daycare.api.persistence.CurriculumProgramRepository
import com.daycare.api.persistence.DevelopmentProgramRepository
import com.daycare.api.persistence.UserProfile
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Test
import org.mockito.Mockito.mock
import org.mockito.Mockito.never
import org.mockito.Mockito.verify
import org.mockito.Mockito.`when`
import org.springframework.security.access.AccessDeniedException
import org.springframework.security.oauth2.jwt.Jwt

class PlatformCurriculumServiceTest {
    @Test
    fun `seeding the global curriculum requires a Platform Admin and delegates to the seeding service`() {
        val platformAccess = mock(PlatformAccessService::class.java)
        val seeding = mock(GlobalCurriculumSeedingService::class.java)
        val service = PlatformCurriculumService(platformAccess, mock(CurriculumProgramRepository::class.java), mock(CurriculumProgramDevelopmentProgramRepository::class.java), mock(DevelopmentProgramRepository::class.java), seeding)
        val jwt = mock(Jwt::class.java)
        val result = GlobalCurriculumSeedResult(alreadySeeded = false, learningLevelCount = 4, developmentProgramCount = 24, developmentProgramItemCount = 138, curriculumProgramCount = 4)
        `when`(platformAccess.requirePlatformAdmin(jwt)).thenReturn(UserProfile())
        `when`(seeding.seed()).thenReturn(result)

        val response = service.seedGlobalCurriculum(jwt)

        assertEquals(result, response)
        verify(platformAccess).requirePlatformAdmin(jwt)
    }

    @Test
    fun `seeding the global curriculum is refused for a non Platform Admin`() {
        val platformAccess = mock(PlatformAccessService::class.java)
        val seeding = mock(GlobalCurriculumSeedingService::class.java)
        val service = PlatformCurriculumService(platformAccess, mock(CurriculumProgramRepository::class.java), mock(CurriculumProgramDevelopmentProgramRepository::class.java), mock(DevelopmentProgramRepository::class.java), seeding)
        val jwt = mock(Jwt::class.java)
        `when`(platformAccess.requirePlatformAdmin(jwt)).thenThrow(AccessDeniedException("Platform administrator access is required"))

        assertThrows(AccessDeniedException::class.java) { service.seedGlobalCurriculum(jwt) }

        verify(seeding, never()).seed()
    }
}
