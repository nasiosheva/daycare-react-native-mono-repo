package com.daycare.api.service

import com.daycare.api.domain.Role
import com.daycare.api.persistence.Branch
import com.daycare.api.persistence.BranchRepository
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.Size
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

data class TenantBranchResponse(val id: UUID, val name: String, val timezone: String, val active: Boolean, val primary: Boolean)
data class CreateTenantBranchRequest(
    @field:NotBlank @field:Size(max = 200) val name: String,
    @field:NotBlank @field:Size(max = 64) val timezone: String = "Asia/Jakarta",
)
data class UpdateTenantBranchRequest(
    @field:NotBlank @field:Size(max = 200) val name: String,
    @field:NotBlank @field:Size(max = 64) val timezone: String,
)

@Service
class BranchManagementService(
    private val access: AccessService,
    private val branches: BranchRepository,
) {
    @Transactional
    fun branches(jwt: Jwt, organizationId: UUID, search: String? = null): List<TenantBranchResponse> {
        access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN), readOnly = true)
        val query = search?.trim().orEmpty()
        return (if (query.isBlank()) branches.findAllByOrganizationId(organizationId) else branches.findAllByOrganizationIdAndNameContainingIgnoreCase(organizationId, query))
            .sortedWith(compareByDescending<Branch> { it.primary }.thenBy { it.name })
            .map(::response)
    }

    @Transactional
    fun create(jwt: Jwt, organizationId: UUID, request: CreateTenantBranchRequest): TenantBranchResponse {
        requireStaffAdmin(jwt, organizationId)
        require(validTimezone(request.timezone)) { "Timezone is not valid" }
        return response(branches.save(Branch(organizationId = organizationId, name = request.name.trim(), timezone = request.timezone.trim())))
    }

    @Transactional
    fun update(jwt: Jwt, organizationId: UUID, branchId: UUID, request: UpdateTenantBranchRequest): TenantBranchResponse {
        requireStaffAdmin(jwt, organizationId)
        require(validTimezone(request.timezone)) { "Timezone is not valid" }
        val branch = requireBranch(branchId, organizationId)
        branch.name = request.name.trim()
        branch.timezone = request.timezone.trim()
        return response(branch)
    }

    @Transactional
    fun setPrimary(jwt: Jwt, organizationId: UUID, branchId: UUID): TenantBranchResponse {
        requireStaffAdmin(jwt, organizationId)
        val branch = requireBranch(branchId, organizationId)
        require(branch.active) { "An archived branch cannot become primary" }
        branches.findByOrganizationIdAndPrimaryTrue(organizationId)?.primary = false
        branch.primary = true
        return response(branch)
    }

    @Transactional
    fun archive(jwt: Jwt, organizationId: UUID, branchId: UUID): TenantBranchResponse {
        requireStaffAdmin(jwt, organizationId)
        val branch = requireBranch(branchId, organizationId)
        require(!branch.primary) { "The primary branch cannot be archived" }
        branch.active = false
        return response(branch)
    }

    private fun requireStaffAdmin(jwt: Jwt, organizationId: UUID) = access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN))
    private fun requireBranch(branchId: UUID, organizationId: UUID) = branches.findById(branchId).orElseThrow { IllegalArgumentException("Branch was not found") }
        .also { require(it.organizationId == organizationId) { "Branch belongs to a different tenant" } }
    private fun response(branch: Branch) = TenantBranchResponse(branch.id, branch.name, branch.timezone, branch.active, branch.primary)
    private fun validTimezone(value: String) = runCatching { java.time.ZoneId.of(value.trim()) }.isSuccess
}
