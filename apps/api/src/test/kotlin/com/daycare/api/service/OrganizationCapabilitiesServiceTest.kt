package com.daycare.api.service

import com.daycare.api.domain.InstitutionCapability
import com.daycare.api.persistence.OrganizationTypeAssignment
import com.daycare.api.persistence.OrganizationTypeAssignmentRepository
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import org.mockito.Mockito.mock
import org.mockito.Mockito.`when`
import java.util.UUID

class OrganizationCapabilitiesServiceTest {
    @Test
    fun `empty organization type assignments default to daycare capabilities`() {
        val repository = mock(OrganizationTypeAssignmentRepository::class.java)
        val organizationId = UUID.randomUUID()
        `when`(repository.findAllByOrganizationId(organizationId)).thenReturn(emptyList())

        val response = OrganizationCapabilitiesService(repository).forOrganization(organizationId)

        assertEquals(setOf("DAYCARE"), response.types)
        assertEquals(setOf(InstitutionCapability.DAYCARE_OPERATIONS), response.capabilities)
    }

    @Test
    fun `capabilities are derived from every assigned institution type`() {
        val repository = mock(OrganizationTypeAssignmentRepository::class.java)
        val organizationId = UUID.randomUUID()
        `when`(repository.findAllByOrganizationId(organizationId)).thenReturn(
            listOf(
                OrganizationTypeAssignment(organizationId = organizationId, type = "DAYCARE"),
                OrganizationTypeAssignment(organizationId = organizationId, type = "PAUD"),
            ),
        )

        val response = OrganizationCapabilitiesService(repository).forOrganization(organizationId)

        assertEquals(setOf("DAYCARE", "PAUD"), response.types)
        assertEquals(setOf(InstitutionCapability.DAYCARE_OPERATIONS, InstitutionCapability.ACADEMIC_CURRICULUM), response.capabilities)
    }
}
