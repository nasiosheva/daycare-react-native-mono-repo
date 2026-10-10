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
import com.daycare.api.persistence.UserProfile
import com.daycare.api.persistence.UserProfileRepository
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Test
import org.mockito.Mockito.mock
import org.mockito.Mockito.verify
import org.mockito.Mockito.verifyNoInteractions
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
private class PlatformAdministrationServiceFixture {
    val platformAccess = mock(PlatformAccessService::class.java)
    val organizations = mock(OrganizationRepository::class.java)
    val organizationTypes = mock(OrganizationTypeAssignmentRepository::class.java)
    val organizationCapabilities = mock(OrganizationCapabilitiesService::class.java)
    val branches = mock(BranchRepository::class.java)
    val subscriptions = mock(TenantSubscriptionRepository::class.java)
    val payments = mock(TenantPaymentRepository::class.java)
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
        defaultCurriculumActivities, educationOfferings, tokenRevocations,
    )

    val jwt: Jwt = mock(Jwt::class.java)
    val organizationId: UUID = UUID.randomUUID()
    val membershipId: UUID = UUID.randomUUID()
    val userId: UUID = UUID.randomUUID()

    /** Stubs a platform admin caller and an organization that exists. */
    fun allowPlatformAdmin() {
        `when`(platformAccess.requirePlatformAdmin(jwt)).thenReturn(UserProfile())
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
        val subscription = TenantSubscription(id = UUID.randomUUID(), organizationId = organization.id, status = TenantSubscriptionStatus.SUSPENDED, periodEnd = LocalDate.now().minusDays(1), monthlyFee = BigDecimal("100"))
        fixture.stubTenantResponse(organization, subscription)
        `when`(fixture.payments.findAllByOrganizationIdOrderByCreatedAtDesc(organization.id)).thenReturn(listOf(TenantPayment(organizationId = organization.id, subscriptionId = subscription.id, amount = BigDecimal("100"), status = TenantPaymentStatus.PENDING)))
        `when`(fixture.payments.save(org.mockito.ArgumentMatchers.any(TenantPayment::class.java))).thenAnswer { it.arguments[0] }
        val paid = TenantPayment(id = UUID.randomUUID(), organizationId = organization.id, subscriptionId = subscription.id, amount = BigDecimal("100"), status = TenantPaymentStatus.PENDING)
        `when`(fixture.payments.findById(paid.id)).thenReturn(Optional.of(paid))
        `when`(fixture.subscriptions.findById(subscription.id)).thenReturn(Optional.of(subscription))

        assertEquals(TenantSubscriptionStatus.PENDING_PAYMENT, fixture.service.renewSubscription(fixture.jwt, organization.id, RenewTenantSubscriptionRequest(null)).subscriptionStatus)
        subscription.status = TenantSubscriptionStatus.SUSPENDED
        assertEquals(TenantSubscriptionStatus.ACTIVE, fixture.service.setSubscriptionStatus(fixture.jwt, organization.id, TenantSubscriptionStatus.ACTIVE).subscriptionStatus)
        assertEquals(TenantPaymentStatus.PAID, fixture.service.markPaymentPaid(fixture.jwt, organization.id, paid.id).let { paid.status })
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
        val result = fixture.service.updateTenant(fixture.jwt, fixture.organizationId, UpdateTenantRequest(" New ", setOf("DAYCARE", "TK"), TenantSubscriptionPlan.PREMIUM, null))
        assertEquals("New", result.name)
        assertEquals(TenantSubscriptionPlan.PREMIUM, subscription.plan)
        verify(fixture.organizationTypes).deleteAll(emptyList())
        verify(fixture.organizationTypes).flush()

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
        `when`(fixture.payments.findAllByOrganizationIdOrderByCreatedAtDesc(fixture.organizationId)).thenReturn(listOf(pending))
        assertEquals(TenantPaymentStatus.VOID, fixture.service.voidPayment(fixture.jwt, fixture.organizationId, pending.id).payments.single().status)
        pending.status = TenantPaymentStatus.PAID
        assertThrows(IllegalArgumentException::class.java) { fixture.service.voidPayment(fixture.jwt, fixture.organizationId, pending.id) }

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
        assertEquals(TenantSubscriptionStatus.SUSPENDED, fixture.service.setSubscriptionStatus(fixture.jwt, fixture.organizationId, TenantSubscriptionStatus.SUSPENDED).subscriptionStatus)
        assertEquals(TenantSubscriptionStatus.ACTIVE, fixture.service.setSubscriptionStatus(fixture.jwt, fixture.organizationId, TenantSubscriptionStatus.ACTIVE).subscriptionStatus)
        assertThrows(IllegalArgumentException::class.java) { fixture.service.setSubscriptionStatus(fixture.jwt, fixture.organizationId, TenantSubscriptionStatus.PENDING_PAYMENT) }
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

        val activeExpired = TenantSubscription(organizationId = organization.id, status = TenantSubscriptionStatus.ACTIVE, periodEnd = LocalDate.now().minusDays(1))
        fixture.stubTenantResponse(organization, activeExpired)
        assertEquals(TenantSubscriptionStatus.EXPIRED, fixture.service.tenant(fixture.jwt, organization.id).subscriptionStatus)
    }

    @Test
    fun `platform parent and tenant searches cover empty results and subscription guards`() {
        val fixture = PlatformAdministrationServiceFixture(); fixture.allowPlatformAdmin()
        `when`(fixture.users.findRegisteredParents("")).thenReturn(emptyList())
        assertTrue(fixture.service.parents(fixture.jwt, null).isEmpty())
        val organization = Organization(id = fixture.organizationId, name = "Tenant")
        val subscription = TenantSubscription(organizationId = organization.id, status = TenantSubscriptionStatus.ACTIVE, periodEnd = LocalDate.now().plusDays(4), monthlyFee = BigDecimal("100"))
        fixture.stubTenantResponse(organization, subscription)
        assertThrows(IllegalArgumentException::class.java) { fixture.service.renewSubscription(fixture.jwt, organization.id, RenewTenantSubscriptionRequest(BigDecimal("200"))) }
        assertThrows(IllegalArgumentException::class.java) { fixture.service.setSubscriptionStatus(fixture.jwt, organization.id, TenantSubscriptionStatus.ACTIVE) }
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
}
