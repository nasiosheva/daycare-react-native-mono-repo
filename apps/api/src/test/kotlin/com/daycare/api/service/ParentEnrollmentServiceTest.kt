package com.daycare.api.service

import com.daycare.api.domain.ChildEnrollmentStatus
import com.daycare.api.domain.Gender
import com.daycare.api.domain.InstitutionCapability
import com.daycare.api.domain.InstitutionTypeCodes
import com.daycare.api.domain.ParentEnrollmentStatus
import com.daycare.api.domain.TenantSubscriptionStatus
import com.daycare.api.persistence.Branch
import com.daycare.api.persistence.BranchRepository
import com.daycare.api.persistence.Child
import com.daycare.api.persistence.ChildRepository
import com.daycare.api.persistence.GuardianLinkRepository
import com.daycare.api.persistence.InvoiceRepository
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
        val invoices = mock(InvoiceRepository::class.java)
        val billing = mock(BillingService::class.java)
        val notifications = mock(NotificationService::class.java)
        val paymentInstructions = mock(TenantPaymentInstructionService::class.java)
        val organizationId = UUID.randomUUID()
        val branch = Branch(organizationId = organizationId, name = "Cabang Utama")
        val parent = UserProfile()
        val planId = UUID.randomUUID()
        val additionalOrganizationId = UUID.randomUUID()
        val additionalBranch = Branch(organizationId = additionalOrganizationId, name = "Cabang Kedua")
        val additionalPlanId = UUID.randomUUID()
        val firstChild = Child(organizationId = organizationId, branchId = branch.id, firstName = "Alya", enrollmentStatus = ChildEnrollmentStatus.PENDING)
        val secondChild = Child(organizationId = organizationId, branchId = branch.id, firstName = "Bima", lastName = "Putra", enrollmentStatus = ChildEnrollmentStatus.PENDING)
        val thirdChild = Child(organizationId = additionalOrganizationId, branchId = additionalBranch.id, firstName = "Citra", enrollmentStatus = ChildEnrollmentStatus.PENDING)
        val jwt = mock(Jwt::class.java)
        `when`(identity.sync(jwt)).thenReturn(parent)
        `when`(memberships.findAllByUserIdAndOrganizationId(parent.id, organizationId)).thenReturn(emptyList())
        `when`(memberships.findAllByUserIdAndOrganizationId(parent.id, additionalOrganizationId)).thenReturn(emptyList())
        `when`(subscriptions.findByOrganizationId(organizationId)).thenReturn(TenantSubscription(organizationId = organizationId, status = TenantSubscriptionStatus.ACTIVE))
        `when`(subscriptions.findByOrganizationId(additionalOrganizationId)).thenReturn(TenantSubscription(organizationId = additionalOrganizationId, status = TenantSubscriptionStatus.ACTIVE))
        `when`(capabilities.forOrganization(organizationId)).thenReturn(OrganizationCapabilities(setOf(InstitutionTypeCodes.DAYCARE), setOf(InstitutionCapability.DAYCARE_OPERATIONS)))
        `when`(capabilities.forOrganization(additionalOrganizationId)).thenReturn(OrganizationCapabilities(setOf(InstitutionTypeCodes.DAYCARE), setOf(InstitutionCapability.DAYCARE_OPERATIONS)))
        `when`(branches.findById(branch.id)).thenReturn(Optional.of(branch))
        `when`(branches.findById(additionalBranch.id)).thenReturn(Optional.of(additionalBranch))
        `when`(children.save(any(Child::class.java))).thenReturn(firstChild, secondChild, thirdChild)
        `when`(children.findById(firstChild.id)).thenReturn(Optional.of(firstChild))
        `when`(children.findById(secondChild.id)).thenReturn(Optional.of(secondChild))
        `when`(children.findById(thirdChild.id)).thenReturn(Optional.of(thirdChild))
        `when`(enrollments.save(any(ParentEnrollment::class.java))).thenAnswer { it.arguments[0] }
        `when`(memberships.findAllByOrganizationId(organizationId)).thenReturn(emptyList())
        `when`(memberships.findAllByOrganizationId(additionalOrganizationId)).thenReturn(emptyList())
        `when`(billing.quoteEnrollment(organizationId, planId, null)).thenReturn(snapshot(planId))
        `when`(billing.quoteEnrollment(additionalOrganizationId, additionalPlanId, null)).thenReturn(snapshot(additionalPlanId))
        val branchFilters = mock(BranchListFilterService::class.java)
        val service = ParentEnrollmentService(identity, access, organizations, subscriptions, capabilities, branches, plans, children, enrollments, memberships, guardians, users, entitlements, invoices, billing, notifications, branchFilters, paymentInstructions)

        val response = service.checkout(jwt, ParentEnrollmentCheckoutRequest(organizationId, branch.id, planId, emptyList(), children = listOf(ParentEnrollmentChildInput("Alya", null, Gender.FEMALE, LocalDate.of(2022, 1, 1)), ParentEnrollmentChildInput("Bima", "Putra", Gender.MALE, LocalDate.of(2023, 2, 2)))))
        val additionalTenantResponse = service.checkout(jwt, ParentEnrollmentCheckoutRequest(additionalOrganizationId, additionalBranch.id, additionalPlanId, emptyList(), children = listOf(ParentEnrollmentChildInput("Citra", null, Gender.FEMALE, LocalDate.of(2021, 3, 3)))))

        assertEquals(listOf("Alya", "Bima Putra"), response.map { it.childName })
        assertEquals(listOf("Citra"), additionalTenantResponse.map { it.childName })
        assertEquals(listOf(ParentEnrollmentStatus.PENDING_APPROVAL, ParentEnrollmentStatus.PENDING_APPROVAL), response.map { it.status })
        assertEquals(listOf<UUID?>(null, null), response.map { it.invoiceId })
        val childCaptor = ArgumentCaptor.forClass(Child::class.java)
        verify(children, times(3)).save(childCaptor.capture())
        assertEquals(listOf(ChildEnrollmentStatus.PENDING, ChildEnrollmentStatus.PENDING, ChildEnrollmentStatus.PENDING), childCaptor.allValues.map { it.enrollmentStatus })
        assertEquals(listOf(Gender.FEMALE, Gender.MALE, Gender.FEMALE), childCaptor.allValues.map { it.gender })
        assertEquals(listOf(organizationId, organizationId, additionalOrganizationId), childCaptor.allValues.map { it.organizationId })
        verify(billing).quoteEnrollment(organizationId, planId, null)
        verify(billing).quoteEnrollment(additionalOrganizationId, additionalPlanId, null)
    }

    private fun snapshot(planId: UUID) = EnrollmentPlanSnapshot(planId, "Paket", com.daycare.api.domain.ServicePlanType.MONTHLY, java.math.BigDecimal.ONE, java.math.BigDecimal.ZERO, null, null, java.math.BigDecimal.ONE, null, null, null, true)
}
