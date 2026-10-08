package com.daycare.api.service

import com.daycare.api.domain.InvoiceSource
import com.daycare.api.domain.InvoiceStatus
import com.daycare.api.domain.ParentEnrollmentStatus
import com.daycare.api.domain.Role
import com.daycare.api.persistence.Invoice
import com.daycare.api.persistence.InvoiceRepository
import com.daycare.api.persistence.Membership
import com.daycare.api.persistence.ParentEnrollment
import com.daycare.api.persistence.ParentEnrollmentRepository
import com.daycare.api.persistence.TenantPaymentInstruction
import com.daycare.api.persistence.TenantPaymentInstructionRepository
import com.daycare.api.persistence.UserProfile
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.mockito.Mockito.any
import org.mockito.Mockito.mock
import org.mockito.Mockito.verify
import org.mockito.Mockito.`when`
import org.springframework.security.oauth2.jwt.Jwt
import java.util.Optional
import java.util.UUID

class TenantPaymentInstructionServiceTest {
    @Test
    fun `approved parent can list active instructions`() {
        val fixture = fixture()
        val user = UserProfile(displayName = "Parent")
        `when`(fixture.identity.sync(fixture.jwt)).thenReturn(user)
        `when`(fixture.enrollments.findAllByUserIdOrderByCreatedAtDesc(user.id)).thenReturn(listOf(ParentEnrollment(userId = user.id, organizationId = fixture.organizationId, status = ParentEnrollmentStatus.APPROVED)))
        val instruction = TenantPaymentInstruction(organizationId = fixture.organizationId, name = "Bank", accountHolder = "Sekolah", accountNumber = "123", note = null, active = true, displayOrder = 2)
        `when`(fixture.instructions.findAllByOrganizationIdAndActiveTrueOrderByDisplayOrderAscCreatedAtAsc(fixture.organizationId)).thenReturn(listOf(instruction))

        val result = fixture.service.list(fixture.jwt, fixture.organizationId)

        assertEquals("Bank", result.single().name)
        assertNull(result.single().note)
    }

    @Test
    fun `private tutoring invoice also grants parent access`() {
        val fixture = fixture()
        val user = UserProfile(displayName = "Parent")
        `when`(fixture.identity.sync(fixture.jwt)).thenReturn(user)
        `when`(fixture.enrollments.findAllByUserIdOrderByCreatedAtDesc(user.id)).thenReturn(emptyList())
        `when`(fixture.invoices.findAllByOrganizationIdAndPayerUserIdOrderByCreatedAtDesc(fixture.organizationId, user.id)).thenReturn(listOf(Invoice(organizationId = fixture.organizationId, payerUserId = user.id, source = InvoiceSource.PRIVATE_TUTORING, status = InvoiceStatus.PAYMENT_SUBMITTED)))
        `when`(fixture.instructions.findAllByOrganizationIdAndActiveTrueOrderByDisplayOrderAscCreatedAtAsc(fixture.organizationId)).thenReturn(emptyList())

        assertTrue(fixture.service.list(fixture.jwt, fixture.organizationId).isEmpty())
    }

    @Test
    fun `management and CRUD normalize values and enforce organization ownership`() {
        val fixture = fixture()
        val existing = TenantPaymentInstruction(organizationId = fixture.organizationId, name = "Old", accountHolder = "Old", accountNumber = "1", active = true)
        `when`(fixture.instructions.findAllByOrganizationIdOrderByDisplayOrderAscCreatedAtAsc(fixture.organizationId)).thenReturn(listOf(existing))
        `when`(fixture.instructions.save(any(TenantPaymentInstruction::class.java))).thenAnswer { it.arguments[0] }
        `when`(fixture.instructions.findById(existing.id)).thenReturn(Optional.of(existing))

        assertEquals(1, fixture.service.listForManagement(fixture.jwt, fixture.organizationId).size)
        val created = fixture.service.create(fixture.jwt, fixture.organizationId, UpsertPaymentInstructionRequest("  Bank  ", "  Holder ", "  123 ", " note ", active = false, displayOrder = 4))
        assertEquals("Bank", created.name)
        assertEquals("note", created.note)
        val updated = fixture.service.update(fixture.jwt, fixture.organizationId, existing.id, UpsertPaymentInstructionRequest(" New ", " H ", " 9 ", " "))
        assertEquals("New", updated.name)
        assertNull(updated.note)
        fixture.service.delete(fixture.jwt, fixture.organizationId, existing.id)
        verify(fixture.instructions).delete(existing)
        assertThrows(IllegalArgumentException::class.java) { fixture.service.update(fixture.jwt, fixture.organizationId, UUID.randomUUID(), UpsertPaymentInstructionRequest("n", "h", "a")) }
    }

    @Test
    fun `has active instruction reflects repository state`() {
        val fixture = fixture()
        `when`(fixture.instructions.findAllByOrganizationIdAndActiveTrueOrderByDisplayOrderAscCreatedAtAsc(fixture.organizationId)).thenReturn(listOf(TenantPaymentInstruction(organizationId = fixture.organizationId)))
        assertTrue(fixture.service.hasActiveInstruction(fixture.organizationId))
        `when`(fixture.instructions.findAllByOrganizationIdAndActiveTrueOrderByDisplayOrderAscCreatedAtAsc(fixture.organizationId)).thenReturn(emptyList())
        assertFalse(fixture.service.hasActiveInstruction(fixture.organizationId))
    }

    private data class Fixture(
        val organizationId: UUID,
        val jwt: Jwt,
        val identity: IdentityService,
        val instructions: TenantPaymentInstructionRepository,
        val enrollments: ParentEnrollmentRepository,
        val invoices: InvoiceRepository,
        val service: TenantPaymentInstructionService,
    )

    private fun fixture(): Fixture {
        val organizationId = UUID.randomUUID()
        val jwt = mock(Jwt::class.java)
        val access = mock(AccessService::class.java)
        val identity = mock(IdentityService::class.java)
        val instructions = mock(TenantPaymentInstructionRepository::class.java)
        val enrollments = mock(ParentEnrollmentRepository::class.java)
        val invoices = mock(InvoiceRepository::class.java)
        `when`(access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN), readOnly = true)).thenReturn(AccessScope(UserProfile(), Membership(), emptySet(), emptySet()))
        `when`(access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN))).thenReturn(AccessScope(UserProfile(), Membership(), emptySet(), emptySet()))
        return Fixture(organizationId, jwt, identity, instructions, enrollments, invoices, TenantPaymentInstructionService(access, identity, instructions, enrollments, invoices))
    }
}
