package com.daycare.api.service

import com.daycare.api.persistence.CurriculumProgram
import com.daycare.api.persistence.CurriculumProgramRepository
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.Size
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

data class CreateGlobalCurriculumProgramRequest(
    @field:NotBlank @field:Size(max = 120) val name: String,
    @field:Size(max = 2_000) val description: String = "",
)

@Service
class PlatformCurriculumService(
    private val platformAccess: PlatformAccessService,
    private val programs: CurriculumProgramRepository,
) {
    @Transactional(readOnly = true)
    fun programs(jwt: Jwt): List<CurriculumProgramResponse> {
        platformAccess.requirePlatformAdmin(jwt)
        return programs.findAllByOrganizationIdIsNullOrderByNameAsc().map(::response)
    }

    @Transactional
    fun createProgram(jwt: Jwt, request: CreateGlobalCurriculumProgramRequest): CurriculumProgramResponse {
        platformAccess.requirePlatformAdmin(jwt)
        return response(programs.save(CurriculumProgram(name = request.name.trim(), description = request.description.trim())))
    }

    private fun response(program: CurriculumProgram) = CurriculumProgramResponse(program.id, null, program.name, program.description, CurriculumProgramSource.GLOBAL)
}
