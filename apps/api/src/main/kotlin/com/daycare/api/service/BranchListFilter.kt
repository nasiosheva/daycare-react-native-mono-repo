package com.daycare.api.service

import com.daycare.api.persistence.BranchRepository
import org.springframework.stereotype.Service
import java.util.UUID

data class BranchListFilter(val branchId: UUID? = null)

@Service
class BranchListFilterService(private val branches: BranchRepository) {
    fun validate(organizationId: UUID, filter: BranchListFilter) {
        filter.branchId?.let { branchId ->
            val branch = branches.findById(branchId).orElseThrow { IllegalArgumentException("Branch was not found") }
            require(branch.organizationId == organizationId) { "Branch belongs to a different organization" }
        }
    }
}
