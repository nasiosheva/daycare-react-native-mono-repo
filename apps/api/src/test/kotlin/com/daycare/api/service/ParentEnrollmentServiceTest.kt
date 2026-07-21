package com.daycare.api.service

import com.daycare.api.domain.ChildEnrollmentStatus
import com.daycare.api.domain.EntitlementStatus
import com.daycare.api.domain.InstitutionCapability
import com.daycare.api.domain.InstitutionType
import com.daycare.api.domain.InvoiceStatus
import com.daycare.api.domain.ServicePlanType
import com.daycare.api.domain.TenantSubscriptionStatus
import com.daycare.api.persistence.Branch
import com.daycare.api.persistence.BranchRepository
import com.daycare.api.persistence.Child
import com.daycare.api.persistence.ChildRepository
import com.daycare.api.persistence.GuardianLinkRepository
import com.daycare.api.persistence.MembershipRepository
import com.daycare.api.persistence.OrganizationRepository
import com.daycare.api.persistence.ParentEnrollment
import com.daycare.api.persistence.ParentEnrollmentRepository
import com.daycare.api.persistence.ServiceEntitlementRepository
import com.daycare.api.persistence.ServicePlanRepository
import com.daycare.api.persistence.TenantSubscription
import com.daycare.api.persistence.TenantSubscriptionRepository
import com.daycare.api.persistence.UserProfile
import com.daycare.api.persistence.UserProfileRepository
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import org.mockito.ArgumentCaptor
import org.mockito.Mockito.any
import org.mockito.Mockito.mock
import org.mockito.Mockito.times
import org.mockito.Mockito.verify
import org.mockito.Mockito.`when`
import org.springframework.security.oauth2.jwt.Jwt
import java.math.BigDecimal
import java.time.Instant
import java.time.LocalDate
import java.util.Optional
import java.util.UUID

class ParentEnrollmentServiceTest {
    @Test
    fun `one Parent checkout creates an enrollment for every submitted child`() {
        val identity = mock(IdentityService::class.java)
        val access = mock(AccessService::class.java)
        val organizations = mock(OrganizationRepository::class.java)
        val subscriptions = mock(TenantSubscriptionRepository::class.java)
        val capabilities = mock(OrganizationCapabilitiesService::class.java)
        val branches = mock(BranchRepository::class.java)
        val plans = mock(ServicePlanRepository::class.java)
        val children = mock(ChildRepository::class.java)
        val enrollments = mock(ParentEnrollmentRepository::class.java)
        val memberships = mock(MembershipRepository::class.java)
        val guardians = mock(GuardianLinkRepository::class.java)
        val users = mock(UserProfileRepository::class.java)
        val entitlements = mock(ServiceEntitlementRepository::class.java)
        val billing = mock(BillingService::class.java)
        val notifications = mock(NotificationService::class.java)
        val organizationId = UUID.randomUUID()
        val branch = Branch(organizationId = organizationId, name = "Cabang Utama")
        val parent = UserProfile()
        val planId = UUID.randomUUID()
        val firstChild = Child(organizationId = organizationId, branchId = branch.id, firstName = "Alya", enrollmentStatus = ChildEnrollmentStatus.PENDING)
        val secondChild = Child(organizationId = organizationId, branchId = branch.id, firstName = "Bima", lastName = "Putra", enrollmentStatus = ChildEnrollmentStatus.PENDING)
        val jwt = mock(Jwt::class.java)
        `when`(identity.sync(jwt)).thenReturn(parent)
        `when`(memberships.findAllByUserIdAndOrganizationId(parent.id, organizationId)).thenReturn(emptyList())
        `when`(subscriptions.findByOrganizationId(organizationId)).thenReturn(TenantSubscription(organizationId = organizationId, status = TenantSubscriptionStatus.ACTIVE))
        `when`(capabilities.forOrganization(organizationId)).thenReturn(OrganizationCapabilities(setOf(InstitutionType.DAYCARE), setOf(InstitutionCapability.DAYCARE_OPERATIONS)))
        `when`(branches.findById(branch.id)).thenReturn(Optional.of(branch))
        `when`(children.save(any(Child::class.java))).thenReturn(firstChild, secondChild)
        `when`(children.findById(firstChild.id)).thenReturn(Optional.of(firstChild))
        `when`(children.findById(secondChild.id)).thenReturn(Optional.of(secondChild))
        `when`(enrollments.save(any(ParentEnrollment::class.java))).thenAnswer { it.arguments[0] }
        `when`(memberships.findAllByOrganizationId(organizationId)).thenReturn(emptyList())
        `when`(billing.purchaseForEnrollment(parent, organizationId, firstChild, PurchaseServiceRequest(planId, firstChild.id, emptyList()))).thenReturn(purchaseResponse(firstChild))
        `when`(billing.purchaseForEnrollment(parent, organizationId, secondChild, PurchaseServiceRequest(planId, secondChild.id, emptyList()))).thenReturn(purchaseResponse(secondChild))
        val service = ParentEnrollmentService(identity, access, organizations, subscriptions, capabilities, branches, plans, children, enrollments, memberships, guardians, users, entitlements, billing, notifications)

        val response = service.checkout(jwt, ParentEnrollmentCheckoutRequest(organizationId, branch.id, planId, emptyList(), children = listOf(ParentEnrollmentChildInput("Alya", null, LocalDate.of(2022, 1, 1)), ParentEnrollmentChildInput("Bima", "Putra", LocalDate.of(2023, 2, 2)))))

        assertEquals(listOf("Alya", "Bima Putra"), response.map { it.childName })
        val childCaptor = ArgumentCaptor.forClass(Child::class.java)
        verify(children, times(2)).save(childCaptor.capture())
        assertEquals(listOf(ChildEnrollmentStatus.PENDING, ChildEnrollmentStatus.PENDING), childCaptor.allValues.map { it.enrollmentStatus })
        verify(billing).purchaseForEnrollment(parent, organizationId, firstChild, PurchaseServiceRequest(planId, firstChild.id, emptyList()))
        verify(billing).purchaseForEnrollment(parent, organizationId, secondChild, PurchaseServiceRequest(planId, secondChild.id, emptyList()))
    }

    private fun purchaseResponse(child: Child): PurchaseServiceResponse {
        val invoiceId = UUID.randomUUID()
        return PurchaseServiceResponse(
            EntitlementResponse(UUID.randomUUID(), child.id, child.firstName, null, null, "Paket", ServicePlanType.MONTHLY, EntitlementStatus.PENDING_PAYMENT, null, null, LocalDate.now()),
            InvoiceResponse(invoiceId, "INV-TEST", child.id, child.firstName, null, null, BigDecimal.ONE, BigDecimal.ZERO, null, null, BigDecimal.ONE, InvoiceStatus.PENDING, LocalDate.now(), Instant.now()),
            emptyList(),
        )
    }
}
