package com.daycare.api.service

import com.daycare.api.domain.InvoiceStatus
import com.daycare.api.domain.Role
import com.daycare.api.persistence.TenantPaymentInstruction
import com.daycare.api.persistence.TenantPaymentInstructionRepository
import com.daycare.api.persistence.ParentEnrollmentRepository
import com.daycare.api.persistence.InvoiceRepository
import com.daycare.api.domain.InvoiceSource
import com.daycare.api.domain.ParentEnrollmentStatus
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.Size
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

data class PaymentInstructionResponse(val id: UUID, val name: String, val accountHolder: String, val accountNumber: String, val note: String?, val active: Boolean, val displayOrder: Int)
data class UpsertPaymentInstructionRequest(
    @field:NotBlank @field:Size(max = 100) val name: String,
    @field:NotBlank @field:Size(max = 200) val accountHolder: String,
    @field:NotBlank @field:Size(max = 200) val accountNumber: String,
    @field:Size(max = 500) val note: String? = null,
    val active: Boolean = true,
    val displayOrder: Int = 0,
)

object TenantPaymentInstructionError {
    const val NOT_FOUND = "tenant_payment_instruction.not_found"
}

@Service
class TenantPaymentInstructionService(
    private val access: AccessService,
    private val identity: IdentityService,
    private val instructions: TenantPaymentInstructionRepository,
    private val enrollments: ParentEnrollmentRepository,
    private val invoices: InvoiceRepository,
) {
    @Transactional(readOnly = true)
    fun list(jwt: Jwt, organizationId: UUID): List<PaymentInstructionResponse> {
        val user = identity.sync(jwt)
        val approvedEnrollment = enrollments.findAllByUserIdOrderByCreatedAtDesc(user.id).any { it.organizationId == organizationId && it.status == ParentEnrollmentStatus.APPROVED }
        val tutoringInvoice = invoices.findAllByOrganizationIdAndPayerUserIdOrderByCreatedAtDesc(organizationId, user.id).any {
            it.source == InvoiceSource.PRIVATE_TUTORING && it.status in setOf(InvoiceStatus.PENDING, InvoiceStatus.PAYMENT_SUBMITTED)
        }
        if (!approvedEnrollment && !tutoringInvoice) access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN), readOnly = true)
        return instructions.findAllByOrganizationIdAndActiveTrueOrderByDisplayOrderAscCreatedAtAsc(organizationId).map(::response)
    }

    @Transactional(readOnly = true)
    fun listForManagement(jwt: Jwt, organizationId: UUID): List<PaymentInstructionResponse> {
        access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN), readOnly = true)
        return instructions.findAllByOrganizationIdOrderByDisplayOrderAscCreatedAtAsc(organizationId).map(::response)
    }

    @Transactional
    fun create(jwt: Jwt, organizationId: UUID, request: UpsertPaymentInstructionRequest): PaymentInstructionResponse {
        access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN))
        return response(instructions.save(TenantPaymentInstruction(organizationId = organizationId, name = request.name.trim(), accountHolder = request.accountHolder.trim(), accountNumber = request.accountNumber.trim(), note = request.note?.trim()?.ifBlank { null }, active = request.active, displayOrder = request.displayOrder)))
    }

    @Transactional
    fun update(jwt: Jwt, organizationId: UUID, instructionId: UUID, request: UpsertPaymentInstructionRequest): PaymentInstructionResponse {
        access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN))
        val instruction = instructions.findById(instructionId).orElseThrow { IllegalArgumentException(TenantPaymentInstructionError.NOT_FOUND) }
        require(instruction.organizationId == organizationId) { TenantPaymentInstructionError.NOT_FOUND }
        instruction.name = request.name.trim(); instruction.accountHolder = request.accountHolder.trim(); instruction.accountNumber = request.accountNumber.trim(); instruction.note = request.note?.trim()?.ifBlank { null }; instruction.active = request.active; instruction.displayOrder = request.displayOrder
        return response(instruction)
    }

    @Transactional
    fun delete(jwt: Jwt, organizationId: UUID, instructionId: UUID) {
        access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN))
        val instruction = instructions.findById(instructionId).orElseThrow { IllegalArgumentException(TenantPaymentInstructionError.NOT_FOUND) }
        require(instruction.organizationId == organizationId) { TenantPaymentInstructionError.NOT_FOUND }
        instructions.delete(instruction)
    }

    fun hasActiveInstruction(organizationId: UUID) = instructions.findAllByOrganizationIdAndActiveTrueOrderByDisplayOrderAscCreatedAtAsc(organizationId).isNotEmpty()
    private fun response(value: TenantPaymentInstruction) = PaymentInstructionResponse(value.id, value.name, value.accountHolder, value.accountNumber, value.note, value.active, value.displayOrder)
}
