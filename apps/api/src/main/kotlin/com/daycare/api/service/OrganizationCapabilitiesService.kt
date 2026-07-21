package com.daycare.api.service

import com.daycare.api.domain.InstitutionCapability
import com.daycare.api.domain.InstitutionType
import com.daycare.api.domain.institutionCapabilities
import com.daycare.api.persistence.OrganizationTypeAssignmentRepository
import org.springframework.stereotype.Service
import java.util.UUID

data class OrganizationCapabilities(val types: Set<InstitutionType>, val capabilities: Set<InstitutionCapability>)

@Service
class OrganizationCapabilitiesService(private val organizationTypes: OrganizationTypeAssignmentRepository) {
    fun forOrganization(organizationId: UUID): OrganizationCapabilities {
        val types = organizationTypes.findAllByOrganizationId(organizationId).map { it.type }.toSet().ifEmpty { setOf(InstitutionType.DAYCARE) }
        return OrganizationCapabilities(types, institutionCapabilities(types))
    }
}
