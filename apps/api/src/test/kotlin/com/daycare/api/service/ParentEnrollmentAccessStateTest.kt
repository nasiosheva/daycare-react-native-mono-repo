package com.daycare.api.service

import com.daycare.api.domain.ChildEnrollmentStatus
import com.daycare.api.domain.Gender
import com.daycare.api.domain.InvoiceStatus
import com.daycare.api.domain.ParentEnrollmentStatus
import com.daycare.api.domain.RegistrationRole
import com.daycare.api.persistence.BranchRepository
import com.daycare.api.persistence.Child
import com.daycare.api.persistence.ChildRepository
import com.daycare.api.persistence.GuardianLinkRepository
import com.daycare.api.persistence.Invoice
import com.daycare.api.persistence.InvoiceRepository
import com.daycare.api.persistence.MembershipRepository
import com.daycare.api.persistence.OrganizationRepository
import com.daycare.api.persistence.ParentEnrollment
import com.daycare.api.persistence.ParentEnrollmentRepository
import com.daycare.api.persistence.ServiceEntitlementRepository
import com.daycare.api.persistence.ServicePlanRepository
import com.daycare.api.persistence.TenantSubscriptionRepository
import com.daycare.api.persistence.UserProfile
import com.daycare.api.persistence.UserProfileRepository
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import org.mockito.Mockito.mock
import org.mockito.Mockito.`when`
import org.springframework.security.oauth2.jwt.Jwt
import java.math.BigDecimal
import java.time.LocalDate
import java.util.Optional
import java.util.UUID

class ParentEnrollmentAccessStateTest {
    @Test
    fun `mine maps every enrollment and invoice state to the documented parent access actions`() {
        val identity = mock(IdentityService::class.java)
        val enrollments = mock(ParentEnrollmentRepository::class.java)
        val children = mock(ChildRepository::class.java)
        val invoices = mock(InvoiceRepository::class.java)
        val parent = UserProfile(registrationRole = RegistrationRole.PARENT, displayName = "Parent")
        val jwt = mock(Jwt::class.java)
        val childById = mutableMapOf<UUID, Child>()
        val invoiceById = mutableMapOf<UUID, Invoice>()
        val cases = listOf(
            ParentEnrollmentStatus.PENDING_APPROVAL to null,
            ParentEnrollmentStatus.REJECTED to null,
            ParentEnrollmentStatus.CANCELLED to null,
            ParentEnrollmentStatus.EXPIRED to null,
            ParentEnrollmentStatus.APPROVED to InvoiceStatus.OVERDUE,
            ParentEnrollmentStatus.APPROVED to InvoiceStatus.PENDING,
            ParentEnrollmentStatus.APPROVED to InvoiceStatus.PAYMENT_SUBMITTED,
            ParentEnrollmentStatus.APPROVED to InvoiceStatus.PAID,
            ParentEnrollmentStatus.APPROVED to null,
        )
        val enrollmentList = cases.mapIndexed { index, (status, invoiceStatus) ->
            val child = Child(organizationId = UUID.randomUUID(), firstName = "Child$index", lastName = if (index % 2 == 0) null else "Test", gender = Gender.FEMALE, enrollmentStatus = ChildEnrollmentStatus.PENDING)
            childById[child.id] = child
            val invoiceId = invoiceStatus?.let {
                val invoice = Invoice(organizationId = child.organizationId, payerUserId = parent.id, childId = child.id, invoiceNumber = "INV-$index", totalAmount = BigDecimal("10"), status = it)
                invoiceById[invoice.id] = invoice
                invoice.id
            }
            ParentEnrollment(userId = parent.id, organizationId = child.organizationId, branchId = UUID.randomUUID(), childId = child.id, selectedPlanName = "Paket", selectedTotalAmount = BigDecimal("10"), status = status, invoiceId = invoiceId)
        }
        `when`(identity.sync(jwt)).thenReturn(parent)
        `when`(enrollments.findAllByUserIdOrderByCreatedAtDesc(parent.id)).thenReturn(enrollmentList)
        childById.forEach { (id, child) -> `when`(children.findById(id)).thenReturn(Optional.of(child)) }
        invoiceById.forEach { (id, invoice) -> `when`(invoices.findById(id)).thenReturn(Optional.of(invoice)) }
        val service = ParentEnrollmentService(
            identity,
            mock(AccessService::class.java),
            mock(OrganizationRepository::class.java),
            mock(TenantSubscriptionRepository::class.java),
            mock(BranchRepository::class.java),
            mock(ServicePlanRepository::class.java),
            children,
            enrollments,
            mock(MembershipRepository::class.java),
            mock(GuardianLinkRepository::class.java),
            mock(UserProfileRepository::class.java),
            mock(ServiceEntitlementRepository::class.java),
            invoices,
            mock(BillingService::class.java),
            mock(NotificationService::class.java),
            mock(BranchListFilterService::class.java),
            mock(TenantPaymentInstructionService::class.java),
            mock(ParentFamilyProfileVisibilityService::class.java),
            mock(PublishedOfferingCapabilityService::class.java),
        )

        val responses = service.mine(jwt)

        assertEquals(ParentEnrollmentAccessState.PENDING_APPROVAL, responses[0].accessState)
        assertEquals(setOf(ParentEnrollmentAllowedAction.CANCEL), responses[0].allowedActions)
        assertEquals(ParentEnrollmentAccessState.CLOSED, responses[1].accessState)
        assertEquals(setOf(ParentEnrollmentAllowedAction.REAPPLY), responses[1].allowedActions)
        assertEquals(ParentEnrollmentAccessState.CLOSED, responses[2].accessState)
        assertEquals(ParentEnrollmentAccessState.CLOSED, responses[3].accessState)
        assertEquals(ParentEnrollmentAccessState.BILLING_LIMITED, responses[4].accessState)
        assertEquals(ParentEnrollmentAccessState.PAYMENT_DUE, responses[5].accessState)
        assertEquals(setOf(ParentEnrollmentAllowedAction.UPLOAD_PAYMENT_PROOF), responses[5].allowedActions)
        assertEquals(ParentEnrollmentAccessState.PAYMENT_REVIEW, responses[6].accessState)
        assertEquals(ParentEnrollmentAccessState.ACTIVE, responses[7].accessState)
        assertEquals(ParentEnrollmentAccessState.PAYMENT_DUE, responses[8].accessState)
    }
}
