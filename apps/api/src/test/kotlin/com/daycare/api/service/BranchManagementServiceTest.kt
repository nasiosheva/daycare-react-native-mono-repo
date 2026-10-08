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
import org.mockito.Mockito.never
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

    @Test
    fun `branch listing searches and keeps primary branch first`() {
        val branches = mock(BranchRepository::class.java)
        val organizationId = UUID.randomUUID()
        val primary = Branch(organizationId = organizationId, name = "Zeta", primary = true)
        val other = Branch(organizationId = organizationId, name = "Alpha")
        `when`(branches.findAllByOrganizationId(organizationId)).thenReturn(listOf(primary, other))
        `when`(branches.findAllByOrganizationIdAndNameContainingIgnoreCase(organizationId, "alpha")).thenReturn(listOf(other))
        val service = BranchManagementService(mock(AccessService::class.java), branches)
        val jwt = mock(Jwt::class.java)

        assertEquals(listOf("Zeta", "Alpha"), service.branches(jwt, organizationId).map { it.name })
        assertEquals(listOf("Alpha"), service.branches(jwt, organizationId, " alpha ").map { it.name })
    }

    @Test
    fun `branch lifecycle validates timezone address and primary archive rules`() {
        val branches = mock(BranchRepository::class.java)
        val organizationId = UUID.randomUUID()
        val branch = Branch(organizationId = organizationId, name = "Old", primary = false)
        val currentPrimary = Branch(organizationId = organizationId, name = "Main", primary = true)
        `when`(branches.findById(branch.id)).thenReturn(java.util.Optional.of(branch))
        `when`(branches.findById(currentPrimary.id)).thenReturn(java.util.Optional.of(currentPrimary))
        `when`(branches.findByOrganizationIdAndPrimaryTrue(organizationId)).thenReturn(currentPrimary)
        val service = BranchManagementService(mock(AccessService::class.java), branches)
        val jwt = mock(Jwt::class.java)

        assertThrows(IllegalArgumentException::class.java) { service.create(jwt, organizationId, CreateTenantBranchRequest("x", timezone = "Not/AZone", fullAddress = "x")) }
        assertThrows(IllegalArgumentException::class.java) { service.create(jwt, organizationId, CreateTenantBranchRequest("x", fullAddress = "  ")) }
        val updated = service.update(jwt, organizationId, branch.id, UpdateTenantBranchRequest(" New ", "Asia/Jakarta", " Address ", ""))
        assertEquals("New", updated.name)
        assertEquals("Address", updated.fullAddress)
        assertEquals(null, updated.googleMapsUrl)
        assertEquals(branch.id, service.setPrimary(jwt, organizationId, branch.id).id)
        assertEquals(true, branch.primary)
        assertEquals(false, currentPrimary.primary)
        branch.primary = false
        assertEquals(false, service.archive(jwt, organizationId, branch.id).active)
        currentPrimary.primary = true
        assertThrows(IllegalArgumentException::class.java) { service.archive(jwt, organizationId, currentPrimary.id) }
        branch.active = false
        assertThrows(IllegalArgumentException::class.java) { service.setPrimary(jwt, organizationId, branch.id) }
        verify(branches, never()).save(org.mockito.ArgumentMatchers.any())
    }
}
