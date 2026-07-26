package com.daycare.api.service

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

data class CreateGlobalCurriculumProgramRequest(
    @field:NotBlank @field:Size(max = 120) val name: String,
    @field:Size(max = 2_000) val description: String = "",
    val developmentProgramIds: Set<java.util.UUID> = emptySet(),
)

@Service
class PlatformCurriculumService(
    private val platformAccess: PlatformAccessService,
    private val programs: CurriculumProgramRepository,
    private val programGoals: CurriculumProgramDevelopmentProgramRepository,
    private val developmentPrograms: DevelopmentProgramRepository,
) {
    @Transactional(readOnly = true)
    fun programs(jwt: Jwt, includeArchived: Boolean = false): List<CurriculumProgramResponse> {
        platformAccess.requirePlatformAdmin(jwt)
        return (if (includeArchived) programs.findAllByOrganizationIdIsNullOrderByNameAsc() else programs.findAllByOrganizationIdIsNullAndActiveTrueOrderByNameAsc()).map(::response)
    }

    @Transactional
    fun createProgram(jwt: Jwt, request: CreateGlobalCurriculumProgramRequest): CurriculumProgramResponse {
        platformAccess.requirePlatformAdmin(jwt)
        validateGoals(request.developmentProgramIds, existingProgramId = null)
        val program = programs.save(CurriculumProgram(name = request.name.trim(), description = request.description.trim(), isTemplate = true))
        replaceGoals(program.id, request.developmentProgramIds)
        return response(program)
    }

    @Transactional
    fun updateProgram(jwt: Jwt, programId: java.util.UUID, request: CreateGlobalCurriculumProgramRequest): CurriculumProgramResponse {
        platformAccess.requirePlatformAdmin(jwt)
        validateGoals(request.developmentProgramIds, existingProgramId = programId)
        val program = globalProgram(programId)
        program.name = request.name.trim()
        program.description = request.description.trim()
        replaceGoals(program.id, request.developmentProgramIds)
        return response(program)
    }

    @Transactional
    fun setProgramActive(jwt: Jwt, programId: java.util.UUID, active: Boolean): CurriculumProgramResponse {
        platformAccess.requirePlatformAdmin(jwt)
        return response(globalProgram(programId).also { it.active = active })
    }

    private fun validateGoals(ids: Set<java.util.UUID>, existingProgramId: java.util.UUID?) = ids.forEach { id ->
        val program = developmentPrograms.findById(id).orElseThrow { IllegalArgumentException("Development program was not found") }
        require(program.organizationId == null) { "Development program is not available for a global curriculum program" }
        require(program.active || (existingProgramId != null && programGoals.existsByCurriculumProgramIdAndDevelopmentProgramId(existingProgramId, id))) { "Archived Goal template cannot be assigned to a new curriculum program" }
    }
    private fun replaceGoals(programId: java.util.UUID, ids: Set<java.util.UUID>) { programGoals.deleteAllByCurriculumProgramId(programId); programGoals.saveAll(ids.map { CurriculumProgramDevelopmentProgram(curriculumProgramId = programId, developmentProgramId = it) }) }
    private fun globalProgram(programId: java.util.UUID) = programs.findById(programId).orElseThrow { IllegalArgumentException("Curriculum program was not found") }.also { require(it.organizationId == null) { "This curriculum program is not global" } }
    private fun response(program: CurriculumProgram) = CurriculumProgramResponse(program.id, null, program.name, program.description, CurriculumProgramSource.GLOBAL, program.isTemplate, program.active, programGoals.findAllByCurriculumProgramId(program.id).map { it.developmentProgramId }.toSet())
}
