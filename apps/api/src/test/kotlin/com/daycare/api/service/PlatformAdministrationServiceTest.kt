package com.daycare.api.service

import com.daycare.api.domain.Role
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
 * Covers only resetTenantStaffAdminPassword: the rest of
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
    val institutionTypeCatalog = mock(InstitutionTypeCatalogService::class.java)
    val defaultCurriculumActivities = mock(TenantDefaultCurriculumActivitySeeder::class.java)
    val educationOfferings = mock(EducationOfferingRepository::class.java)
    val service = PlatformAdministrationService(
        platformAccess, organizations, organizationTypes, organizationCapabilities, branches, subscriptions,
        payments, invitations, memberships, users, tenantUserAccounts, institutionTypeCatalog,
        defaultCurriculumActivities, educationOfferings,
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
    @Test
    fun `resets the password of a non-primary active Staff Admin`() {
        val fixture = PlatformAdministrationServiceFixture()
        fixture.allowPlatformAdmin()
        val membership = Membership(id = fixture.membershipId, userId = fixture.userId, organizationId = fixture.organizationId, role = Role.STAFF_ADMIN, active = true, primaryStaffAdmin = false)
        val user = fixture.stubMembership(membership)

        fixture.service.resetTenantStaffAdminPassword(fixture.jwt, fixture.organizationId, fixture.membershipId, ChangeTenantUserPasswordRequest("new-password"))

        verify(fixture.tenantUserAccounts).changePassword(user, "new-password")
    }

    @Test
    fun `also resets the password of the primary Staff Admin, unlike update and remove`() {
        val fixture = PlatformAdministrationServiceFixture()
        fixture.allowPlatformAdmin()
        val membership = Membership(id = fixture.membershipId, userId = fixture.userId, organizationId = fixture.organizationId, role = Role.STAFF_ADMIN, active = true, primaryStaffAdmin = true)
        val user = fixture.stubMembership(membership)

        fixture.service.resetTenantStaffAdminPassword(fixture.jwt, fixture.organizationId, fixture.membershipId, ChangeTenantUserPasswordRequest("new-password"))

        verify(fixture.tenantUserAccounts).changePassword(user, "new-password")
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
}
