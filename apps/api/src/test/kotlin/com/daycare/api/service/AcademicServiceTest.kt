package com.daycare.api.service

import com.daycare.api.domain.Role
import com.daycare.api.persistence.AcademicYearRepository
import com.daycare.api.persistence.CurriculumActivityAssessmentRepository
import com.daycare.api.persistence.CurriculumActivityRepository
import com.daycare.api.persistence.CurriculumProgram
import com.daycare.api.persistence.CurriculumProgramDevelopmentProgramRepository
import com.daycare.api.persistence.CurriculumProgramRepository
import com.daycare.api.persistence.DevelopmentProgramRepository
import com.daycare.api.persistence.DevelopmentProgram
import com.daycare.api.persistence.Membership
import com.daycare.api.persistence.UserProfile
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Test
import org.mockito.Mockito.mock
import org.mockito.Mockito.never
import org.mockito.Mockito.verify
import org.mockito.Mockito.`when`
import org.springframework.security.oauth2.jwt.Jwt
import java.util.UUID
import java.util.Optional

class AcademicServiceTest {
    @Test
    fun `searches global and tenant curriculum programs on the server`() {
        val access = mock(AccessService::class.java)
        val academicYears = mock(AcademicYearRepository::class.java)
        val programs = mock(CurriculumProgramRepository::class.java)
        val programGoals = mock(CurriculumProgramDevelopmentProgramRepository::class.java)
        val developmentPrograms = mock(DevelopmentProgramRepository::class.java)
        val activities = mock(CurriculumActivityRepository::class.java)
        val assessments = mock(CurriculumActivityAssessmentRepository::class.java)
        val jwt = mock(Jwt::class.java)
        val organizationId = UUID.randomUUID()
        val globalProgram = CurriculumProgram(name = "Fondasi Global")
        val tenantProgram = CurriculumProgram(organizationId = organizationId, name = "Fondasi Tenant")
        `when`(access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN, Role.STAFF), readOnly = true))
            .thenReturn(AccessScope(UserProfile(), Membership(organizationId = organizationId, role = Role.STAFF_ADMIN), emptySet(), emptySet()))
        `when`(programs.searchAvailableForOrganization(organizationId, "fondasi")).thenReturn(listOf(globalProgram, tenantProgram))
        `when`(programGoals.findAllByCurriculumProgramId(globalProgram.id)).thenReturn(emptyList())
        `when`(programGoals.findAllByCurriculumProgramId(tenantProgram.id)).thenReturn(emptyList())
        val service = AcademicService(access, academicYears, programs, programGoals, developmentPrograms, activities, assessments)

        val response = service.curriculumPrograms(jwt, organizationId, "  fondasi  ")

        assertEquals(listOf("Fondasi Global", "Fondasi Tenant"), response.map { it.name })
        assertEquals(listOf(CurriculumProgramSource.GLOBAL, CurriculumProgramSource.TENANT), response.map { it.source })
        verify(programs).searchAvailableForOrganization(organizationId, "fondasi")
        verify(programs, never()).findAllByOrganizationIdIsNullOrderByNameAsc()
        verify(programs, never()).findAllByOrganizationIdOrderByNameAsc(organizationId)
    }

    @Test
    fun `rejects development programs owned by another tenant when creating a curriculum program`() {
        val access = mock(AccessService::class.java)
        val academicYears = mock(AcademicYearRepository::class.java)
        val programs = mock(CurriculumProgramRepository::class.java)
        val programGoals = mock(CurriculumProgramDevelopmentProgramRepository::class.java)
        val developmentPrograms = mock(DevelopmentProgramRepository::class.java)
        val activities = mock(CurriculumActivityRepository::class.java)
        val assessments = mock(CurriculumActivityAssessmentRepository::class.java)
        val jwt = mock(Jwt::class.java)
        val organizationId = UUID.randomUUID()
        val foreignDevelopmentProgram = DevelopmentProgram(organizationId = UUID.randomUUID(), name = "Foreign development program")
        `when`(access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN))).thenReturn(AccessScope(UserProfile(), Membership(organizationId = organizationId, role = Role.STAFF_ADMIN), emptySet(), emptySet()))
        `when`(developmentPrograms.findById(foreignDevelopmentProgram.id)).thenReturn(Optional.of(foreignDevelopmentProgram))
        val service = AcademicService(access, academicYears, programs, programGoals, developmentPrograms, activities, assessments)

        assertThrows(IllegalArgumentException::class.java) {
            service.createCurriculumProgram(jwt, organizationId, CreateCurriculumProgramRequest(name = "Program", developmentProgramIds = setOf(foreignDevelopmentProgram.id)))
        }
        verify(programs, never()).save(org.mockito.ArgumentMatchers.any())
    }
}
