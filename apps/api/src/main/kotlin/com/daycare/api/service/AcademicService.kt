package com.daycare.api.service

import com.daycare.api.domain.Role
import com.daycare.api.persistence.AcademicYear
import com.daycare.api.persistence.AcademicYearRepository
import com.daycare.api.persistence.CurriculumActivity
import com.daycare.api.persistence.CurriculumActivityRepository
import com.daycare.api.persistence.CurriculumActivityAssessment
import com.daycare.api.persistence.CurriculumActivityAssessmentRepository
import com.daycare.api.persistence.CurriculumProgram
import com.daycare.api.persistence.CurriculumProgramDevelopmentProgram
import com.daycare.api.persistence.CurriculumProgramDevelopmentProgramRepository
import com.daycare.api.persistence.CurriculumProgramRepository
import com.daycare.api.persistence.DevelopmentProgramRepository
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.Size
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.LocalDate
import java.util.UUID

data class CreateAcademicYearRequest(
    @field:NotBlank @field:Size(max = 80) val name: String,
    val startsOn: LocalDate,
    val endsOn: LocalDate,
)
data class AcademicYearResponse(val id: UUID, val name: String, val startsOn: LocalDate, val endsOn: LocalDate, val active: Boolean)
data class CreateCurriculumProgramRequest(
    val academicYearId: UUID? = null,
    @field:NotBlank @field:Size(max = 120) val name: String,
    @field:Size(max = 2_000) val description: String = "",
    val developmentProgramIds: Set<UUID> = emptySet(),
)
data class SetCurriculumProgramActiveRequest(val active: Boolean)
enum class CurriculumProgramSource { GLOBAL, TENANT }
data class CurriculumProgramResponse(val id: UUID, val academicYearId: UUID?, val name: String, val description: String, val source: CurriculumProgramSource, val isTemplate: Boolean, val active: Boolean, val developmentProgramIds: Set<UUID>)
data class UpsertCurriculumActivityRequest(
    @field:NotBlank @field:Size(max = 120) val name: String,
    @field:Size(max = 2_000) val description: String = "",
)
data class CurriculumActivityResponse(val id: UUID, val name: String, val description: String, val active: Boolean)
data class CreateCurriculumActivityAssessmentRequest(
    @field:NotBlank @field:Size(max = 120) val name: String,
    @field:Size(max = 2_000) val description: String = "",
)
data class CurriculumActivityAssessmentResponse(val id: UUID, val activityId: UUID, val name: String, val description: String)

@Service
class AcademicService(
    private val access: AccessService,
    private val academicYears: AcademicYearRepository,
    private val curriculumPrograms: CurriculumProgramRepository,
    private val programGoals: CurriculumProgramDevelopmentProgramRepository,
    private val developmentPrograms: DevelopmentProgramRepository,
    private val curriculumActivities: CurriculumActivityRepository,
    private val curriculumActivityAssessments: CurriculumActivityAssessmentRepository,
) {
    @Transactional(readOnly = true)
    fun academicYears(jwt: Jwt, organizationId: UUID): List<AcademicYearResponse> {
        access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN, Role.STAFF), readOnly = true)
        return academicYears.findAllByOrganizationIdOrderByStartsOnDesc(organizationId).map(::academicYearResponse)
    }

    @Transactional
    fun createAcademicYear(jwt: Jwt, organizationId: UUID, request: CreateAcademicYearRequest): AcademicYearResponse {
        access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN))
        require(!request.endsOn.isBefore(request.startsOn)) { "Academic year end date must be after its start date" }
        return academicYearResponse(academicYears.save(AcademicYear(organizationId = organizationId, name = request.name.trim(), startsOn = request.startsOn, endsOn = request.endsOn)))
    }

    @Transactional(readOnly = true)
    fun curriculumPrograms(jwt: Jwt, organizationId: UUID, search: String? = null, includeArchived: Boolean = false): List<CurriculumProgramResponse> {
        access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN, Role.STAFF), readOnly = true)
        val query = search?.trim().orEmpty()
        val programs = if (query.isBlank()) {
            if (includeArchived) curriculumPrograms.findAllByOrganizationIdIsNullOrderByNameAsc() + curriculumPrograms.findAllByOrganizationIdOrderByNameAsc(organizationId)
            else curriculumPrograms.findAllByOrganizationIdIsNullAndActiveTrueOrderByNameAsc() + curriculumPrograms.findAllByOrganizationIdAndActiveTrueOrderByNameAsc(organizationId)
        } else {
            if (includeArchived) curriculumPrograms.searchIncludingArchivedForOrganization(organizationId, query)
            else curriculumPrograms.searchAvailableForOrganization(organizationId, query)
        }
        return programs.map(::curriculumProgramResponse)
    }

    @Transactional
    fun createCurriculumProgram(jwt: Jwt, organizationId: UUID, request: CreateCurriculumProgramRequest): CurriculumProgramResponse {
        access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN))
        validateTenantProgramRequest(organizationId, request, existingProgramId = null)
        val program = curriculumPrograms.save(CurriculumProgram(organizationId = organizationId, academicYearId = request.academicYearId, name = request.name.trim(), description = request.description.trim()))
        replaceProgramGoals(program.id, request.developmentProgramIds)
        return curriculumProgramResponse(program)
    }

    @Transactional
    fun updateCurriculumProgram(jwt: Jwt, organizationId: UUID, programId: UUID, request: CreateCurriculumProgramRequest): CurriculumProgramResponse {
        access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN))
        validateTenantProgramRequest(organizationId, request, existingProgramId = programId)
        val program = tenantProgram(programId, organizationId)
        program.academicYearId = request.academicYearId
        program.name = request.name.trim()
        program.description = request.description.trim()
        replaceProgramGoals(program.id, request.developmentProgramIds)
        return curriculumProgramResponse(program)
    }

    @Transactional
    fun setCurriculumProgramActive(jwt: Jwt, organizationId: UUID, programId: UUID, active: Boolean): CurriculumProgramResponse {
        access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN))
        return curriculumProgramResponse(tenantProgram(programId, organizationId).also { it.active = active })
    }

    @Transactional(readOnly = true)
    fun activities(jwt: Jwt, organizationId: UUID): List<CurriculumActivityResponse> {
        access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN, Role.STAFF), readOnly = true)
        return curriculumActivities.findAllByOrganizationIdOrderByCreatedAtDesc(organizationId).map(::activityResponse)
    }

    @Transactional
    fun createActivity(jwt: Jwt, organizationId: UUID, request: UpsertCurriculumActivityRequest): CurriculumActivityResponse {
        access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN))
        return activityResponse(curriculumActivities.save(CurriculumActivity(organizationId = organizationId, name = request.name.trim(), description = request.description.trim())))
    }

    @Transactional
    fun updateActivity(jwt: Jwt, organizationId: UUID, activityId: UUID, request: UpsertCurriculumActivityRequest): CurriculumActivityResponse {
        access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN))
        val activity = activity(activityId, organizationId)
        activity.name = request.name.trim()
        activity.description = request.description.trim()
        return activityResponse(activity)
    }

    @Transactional
    fun archiveActivity(jwt: Jwt, organizationId: UUID, activityId: UUID): CurriculumActivityResponse {
        access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN))
        return activity(activityId, organizationId).also { it.active = false }.let(::activityResponse)
    }

    @Transactional(readOnly = true)
    fun activityAssessments(jwt: Jwt, organizationId: UUID, activityId: UUID): List<CurriculumActivityAssessmentResponse> {
        access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN, Role.STAFF), readOnly = true)
        activity(activityId, organizationId)
        return curriculumActivityAssessments.findAllByOrganizationIdAndActivityIdOrderByCreatedAtDesc(organizationId, activityId).map(::activityAssessmentResponse)
    }

    @Transactional
    fun createActivityAssessment(jwt: Jwt, organizationId: UUID, activityId: UUID, request: CreateCurriculumActivityAssessmentRequest): CurriculumActivityAssessmentResponse {
        access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN))
        activity(activityId, organizationId)
        return activityAssessmentResponse(curriculumActivityAssessments.save(CurriculumActivityAssessment(organizationId = organizationId, activityId = activityId, name = request.name.trim(), description = request.description.trim())))
    }

    @Transactional
    fun removeActivityAssessment(jwt: Jwt, organizationId: UUID, activityId: UUID, assessmentId: UUID) {
        access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN))
        activity(activityId, organizationId)
        val assessment = curriculumActivityAssessments.findById(assessmentId).orElseThrow { IllegalArgumentException("Curriculum activity assessment was not found") }
        require(assessment.organizationId == organizationId && assessment.activityId == activityId) { "Curriculum activity assessment belongs to a different activity" }
        curriculumActivityAssessments.delete(assessment)
    }

    private fun activity(activityId: UUID, organizationId: UUID) = curriculumActivities.findById(activityId).orElseThrow { IllegalArgumentException("Curriculum activity was not found") }.also { require(it.organizationId == organizationId) { "Curriculum activity belongs to a different organization" } }
    private fun academicYearResponse(year: AcademicYear) = AcademicYearResponse(year.id, year.name, year.startsOn, year.endsOn, year.active)
    private fun validateTenantProgramRequest(organizationId: UUID, request: CreateCurriculumProgramRequest, existingProgramId: UUID?) {
        request.academicYearId?.let { yearId ->
            val academicYear = academicYears.findById(yearId).orElseThrow { IllegalArgumentException("Learning period was not found") }
            require(academicYear.organizationId == organizationId) { "Learning period belongs to a different organization" }
        }
        validateProgramGoals(organizationId, request.developmentProgramIds, globalProgram = false, existingProgramId = existingProgramId)
    }
    private fun validateProgramGoals(organizationId: UUID?, ids: Set<UUID>, globalProgram: Boolean, existingProgramId: UUID? = null) = ids.forEach { id ->
        val program = developmentPrograms.findById(id).orElseThrow { IllegalArgumentException("Development program was not found") }
        require(program.active || (existingProgramId != null && programGoals.existsByCurriculumProgramIdAndDevelopmentProgramId(existingProgramId, id))) { "Archived Goal template cannot be assigned to a new curriculum program" }
        require(program.organizationId == null || (!globalProgram && program.organizationId == organizationId)) { "Development program belongs to a different organization" }
    }
    private fun replaceProgramGoals(programId: UUID, ids: Set<UUID>) {
        programGoals.deleteAllByCurriculumProgramId(programId)
        programGoals.saveAll(ids.map { CurriculumProgramDevelopmentProgram(curriculumProgramId = programId, developmentProgramId = it) })
    }
    private fun tenantProgram(programId: UUID, organizationId: UUID) = curriculumPrograms.findById(programId).orElseThrow { IllegalArgumentException("Curriculum program was not found") }.also { require(it.organizationId == organizationId) { "Curriculum program belongs to a different organization" } }
    private fun curriculumProgramResponse(program: CurriculumProgram) = CurriculumProgramResponse(program.id, program.academicYearId, program.name, program.description, if (program.organizationId == null) CurriculumProgramSource.GLOBAL else CurriculumProgramSource.TENANT, program.isTemplate, program.active, programGoals.findAllByCurriculumProgramId(program.id).map { it.developmentProgramId }.toSet())
    private fun activityResponse(activity: CurriculumActivity) = CurriculumActivityResponse(activity.id, activity.name, activity.description, activity.active)
    private fun activityAssessmentResponse(assessment: CurriculumActivityAssessment) = CurriculumActivityAssessmentResponse(assessment.id, assessment.activityId, assessment.name, assessment.description)
}
