package com.daycare.api.service

import com.daycare.api.persistence.InstitutionTypeDefinition
import com.daycare.api.persistence.InstitutionTypeDefinitionRepository
import com.daycare.api.persistence.OrganizationTypeAssignmentRepository
import com.daycare.api.domain.InstitutionTypeCodes
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.Size
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.util.Locale

data class InstitutionTypeDefinitionResponse(
    val code: String,
    val name: String,
    val parentOccupationVisible: Boolean,
    val parentIncomeRangeVisible: Boolean,
)
data class CreateInstitutionTypeDefinitionRequest(
    @field:NotBlank @field:Size(max = 100) val name: String,
    val parentOccupationVisible: Boolean? = null,
    val parentIncomeRangeVisible: Boolean? = null,
)

@Service
class InstitutionTypeCatalogService(
    private val types: InstitutionTypeDefinitionRepository,
    private val organizationTypes: OrganizationTypeAssignmentRepository,
    private val platformAccess: PlatformAccessService,
) {
    @Transactional(readOnly = true)
    fun list(jwt: Jwt): List<InstitutionTypeDefinitionResponse> {
        platformAccess.requirePlatformAdmin(jwt)
        return types.findAllByActiveTrueOrderByNameAsc().map(::response)
    }

    @Transactional
    fun create(jwt: Jwt, request: CreateInstitutionTypeDefinitionRequest): InstitutionTypeDefinitionResponse {
        platformAccess.requirePlatformAdmin(jwt)
        val name = request.name.trim()
        require(!types.existsByNameIgnoreCase(name)) { "Institution type already exists" }
        val code = normalizeCode(name)
        require(!types.existsById(code)) { "Institution type already exists" }
        return response(types.save(InstitutionTypeDefinition(
            code = code,
            name = name,
            parentOccupationVisible = request.parentOccupationVisible ?: false,
            parentIncomeRangeVisible = request.parentIncomeRangeVisible ?: false,
        )))
    }

    @Transactional
    fun update(jwt: Jwt, code: String, request: CreateInstitutionTypeDefinitionRequest): InstitutionTypeDefinitionResponse {
        platformAccess.requirePlatformAdmin(jwt)
        val type = requireType(code)
        val name = request.name.trim()
        val matchingType = types.findByNameIgnoreCase(name)
        require(matchingType == null || matchingType.code == type.code) { "Institution type already exists" }
        type.name = name
        request.parentOccupationVisible?.let { type.parentOccupationVisible = it }
        request.parentIncomeRangeVisible?.let { type.parentIncomeRangeVisible = it }
        return response(type)
    }

    @Transactional
    fun delete(jwt: Jwt, code: String) {
        platformAccess.requirePlatformAdmin(jwt)
        val normalizedCode = normalizeExistingCode(code)
        require(normalizedCode !in InstitutionTypeCodes.builtIn) { "Built-in institution type cannot be deleted" }
        require(!organizationTypes.existsByType(normalizedCode)) { "Institution type is used by a tenant" }
        types.delete(requireType(normalizedCode))
    }

    fun requireActiveCodes(codes: Set<String>) {
        require(codes.isNotEmpty()) { "At least one institution type is required" }
        val availableCodes = types.findAllByActiveTrueOrderByNameAsc().mapTo(mutableSetOf()) { it.code }
        require(codes.all(availableCodes::contains)) { "Institution type is not available" }
    }

    private fun normalizeCode(name: String): String {
        val code = name.uppercase(Locale.ROOT).replace(Regex("[^A-Z0-9]+"), "_").trim('_').take(80).trimEnd('_')
        require(code.isNotBlank()) { "Institution type name is invalid" }
        return code
    }

    private fun requireType(code: String) = types.findById(normalizeExistingCode(code)).orElseThrow { IllegalArgumentException("Institution type was not found") }

    private fun normalizeExistingCode(code: String) = code.trim().uppercase(Locale.ROOT)

    private fun response(type: InstitutionTypeDefinition) = InstitutionTypeDefinitionResponse(type.code, type.name, type.parentOccupationVisible, type.parentIncomeRangeVisible)
}
