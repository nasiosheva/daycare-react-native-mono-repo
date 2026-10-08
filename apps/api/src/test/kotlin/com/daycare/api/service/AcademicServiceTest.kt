package com.daycare.api.service

import com.daycare.api.domain.Role
import com.daycare.api.domain.InstitutionCapability
import com.daycare.api.persistence.AcademicYearRepository
import com.daycare.api.persistence.AcademicYear
import com.daycare.api.persistence.CurriculumActivity
import com.daycare.api.persistence.CurriculumActivityAssessment
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
import java.time.LocalDate

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
        `when`(access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN, Role.STAFF), InstitutionCapability.ACADEMIC_CURRICULUM, readOnly = true))
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
        `when`(access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN), InstitutionCapability.ACADEMIC_CURRICULUM)).thenReturn(AccessScope(UserProfile(), Membership(organizationId = organizationId, role = Role.STAFF_ADMIN), emptySet(), emptySet()))
        `when`(developmentPrograms.findById(foreignDevelopmentProgram.id)).thenReturn(Optional.of(foreignDevelopmentProgram))
        val service = AcademicService(access, academicYears, programs, programGoals, developmentPrograms, activities, assessments)

        assertThrows(IllegalArgumentException::class.java) {
            service.createCurriculumProgram(jwt, organizationId, CreateCurriculumProgramRequest(name = "Program", developmentProgramIds = setOf(foreignDevelopmentProgram.id)))
        }
        verify(programs, never()).save(org.mockito.ArgumentMatchers.any())
    }

    @Test
    fun `academic years and curriculum programs cover active and archived queries`() {
        val access = mock(AccessService::class.java)
        val academicYears = mock(AcademicYearRepository::class.java)
        val programs = mock(CurriculumProgramRepository::class.java)
        val goals = mock(CurriculumProgramDevelopmentProgramRepository::class.java)
        val development = mock(DevelopmentProgramRepository::class.java)
        val activities = mock(CurriculumActivityRepository::class.java)
        val assessments = mock(CurriculumActivityAssessmentRepository::class.java)
        val jwt = mock(Jwt::class.java)
        val organizationId = UUID.randomUUID()
        val staff = AccessScope(UserProfile(), Membership(organizationId = organizationId, role = Role.STAFF), emptySet(), emptySet())
        `when`(access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN, Role.STAFF), InstitutionCapability.ACADEMIC_CURRICULUM, readOnly = true)).thenReturn(staff)
        val year = AcademicYear(organizationId = organizationId, name = "2026/2027", startsOn = LocalDate.of(2026, 7, 1), endsOn = LocalDate.of(2027, 6, 30))
        `when`(academicYears.findAllByOrganizationIdOrderByStartsOnDesc(organizationId)).thenReturn(listOf(year))
        val global = CurriculumProgram(name = "Global", active = true)
        val tenant = CurriculumProgram(organizationId = organizationId, name = "Tenant", active = false)
        `when`(programs.findAllByOrganizationIdIsNullAndActiveTrueOrderByNameAsc()).thenReturn(listOf(global))
        `when`(programs.findAllByOrganizationIdAndActiveTrueOrderByNameAsc(organizationId)).thenReturn(emptyList())
        `when`(programs.findAllByOrganizationIdIsNullOrderByNameAsc()).thenReturn(listOf(global))
        `when`(programs.findAllByOrganizationIdOrderByNameAsc(organizationId)).thenReturn(listOf(tenant))
        `when`(goals.findAllByCurriculumProgramId(global.id)).thenReturn(emptyList())
        `when`(goals.findAllByCurriculumProgramId(tenant.id)).thenReturn(emptyList())
        val service = AcademicService(access, academicYears, programs, goals, development, activities, assessments)

        assertEquals("2026/2027", service.academicYears(jwt, organizationId).single().name)
        assertEquals(listOf("Global"), service.curriculumPrograms(jwt, organizationId).map { it.name })
        assertEquals(listOf("Global", "Tenant"), service.curriculumPrograms(jwt, organizationId, includeArchived = true).map { it.name })
        verify(programs).findAllByOrganizationIdIsNullAndActiveTrueOrderByNameAsc()
        verify(programs).findAllByOrganizationIdIsNullOrderByNameAsc()
    }

    @Test
    fun `tenant curriculum and activity lifecycle validates dates ownership and assessments`() {
        val access = mock(AccessService::class.java)
        val academicYears = mock(AcademicYearRepository::class.java)
        val programs = mock(CurriculumProgramRepository::class.java)
        val goals = mock(CurriculumProgramDevelopmentProgramRepository::class.java)
        val development = mock(DevelopmentProgramRepository::class.java)
        val activities = mock(CurriculumActivityRepository::class.java)
        val assessments = mock(CurriculumActivityAssessmentRepository::class.java)
        val jwt = mock(Jwt::class.java)
        val organizationId = UUID.randomUUID()
        val admin = AccessScope(UserProfile(), Membership(organizationId = organizationId, role = Role.STAFF_ADMIN), emptySet(), emptySet())
        `when`(access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN), InstitutionCapability.ACADEMIC_CURRICULUM)).thenReturn(admin)
        `when`(access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN, Role.STAFF), InstitutionCapability.ACADEMIC_CURRICULUM, readOnly = true)).thenReturn(admin)
        val year = AcademicYear(organizationId = organizationId, name = "Year", startsOn = LocalDate.of(2026, 1, 1), endsOn = LocalDate.of(2026, 12, 31))
        `when`(academicYears.findById(year.id)).thenReturn(Optional.of(year))
        val developmentProgram = DevelopmentProgram(organizationId = organizationId, name = "Goal")
        `when`(development.findById(developmentProgram.id)).thenReturn(Optional.of(developmentProgram))
        val savedProgram = CurriculumProgram(organizationId = organizationId, academicYearId = year.id, name = "Program", description = "desc")
        `when`(programs.save(org.mockito.ArgumentMatchers.any(CurriculumProgram::class.java))).thenReturn(savedProgram)
        `when`(goals.findAllByCurriculumProgramId(savedProgram.id)).thenReturn(emptyList())
        val activity = CurriculumActivity(organizationId = organizationId, name = "Art")
        val assessment = CurriculumActivityAssessment(organizationId = organizationId, activityId = activity.id, name = "Observed")
        `when`(activities.save(org.mockito.ArgumentMatchers.any(CurriculumActivity::class.java))).thenReturn(activity)
        `when`(activities.findById(activity.id)).thenReturn(Optional.of(activity))
        `when`(assessments.save(org.mockito.ArgumentMatchers.any(CurriculumActivityAssessment::class.java))).thenReturn(assessment)
        `when`(assessments.findAllByOrganizationIdAndActivityIdOrderByCreatedAtDesc(organizationId, activity.id)).thenReturn(listOf(assessment))
        `when`(assessments.findById(assessment.id)).thenReturn(Optional.of(assessment))
        val service = AcademicService(access, academicYears, programs, goals, development, activities, assessments)

        assertThrows(IllegalArgumentException::class.java) { service.createAcademicYear(jwt, organizationId, CreateAcademicYearRequest("bad", LocalDate.of(2027, 1, 1), LocalDate.of(2026, 1, 1))) }
        assertEquals("Program", service.createCurriculumProgram(jwt, organizationId, CreateCurriculumProgramRequest(year.id, " Program ", developmentProgramIds = setOf(developmentProgram.id))).name)
        `when`(programs.findById(savedProgram.id)).thenReturn(Optional.of(savedProgram))
        assertEquals("Program 2", service.updateCurriculumProgram(jwt, organizationId, savedProgram.id, CreateCurriculumProgramRequest(name = " Program 2 ")).name)
        assertEquals(false, service.setCurriculumProgramActive(jwt, organizationId, savedProgram.id, false).active)
        assertEquals("Art", service.createActivity(jwt, organizationId, UpsertCurriculumActivityRequest(" Art ")).name)
        assertEquals("Updated", service.updateActivity(jwt, organizationId, activity.id, UpsertCurriculumActivityRequest("Updated")).name)
        assertEquals(false, service.archiveActivity(jwt, organizationId, activity.id).active)
        assertEquals(1, service.activityAssessments(jwt, organizationId, activity.id).size)
        assertEquals("Observed", service.createActivityAssessment(jwt, organizationId, activity.id, CreateCurriculumActivityAssessmentRequest("Observed")).name)
        service.removeActivityAssessment(jwt, organizationId, activity.id, assessment.id)
        verify(assessments).delete(assessment)
    }
}
