package com.daycare.api.service

// Mories Deo Hutapea,S.E.,S.Kom

import com.daycare.api.domain.EducationOfferingStatus
import com.daycare.api.domain.InstitutionCapability
import com.daycare.api.persistence.EducationOffering
import com.daycare.api.persistence.EducationOfferingRepository
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.Assertions.assertThrows
import org.springframework.security.access.AccessDeniedException
import org.mockito.Mockito.mock
import org.mockito.Mockito.`when`
import java.util.UUID

class PublishedOfferingCapabilityServiceTest {
    @Test
    fun `requires a published matching offering in the requested branch`() {
        val repository = mock(EducationOfferingRepository::class.java)
        val organizationId = UUID.randomUUID()
        val daycareBranchId = UUID.randomUUID()
        val otherBranchId = UUID.randomUUID()
        `when`(repository.findAllByOrganizationIdOrderByCreatedAtAsc(organizationId)).thenReturn(
            listOf(
                EducationOffering(organizationId = organizationId, branchId = daycareBranchId, capabilities = "DAYCARE_OPERATIONS", status = EducationOfferingStatus.PUBLISHED),
                EducationOffering(organizationId = organizationId, branchId = otherBranchId, capabilities = "ACADEMIC_CURRICULUM", status = EducationOfferingStatus.DRAFT),
            ),
        )
        val service = PublishedOfferingCapabilityService(repository)

        assertTrue(service.hasPublishedCapability(organizationId, InstitutionCapability.DAYCARE_OPERATIONS, daycareBranchId))
        assertFalse(service.hasPublishedCapability(organizationId, InstitutionCapability.DAYCARE_OPERATIONS, otherBranchId))
        assertFalse(service.hasPublishedCapability(organizationId, InstitutionCapability.ACADEMIC_CURRICULUM))
    }

    @Test
    fun `ignores draft branch mismatches blank and unknown capability tokens`() {
        val repository = mock(EducationOfferingRepository::class.java)
        val organizationId = UUID.randomUUID()
        val branchId = UUID.randomUUID()
        `when`(repository.findAllByOrganizationIdOrderByCreatedAtAsc(organizationId)).thenReturn(listOf(
            EducationOffering(organizationId = organizationId, branchId = branchId, capabilities = " ,UNKNOWN,DAYCARE_OPERATIONS, ", status = EducationOfferingStatus.PUBLISHED),
            EducationOffering(organizationId = organizationId, branchId = UUID.randomUUID(), capabilities = "DAYCARE_OPERATIONS", status = EducationOfferingStatus.PUBLISHED),
        ))
        val service = PublishedOfferingCapabilityService(repository)

        assertTrue(service.hasPublishedCapability(organizationId, InstitutionCapability.DAYCARE_OPERATIONS))
        assertTrue(service.hasPublishedCapability(organizationId, InstitutionCapability.DAYCARE_OPERATIONS, branchId))
        assertFalse(service.hasPublishedCapability(organizationId, InstitutionCapability.ACADEMIC_CURRICULUM, branchId))
        assertThrows(AccessDeniedException::class.java) { service.requirePublishedCapability(organizationId, InstitutionCapability.ACADEMIC_CURRICULUM, branchId) }
    }
}
