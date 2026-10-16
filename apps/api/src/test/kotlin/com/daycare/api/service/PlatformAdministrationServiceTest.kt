// Mories Deo Hutapea,S.E.,S.Kom
package com.daycare.api.service

import com.daycare.api.domain.Role
import com.daycare.api.domain.RegistrationRole
import com.daycare.api.domain.InstitutionCapability
import com.daycare.api.domain.TenantSubscriptionPlan
import com.daycare.api.domain.TenantSubscriptionStatus
import com.daycare.api.domain.TenantPaymentStatus
import com.daycare.api.persistence.Branch
import com.daycare.api.persistence.TenantSubscription
import com.daycare.api.persistence.TenantPayment
import com.daycare.api.persistence.Invitation
import java.math.BigDecimal
import java.time.LocalDate
import java.time.Instant
import com.daycare.api.persistence.BranchRepository
import com.daycare.api.persistence.EducationOfferingRepository
import com.daycare.api.persistence.InvitationRepository
import com.daycare.api.persistence.Membership
import com.daycare.api.persistence.MembershipRepository
import com.daycare.api.persistence.Organization
import com.daycare.api.persistence.OrganizationRepository
import com.daycare.api.persistence.OrganizationTypeAssignmentRepository
import com.daycare.api.persistence.TenantPaymentRepository
import com.daycare.api.persistence.TenantSubscriptionRepository
import com.daycare.api.persistence.TenantSubscriptionAuditEventRepository
import com.daycare.api.persistence.UserProfile
import com.daycare.api.persistence.UserProfileRepository
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Test
import org.mockito.Mockito.mock
import org.mockito.Mockito.verify
import org.mockito.Mockito.verifyNoInteractions
import org.mockito.Mockito.times
import org.mockito.Mockito.`when`
import org.springframework.security.access.AccessDeniedException
import org.springframework.security.oauth2.jwt.Jwt
import java.util.Optional
import java.util.UUID

/**
 * Covers platform-admin account password resets. The rest of
 * PlatformAdministrationService has no unit coverage yet and is out of scope
 * for this change.
 */
private class PlatformAdministrationServiceFixture(graceEnabled: Boolean = false) {
    val platformAccess = mock(PlatformAccessService::class.java)
    val organizations = mock(OrganizationRepository::class.java)
    val organizationTypes = mock(OrganizationTypeAssignmentRepository::class.java)
    val organizationCapabilities = mock(OrganizationCapabilitiesService::class.java)
    val branches = mock(BranchRepository::class.java)
    val subscriptions = mock(TenantSubscriptionRepository::class.java)
    val payments = mock(TenantPaymentRepository::class.java)
    val subscriptionAudits = mock(TenantSubscriptionAuditEventRepository::class.java)
    val subscriptionBillingPolicy = mock(TenantSubscriptionBillingPolicy::class.java)
    val invoiceNumbers = mock(TenantSubscriptionInvoiceNumberGenerator::class.java)
    private val subscriptionLifecycle = TenantSubscriptionLifecyclePolicy(graceEnabled = graceEnabled)
    val subscriptionRenewals = TenantSubscriptionRenewalService(subscriptions, payments, subscriptionBillingPolicy, subscriptionLifecycle, subscriptionAudits, invoiceNumbers)
    val invitations = mock(InvitationRepository::class.java)
    val memberships = mock(MembershipRepository::class.java)
    val users = mock(UserProfileRepository::class.java)
    val tenantUserAccounts = mock(TenantUserAccountService::class.java)
    val tokenRevocations = mock(AccessTokenRevocationService::class.java)
    val institutionTypeCatalog = mock(InstitutionTypeCatalogService::class.java)
    val defaultCurriculumActivities = mock(TenantDefaultCurriculumActivitySeeder::class.java)
    val educationOfferings = mock(EducationOfferingRepository::class.java)
    val service = PlatformAdministrationService(
        platformAccess, organizations, organizationTypes, organizationCapabilities, branches, subscriptions,
        payments, invitations, memberships, users, tenantUserAccounts, institutionTypeCatalog,
        defaultCurriculumActivities, educationOfferings, tokenRevocations, subscriptionAudits, subscriptionBillingPolicy,
        invoiceNumbers, subscriptionRenewals, subscriptionLifecycle,
    )

    val jwt: Jwt = mock(Jwt::class.java)
    val organizationId: UUID = UUID.randomUUID()
    val membershipId: UUID = UUID.randomUUID()
    val userId: UUID = UUID.randomUUID()

    init {
        `when`(invoiceNumbers.next(LocalDate.now(BILLING_TIME_ZONE))).thenReturn("UE-SUB-202610-000001")
        `when`(payments.save(org.mockito.ArgumentMatchers.any(TenantPayment::class.java))).thenAnswer { invocation -> invocation.arguments[0] }
    }

    /** Stubs a platform admin caller and an organization that exists. */
    fun allowPlatformAdmin() {
        val actor = UserProfile(id = userId)
        `when`(platformAccess.requirePlatformAdmin(jwt)).thenReturn(actor)
        `when`(users.findWithLockById(userId)).thenReturn(actor)
        `when`(organizations.findById(organizationId)).thenReturn(Optional.of(Organization(id = organizationId)))
    }

    /** Stubs the membership lookup and returns the exact UserProfile instance the service will load, for reference-equality verification. */
    fun stubMembership(membership: Membership): UserProfile {
        `when`(memberships.findById(membershipId)).thenReturn(Optional.of(membership))
        val user = UserProfile(id = membership.userId)
        `when`(users.findById(membership.userId)).thenReturn(Optional.of(user))
        return user
    }
}

class PlatformAdministrationServiceTest {
    private fun PlatformAdministrationServiceFixture.stubTenantResponse(organization: Organization, subscription: TenantSubscription? = null) {
        `when`(organizations.findById(organization.id)).thenReturn(Optional.of(organization))
        `when`(organizationCapabilities.forOrganization(organization.id)).thenReturn(OrganizationCapabilities(setOf("DAYCARE"), setOf(InstitutionCapability.DAYCARE_OPERATIONS)))
        `when`(memberships.findAllByOrganizationId(organization.id)).thenReturn(emptyList())
        `when`(invitations.findAllByOrganizationIdAndStatus(organization.id, com.daycare.api.domain.InvitationStatus.PENDING)).thenReturn(emptyList())
        `when`(branches.findAllByOrganizationId(organization.id)).thenReturn(emptyList())
        `when`(payments.findAllByOrganizationIdOrderByCreatedAtDesc(organization.id)).thenReturn(emptyList())
        `when`(subscriptions.findByOrganizationId(organization.id)).thenReturn(subscription)
        `when`(subscriptions.findByOrganizationIdForUpdate(organization.id)).thenReturn(subscription)
    }

    @Test
    fun `payment decisions fail closed when the locked platform admin no longer exists`() {
        val fixture = PlatformAdministrationServiceFixture()
        val actorId = UUID.randomUUID()
        `when`(fixture.platformAccess.requirePlatformAdmin(fixture.jwt)).thenReturn(UserProfile(id = actorId))
        `when`(fixture.users.findWithLockById(actorId)).thenReturn(null)

        assertThrows(IllegalArgumentException::class.java) {
            fixture.service.markPaymentPaid(fixture.jwt, fixture.organizationId, UUID.randomUUID(), UUID.randomUUID())
        }
        assertThrows(IllegalArgumentException::class.java) {
            fixture.service.voidPayment(fixture.jwt, fixture.organizationId, UUID.randomUUID(), UUID.randomUUID())
        }
        verifyNoInteractions(fixture.payments)
    }

    @Test
    fun `grace rollout preview is read only and reports current versus proposed states`() {
        val fixture = PlatformAdministrationServiceFixture(); fixture.allowPlatformAdmin()
        val organization = Organization(id = fixture.organizationId, name = "Tenant")
        val subscription = TenantSubscription(
            organizationId = organization.id,
            status = TenantSubscriptionStatus.ACTIVE,
            periodEnd = LocalDate.now(BILLING_TIME_ZONE).minusDays(1),
            gracePeriodDays = 7,
        )
        `when`(fixture.subscriptions.findAll()).thenReturn(listOf(subscription))
        `when`(fixture.organizations.findAllById(listOf(organization.id))).thenReturn(listOf(organization))

        val preview = fixture.service.previewGraceRollout(fixture.jwt, page = 0, size = 20)

        assertEquals(1, preview.totalTenantCount)
        assertEquals(1, preview.affectedTenantCount)
        assertEquals(TenantSubscriptionStatus.EXPIRED, preview.tenants.single().currentEffectiveStatus)
        assertEquals(TenantGraceRolloutAccessLevel.RESTRICTED, preview.tenants.single().currentAccessLevel)
        assertEquals(TenantSubscriptionStatus.GRACE, preview.tenants.single().proposedEffectiveStatus)
        assertEquals(TenantGraceRolloutAccessLevel.GRACE_LIMITED, preview.tenants.single().proposedAccessLevel)
        assertEquals(false, preview.graceLifecycleEnabled)
        assertEquals(TenantSubscriptionStatus.ACTIVE, subscription.status)
        verifyNoInteractions(fixture.payments, fixture.subscriptionAudits)
    }

    @Test
    fun `renewal replays identical idempotency key and conflicts on changed payload`() {
        val fixture = PlatformAdministrationServiceFixture(); fixture.allowPlatformAdmin()
        val organization = Organization(id = fixture.organizationId, name = "Tenant")
        val subscription = TenantSubscription(organizationId = organization.id, status = TenantSubscriptionStatus.ACTIVE, periodEnd = LocalDate.now(BILLING_TIME_ZONE).plusDays(5), monthlyFee = BigDecimal("100"))
        fixture.stubTenantResponse(organization, subscription)
        val key = UUID.randomUUID()
        val paymentsByKey = mutableMapOf<UUID, TenantPayment>()
        `when`(fixture.payments.findByOrganizationIdAndIdempotencyKey(organization.id, key)).thenAnswer { paymentsByKey[key] }
        `when`(fixture.payments.save(org.mockito.ArgumentMatchers.any(TenantPayment::class.java))).thenAnswer { invocation ->
            val payment = invocation.arguments[0] as TenantPayment
            paymentsByKey[key] = payment
            payment
        }

        fixture.service.renewSubscription(fixture.jwt, organization.id, key, RenewTenantSubscriptionRequest(BigDecimal("100")))
        fixture.service.renewSubscription(fixture.jwt, organization.id, key, RenewTenantSubscriptionRequest(BigDecimal("100.00")))

        verify(fixture.payments, times(1)).save(org.mockito.ArgumentMatchers.any(TenantPayment::class.java))
        assertThrows(TenantSubscriptionIdempotencyConflict::class.java) {
            fixture.service.renewSubscription(fixture.jwt, organization.id, key, RenewTenantSubscriptionRequest(BigDecimal("101")))
        }
    }

    @Test
    fun `renewal without a client price replays same invoice after platform changes the current price`() {
        val fixture = PlatformAdministrationServiceFixture()
        val subscription = TenantSubscription(organizationId = fixture.organizationId, status = TenantSubscriptionStatus.ACTIVE, periodEnd = LocalDate.now(BILLING_TIME_ZONE).plusDays(10), monthlyFee = BigDecimal("100"))
        `when`(fixture.subscriptions.findByOrganizationIdForUpdate(fixture.organizationId)).thenReturn(subscription)
        val key = UUID.randomUUID()
        val paymentByKey = mutableMapOf<UUID, TenantPayment>()
        `when`(fixture.payments.findByOrganizationIdAndIdempotencyKey(fixture.organizationId, key)).thenAnswer { paymentByKey[key] }
        `when`(fixture.payments.findAllByOrganizationIdOrderByCreatedAtDesc(fixture.organizationId)).thenReturn(emptyList())
        `when`(fixture.payments.save(org.mockito.ArgumentMatchers.any(TenantPayment::class.java))).thenAnswer { invocation ->
            (invocation.arguments[0] as TenantPayment).also { paymentByKey[key] = it }
        }

        val first = fixture.subscriptionRenewals.renew(fixture.organizationId, fixture.userId, key)
        subscription.monthlyFee = BigDecimal("200")
        val retried = fixture.subscriptionRenewals.renew(fixture.organizationId, fixture.userId, key)

        assertEquals(first.id, retried.id)
        assertEquals(BigDecimal("100"), retried.amount)
        verify(fixture.payments, times(1)).save(org.mockito.ArgumentMatchers.any(TenantPayment::class.java))
    }

    @Test
    fun `payment confirmed after grace preserves invoice period and records actual coverage from confirmation`() {
        val fixture = PlatformAdministrationServiceFixture(); fixture.allowPlatformAdmin()
        val organization = Organization(id = fixture.organizationId, name = "Tenant")
        val today = LocalDate.now(BILLING_TIME_ZONE)
        val subscription = TenantSubscription(
            id = UUID.randomUUID(),
            organizationId = organization.id,
            status = TenantSubscriptionStatus.EXPIRED,
            periodStart = today.minusMonths(2),
            periodEnd = today.minusDays(8),
            monthlyFee = BigDecimal("100"),
        )
        val invoicePeriodStart = subscription.periodEnd.plusDays(1)
        val invoicePeriodEnd = invoicePeriodStart.plusMonths(1).minusDays(1)
        val payment = TenantPayment(
            id = UUID.randomUUID(),
            organizationId = organization.id,
            subscriptionId = subscription.id,
            amount = BigDecimal("100"),
            status = TenantPaymentStatus.PENDING,
            periodStart = invoicePeriodStart,
            periodEnd = invoicePeriodEnd,
            planCodeSnapshot = subscription.plan.name,
        )
        fixture.stubTenantResponse(organization, subscription)
        `when`(fixture.payments.findById(payment.id)).thenReturn(Optional.of(payment))
        `when`(fixture.payments.findWithLockById(payment.id)).thenReturn(payment)
        `when`(fixture.payments.findAllByOrganizationIdOrderByCreatedAtDesc(organization.id)).thenReturn(listOf(payment))
        `when`(fixture.subscriptions.findById(subscription.id)).thenReturn(Optional.of(subscription))

        val response = fixture.service.markPaymentPaid(fixture.jwt, organization.id, payment.id, UUID.randomUUID())

        assertEquals(invoicePeriodStart, payment.periodStart)
        assertEquals(invoicePeriodEnd, payment.periodEnd)
        assertEquals(today, payment.coveragePeriodStart)
        assertEquals(today.plusMonths(1).minusDays(1), payment.coveragePeriodEnd)
        assertEquals(payment.coveragePeriodStart, subscription.periodStart)
        assertEquals(payment.coveragePeriodEnd, subscription.periodEnd)
        assertEquals(TenantSubscriptionStatus.ACTIVE, response.subscriptionStatus)
    }

    @Test
    fun `late initial payment starts coverage on confirmation date without grace`() {
        val fixture = PlatformAdministrationServiceFixture(); fixture.allowPlatformAdmin()
        val organization = Organization(id = fixture.organizationId, name = "Tenant")
        val today = LocalDate.now(BILLING_TIME_ZONE)
        val subscription = TenantSubscription(
            id = UUID.randomUUID(), organizationId = organization.id,
            status = TenantSubscriptionStatus.PENDING_PAYMENT,
            periodStart = today.minusMonths(2), periodEnd = today.minusDays(1),
            monthlyFee = BigDecimal("100"), gracePeriodDays = 7,
            nextGracePeriodDays = 9,
        )
        val payment = TenantPayment(
            id = UUID.randomUUID(), organizationId = organization.id, subscriptionId = subscription.id,
            amount = BigDecimal("100"), status = TenantPaymentStatus.PENDING,
            periodStart = subscription.periodStart, periodEnd = subscription.periodEnd,
        )
        val invoicePeriodStart = payment.periodStart
        fixture.stubTenantResponse(organization, subscription)
        `when`(fixture.payments.findWithLockById(payment.id)).thenReturn(payment)
        `when`(fixture.subscriptions.findById(subscription.id)).thenReturn(Optional.of(subscription))

        val result = fixture.service.markPaymentPaid(fixture.jwt, organization.id, payment.id, UUID.randomUUID())

        assertEquals(invoicePeriodStart, payment.periodStart)
        assertEquals(today, payment.coveragePeriodStart)
        assertEquals(today.plusMonths(1).minusDays(1), payment.coveragePeriodEnd)
        assertEquals(today, subscription.periodStart)
        assertEquals(today.plusMonths(1).minusDays(1), subscription.periodEnd)
        assertEquals(9, subscription.gracePeriodDays)
        assertEquals(null, subscription.nextGracePeriodDays)
        assertEquals(TenantSubscriptionStatus.ACTIVE, result.subscriptionStatus)
    }

    @Test
    fun `payment confirmation activates current coverage and applies a scheduled grace period`() {
        val fixture = PlatformAdministrationServiceFixture(); fixture.allowPlatformAdmin()
        val organization = Organization(id = fixture.organizationId, name = "Tenant")
        val today = LocalDate.now(BILLING_TIME_ZONE)
        val subscription = TenantSubscription(
            id = UUID.randomUUID(), organizationId = organization.id,
            status = TenantSubscriptionStatus.PENDING_PAYMENT,
            periodStart = today, periodEnd = today.plusDays(29),
            nextGracePeriodDays = 10,
        )
        val payment = TenantPayment(
            id = UUID.randomUUID(), organizationId = organization.id, subscriptionId = subscription.id,
            amount = BigDecimal("100"), status = TenantPaymentStatus.PENDING,
            periodStart = today, periodEnd = today.plusDays(29),
        )
        fixture.stubTenantResponse(organization, subscription)
        `when`(fixture.payments.findWithLockById(payment.id)).thenReturn(payment)
        `when`(fixture.subscriptions.findById(subscription.id)).thenReturn(Optional.of(subscription))

        val result = fixture.service.markPaymentPaid(fixture.jwt, organization.id, payment.id, UUID.randomUUID())

        assertEquals(TenantSubscriptionStatus.ACTIVE, result.subscriptionStatus)
        assertEquals(today, subscription.periodStart)
        assertEquals(today.plusDays(29), subscription.periodEnd)
        assertEquals(10, subscription.gracePeriodDays)
        assertEquals(null, subscription.nextGracePeriodDays)
    }

    @Test
    fun `payment confirmation schedules future coverage and does not activate suspended fallback`() {
        val fixture = PlatformAdministrationServiceFixture(); fixture.allowPlatformAdmin()
        val organization = Organization(id = fixture.organizationId, name = "Tenant")
        val today = LocalDate.now(BILLING_TIME_ZONE)
        val subscription = TenantSubscription(
            id = UUID.randomUUID(), organizationId = organization.id,
            status = TenantSubscriptionStatus.ACTIVE,
            periodStart = today.minusDays(10), periodEnd = today.plusDays(19),
        )
        val futurePayment = TenantPayment(
            id = UUID.randomUUID(), organizationId = organization.id, subscriptionId = subscription.id,
            amount = BigDecimal("100"), status = TenantPaymentStatus.PENDING,
            periodStart = today.plusDays(20), periodEnd = today.plusDays(49),
        )
        fixture.stubTenantResponse(organization, subscription)
        `when`(fixture.payments.findWithLockById(futurePayment.id)).thenReturn(futurePayment)
        `when`(fixture.subscriptions.findById(subscription.id)).thenReturn(Optional.of(subscription))

        fixture.service.markPaymentPaid(fixture.jwt, organization.id, futurePayment.id, UUID.randomUUID())

        assertEquals(today.plusDays(20), subscription.nextPeriodStart)
        assertEquals(today.plusDays(49), subscription.nextPeriodEnd)
        assertEquals(TenantSubscriptionStatus.ACTIVE, subscription.status)

        val suspendedCurrent = TenantSubscription(
            id = UUID.randomUUID(), organizationId = organization.id,
            status = TenantSubscriptionStatus.SUSPENDED,
            periodStart = today, periodEnd = today.plusDays(29),
        )
        val suspendedPayment = TenantPayment(
            id = UUID.randomUUID(), organizationId = organization.id, subscriptionId = suspendedCurrent.id,
            amount = BigDecimal("100"), status = TenantPaymentStatus.PENDING,
            periodStart = today, periodEnd = today.plusDays(29),
        )
        fixture.stubTenantResponse(organization, suspendedCurrent)
        `when`(fixture.payments.findWithLockById(suspendedPayment.id)).thenReturn(suspendedPayment)
        `when`(fixture.subscriptions.findById(suspendedCurrent.id)).thenReturn(Optional.of(suspendedCurrent))

        val suspendedCurrentResult = fixture.service.markPaymentPaid(fixture.jwt, organization.id, suspendedPayment.id, UUID.randomUUID())

        assertEquals(TenantSubscriptionStatus.SUSPENDED, suspendedCurrentResult.subscriptionStatus)
        assertEquals(TenantSubscriptionStatus.SUSPENDED, suspendedCurrent.status)

        val suspended = TenantSubscription(id = UUID.randomUUID(), organizationId = organization.id, status = TenantSubscriptionStatus.SUSPENDED)
        val noPeriodPayment = TenantPayment(id = UUID.randomUUID(), organizationId = organization.id, subscriptionId = suspended.id, amount = BigDecimal("100"), status = TenantPaymentStatus.PENDING)
        fixture.stubTenantResponse(organization, suspended)
        `when`(fixture.payments.findWithLockById(noPeriodPayment.id)).thenReturn(noPeriodPayment)
        `when`(fixture.subscriptions.findById(suspended.id)).thenReturn(Optional.of(suspended))

        val result = fixture.service.markPaymentPaid(fixture.jwt, organization.id, noPeriodPayment.id, UUID.randomUUID())

        assertEquals(TenantSubscriptionStatus.SUSPENDED, result.subscriptionStatus)
        assertEquals(TenantSubscriptionStatus.SUSPENDED, suspended.status)
        assertEquals(today, noPeriodPayment.coveragePeriodStart)
        assertEquals(today.plusMonths(1).minusDays(1), noPeriodPayment.coveragePeriodEnd)

        val partialPeriodSubscription = TenantSubscription(
            id = UUID.randomUUID(), organizationId = organization.id,
            status = TenantSubscriptionStatus.PENDING_PAYMENT,
        )
        val partialPeriodPayment = TenantPayment(
            id = UUID.randomUUID(), organizationId = organization.id, subscriptionId = partialPeriodSubscription.id,
            amount = BigDecimal("100"), status = TenantPaymentStatus.PENDING,
            periodStart = today,
        )
        fixture.stubTenantResponse(organization, partialPeriodSubscription)
        `when`(fixture.payments.findWithLockById(partialPeriodPayment.id)).thenReturn(partialPeriodPayment)
        `when`(fixture.subscriptions.findById(partialPeriodSubscription.id)).thenReturn(Optional.of(partialPeriodSubscription))

        val partialPeriodResult = fixture.service.markPaymentPaid(fixture.jwt, organization.id, partialPeriodPayment.id, UUID.randomUUID())

        assertEquals(TenantSubscriptionStatus.ACTIVE, partialPeriodResult.subscriptionStatus)
        assertEquals(today, partialPeriodPayment.coveragePeriodStart)
        assertEquals(today.plusMonths(1).minusDays(1), partialPeriodPayment.coveragePeriodEnd)
    }

    @Test
    fun `payment confirmation does not reactivate a manually suspended subscription`() {
        val fixture = PlatformAdministrationServiceFixture(); fixture.allowPlatformAdmin()
        val organization = Organization(id = fixture.organizationId, name = "Tenant")
        val today = LocalDate.now(BILLING_TIME_ZONE)
        val subscription = TenantSubscription(
            id = UUID.randomUUID(), organizationId = organization.id,
            status = TenantSubscriptionStatus.SUSPENDED,
            periodStart = today.minusMonths(2), periodEnd = today.minusDays(1),
        )
        val payment = TenantPayment(
            id = UUID.randomUUID(), organizationId = organization.id, subscriptionId = subscription.id,
            amount = BigDecimal("100"), status = TenantPaymentStatus.PENDING,
            periodStart = subscription.periodStart, periodEnd = subscription.periodEnd,
        )
        fixture.stubTenantResponse(organization, subscription)
        `when`(fixture.payments.findWithLockById(payment.id)).thenReturn(payment)
        `when`(fixture.subscriptions.findById(subscription.id)).thenReturn(Optional.of(subscription))

        val result = fixture.service.markPaymentPaid(fixture.jwt, organization.id, payment.id, UUID.randomUUID())

        assertEquals(TenantPaymentStatus.PAID, payment.status)
        assertEquals(TenantSubscriptionStatus.SUSPENDED, subscription.status)
        assertEquals(TenantSubscriptionStatus.SUSPENDED, result.subscriptionStatus)
        assertEquals(today, payment.coveragePeriodStart)
        assertEquals(today.plusMonths(1).minusDays(1), payment.coveragePeriodEnd)
        assertEquals(today, subscription.periodStart)
    }

    @Test
    fun `markPaymentPaid replays the same response for a retried idempotency key and rejects a changed payload`() {
        val fixture = PlatformAdministrationServiceFixture()
        val actorId = UUID.randomUUID()
        `when`(fixture.platformAccess.requirePlatformAdmin(fixture.jwt)).thenReturn(UserProfile(id = actorId))
        val organization = Organization(id = fixture.organizationId, name = "Tenant")
        val subscription = TenantSubscription(id = UUID.randomUUID(), organizationId = organization.id, status = TenantSubscriptionStatus.ACTIVE, periodEnd = LocalDate.now(BILLING_TIME_ZONE).plusDays(5), monthlyFee = BigDecimal("100"))
        val payment = TenantPayment(id = UUID.randomUUID(), organizationId = organization.id, subscriptionId = subscription.id, amount = BigDecimal("100"), status = TenantPaymentStatus.PENDING)
        fixture.stubTenantResponse(organization, subscription)
        `when`(fixture.payments.findWithLockById(payment.id)).thenReturn(payment)
        `when`(fixture.subscriptions.findById(subscription.id)).thenReturn(Optional.of(subscription))
        val key = UUID.randomUUID()
        `when`(fixture.users.findWithLockById(actorId)).thenReturn(UserProfile(id = actorId))
        `when`(fixture.payments.findByOrganizationIdAndDecisionByUserIdAndDecisionOperationAndDecisionIdempotencyKey(organization.id, actorId, "MARK_PAID", key)).thenReturn(null, payment, payment)

        val first = fixture.service.markPaymentPaid(fixture.jwt, organization.id, payment.id, key)
        assertEquals(TenantPaymentStatus.PAID, payment.status)
        assertEquals(actorId, payment.decisionByUserId)
        assertEquals("MARK_PAID", payment.decisionOperation)

        val replay = fixture.service.markPaymentPaid(fixture.jwt, organization.id, payment.id, key)
        assertEquals(first.subscriptionStatus, replay.subscriptionStatus)
        assertEquals(TenantPaymentStatus.PAID, payment.status)
        verify(fixture.users, times(2)).findWithLockById(actorId)
        verify(fixture.payments, times(2)).findByOrganizationIdAndDecisionByUserIdAndDecisionOperationAndDecisionIdempotencyKey(organization.id, actorId, "MARK_PAID", key)

        val otherPayment = TenantPayment(id = UUID.randomUUID(), organizationId = organization.id, subscriptionId = subscription.id, amount = BigDecimal("100"), status = TenantPaymentStatus.PENDING)
        assertThrows(TenantSubscriptionIdempotencyConflict::class.java) { fixture.service.markPaymentPaid(fixture.jwt, organization.id, otherPayment.id, key) }
    }

    @Test
    fun `voidPayment replays the same response for a retried idempotency key and rejects a changed payload`() {
        val fixture = PlatformAdministrationServiceFixture()
        val actorId = UUID.randomUUID()
        `when`(fixture.platformAccess.requirePlatformAdmin(fixture.jwt)).thenReturn(UserProfile(id = actorId))
        val organization = Organization(id = fixture.organizationId, name = "Tenant")
        fixture.stubTenantResponse(organization)
        val payment = TenantPayment(id = UUID.randomUUID(), organizationId = organization.id, subscriptionId = UUID.randomUUID(), amount = BigDecimal("10"), status = TenantPaymentStatus.PENDING)
        `when`(fixture.payments.findWithLockById(payment.id)).thenReturn(payment)
        val key = UUID.randomUUID()
        `when`(fixture.users.findWithLockById(actorId)).thenReturn(UserProfile(id = actorId))
        `when`(fixture.payments.findByOrganizationIdAndDecisionByUserIdAndDecisionOperationAndDecisionIdempotencyKey(organization.id, actorId, "VOID", key)).thenReturn(null, payment, payment)

        fixture.service.voidPayment(fixture.jwt, organization.id, payment.id, key)
        assertEquals(TenantPaymentStatus.VOID, payment.status)
        assertEquals(actorId, payment.decisionByUserId)
        assertEquals("VOID", payment.decisionOperation)

        val replay = fixture.service.voidPayment(fixture.jwt, organization.id, payment.id, key)
        assertEquals(organization.id, replay.id)
        verify(fixture.users, times(2)).findWithLockById(actorId)
        verify(fixture.payments, times(2)).findByOrganizationIdAndDecisionByUserIdAndDecisionOperationAndDecisionIdempotencyKey(organization.id, actorId, "VOID", key)

        val otherPayment = TenantPayment(id = UUID.randomUUID(), organizationId = organization.id, subscriptionId = UUID.randomUUID(), amount = BigDecimal("10"), status = TenantPaymentStatus.PENDING)
        assertThrows(TenantSubscriptionIdempotencyConflict::class.java) { fixture.service.voidPayment(fixture.jwt, organization.id, otherPayment.id, key) }
    }

    @Test
    fun `lists registered Parent accounts with safe metadata only`() {
        val fixture = PlatformAdministrationServiceFixture()
        fixture.allowPlatformAdmin()
        val parent = UserProfile(id = fixture.userId, displayName = "Parent Satu", email = "parent@example.test", registrationRole = RegistrationRole.PARENT, localPasswordHash = "hash")
        val activeMembership = Membership(userId = parent.id, organizationId = fixture.organizationId, role = Role.PARENT, active = true)
        `when`(fixture.users.findRegisteredParents("parent")).thenReturn(listOf(parent))
        `when`(fixture.memberships.findAllByRoleAndUserIdIn(Role.PARENT, listOf(parent.id))).thenReturn(listOf(activeMembership))

        val result = fixture.service.parents(fixture.jwt, "parent")

        assertEquals(1, result.size)
        assertEquals(parent.id, result.single().id)
        assertEquals("ACTIVE", result.single().status)
        assertEquals(1, result.single().tenantCount)
        assertTrue(result.single().hasLocalPassword)
    }

    @Test
    fun `resets a registered Parent password and revokes sessions`() {
        val fixture = PlatformAdministrationServiceFixture()
        fixture.allowPlatformAdmin()
        val parent = UserProfile(id = fixture.userId, registrationRole = RegistrationRole.PARENT)
        `when`(fixture.users.findById(parent.id)).thenReturn(Optional.of(parent))

        fixture.service.resetParentPassword(fixture.jwt, parent.id, ChangeTenantUserPasswordRequest("new-password"))

        verify(fixture.tenantUserAccounts).changePassword(parent, "new-password")
        verify(fixture.tokenRevocations).revokeUserSessions(parent)
    }

    @Test
    fun `rejects password reset for a non Parent account`() {
        val fixture = PlatformAdministrationServiceFixture()
        fixture.allowPlatformAdmin()
        val staff = UserProfile(id = fixture.userId, registrationRole = null)
        `when`(fixture.users.findById(staff.id)).thenReturn(Optional.of(staff))

        assertThrows(IllegalArgumentException::class.java) {
            fixture.service.resetParentPassword(fixture.jwt, staff.id, ChangeTenantUserPasswordRequest("new-password"))
        }
        verifyNoInteractions(fixture.tenantUserAccounts)
    }

    @Test
    fun `resets the password of a non-primary active Staff Admin`() {
        val fixture = PlatformAdministrationServiceFixture()
        fixture.allowPlatformAdmin()
        val membership = Membership(id = fixture.membershipId, userId = fixture.userId, organizationId = fixture.organizationId, role = Role.STAFF_ADMIN, active = true, primaryStaffAdmin = false)
        val user = fixture.stubMembership(membership)

        fixture.service.resetTenantStaffAdminPassword(fixture.jwt, fixture.organizationId, fixture.membershipId, ChangeTenantUserPasswordRequest("new-password"))

        verify(fixture.tenantUserAccounts).changePassword(user, "new-password")
        verify(fixture.tokenRevocations).revokeUserSessions(user)
    }

    @Test
    fun `also resets the password of the primary Staff Admin, unlike update and remove`() {
        val fixture = PlatformAdministrationServiceFixture()
        fixture.allowPlatformAdmin()
        val membership = Membership(id = fixture.membershipId, userId = fixture.userId, organizationId = fixture.organizationId, role = Role.STAFF_ADMIN, active = true, primaryStaffAdmin = true)
        val user = fixture.stubMembership(membership)

        fixture.service.resetTenantStaffAdminPassword(fixture.jwt, fixture.organizationId, fixture.membershipId, ChangeTenantUserPasswordRequest("new-password"))

        verify(fixture.tenantUserAccounts).changePassword(user, "new-password")
        verify(fixture.tokenRevocations).revokeUserSessions(user)
    }

    @Test
    fun `rejects a membership from a different tenant`() {
        val fixture = PlatformAdministrationServiceFixture()
        fixture.allowPlatformAdmin()
        val membership = Membership(id = fixture.membershipId, userId = fixture.userId, organizationId = UUID.randomUUID(), role = Role.STAFF_ADMIN, active = true)
        `when`(fixture.memberships.findById(fixture.membershipId)).thenReturn(Optional.of(membership))

        assertThrows(IllegalArgumentException::class.java) {
            fixture.service.resetTenantStaffAdminPassword(fixture.jwt, fixture.organizationId, fixture.membershipId, ChangeTenantUserPasswordRequest("new-password"))
        }
        verifyNoInteractions(fixture.tenantUserAccounts)
    }

    @Test
    fun `rejects an inactive Staff Admin membership`() {
        val fixture = PlatformAdministrationServiceFixture()
        fixture.allowPlatformAdmin()
        val membership = Membership(id = fixture.membershipId, userId = fixture.userId, organizationId = fixture.organizationId, role = Role.STAFF_ADMIN, active = false)
        `when`(fixture.memberships.findById(fixture.membershipId)).thenReturn(Optional.of(membership))

        assertThrows(IllegalArgumentException::class.java) {
            fixture.service.resetTenantStaffAdminPassword(fixture.jwt, fixture.organizationId, fixture.membershipId, ChangeTenantUserPasswordRequest("new-password"))
        }
        verifyNoInteractions(fixture.tenantUserAccounts)
    }

    @Test
    fun `rejects a Staff membership that is not a Staff Admin`() {
        val fixture = PlatformAdministrationServiceFixture()
        fixture.allowPlatformAdmin()
        val membership = Membership(id = fixture.membershipId, userId = fixture.userId, organizationId = fixture.organizationId, role = Role.STAFF, active = true)
        `when`(fixture.memberships.findById(fixture.membershipId)).thenReturn(Optional.of(membership))

        assertThrows(IllegalArgumentException::class.java) {
            fixture.service.resetTenantStaffAdminPassword(fixture.jwt, fixture.organizationId, fixture.membershipId, ChangeTenantUserPasswordRequest("new-password"))
        }
        verifyNoInteractions(fixture.tenantUserAccounts)
    }

    @Test
    fun `requires platform administrator access`() {
        val fixture = PlatformAdministrationServiceFixture()
        `when`(fixture.platformAccess.requirePlatformAdmin(fixture.jwt)).thenThrow(AccessDeniedException("You do not have platform administrator access"))

        assertThrows(AccessDeniedException::class.java) {
            fixture.service.resetTenantStaffAdminPassword(fixture.jwt, fixture.organizationId, fixture.membershipId, ChangeTenantUserPasswordRequest("new-password"))
        }
        verifyNoInteractions(fixture.memberships, fixture.tenantUserAccounts)
    }

    @Test
    fun `parent listing reports active inactive and unbound accounts`() {
        val fixture = PlatformAdministrationServiceFixture()
        fixture.allowPlatformAdmin()
        val active = UserProfile(displayName = "Active", registrationRole = RegistrationRole.PARENT)
        val inactive = UserProfile(displayName = "Inactive", registrationRole = RegistrationRole.PARENT)
        val unbound = UserProfile(displayName = "Unbound", registrationRole = RegistrationRole.PARENT)
        `when`(fixture.users.findRegisteredParents("")).thenReturn(listOf(active, inactive, unbound))
        `when`(fixture.memberships.findAllByRoleAndUserIdIn(Role.PARENT, listOf(active.id, inactive.id, unbound.id))).thenReturn(listOf(
            Membership(userId = active.id, organizationId = UUID.randomUUID(), role = Role.PARENT, active = true),
            Membership(userId = inactive.id, organizationId = UUID.randomUUID(), role = Role.PARENT, active = false),
        ))
        val result = fixture.service.parents(fixture.jwt, null)
        assertEquals(listOf("ACTIVE", "INACTIVE", "UNBOUND"), result.map { it.status })
        assertEquals(1, result.first().tenantCount)
    }

    @Test
    fun `platform creates trial and paid tenants with default daycare type`() {
        val fixture = PlatformAdministrationServiceFixture()
        fixture.allowPlatformAdmin()
        val organization = Organization(name = "Tenant")
        `when`(fixture.organizations.save(org.mockito.ArgumentMatchers.any(Organization::class.java))).thenReturn(organization)
        `when`(fixture.tenantUserAccounts.create("Admin", "admin@example.test", "secret", null)).thenReturn(UserProfile(email = "admin@example.test", displayName = "Admin"))
        `when`(fixture.branches.save(org.mockito.ArgumentMatchers.any(Branch::class.java))).thenAnswer { it.arguments[0] }
        `when`(fixture.subscriptions.save(org.mockito.ArgumentMatchers.any(TenantSubscription::class.java))).thenAnswer { it.arguments[0] }
        `when`(fixture.organizationCapabilities.forOrganization(organization.id)).thenReturn(OrganizationCapabilities(setOf("DAYCARE"), setOf(InstitutionCapability.DAYCARE_OPERATIONS)))
        `when`(fixture.memberships.findAllByOrganizationId(organization.id)).thenReturn(emptyList())
        `when`(fixture.invitations.findAllByOrganizationIdAndStatus(organization.id, com.daycare.api.domain.InvitationStatus.PENDING)).thenReturn(emptyList())
        `when`(fixture.branches.findAllByOrganizationId(organization.id)).thenReturn(emptyList())
        `when`(fixture.payments.findAllByOrganizationIdOrderByCreatedAtDesc(organization.id)).thenReturn(emptyList())
        val trial = fixture.service.createTenant(fixture.jwt, CreateTenantRequest("Tenant", "Main", null, TenantSubscriptionPlan.STARTER, null, 1, "Admin", "admin@example.test", "secret"))
        assertEquals("Tenant", trial.name)
        assertThrows(IllegalArgumentException::class.java) { fixture.service.createTenant(fixture.jwt, CreateTenantRequest("Tenant", "Main", null, TenantSubscriptionPlan.STARTER, BigDecimal("100"), 1, "Admin", "admin@example.test", "secret")) }
    }

    @Test
    fun `tenant subscription payment and invitation lifecycle enforce state`() {
        val fixture = PlatformAdministrationServiceFixture()
        fixture.allowPlatformAdmin()
        val organization = Organization(id = fixture.organizationId, name = "Tenant")
        val subscription = TenantSubscription(id = UUID.randomUUID(), organizationId = organization.id, status = TenantSubscriptionStatus.ACTIVE, periodEnd = LocalDate.now(BILLING_TIME_ZONE).plusDays(5), monthlyFee = BigDecimal("100"))
        fixture.stubTenantResponse(organization, subscription)
        `when`(fixture.payments.findAllByOrganizationIdOrderByCreatedAtDesc(organization.id)).thenReturn(listOf(TenantPayment(organizationId = organization.id, subscriptionId = subscription.id, amount = BigDecimal("100"), status = TenantPaymentStatus.PENDING)))
        `when`(fixture.payments.save(org.mockito.ArgumentMatchers.any(TenantPayment::class.java))).thenAnswer { it.arguments[0] }
        val paid = TenantPayment(id = UUID.randomUUID(), organizationId = organization.id, subscriptionId = subscription.id, amount = BigDecimal("100"), status = TenantPaymentStatus.PENDING)
        `when`(fixture.payments.findById(paid.id)).thenReturn(Optional.of(paid))
        `when`(fixture.payments.findWithLockById(paid.id)).thenReturn(paid)
        `when`(fixture.subscriptions.findById(subscription.id)).thenReturn(Optional.of(subscription))

        assertThrows(IllegalArgumentException::class.java) { fixture.service.renewSubscription(fixture.jwt, organization.id, UUID.randomUUID(), RenewTenantSubscriptionRequest(null)) }
        `when`(fixture.payments.findAllByOrganizationIdOrderByCreatedAtDesc(organization.id)).thenReturn(emptyList())
        assertEquals(TenantSubscriptionStatus.ACTIVE, fixture.service.renewSubscription(fixture.jwt, organization.id, UUID.randomUUID(), RenewTenantSubscriptionRequest(null)).subscriptionStatus)
        subscription.status = TenantSubscriptionStatus.SUSPENDED
        assertEquals(TenantSubscriptionStatus.ACTIVE, fixture.service.setSubscriptionStatus(fixture.jwt, organization.id, TenantSubscriptionStatus.ACTIVE, "Restore access").subscriptionStatus)
        assertEquals(TenantPaymentStatus.PAID, fixture.service.markPaymentPaid(fixture.jwt, organization.id, paid.id, UUID.randomUUID()).let { paid.status })
        val invitation = Invitation(organizationId = organization.id, role = Role.STAFF_ADMIN, email = "admin@example.test")
        `when`(fixture.invitations.findAllByOrganizationIdAndStatus(organization.id, com.daycare.api.domain.InvitationStatus.PENDING)).thenReturn(listOf(invitation))
        fixture.service.refreshStaffAdminInvitation(fixture.jwt, organization.id)
        fixture.service.cancelStaffAdminInvitation(fixture.jwt, organization.id)
        assertEquals(com.daycare.api.domain.InvitationStatus.EXPIRED, invitation.status)
    }

    @Test
    fun `tenant search combines name and staff admin matches without duplicates`() {
        val fixture = PlatformAdministrationServiceFixture()
        fixture.allowPlatformAdmin()
        val byName = Organization(id = UUID.randomUUID(), name = "Alpha")
        val byStaff = Organization(id = UUID.randomUUID(), name = "Beta")
        `when`(fixture.organizations.findAllByNameContainingIgnoreCase("admin")).thenReturn(listOf(byName))
        `when`(fixture.memberships.findOrganizationIdsByStaffAdminSearch("admin")).thenReturn(listOf(byName.id, byStaff.id))
        `when`(fixture.organizations.findAllById(listOf(byName.id, byStaff.id))).thenReturn(listOf(byName, byStaff))
        fixture.stubTenantResponse(byName)
        fixture.stubTenantResponse(byStaff)
        assertEquals(listOf("Alpha", "Beta"), fixture.service.tenants(fixture.jwt, " admin ").map { it.name })

        `when`(fixture.organizations.findAll()).thenReturn(listOf(byName, byStaff))
        assertEquals(2, fixture.service.tenants(fixture.jwt, null).size)
    }

    @Test
    fun `tenant page applies institution and effective status filters before paging`() {
        val fixture = PlatformAdministrationServiceFixture()
        fixture.allowPlatformAdmin()
        val matching = Organization(id = UUID.randomUUID(), name = "Alpha")
        val otherType = Organization(id = UUID.randomUUID(), name = "Beta")
        `when`(fixture.organizations.findAll()).thenReturn(listOf(matching, otherType))
        `when`(fixture.organizationTypes.findAllByOrganizationIdIn(listOf(matching.id, otherType.id))).thenReturn(listOf(
            com.daycare.api.persistence.OrganizationTypeAssignment(organizationId = matching.id, type = "DAYCARE"),
            com.daycare.api.persistence.OrganizationTypeAssignment(organizationId = otherType.id, type = "SCHOOL"),
        ))
        `when`(fixture.subscriptions.findAllByOrganizationIdIn(listOf(matching.id))).thenReturn(listOf(
            TenantSubscription(organizationId = matching.id, status = TenantSubscriptionStatus.ACTIVE),
        ))
        fixture.stubTenantResponse(matching, TenantSubscription(organizationId = matching.id, status = TenantSubscriptionStatus.ACTIVE))

        val result = fixture.service.tenantPage(fixture.jwt, null, TenantSubscriptionStatus.ACTIVE, "DAYCARE", 0, 1)
        assertEquals(1, result.totalElements)
        assertEquals(1, result.totalPages)
        assertEquals(1, result.totalMatching)
        assertEquals(1, result.statusCounts[TenantSubscriptionStatus.ACTIVE])
        assertEquals(listOf("Alpha"), result.items.map { it.name })
        assertThrows(IllegalArgumentException::class.java) { fixture.service.tenantPage(fixture.jwt, null, null, null, 0, 51) }
    }

    @Test
    fun `platform can create a paid tenant and rejects invalid billing choices`() {
        val fixture = PlatformAdministrationServiceFixture()
        fixture.allowPlatformAdmin()
        val organization = Organization(name = "Paid")
        `when`(fixture.organizations.save(org.mockito.ArgumentMatchers.any(Organization::class.java))).thenReturn(organization)
        `when`(fixture.tenantUserAccounts.create("Admin", "paid@example.test", "secret", "paid-admin")).thenReturn(UserProfile(displayName = "Admin", email = "paid@example.test"))
        `when`(fixture.branches.save(org.mockito.ArgumentMatchers.any(Branch::class.java))).thenAnswer { it.arguments[0] }
        `when`(fixture.subscriptions.save(org.mockito.ArgumentMatchers.any(TenantSubscription::class.java))).thenAnswer { it.arguments[0] }
        `when`(fixture.payments.save(org.mockito.ArgumentMatchers.any(TenantPayment::class.java))).thenAnswer { it.arguments[0] }
        fixture.stubTenantResponse(organization)
        val result = fixture.service.createTenant(fixture.jwt, CreateTenantRequest(" Paid ", " Main ", setOf("DAYCARE"), TenantSubscriptionPlan.PREMIUM, BigDecimal("250"), null, "Admin", "paid@example.test", "secret", "paid-admin"))
        assertEquals("Paid", result.name)
        verify(fixture.payments).save(org.mockito.ArgumentMatchers.any(TenantPayment::class.java))
        verify(fixture.organizationTypes).saveAll(org.mockito.ArgumentMatchers.anyList())
        verify(fixture.defaultCurriculumActivities).seed(organization.id)
    }

    @Test
    fun `secondary staff admin can be removed or edited but primary cannot`() {
        val fixture = PlatformAdministrationServiceFixture()
        fixture.allowPlatformAdmin()
        val organization = Organization(id = fixture.organizationId, name = "Tenant")
        fixture.stubTenantResponse(organization)
        val secondary = Membership(id = fixture.membershipId, userId = fixture.userId, organizationId = fixture.organizationId, role = Role.STAFF_ADMIN, primaryStaffAdmin = false, active = true)
        `when`(fixture.memberships.findById(fixture.membershipId)).thenReturn(Optional.of(secondary))
        `when`(fixture.users.findById(fixture.userId)).thenReturn(Optional.of(UserProfile(id = fixture.userId, displayName = "Old")))
        fixture.service.removeTenantStaffAdmin(fixture.jwt, fixture.organizationId, fixture.membershipId)
        assertEquals(false, secondary.active)
        fixture.service.updateTenantStaffAdmin(fixture.jwt, fixture.organizationId, fixture.membershipId, UpdateTenantStaffAdminRequest(" New "))
        assertEquals("New", fixture.users.findById(fixture.userId).get().displayName)

        secondary.primaryStaffAdmin = true
        assertThrows(IllegalArgumentException::class.java) { fixture.service.removeTenantStaffAdmin(fixture.jwt, fixture.organizationId, fixture.membershipId) }
        assertThrows(IllegalArgumentException::class.java) { fixture.service.updateTenantStaffAdmin(fixture.jwt, fixture.organizationId, fixture.membershipId, UpdateTenantStaffAdminRequest("No")) }
    }

    @Test
    fun `tenant update preserves offered types and updates subscription`() {
        val fixture = PlatformAdministrationServiceFixture()
        fixture.allowPlatformAdmin()
        val organization = Organization(id = fixture.organizationId, name = "Old")
        val subscription = TenantSubscription(organizationId = fixture.organizationId, status = TenantSubscriptionStatus.TRIAL, plan = TenantSubscriptionPlan.STARTER, monthlyFee = null)
        fixture.stubTenantResponse(organization, subscription)
        `when`(fixture.organizationTypes.findAllByOrganizationId(fixture.organizationId)).thenReturn(emptyList())
        `when`(fixture.educationOfferings.findAllByOrganizationIdOrderByCreatedAtAsc(fixture.organizationId)).thenReturn(emptyList())
        val result = fixture.service.updateTenant(fixture.jwt, fixture.organizationId, UpdateTenantRequest(" New ", setOf("DAYCARE", "TK"), TenantSubscriptionPlan.PREMIUM, null, "Approved package update"))
        assertEquals("New", result.name)
        assertEquals(TenantSubscriptionPlan.PREMIUM, subscription.plan)
        verify(fixture.organizationTypes).deleteAll(emptyList())
        verify(fixture.organizationTypes).flush()
        assertThrows(IllegalArgumentException::class.java) { fixture.service.updateTenant(fixture.jwt, fixture.organizationId, UpdateTenantRequest("New", setOf("DAYCARE", "TK"), TenantSubscriptionPlan.STARTER, null)) }

        assertThrows(IllegalArgumentException::class.java) { fixture.service.updateTenant(fixture.jwt, fixture.organizationId, UpdateTenantRequest("No types", emptySet(), TenantSubscriptionPlan.STARTER, null)) }
        assertThrows(IllegalArgumentException::class.java) { fixture.service.updateTenant(fixture.jwt, fixture.organizationId, UpdateTenantRequest("Fee", setOf("DAYCARE"), TenantSubscriptionPlan.STARTER, BigDecimal("10"))) }
    }

    @Test
    fun `void payment and invitation refresh reject missing or completed states`() {
        val fixture = PlatformAdministrationServiceFixture()
        fixture.allowPlatformAdmin()
        val organization = Organization(id = fixture.organizationId, name = "Tenant")
        fixture.stubTenantResponse(organization)
        val pending = TenantPayment(id = UUID.randomUUID(), organizationId = fixture.organizationId, subscriptionId = UUID.randomUUID(), amount = BigDecimal("10"), status = TenantPaymentStatus.PENDING)
        `when`(fixture.payments.findById(pending.id)).thenReturn(Optional.of(pending))
        `when`(fixture.payments.findWithLockById(pending.id)).thenReturn(pending)
        `when`(fixture.payments.findAllByOrganizationIdOrderByCreatedAtDesc(fixture.organizationId)).thenReturn(listOf(pending))
        assertEquals(TenantPaymentStatus.VOID, fixture.service.voidPayment(fixture.jwt, fixture.organizationId, pending.id, UUID.randomUUID()).payments.single().status)
        pending.status = TenantPaymentStatus.PAID
        assertThrows(IllegalArgumentException::class.java) { fixture.service.voidPayment(fixture.jwt, fixture.organizationId, pending.id, UUID.randomUUID()) }

        `when`(fixture.invitations.findAllByOrganizationIdAndStatus(fixture.organizationId, com.daycare.api.domain.InvitationStatus.PENDING)).thenReturn(emptyList())
        assertThrows(IllegalArgumentException::class.java) { fixture.service.refreshStaffAdminInvitation(fixture.jwt, fixture.organizationId) }
        assertThrows(IllegalArgumentException::class.java) { fixture.service.cancelStaffAdminInvitation(fixture.jwt, fixture.organizationId) }
    }

    @Test
    fun `manual subscription status accepts only suspended to active and active to suspended`() {
        val fixture = PlatformAdministrationServiceFixture()
        fixture.allowPlatformAdmin()
        val organization = Organization(id = fixture.organizationId, name = "Tenant")
        val subscription = TenantSubscription(organizationId = fixture.organizationId, status = TenantSubscriptionStatus.ACTIVE, periodEnd = LocalDate.now().plusDays(5))
        fixture.stubTenantResponse(organization, subscription)
        assertEquals(TenantSubscriptionStatus.SUSPENDED, fixture.service.setSubscriptionStatus(fixture.jwt, fixture.organizationId, TenantSubscriptionStatus.SUSPENDED, "Temporary hold").subscriptionStatus)
        assertEquals(TenantSubscriptionStatus.ACTIVE, fixture.service.setSubscriptionStatus(fixture.jwt, fixture.organizationId, TenantSubscriptionStatus.ACTIVE, "Resolved").subscriptionStatus)
        assertThrows(IllegalArgumentException::class.java) { fixture.service.setSubscriptionStatus(fixture.jwt, fixture.organizationId, TenantSubscriptionStatus.PENDING_PAYMENT, "Invalid") }
    }

    @Test
    fun `platform tenant response expires stale trial and active subscriptions and maps staff invitations`() {
        val fixture = PlatformAdministrationServiceFixture(); fixture.allowPlatformAdmin()
        val organization = Organization(id = fixture.organizationId, name = "Tenant")
        val expiredTrial = TenantSubscription(organizationId = organization.id, status = TenantSubscriptionStatus.TRIAL, trialEndsAt = LocalDate.now().minusDays(1), periodEnd = LocalDate.now())
        val primary = Membership(id = UUID.randomUUID(), organizationId = organization.id, userId = fixture.userId, role = Role.STAFF_ADMIN, primaryStaffAdmin = true, active = false)
        val pending = Invitation(organizationId = organization.id, role = Role.STAFF_ADMIN, email = "pending@test")
        fixture.stubTenantResponse(organization, expiredTrial)
        `when`(fixture.memberships.findAllByOrganizationId(organization.id)).thenReturn(listOf(primary))
        `when`(fixture.users.findById(primary.userId)).thenReturn(Optional.empty())
        `when`(fixture.invitations.findAllByOrganizationIdAndStatus(organization.id, com.daycare.api.domain.InvitationStatus.PENDING)).thenReturn(listOf(pending))
        val result = fixture.service.tenant(fixture.jwt, organization.id)
        assertEquals(TenantSubscriptionStatus.PENDING_PAYMENT, result.subscriptionStatus)
        assertEquals("pending@test", result.staffAdmin?.email)

        val activeExpired = TenantSubscription(organizationId = organization.id, status = TenantSubscriptionStatus.ACTIVE, periodEnd = LocalDate.now(BILLING_TIME_ZONE).minusDays(8))
        fixture.stubTenantResponse(organization, activeExpired)
        assertEquals(TenantSubscriptionStatus.EXPIRED, fixture.service.tenant(fixture.jwt, organization.id).subscriptionStatus)
    }

    @Test
    fun `platform tenant response reports prepaid next period once it becomes effective`() {
        val fixture = PlatformAdministrationServiceFixture(); fixture.allowPlatformAdmin()
        val organization = Organization(id = fixture.organizationId, name = "Tenant")
        val today = LocalDate.now(BILLING_TIME_ZONE)
        val subscription = TenantSubscription(
            organizationId = organization.id,
            status = TenantSubscriptionStatus.ACTIVE,
            periodStart = today.minusMonths(1),
            periodEnd = today.minusDays(1),
            nextPeriodStart = today,
            nextPeriodEnd = today.plusDays(29),
        )
        fixture.stubTenantResponse(organization, subscription)

        val result = fixture.service.tenant(fixture.jwt, organization.id)

        assertEquals(TenantSubscriptionStatus.ACTIVE, result.subscriptionStatus)
        assertEquals(today, result.periodStart)
        assertEquals(today.plusDays(29), result.periodEnd)
    }

    @Test
    fun `platform parent and tenant searches cover empty results and subscription guards`() {
        val fixture = PlatformAdministrationServiceFixture(); fixture.allowPlatformAdmin()
        `when`(fixture.users.findRegisteredParents("")).thenReturn(emptyList())
        assertTrue(fixture.service.parents(fixture.jwt, null).isEmpty())
        val organization = Organization(id = fixture.organizationId, name = "Tenant")
        val subscription = TenantSubscription(organizationId = organization.id, status = TenantSubscriptionStatus.ACTIVE, periodEnd = LocalDate.now().plusDays(4), monthlyFee = BigDecimal("100"))
        fixture.stubTenantResponse(organization, subscription)
        assertEquals(TenantSubscriptionStatus.ACTIVE, fixture.service.renewSubscription(fixture.jwt, organization.id, UUID.randomUUID(), RenewTenantSubscriptionRequest(BigDecimal("200"))).subscriptionStatus)
        assertThrows(IllegalArgumentException::class.java) { fixture.service.setSubscriptionStatus(fixture.jwt, organization.id, TenantSubscriptionStatus.ACTIVE, "Invalid") }
    }

    @Test
    fun `platform creates additional staff admin and enforces singleton platform admin`() {
        val fixture = PlatformAdministrationServiceFixture(); fixture.allowPlatformAdmin()
        val organization = Organization(id = fixture.organizationId, name = "Tenant")
        fixture.stubTenantResponse(organization)
        val staff = UserProfile(id = fixture.userId, displayName = "Staff", email = "staff@test")
        `when`(fixture.tenantUserAccounts.create("Staff", "staff@test", "secret", "staff")).thenReturn(staff)
        assertEquals(organization.id, fixture.service.createTenantStaffAdmin(fixture.jwt, organization.id, CreateTenantStaffAdminRequest("Staff", "staff", "staff@test", "secret")).id)
        assertThrows(IllegalStateException::class.java) { fixture.service.createPlatformAdmin(fixture.jwt, CreatePlatformAdminRequest("admin@test", "admin", "secret")) }
    }

    @Test
    fun `platform tenant update rejects offered type removal and trial fee`() {
        val fixture = PlatformAdministrationServiceFixture(); fixture.allowPlatformAdmin()
        val organization = Organization(id = fixture.organizationId, name = "Tenant")
        val subscription = TenantSubscription(organizationId = organization.id, status = TenantSubscriptionStatus.TRIAL, periodEnd = LocalDate.now(), monthlyFee = null)
        fixture.stubTenantResponse(organization, subscription)
        `when`(fixture.educationOfferings.findAllByOrganizationIdOrderByCreatedAtAsc(organization.id)).thenReturn(listOf(com.daycare.api.persistence.EducationOffering(organizationId = organization.id, institutionType = "TK")))
        assertThrows(IllegalArgumentException::class.java) { fixture.service.updateTenant(fixture.jwt, organization.id, UpdateTenantRequest("Tenant", setOf("DAYCARE"), TenantSubscriptionPlan.STARTER, null)) }
        assertThrows(IllegalArgumentException::class.java) { fixture.service.updateTenant(fixture.jwt, organization.id, UpdateTenantRequest("Tenant", setOf("DAYCARE", "TK"), TenantSubscriptionPlan.STARTER, BigDecimal("10"))) }
    }

    @Test
    fun `tenant response maps staff admins branches payments and pending invitation fallback`() {
        val fixture = PlatformAdministrationServiceFixture(); fixture.allowPlatformAdmin()
        val organization = Organization(id = fixture.organizationId, name = "Tenant")
        val subscription = TenantSubscription(organizationId = organization.id, status = TenantSubscriptionStatus.ACTIVE, periodEnd = LocalDate.now().plusDays(5), monthlyFee = BigDecimal("100"))
        fixture.stubTenantResponse(organization, subscription)
        val primaryUser = UserProfile(id = fixture.userId, displayName = "Primary", email = "primary@test")
        val primary = Membership(id = UUID.randomUUID(), organizationId = organization.id, userId = primaryUser.id, role = Role.STAFF_ADMIN, primaryStaffAdmin = true, active = true)
        val inactive = Membership(id = UUID.randomUUID(), organizationId = organization.id, userId = UUID.randomUUID(), role = Role.STAFF_ADMIN, primaryStaffAdmin = false, active = false)
        val parent = Membership(id = UUID.randomUUID(), organizationId = organization.id, userId = UUID.randomUUID(), role = Role.PARENT, active = true)
        `when`(fixture.memberships.findAllByOrganizationId(organization.id)).thenReturn(listOf(inactive, parent, primary))
        `when`(fixture.users.findById(primary.userId)).thenReturn(Optional.of(primaryUser))
        `when`(fixture.users.findById(inactive.userId)).thenReturn(Optional.empty())
        val pending = Invitation(organizationId = organization.id, role = Role.STAFF_ADMIN, email = null, phoneNumber = "+62000")
        val unrelated = Invitation(organizationId = organization.id, role = Role.PARENT, email = "parent@test")
        `when`(fixture.invitations.findAllByOrganizationIdAndStatus(organization.id, com.daycare.api.domain.InvitationStatus.PENDING)).thenReturn(listOf(unrelated, pending))
        val branch = Branch(id = UUID.randomUUID(), organizationId = organization.id, name = "Cabang", primary = true, fullAddress = "Alamat", googleMapsUrl = "https://maps.test")
        val secondary = Branch(id = UUID.randomUUID(), organizationId = organization.id, name = "Cadangan", primary = false)
        `when`(fixture.branches.findAllByOrganizationId(organization.id)).thenReturn(listOf(secondary, branch))
        val payment = TenantPayment(organizationId = organization.id, subscriptionId = subscription.id, amount = BigDecimal("100"), status = TenantPaymentStatus.PAID)
        `when`(fixture.payments.findAllByOrganizationIdOrderByCreatedAtDesc(organization.id)).thenReturn(listOf(payment))

        val active = fixture.service.tenant(fixture.jwt, organization.id)
        assertEquals("Primary", active.staffAdmin?.displayName)
        assertEquals("Cabang", active.branchName)
        assertEquals(2, active.branches.size)
        assertEquals(1, active.payments.size)

        primary.active = false
        val pendingResponse = fixture.service.tenant(fixture.jwt, organization.id)
        assertEquals("+62000", pendingResponse.staffAdmin?.email)
        assertEquals("PENDING", pendingResponse.staffAdmin?.status)
    }

    @Test
    fun `platform guards empty staff search and subscription payment invitation branches`() {
        val fixture = PlatformAdministrationServiceFixture(); fixture.allowPlatformAdmin()
        `when`(fixture.organizations.findAllByNameContainingIgnoreCase("none")).thenReturn(emptyList())
        `when`(fixture.memberships.findOrganizationIdsByStaffAdminSearch("none")).thenReturn(emptyList())
        assertTrue(fixture.service.tenants(fixture.jwt, " none ").isEmpty())

        val organization = Organization(id = fixture.organizationId, name = "Tenant")
        fixture.stubTenantResponse(organization)
        assertThrows(IllegalArgumentException::class.java) { fixture.service.renewSubscription(fixture.jwt, organization.id, UUID.randomUUID(), RenewTenantSubscriptionRequest(BigDecimal("100"))) }
        assertThrows(IllegalArgumentException::class.java) { fixture.service.setSubscriptionStatus(fixture.jwt, organization.id, TenantSubscriptionStatus.ACTIVE, "Invalid") }
        val payment = TenantPayment(id = UUID.randomUUID(), organizationId = UUID.randomUUID(), subscriptionId = UUID.randomUUID(), amount = BigDecimal("10"), status = TenantPaymentStatus.PENDING)
        `when`(fixture.payments.findById(payment.id)).thenReturn(Optional.of(payment))
        `when`(fixture.payments.findWithLockById(payment.id)).thenReturn(payment)
        assertThrows(IllegalArgumentException::class.java) { fixture.service.markPaymentPaid(fixture.jwt, organization.id, payment.id, UUID.randomUUID()) }
        val ownPayment = payment.apply { organizationId = organization.id; status = TenantPaymentStatus.PAID }
        assertThrows(IllegalArgumentException::class.java) { fixture.service.voidPayment(fixture.jwt, organization.id, ownPayment.id, UUID.randomUUID()) }
        assertThrows(IllegalArgumentException::class.java) { fixture.service.refreshStaffAdminInvitation(fixture.jwt, organization.id) }
        assertThrows(IllegalArgumentException::class.java) { fixture.service.cancelStaffAdminInvitation(fixture.jwt, organization.id) }
    }

    @Test
    fun `tenant response maps expiry, staff fallback and branch ordering variants`() {
        val f = PlatformAdministrationServiceFixture()
        val organization = Organization(id = f.organizationId, name = "Tenant")
        val trial = TenantSubscription(organizationId = organization.id, status = TenantSubscriptionStatus.TRIAL, trialEndsAt = LocalDate.now().minusDays(1))
        val primary = Membership(id = f.membershipId, organizationId = organization.id, userId = f.userId, role = Role.STAFF_ADMIN, primaryStaffAdmin = true, active = true)
        val secondary = Membership(organizationId = organization.id, userId = UUID.randomUUID(), role = Role.STAFF_ADMIN, primaryStaffAdmin = false, active = false)
        val primaryUser = UserProfile(id = f.userId, email = "admin@example.test", displayName = "Admin")
        val pending = Invitation(organizationId = organization.id, role = Role.STAFF_ADMIN, email = null, phoneNumber = "+62000", status = com.daycare.api.domain.InvitationStatus.PENDING)
        `when`(f.subscriptions.findByOrganizationId(organization.id)).thenReturn(trial)
        `when`(f.organizationCapabilities.forOrganization(organization.id)).thenReturn(OrganizationCapabilities(emptySet(), emptySet()))
        `when`(f.memberships.findAllByOrganizationId(organization.id)).thenReturn(listOf(secondary, primary))
        `when`(f.users.findById(primary.id)).thenReturn(Optional.of(primaryUser))
        `when`(f.users.findById(secondary.userId)).thenReturn(Optional.empty())
        `when`(f.invitations.findAllByOrganizationIdAndStatus(organization.id, com.daycare.api.domain.InvitationStatus.PENDING)).thenReturn(listOf(pending))
        val main = Branch(organizationId = organization.id, name = "Utama", primary = true)
        val other = Branch(organizationId = organization.id, name = "Cabang", primary = false)
        `when`(f.branches.findAllByOrganizationId(organization.id)).thenReturn(listOf(other, main))
        `when`(f.payments.findAllByOrganizationIdOrderByCreatedAtDesc(organization.id)).thenReturn(emptyList())
        val response = invokePrivate(f.service, "tenantResponse", organization) as TenantResponse
        assertEquals(TenantSubscriptionStatus.PENDING_PAYMENT, response.subscriptionStatus)
        assertEquals("Utama", response.branchName)
        assertEquals("ACTIVE", response.staffAdmins.first { it.id == primary.id }.status)
        assertEquals("ACTIVE", response.staffAdmin?.status)

        val active = TenantSubscription(organizationId = organization.id, status = TenantSubscriptionStatus.ACTIVE, periodEnd = LocalDate.now(BILLING_TIME_ZONE).minusDays(8))
        `when`(f.subscriptions.findByOrganizationId(organization.id)).thenReturn(active)
        val expired = invokePrivate(f.service, "tenantResponse", organization) as TenantResponse
        assertEquals(TenantSubscriptionStatus.EXPIRED, expired.subscriptionStatus)
    }

    @Test
    fun `tenant response computes grace end from current prepaid period and grace overrides`() {
        val f = PlatformAdministrationServiceFixture(graceEnabled = true)
        val organization = Organization(id = f.organizationId, name = "Tenant")
        val today = LocalDate.now(BILLING_TIME_ZONE)
        val subscription = TenantSubscription(
            organizationId = organization.id,
            status = TenantSubscriptionStatus.GRACE,
            periodEnd = today.minusDays(30),
            nextPeriodStart = today.minusDays(30),
            nextPeriodEnd = today.minusDays(2),
            gracePeriodDays = 7,
            nextGracePeriodDays = 10,
        )
        f.stubTenantResponse(organization, subscription)

        val futurePeriodGrace = invokePrivate(f.service, "tenantResponse", organization) as TenantResponse

        assertEquals(TenantSubscriptionStatus.GRACE, futurePeriodGrace.subscriptionStatus)
        assertEquals(today.minusDays(2).plusDays(10), futurePeriodGrace.graceEndsAt)

        subscription.nextGracePeriodDays = null
        val futurePeriodGraceFallback = invokePrivate(f.service, "tenantResponse", organization) as TenantResponse
        assertEquals(today.minusDays(2).plusDays(7), futurePeriodGraceFallback.graceEndsAt)

        subscription.nextPeriodStart = null
        subscription.nextPeriodEnd = null
        subscription.periodEnd = today.minusDays(3)
        val currentPeriodGrace = invokePrivate(f.service, "tenantResponse", organization) as TenantResponse

        assertEquals(TenantSubscriptionStatus.GRACE, currentPeriodGrace.subscriptionStatus)
        assertEquals(today.minusDays(3).plusDays(7), currentPeriodGrace.graceEndsAt)
    }

    @Test
    fun `account and tenant lookups reject a missing record at every not-found branch`() {
        val f = PlatformAdministrationServiceFixture()
        f.allowPlatformAdmin()

        assertThrows(IllegalArgumentException::class.java) {
            f.service.resetParentPassword(f.jwt, UUID.randomUUID(), ChangeTenantUserPasswordRequest("new-password"))
        }

        assertThrows(IllegalArgumentException::class.java) {
            f.service.removeTenantStaffAdmin(f.jwt, f.organizationId, UUID.randomUUID())
        }
        assertThrows(IllegalArgumentException::class.java) {
            f.service.updateTenantStaffAdmin(f.jwt, f.organizationId, UUID.randomUUID(), UpdateTenantStaffAdminRequest("New"))
        }
        assertThrows(IllegalArgumentException::class.java) {
            f.service.resetTenantStaffAdminPassword(f.jwt, f.organizationId, UUID.randomUUID(), ChangeTenantUserPasswordRequest("new-password"))
        }

        val membershipWithoutUser = Membership(id = f.membershipId, userId = f.userId, organizationId = f.organizationId, role = Role.STAFF_ADMIN, active = true, primaryStaffAdmin = false)
        `when`(f.memberships.findById(f.membershipId)).thenReturn(Optional.of(membershipWithoutUser))
        `when`(f.users.findById(f.userId)).thenReturn(Optional.empty())
        assertThrows(IllegalArgumentException::class.java) {
            f.service.updateTenantStaffAdmin(f.jwt, f.organizationId, f.membershipId, UpdateTenantStaffAdminRequest("New"))
        }
        assertThrows(IllegalArgumentException::class.java) {
            f.service.resetTenantStaffAdminPassword(f.jwt, f.organizationId, f.membershipId, ChangeTenantUserPasswordRequest("new-password"))
        }

        assertThrows(IllegalArgumentException::class.java) {
            f.service.markPaymentPaid(f.jwt, f.organizationId, UUID.randomUUID(), UUID.randomUUID())
        }
        assertThrows(IllegalArgumentException::class.java) {
            f.service.voidPayment(f.jwt, f.organizationId, UUID.randomUUID(), UUID.randomUUID())
        }

        val pendingPayment = TenantPayment(id = UUID.randomUUID(), organizationId = f.organizationId, subscriptionId = UUID.randomUUID(), amount = BigDecimal("100"), status = TenantPaymentStatus.PENDING)
        `when`(f.payments.findById(pendingPayment.id)).thenReturn(Optional.of(pendingPayment))
        `when`(f.payments.findWithLockById(pendingPayment.id)).thenReturn(pendingPayment)
        `when`(f.subscriptions.findById(pendingPayment.subscriptionId)).thenReturn(Optional.empty())
        assertThrows(IllegalArgumentException::class.java) {
            f.service.markPaymentPaid(f.jwt, f.organizationId, pendingPayment.id, UUID.randomUUID())
        }

        assertThrows(IllegalArgumentException::class.java) {
            f.service.tenant(f.jwt, UUID.randomUUID())
        }
        assertThrows(IllegalArgumentException::class.java) {
            f.service.setSubscriptionStatus(f.jwt, f.organizationId, TenantSubscriptionStatus.ACTIVE, "Invalid")
        }

        // Payment and subscription found, but the tenant itself is gone by the final lookup.
        val ghostOrganizationId = UUID.randomUUID()
        val ghostPayment = TenantPayment(id = UUID.randomUUID(), organizationId = ghostOrganizationId, subscriptionId = UUID.randomUUID(), amount = BigDecimal("50"), status = TenantPaymentStatus.PENDING)
        `when`(f.payments.findById(ghostPayment.id)).thenReturn(Optional.of(ghostPayment))
        `when`(f.payments.findWithLockById(ghostPayment.id)).thenReturn(ghostPayment)
        `when`(f.subscriptions.findById(ghostPayment.subscriptionId)).thenReturn(Optional.of(TenantSubscription(organizationId = ghostOrganizationId, status = TenantSubscriptionStatus.PENDING_PAYMENT)))
        assertThrows(IllegalArgumentException::class.java) {
            f.service.markPaymentPaid(f.jwt, ghostOrganizationId, ghostPayment.id, UUID.randomUUID())
        }
    }

    @Test
    fun `remove and update Staff Admin reject a membership from another tenant or the wrong role`() {
        val f = PlatformAdministrationServiceFixture()
        f.allowPlatformAdmin()

        val foreignOrgMembership = Membership(id = f.membershipId, userId = f.userId, organizationId = UUID.randomUUID(), role = Role.STAFF_ADMIN, active = true)
        `when`(f.memberships.findById(f.membershipId)).thenReturn(Optional.of(foreignOrgMembership))
        assertThrows(IllegalArgumentException::class.java) { f.service.removeTenantStaffAdmin(f.jwt, f.organizationId, f.membershipId) }
        assertThrows(IllegalArgumentException::class.java) { f.service.updateTenantStaffAdmin(f.jwt, f.organizationId, f.membershipId, UpdateTenantStaffAdminRequest("New")) }

        val staffRoleMembership = Membership(id = f.membershipId, userId = f.userId, organizationId = f.organizationId, role = Role.STAFF, active = true)
        `when`(f.memberships.findById(f.membershipId)).thenReturn(Optional.of(staffRoleMembership))
        assertThrows(IllegalArgumentException::class.java) { f.service.removeTenantStaffAdmin(f.jwt, f.organizationId, f.membershipId) }
        assertThrows(IllegalArgumentException::class.java) { f.service.updateTenantStaffAdmin(f.jwt, f.organizationId, f.membershipId, UpdateTenantStaffAdminRequest("New")) }
    }

    @Test
    fun `tenant creation covers an empty institution type set and the non-trial-without-fee rejection`() {
        val f = PlatformAdministrationServiceFixture()
        f.allowPlatformAdmin()
        val organization = Organization(name = "Empty Types")
        `when`(f.organizations.save(org.mockito.ArgumentMatchers.any(Organization::class.java))).thenReturn(organization)
        `when`(f.tenantUserAccounts.create("Admin", "admin@example.test", "secret", null)).thenReturn(UserProfile(email = "admin@example.test", displayName = "Admin"))
        `when`(f.branches.save(org.mockito.ArgumentMatchers.any(Branch::class.java))).thenAnswer { it.arguments[0] }
        `when`(f.subscriptions.save(org.mockito.ArgumentMatchers.any(TenantSubscription::class.java))).thenAnswer { it.arguments[0] }
        f.stubTenantResponse(organization)

        // An empty (but non-null) institutionTypes set falls back to the default DAYCARE type,
        // same as null - but takes the distinct `takeIf { isNotEmpty() }` false branch to get there.
        val created = f.service.createTenant(f.jwt, CreateTenantRequest("Empty Types", "Main", emptySet(), TenantSubscriptionPlan.STARTER, null, 1, "Admin", "admin@example.test", "secret"))
        assertEquals("Empty Types", created.name)

        // Not a trial and no monthly fee is rejected before the trial-must-not-have-a-fee check.
        assertThrows(IllegalArgumentException::class.java) {
            f.service.createTenant(f.jwt, CreateTenantRequest("No Fee", "Main", null, TenantSubscriptionPlan.STARTER, null, null, "Admin", "admin@example.test", "secret"))
        }
    }
}
