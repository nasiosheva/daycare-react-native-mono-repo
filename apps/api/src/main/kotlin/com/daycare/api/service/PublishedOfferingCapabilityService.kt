package com.daycare.api.service

import com.daycare.api.domain.EducationOfferingStatus
import com.daycare.api.domain.InstitutionCapability
import com.daycare.api.persistence.EducationOffering
import com.daycare.api.persistence.EducationOfferingRepository
import org.springframework.security.access.AccessDeniedException
import org.springframework.stereotype.Service
import java.util.UUID

/**
 * Resolves the effective capability that is currently operable. Institution
 * types remain tenant identity; a published offering is the operational gate.
 */
@Service
class PublishedOfferingCapabilityService(
    private val offerings: EducationOfferingRepository,
) {
    fun hasPublishedCapability(organizationId: UUID, capability: InstitutionCapability, branchId: UUID? = null): Boolean =
        offerings.findAllByOrganizationIdOrderByCreatedAtAsc(organizationId).any { offering ->
            offering.status == EducationOfferingStatus.PUBLISHED &&
                (branchId == null || offering.branchId == branchId) &&
                capability in offeringCapabilities(offering)
        }

    fun requirePublishedCapability(organizationId: UUID, capability: InstitutionCapability, branchId: UUID? = null) {
        if (!hasPublishedCapability(organizationId, capability, branchId)) {
            throw AccessDeniedException("This feature is not enabled for the branch offering")
        }
    }

    private fun offeringCapabilities(offering: EducationOffering) = offering.capabilities
        .split(',')
        .mapNotNull { item -> item.takeIf(String::isNotBlank)?.let { runCatching { InstitutionCapability.valueOf(it) }.getOrNull() } }
        .toSet()
}
