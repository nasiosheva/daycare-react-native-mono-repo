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
}
