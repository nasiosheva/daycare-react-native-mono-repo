package com.daycare.api.service

import com.daycare.api.domain.ParentIncomeRange
import com.daycare.api.domain.ParentOccupation
import com.daycare.api.persistence.InstitutionTypeDefinitionRepository
import com.daycare.api.persistence.OrganizationTypeAssignmentRepository
import com.daycare.api.persistence.ParentFamilyProfileRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

data class ParentFamilyProfileForTenantResponse(
    val husbandOccupation: ParentOccupation?,
    val husbandIncomeRange: ParentIncomeRange?,
    val wifeOccupation: ParentOccupation?,
    val wifeIncomeRange: ParentIncomeRange?,
)

@Service
class ParentFamilyProfileVisibilityService(
    private val organizationTypes: OrganizationTypeAssignmentRepository,
    private val institutionTypes: InstitutionTypeDefinitionRepository,
    private val profiles: ParentFamilyProfileRepository,
) {
    @Transactional(readOnly = true)
    fun forTenant(organizationId: UUID, parentUserId: UUID): ParentFamilyProfileForTenantResponse? {
        val definitions = institutionTypes.findAllById(organizationTypes.findAllByOrganizationId(organizationId).map { it.type })
        val occupationVisible = definitions.any { it.parentOccupationVisible }
        val incomeRangeVisible = definitions.any { it.parentIncomeRangeVisible }
        if (!occupationVisible && !incomeRangeVisible) return null
        val profile = profiles.findByUserId(parentUserId) ?: return null
        return ParentFamilyProfileForTenantResponse(
            husbandOccupation = profile.husbandOccupation.takeIf { occupationVisible },
            husbandIncomeRange = profile.husbandIncomeRange.takeIf { incomeRangeVisible },
            wifeOccupation = profile.wifeOccupation.takeIf { occupationVisible },
            wifeIncomeRange = profile.wifeIncomeRange.takeIf { incomeRangeVisible },
        )
    }
}
