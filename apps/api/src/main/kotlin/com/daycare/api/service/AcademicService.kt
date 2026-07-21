package com.daycare.api.service

import com.daycare.api.domain.InstitutionCapability
import com.daycare.api.domain.Role
import com.daycare.api.persistence.AcademicYear
import com.daycare.api.persistence.AcademicYearRepository
import com.daycare.api.persistence.CurriculumProgram
import com.daycare.api.persistence.CurriculumProgramRepository
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
    val academicYearId: UUID,
    @field:NotBlank @field:Size(max = 120) val name: String,
    @field:Size(max = 2_000) val description: String = "",
)
data class CurriculumProgramResponse(val id: UUID, val academicYearId: UUID, val name: String, val description: String)

@Service
class AcademicService(
    private val access: AccessService,
    private val academicYears: AcademicYearRepository,
    private val curriculumPrograms: CurriculumProgramRepository,
) {
    @Transactional(readOnly = true)
    fun academicYears(jwt: Jwt, organizationId: UUID): List<AcademicYearResponse> {
        access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN, Role.STAFF), InstitutionCapability.ACADEMIC_CURRICULUM)
        return academicYears.findAllByOrganizationIdOrderByStartsOnDesc(organizationId).map(::academicYearResponse)
    }

    @Transactional
    fun createAcademicYear(jwt: Jwt, organizationId: UUID, request: CreateAcademicYearRequest): AcademicYearResponse {
        access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN), InstitutionCapability.ACADEMIC_CURRICULUM)
        require(!request.endsOn.isBefore(request.startsOn)) { "Academic year end date must be after its start date" }
        return academicYearResponse(academicYears.save(AcademicYear(organizationId = organizationId, name = request.name.trim(), startsOn = request.startsOn, endsOn = request.endsOn)))
    }

    @Transactional(readOnly = true)
    fun curriculumPrograms(jwt: Jwt, organizationId: UUID): List<CurriculumProgramResponse> {
        access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN, Role.STAFF), InstitutionCapability.ACADEMIC_CURRICULUM)
        return curriculumPrograms.findAllByOrganizationIdOrderByNameAsc(organizationId).map(::curriculumProgramResponse)
    }

    @Transactional
    fun createCurriculumProgram(jwt: Jwt, organizationId: UUID, request: CreateCurriculumProgramRequest): CurriculumProgramResponse {
        access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN), InstitutionCapability.ACADEMIC_CURRICULUM)
        val academicYear = academicYears.findById(request.academicYearId).orElseThrow { IllegalArgumentException("Academic year was not found") }
        require(academicYear.organizationId == organizationId) { "Academic year belongs to a different institution" }
        return curriculumProgramResponse(curriculumPrograms.save(CurriculumProgram(organizationId = organizationId, academicYearId = academicYear.id, name = request.name.trim(), description = request.description.trim())))
    }

    private fun academicYearResponse(year: AcademicYear) = AcademicYearResponse(year.id, year.name, year.startsOn, year.endsOn, year.active)
    private fun curriculumProgramResponse(program: CurriculumProgram) = CurriculumProgramResponse(program.id, program.academicYearId, program.name, program.description)
}
