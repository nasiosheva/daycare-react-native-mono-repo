package com.daycare.api.service

import com.daycare.api.domain.ParentIncomeRange
import com.daycare.api.domain.ParentOccupation
import com.daycare.api.persistence.InstitutionTypeDefinition
import com.daycare.api.persistence.InstitutionTypeDefinitionRepository
import com.daycare.api.persistence.OrganizationTypeAssignment
import com.daycare.api.persistence.OrganizationTypeAssignmentRepository
import com.daycare.api.persistence.ParentFamilyProfile
import com.daycare.api.persistence.ParentFamilyProfileRepository
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Test
import org.mockito.Mockito.mock
import org.mockito.Mockito.`when`
import java.util.UUID

class ParentFamilyProfileVisibilityServiceTest {
    private val organizationTypes = mock(OrganizationTypeAssignmentRepository::class.java)
    private val institutionTypes = mock(InstitutionTypeDefinitionRepository::class.java)
    private val profiles = mock(ParentFamilyProfileRepository::class.java)
    private val service = ParentFamilyProfileVisibilityService(organizationTypes, institutionTypes, profiles)

    @Test
    fun `returns only fields enabled by at least one tenant institution type`() {
        val organizationId = UUID.randomUUID()
        val parentId = UUID.randomUUID()
        `when`(organizationTypes.findAllByOrganizationId(organizationId)).thenReturn(listOf(OrganizationTypeAssignment(organizationId = organizationId, type = "TK")))
        `when`(institutionTypes.findAllById(listOf("TK"))).thenReturn(listOf(InstitutionTypeDefinition(code = "TK", name = "TK", parentOccupationVisible = true)))
        `when`(profiles.findByUserId(parentId)).thenReturn(ParentFamilyProfile(userId = parentId, husbandOccupation = ParentOccupation.PNS, husbandIncomeRange = ParentIncomeRange.FIVE_TO_TEN_MILLION, wifeOccupation = ParentOccupation.PROFESIONAL, wifeIncomeRange = ParentIncomeRange.TEN_TO_TWENTY_MILLION))

        val result = service.forTenant(organizationId, parentId)

        assertEquals(ParentOccupation.PNS, result?.husbandOccupation)
        assertEquals(ParentOccupation.PROFESIONAL, result?.wifeOccupation)
        assertNull(result?.husbandIncomeRange)
        assertNull(result?.wifeIncomeRange)
    }

    @Test
    fun `does not load Parent profile when the tenant types grant no visibility`() {
        val organizationId = UUID.randomUUID()
        val parentId = UUID.randomUUID()
        `when`(organizationTypes.findAllByOrganizationId(organizationId)).thenReturn(listOf(OrganizationTypeAssignment(organizationId = organizationId, type = "PAUD")))
        `when`(institutionTypes.findAllById(listOf("PAUD"))).thenReturn(listOf(InstitutionTypeDefinition(code = "PAUD", name = "PAUD")))

        assertNull(service.forTenant(organizationId, parentId))
    }
}
