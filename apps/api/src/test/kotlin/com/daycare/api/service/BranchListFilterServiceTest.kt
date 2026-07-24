package com.daycare.api.service

import com.daycare.api.persistence.Branch
import com.daycare.api.persistence.BranchRepository
import org.junit.jupiter.api.Assertions.assertDoesNotThrow
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Test
import org.mockito.Mockito.mock
import org.mockito.Mockito.`when`
import java.util.Optional
import java.util.UUID

class BranchListFilterServiceTest {
    @Test
    fun `accepts an empty filter or a branch in the selected organization`() {
        val branches = mock(BranchRepository::class.java)
        val organizationId = UUID.randomUUID()
        val branch = Branch(organizationId = organizationId)
        `when`(branches.findById(branch.id)).thenReturn(Optional.of(branch))
        val service = BranchListFilterService(branches)

        assertDoesNotThrow { service.validate(organizationId, BranchListFilter()) }
        assertDoesNotThrow { service.validate(organizationId, BranchListFilter(branch.id)) }
    }

    @Test
    fun `rejects a branch from another organization`() {
        val branches = mock(BranchRepository::class.java)
        val branch = Branch(organizationId = UUID.randomUUID())
        `when`(branches.findById(branch.id)).thenReturn(Optional.of(branch))
        val service = BranchListFilterService(branches)

        assertThrows(IllegalArgumentException::class.java) { service.validate(UUID.randomUUID(), BranchListFilter(branch.id)) }
    }
}
