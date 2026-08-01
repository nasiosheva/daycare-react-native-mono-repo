package com.daycare.api.service

import com.daycare.api.persistence.CurriculumProgramDevelopmentProgramRepository
import com.daycare.api.persistence.CurriculumProgramRepository
import com.daycare.api.persistence.DevelopmentProgramRepository
import com.daycare.api.persistence.LearningLevel
import com.daycare.api.persistence.LearningLevelCurriculumProgram
import com.daycare.api.persistence.LearningLevelCurriculumProgramRepository
import com.daycare.api.persistence.LearningLevelRepository
import com.daycare.api.persistence.UserProfile
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Test
import org.mockito.ArgumentMatchers.any
import org.mockito.Mockito.mock
import org.mockito.Mockito.never
import org.mockito.Mockito.verify
import org.mockito.Mockito.`when`
import org.springframework.security.access.AccessDeniedException
import org.springframework.security.oauth2.jwt.Jwt
import java.util.Optional
import java.util.UUID

class PlatformCurriculumServiceTest {
    @Test
    fun `seeding the global curriculum requires a Platform Admin and delegates to the seeding service`() {
        val platformAccess = mock(PlatformAccessService::class.java)
        val seeding = mock(GlobalCurriculumSeedingService::class.java)
        val service = PlatformCurriculumService(platformAccess, mock(CurriculumProgramRepository::class.java), mock(CurriculumProgramDevelopmentProgramRepository::class.java), mock(DevelopmentProgramRepository::class.java), mock(LearningLevelRepository::class.java), mock(LearningLevelCurriculumProgramRepository::class.java), seeding)
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
        val service = PlatformCurriculumService(platformAccess, mock(CurriculumProgramRepository::class.java), mock(CurriculumProgramDevelopmentProgramRepository::class.java), mock(DevelopmentProgramRepository::class.java), mock(LearningLevelRepository::class.java), mock(LearningLevelCurriculumProgramRepository::class.java), seeding)
        val jwt = mock(Jwt::class.java)
        `when`(platformAccess.requirePlatformAdmin(jwt)).thenThrow(AccessDeniedException("Platform administrator access is required"))

        assertThrows(AccessDeniedException::class.java) { service.seedGlobalCurriculum(jwt) }

        verify(seeding, never()).seed()
    }

    @Test
    fun `global curriculum program only accepts Goals from its reference learning level`() {
        val platformAccess = mock(PlatformAccessService::class.java)
        val programs = mock(CurriculumProgramRepository::class.java)
        val programGoals = mock(CurriculumProgramDevelopmentProgramRepository::class.java)
        val developmentPrograms = mock(DevelopmentProgramRepository::class.java)
        val levels = mock(LearningLevelRepository::class.java)
        val levelPrograms = mock(LearningLevelCurriculumProgramRepository::class.java)
        val service = PlatformCurriculumService(platformAccess, programs, programGoals, developmentPrograms, levels, levelPrograms, mock(GlobalCurriculumSeedingService::class.java))
        val jwt = mock(Jwt::class.java)
        val referenceLevelId = UUID.randomUUID()
        val otherLevelId = UUID.randomUUID()
        val goalId = UUID.randomUUID()
        `when`(platformAccess.requirePlatformAdmin(jwt)).thenReturn(UserProfile())
        `when`(levels.findById(referenceLevelId)).thenReturn(Optional.of(LearningLevel(id = referenceLevelId, organizationId = null)))
        `when`(developmentPrograms.findById(goalId)).thenReturn(Optional.of(com.daycare.api.persistence.DevelopmentProgram(id = goalId, organizationId = null, learningLevelId = otherLevelId)))

        assertThrows(IllegalArgumentException::class.java) {
            service.createProgram(jwt, CreateGlobalCurriculumProgramRequest(referenceLevelId, "Kurikulum Toddler", developmentProgramIds = setOf(goalId)))
        }

        verify(programs, never()).save(any(com.daycare.api.persistence.CurriculumProgram::class.java))
    }

    @Test
    fun `global curriculum program saves its reference learning level with matching Goals`() {
        val platformAccess = mock(PlatformAccessService::class.java)
        val programs = mock(CurriculumProgramRepository::class.java)
        val programGoals = mock(CurriculumProgramDevelopmentProgramRepository::class.java)
        val developmentPrograms = mock(DevelopmentProgramRepository::class.java)
        val levels = mock(LearningLevelRepository::class.java)
        val levelPrograms = mock(LearningLevelCurriculumProgramRepository::class.java)
        val service = PlatformCurriculumService(platformAccess, programs, programGoals, developmentPrograms, levels, levelPrograms, mock(GlobalCurriculumSeedingService::class.java))
        val jwt = mock(Jwt::class.java)
        val referenceLevelId = UUID.randomUUID()
        val goalId = UUID.randomUUID()
        val savedProgram = com.daycare.api.persistence.CurriculumProgram()
        val referenceLink = LearningLevelCurriculumProgram(learningLevelId = referenceLevelId, curriculumProgramId = savedProgram.id)
        `when`(platformAccess.requirePlatformAdmin(jwt)).thenReturn(UserProfile())
        `when`(levels.findById(referenceLevelId)).thenReturn(Optional.of(LearningLevel(id = referenceLevelId, organizationId = null)))
        `when`(developmentPrograms.findById(goalId)).thenReturn(Optional.of(com.daycare.api.persistence.DevelopmentProgram(id = goalId, organizationId = null, learningLevelId = referenceLevelId)))
        `when`(programs.save(any(com.daycare.api.persistence.CurriculumProgram::class.java))).thenReturn(savedProgram)
        `when`(levelPrograms.findAllByCurriculumProgramId(savedProgram.id)).thenReturn(emptyList(), listOf(referenceLink))
        `when`(programGoals.findAllByCurriculumProgramId(savedProgram.id)).thenReturn(emptyList())

        val response = service.createProgram(jwt, CreateGlobalCurriculumProgramRequest(referenceLevelId, "Kurikulum Toddler", developmentProgramIds = setOf(goalId)))

        assertEquals(referenceLevelId, response.learningLevelId)
        verify(levelPrograms).save(any(LearningLevelCurriculumProgram::class.java))
    }

    @Test
    fun `updating a global reference level preserves its tenant level links`() {
        val platformAccess = mock(PlatformAccessService::class.java)
        val programs = mock(CurriculumProgramRepository::class.java)
        val programGoals = mock(CurriculumProgramDevelopmentProgramRepository::class.java)
        val levels = mock(LearningLevelRepository::class.java)
        val levelPrograms = mock(LearningLevelCurriculumProgramRepository::class.java)
        val program = com.daycare.api.persistence.CurriculumProgram()
        val previousGlobalLevelId = UUID.randomUUID()
        val nextGlobalLevelId = UUID.randomUUID()
        val tenantLevelId = UUID.randomUUID()
        val tenantOrganizationId = UUID.randomUUID()
        val previousGlobalLink = LearningLevelCurriculumProgram(learningLevelId = previousGlobalLevelId, curriculumProgramId = program.id)
        val tenantLink = LearningLevelCurriculumProgram(learningLevelId = tenantLevelId, curriculumProgramId = program.id)
        val service = PlatformCurriculumService(platformAccess, programs, programGoals, mock(DevelopmentProgramRepository::class.java), levels, levelPrograms, mock(GlobalCurriculumSeedingService::class.java))
        val jwt = mock(Jwt::class.java)
        `when`(platformAccess.requirePlatformAdmin(jwt)).thenReturn(UserProfile())
        `when`(programs.findById(program.id)).thenReturn(Optional.of(program))
        `when`(levels.findById(nextGlobalLevelId)).thenReturn(Optional.of(LearningLevel(id = nextGlobalLevelId, organizationId = null)))
        `when`(levels.findById(previousGlobalLevelId)).thenReturn(Optional.of(LearningLevel(id = previousGlobalLevelId, organizationId = null)))
        `when`(levels.findById(tenantLevelId)).thenReturn(Optional.of(LearningLevel(id = tenantLevelId, organizationId = tenantOrganizationId)))
        `when`(levelPrograms.findAllByCurriculumProgramId(program.id)).thenReturn(listOf(previousGlobalLink, tenantLink))
        `when`(programGoals.findAllByCurriculumProgramId(program.id)).thenReturn(emptyList())

        service.updateProgram(jwt, program.id, CreateGlobalCurriculumProgramRequest(nextGlobalLevelId, "Kurikulum baru"))

        verify(levelPrograms).deleteAll(listOf(previousGlobalLink))
        verify(levelPrograms, never()).deleteAll(listOf(tenantLink))
    }
}
