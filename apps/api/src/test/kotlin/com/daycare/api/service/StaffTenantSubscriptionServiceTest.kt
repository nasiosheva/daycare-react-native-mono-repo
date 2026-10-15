// Mories Deo Hutapea,S.E.,S.Kom
package com.daycare.api.service

import com.daycare.api.domain.Role
import com.daycare.api.domain.TenantPaymentStatus
import com.daycare.api.domain.TenantSubscriptionPlan
import com.daycare.api.domain.TenantSubscriptionStatus
import com.daycare.api.persistence.Organization
import com.daycare.api.persistence.OrganizationRepository
import com.daycare.api.persistence.TenantPayment
import com.daycare.api.persistence.TenantPaymentRepository
import com.daycare.api.persistence.TenantSubscription
import com.daycare.api.persistence.TenantSubscriptionRepository
import com.daycare.api.persistence.UserProfile
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import org.mockito.Mockito.mock
import org.mockito.Mockito.verify
import org.mockito.Mockito.`when`
import org.springframework.security.oauth2.jwt.Jwt
import java.math.BigDecimal
import java.time.LocalDate
import java.util.Optional
import java.util.UUID

class StaffTenantSubscriptionServiceTest {
    private val access = mock(AccessService::class.java)
    private val organizations = mock(OrganizationRepository::class.java)
    private val subscriptions = mock(TenantSubscriptionRepository::class.java)
    private val payments = mock(TenantPaymentRepository::class.java)
    private val renewals = mock(TenantSubscriptionRenewalService::class.java)
    private val lifecycle = TenantSubscriptionLifecyclePolicy(graceEnabled = true)
    private val service = StaffTenantSubscriptionService(access, organizations, subscriptions, payments, renewals, lifecycle)
    private val jwt = mock(Jwt::class.java)
    private val organizationId = UUID.randomUUID()
    private val actor = UserProfile(id = UUID.randomUUID())

    @Test
    fun `current subscription is restricted to the selected organization and reports effective status`() {
        allowStaffAdmin()
        val subscription = TenantSubscription(
            organizationId = organizationId,
            plan = TenantSubscriptionPlan.STANDARD,
            status = TenantSubscriptionStatus.ACTIVE,
            periodStart = LocalDate.now(BILLING_TIME_ZONE).minusMonths(1),
            periodEnd = LocalDate.now(BILLING_TIME_ZONE).minusDays(1),
            gracePeriodDays = 7,
        )
        `when`(organizations.findById(organizationId)).thenReturn(Optional.of(Organization(id = organizationId, name = "Tenant sendiri")))
        `when`(subscriptions.findByOrganizationId(organizationId)).thenReturn(subscription)
        `when`(payments.findAllByOrganizationIdOrderByCreatedAtDesc(organizationId)).thenReturn(emptyList())

        val result = service.current(jwt, organizationId)

        assertEquals(organizationId, result.organizationId)
        assertEquals("Tenant sendiri", result.organizationName)
        assertEquals(TenantSubscriptionStatus.GRACE, result.status)
        verify(access).require(jwt, organizationId, setOf(Role.STAFF_ADMIN), null, false, setOf(Role.STAFF_ADMIN), emptySet(), emptySet())
    }

    @Test
    fun `renewal uses authenticated Staff Admin identity and caller idempotency key`() {
        allowStaffAdmin()
        val key = UUID.randomUUID()
        val payment = TenantPayment(invoiceNumber = "UE-SUB-202610-000001", organizationId = organizationId, amount = BigDecimal("100"), status = TenantPaymentStatus.PENDING)
        `when`(renewals.renew(organizationId, actor.id, key)).thenReturn(payment)

        val result = service.renew(jwt, organizationId, key)

        assertEquals(payment.id, result.id)
        assertEquals(payment.invoiceNumber, result.invoiceNumber)
        verify(renewals).renew(organizationId, actor.id, key)
    }

    private fun allowStaffAdmin() {
        val membership = mock(com.daycare.api.persistence.Membership::class.java)
        `when`(access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN), null, false, setOf(Role.STAFF_ADMIN), emptySet(), emptySet()))
            .thenReturn(AccessScope(actor, membership, emptySet(), emptySet()))
    }
}
