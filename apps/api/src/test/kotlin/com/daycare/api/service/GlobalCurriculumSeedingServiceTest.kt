package com.daycare.api.service

import com.daycare.api.persistence.CurriculumProgram
import com.daycare.api.persistence.CurriculumProgramRepository
import com.daycare.api.persistence.DevelopmentProgram
import com.daycare.api.persistence.DevelopmentProgramItem
import com.daycare.api.persistence.DevelopmentProgramItemRepository
import com.daycare.api.persistence.DevelopmentProgramRepository
import com.daycare.api.persistence.LearningLevel
import com.daycare.api.persistence.LearningLevelRepository
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.mockito.Mockito.mock
import org.mockito.Mockito.verify
import org.mockito.Mockito.`when`
import org.springframework.jdbc.core.JdbcTemplate

class GlobalCurriculumSeedingServiceTest {
    @Test
    fun `seed executes bundled SQL and reports global records`() {
        val jdbc = mock(JdbcTemplate::class.java)
        val levels = mock(LearningLevelRepository::class.java)
        val programs = mock(DevelopmentProgramRepository::class.java)
        val items = mock(DevelopmentProgramItemRepository::class.java)
        val curriculum = mock(CurriculumProgramRepository::class.java)
        val level = LearningLevel(name = "Toddler")
        val program = DevelopmentProgram(name = "Bahasa")
        `when`(curriculum.findAllByOrganizationIdIsNullOrderByNameAsc()).thenReturn(emptyList(), listOf(CurriculumProgram(name = "Program")))
        `when`(levels.findAllByOrganizationIdIsNullOrderByDisplayOrderAscNameAsc()).thenReturn(listOf(level))
        `when`(programs.findAllByOrganizationIdIsNullOrderByCreatedAtDesc()).thenReturn(listOf(program))
        `when`(items.findAllByDevelopmentProgramIdIn(setOf(program.id))).thenReturn(listOf(DevelopmentProgramItem(developmentProgramId = program.id)))
        val result = GlobalCurriculumSeedingService(jdbc, levels, programs, items, curriculum).seed()
        assertFalse(result.alreadySeeded)
        assertEquals(1, result.learningLevelCount)
        assertEquals(1, result.developmentProgramCount)
        assertEquals(1, result.developmentProgramItemCount)
        assertEquals(1, result.curriculumProgramCount)
        verify(jdbc).execute(org.mockito.ArgumentMatchers.anyString())
    }
}
