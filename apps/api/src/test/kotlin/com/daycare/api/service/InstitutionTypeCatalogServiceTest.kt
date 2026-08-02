package com.daycare.api.service

import com.daycare.api.persistence.InstitutionTypeDefinition
import com.daycare.api.persistence.InstitutionTypeDefinitionRepository
import com.daycare.api.persistence.OrganizationTypeAssignmentRepository
import com.daycare.api.persistence.UserProfile
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Test
import org.mockito.ArgumentCaptor
import org.mockito.Mockito.any
import org.mockito.Mockito.mock
import org.mockito.Mockito.verify
import org.mockito.Mockito.`when`
import org.springframework.security.oauth2.jwt.Jwt
import java.util.Optional

class InstitutionTypeCatalogServiceTest {
    @Test
    fun `creates a normalized custom institution type for a Platform Admin`() {
        val types = mock(InstitutionTypeDefinitionRepository::class.java)
        val organizationTypes = mock(OrganizationTypeAssignmentRepository::class.java)
        val access = mock(PlatformAccessService::class.java)
        val jwt = mock(Jwt::class.java)
        `when`(access.requirePlatformAdmin(jwt)).thenReturn(UserProfile())
        `when`(types.existsByNameIgnoreCase("Taman Bermain")).thenReturn(false)
        `when`(types.existsById("TAMAN_BERMAIN")).thenReturn(false)
        `when`(types.save(any(InstitutionTypeDefinition::class.java))).thenAnswer { it.arguments[0] }
        val service = InstitutionTypeCatalogService(types, organizationTypes, access)

        val result = service.create(jwt, CreateInstitutionTypeDefinitionRequest("  Taman Bermain  "))

        assertEquals(InstitutionTypeDefinitionResponse("TAMAN_BERMAIN", "Taman Bermain", false, false), result)
        val type = ArgumentCaptor.forClass(InstitutionTypeDefinition::class.java)
        verify(types).save(type.capture())
        assertEquals("TAMAN_BERMAIN", type.value.code)
        assertEquals("Taman Bermain", type.value.name)
    }

    @Test
    fun `rejects a duplicate institution type name`() {
        val types = mock(InstitutionTypeDefinitionRepository::class.java)
        val organizationTypes = mock(OrganizationTypeAssignmentRepository::class.java)
        val access = mock(PlatformAccessService::class.java)
        val jwt = mock(Jwt::class.java)
        `when`(access.requirePlatformAdmin(jwt)).thenReturn(UserProfile())
        `when`(types.existsByNameIgnoreCase("Daycare")).thenReturn(true)
        val service = InstitutionTypeCatalogService(types, organizationTypes, access)

        assertThrows(IllegalArgumentException::class.java) { service.create(jwt, CreateInstitutionTypeDefinitionRequest("Daycare")) }
    }

    @Test
    fun `renames an institution type without changing its code`() {
        val types = mock(InstitutionTypeDefinitionRepository::class.java)
        val organizationTypes = mock(OrganizationTypeAssignmentRepository::class.java)
        val access = mock(PlatformAccessService::class.java)
        val jwt = mock(Jwt::class.java)
        val type = InstitutionTypeDefinition(code = "TAMAN_BERMAIN", name = "Taman Bermain")
        `when`(access.requirePlatformAdmin(jwt)).thenReturn(UserProfile())
        `when`(types.findById("TAMAN_BERMAIN")).thenReturn(Optional.of(type))
        `when`(types.findByNameIgnoreCase("Kelompok Bermain")).thenReturn(null)
        val service = InstitutionTypeCatalogService(types, organizationTypes, access)

        val result = service.update(jwt, "taman_bermain", CreateInstitutionTypeDefinitionRequest("Kelompok Bermain"))

        assertEquals(InstitutionTypeDefinitionResponse("TAMAN_BERMAIN", "Kelompok Bermain", false, false), result)
    }

    @Test
    fun `stores optional presentation fields and rejects a non HTTPS logo`() {
        val types = mock(InstitutionTypeDefinitionRepository::class.java)
        val organizationTypes = mock(OrganizationTypeAssignmentRepository::class.java)
        val access = mock(PlatformAccessService::class.java)
        val jwt = mock(Jwt::class.java)
        `when`(access.requirePlatformAdmin(jwt)).thenReturn(UserProfile())
        `when`(types.existsByNameIgnoreCase("Taman Bermain")).thenReturn(false)
        `when`(types.existsById("TAMAN_BERMAIN")).thenReturn(false)
        `when`(types.save(any(InstitutionTypeDefinition::class.java))).thenAnswer { it.arguments[0] }
        val service = InstitutionTypeCatalogService(types, organizationTypes, access)

        val result = service.create(jwt, CreateInstitutionTypeDefinitionRequest(
            name = "Taman Bermain",
            description = "Program bermain untuk usia dini.",
            logo = "https://cdn.example.test/logo.png",
            backgroundColor = "#FFF0D8",
            borderColor = "#D89A37",
            textColor = "#634000",
            parameters = mapOf("minimumAgeMonths" to "12"),
        ))

        assertEquals("https://cdn.example.test/logo.png", result.logo)
        assertEquals("Program bermain untuk usia dini.", result.description)
        assertEquals("#FFF0D8", result.backgroundColor)
        assertEquals(mapOf("minimumAgeMonths" to "12"), result.parameters)
        assertThrows(IllegalArgumentException::class.java) {
            service.create(jwt, CreateInstitutionTypeDefinitionRequest(name = "Logo Tidak Aman", logo = "http://example.test/logo.png"))
        }
    }

    @Test
    fun `rejects unsafe dynamic parameter names`() {
        val types = mock(InstitutionTypeDefinitionRepository::class.java)
        val organizationTypes = mock(OrganizationTypeAssignmentRepository::class.java)
        val access = mock(PlatformAccessService::class.java)
        val jwt = mock(Jwt::class.java)
        `when`(access.requirePlatformAdmin(jwt)).thenReturn(UserProfile())
        `when`(types.existsByNameIgnoreCase("Taman Bermain")).thenReturn(false)
        `when`(types.existsById("TAMAN_BERMAIN")).thenReturn(false)
        val service = InstitutionTypeCatalogService(types, organizationTypes, access)

        assertThrows(IllegalArgumentException::class.java) {
            service.create(jwt, CreateInstitutionTypeDefinitionRequest("Taman Bermain", parameters = mapOf("1invalid" to "value")))
        }
    }

    @Test
    fun `deletes only an unused custom institution type`() {
        val types = mock(InstitutionTypeDefinitionRepository::class.java)
        val organizationTypes = mock(OrganizationTypeAssignmentRepository::class.java)
        val access = mock(PlatformAccessService::class.java)
        val jwt = mock(Jwt::class.java)
        val type = InstitutionTypeDefinition(code = "TAMAN_BERMAIN", name = "Taman Bermain")
        `when`(access.requirePlatformAdmin(jwt)).thenReturn(UserProfile())
        `when`(organizationTypes.existsByType("TAMAN_BERMAIN")).thenReturn(false)
        `when`(types.findById("TAMAN_BERMAIN")).thenReturn(Optional.of(type))
        val service = InstitutionTypeCatalogService(types, organizationTypes, access)

        service.delete(jwt, "TAMAN_BERMAIN")

        verify(types).delete(type)
    }
}
