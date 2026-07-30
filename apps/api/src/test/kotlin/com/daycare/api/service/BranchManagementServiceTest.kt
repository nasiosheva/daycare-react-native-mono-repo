package com.daycare.api.service

import com.daycare.api.persistence.Branch
import com.daycare.api.persistence.BranchRepository
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Test
import org.mockito.ArgumentCaptor
import org.mockito.Mockito.any
import org.mockito.Mockito.mock
import org.mockito.Mockito.verify
import org.mockito.Mockito.`when`
import org.springframework.security.oauth2.jwt.Jwt
import java.util.UUID

class BranchManagementServiceTest {
    @Test
    fun `Staff Admin saves a required address and an optional Google Maps link`() {
        val branches = mock(BranchRepository::class.java)
        `when`(branches.save(any(Branch::class.java))).thenAnswer { it.arguments[0] }
        val service = BranchManagementService(mock(AccessService::class.java), branches)
        val organizationId = UUID.randomUUID()

        val response = service.create(mock(Jwt::class.java), organizationId, CreateTenantBranchRequest("Utama", fullAddress = "Jl. Merdeka No. 1, Jakarta", googleMapsUrl = "https://maps.app.goo.gl/example"))

        assertEquals("Jl. Merdeka No. 1, Jakarta", response.fullAddress)
        assertEquals("https://maps.app.goo.gl/example", response.googleMapsUrl)
        val branch = ArgumentCaptor.forClass(Branch::class.java)
        verify(branches).save(branch.capture())
        assertEquals(organizationId, branch.value.organizationId)
    }

    @Test
    fun `rejects a non Google Maps location link`() {
        val service = BranchManagementService(mock(AccessService::class.java), mock(BranchRepository::class.java))

        assertThrows(IllegalArgumentException::class.java) {
            service.create(mock(Jwt::class.java), UUID.randomUUID(), CreateTenantBranchRequest("Utama", fullAddress = "Jl. Merdeka No. 1", googleMapsUrl = "https://example.com/location"))
        }
    }
}
