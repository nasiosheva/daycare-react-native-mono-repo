package com.daycare.api.service

import com.daycare.api.domain.InstitutionType
import com.daycare.api.domain.InvitationStatus
import com.daycare.api.domain.Role
import com.daycare.api.domain.TenantSubscriptionPlan
import com.daycare.api.domain.TenantSubscriptionStatus
import com.daycare.api.persistence.Branch
import com.daycare.api.persistence.BranchRepository
import com.daycare.api.persistence.ChildRepository
import com.daycare.api.persistence.DeviceTokenRepository
import com.daycare.api.persistence.InvitationRepository
import com.daycare.api.persistence.Membership
import com.daycare.api.persistence.MembershipRepository
import com.daycare.api.persistence.NotificationRepository
import com.daycare.api.persistence.Organization
import com.daycare.api.persistence.OrganizationRepository
import com.daycare.api.persistence.OrganizationTypeAssignmentRepository
import com.daycare.api.persistence.PlatformAdministratorRepository
import com.daycare.api.persistence.TenantPaymentRepository
import com.daycare.api.persistence.TenantSubscription
import com.daycare.api.persistence.TenantSubscriptionRepository
import com.daycare.api.persistence.UserProfile
import com.daycare.api.persistence.UserProfileRepository
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Test
import org.mockito.ArgumentCaptor
import org.mockito.Mockito.any
import org.mockito.Mockito.mock
import org.mockito.Mockito.never
import org.mockito.Mockito.verify
import org.mockito.Mockito.`when`
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.security.oauth2.jwt.Jwt
import java.time.LocalDate
import java.util.Optional
import java.util.UUID

class TenantAccountProvisioningTest {
    @Test
    fun `creates local credentials without Firebase`() {
        val users = mock(UserProfileRepository::class.java)
        val firebase = mock(FirebaseAdminIdentityService::class.java)
        val passwordEncoder = mock(PasswordEncoder::class.java)
        `when`(users.findByEmailIgnoreCase("staff@tenant.test")).thenReturn(null)
        `when`(passwordEncoder.encode("123123")).thenReturn("hashed-password")
        `when`(users.save(any(UserProfile::class.java))).thenAnswer { it.arguments[0] }
        val service = TenantUserAccountService(users, firebase, passwordEncoder, true)

        val user = service.create("Staff Baru", "Staff@Tenant.Test", "123123")

        assertEquals("staff@tenant.test", user.email)
        assertEquals("Staff Baru", user.displayName)
        assertEquals("hashed-password", user.localPasswordHash)
        assert(user.firebaseUid.startsWith("local:"))
        verify(firebase, never()).createEmailPasswordUser("staff@tenant.test", "Staff Baru", "123123")
    }

    @Test
    fun `rejects an email that already belongs to an account`() {
        val users = mock(UserProfileRepository::class.java)
        val firebase = mock(FirebaseAdminIdentityService::class.java)
        val passwordEncoder = mock(PasswordEncoder::class.java)
        `when`(users.findByEmailIgnoreCase("staff@tenant.test")).thenReturn(UserProfile(email = "staff@tenant.test"))
        val service = TenantUserAccountService(users, firebase, passwordEncoder, false)

        assertThrows(IllegalArgumentException::class.java) { service.create("Staff Baru", "staff@tenant.test", "123123") }

        verify(firebase, never()).createEmailPasswordUser("staff@tenant.test", "Staff Baru", "123123")
    }

    @Test
    fun `creates a Firebase account when local auth is disabled`() {
        val users = mock(UserProfileRepository::class.java)
        val firebase = mock(FirebaseAdminIdentityService::class.java)
        val passwordEncoder = mock(PasswordEncoder::class.java)
        `when`(users.findByEmailIgnoreCase("staff@tenant.test")).thenReturn(null)
        `when`(firebase.createEmailPasswordUser("staff@tenant.test", "Staff Baru", "123123")).thenReturn("firebase-staff")
        `when`(users.save(any(UserProfile::class.java))).thenAnswer { it.arguments[0] }
        val service = TenantUserAccountService(users, firebase, passwordEncoder, false)

        val user = service.create("Staff Baru", "staff@tenant.test", "123123")

        assertEquals("firebase-staff", user.firebaseUid)
        assertEquals(null, user.localPasswordHash)
        verify(firebase).createEmailPasswordUser("staff@tenant.test", "Staff Baru", "123123")
    }

    @Test
    fun `tenant creation provisions an active Staff Admin instead of an invitation`() {
        val platformAccess = mock(PlatformAccessService::class.java)
        val organizations = mock(OrganizationRepository::class.java)
        val organizationTypes = mock(OrganizationTypeAssignmentRepository::class.java)
        val capabilities = mock(OrganizationCapabilitiesService::class.java)
        val branches = mock(BranchRepository::class.java)
        val subscriptions = mock(TenantSubscriptionRepository::class.java)
        val payments = mock(TenantPaymentRepository::class.java)
        val invitations = mock(InvitationRepository::class.java)
        val memberships = mock(MembershipRepository::class.java)
        val users = mock(UserProfileRepository::class.java)
        val platformAdministrators = mock(PlatformAdministratorRepository::class.java)
        val firebase = mock(FirebaseAdminIdentityService::class.java)
        val tenantAccounts = mock(TenantUserAccountService::class.java)
        val organization = Organization(name = "Tenant Baru")
        val staffAdmin = UserProfile(displayName = "Owner Tenant", email = "owner@tenant.test")
        val membership = Membership(userId = staffAdmin.id, organizationId = organization.id, role = Role.STAFF_ADMIN)
        val subscription = TenantSubscription(organizationId = organization.id, plan = TenantSubscriptionPlan.STARTER, status = TenantSubscriptionStatus.TRIAL, periodStart = LocalDate.now(), periodEnd = LocalDate.now().plusMonths(1))
        val jwt = mock(Jwt::class.java)
        `when`(platformAccess.requirePlatformAdmin(jwt)).thenReturn(UserProfile())
        `when`(organizations.save(any(Organization::class.java))).thenReturn(organization)
        `when`(subscriptions.save(any(TenantSubscription::class.java))).thenReturn(subscription)
        `when`(tenantAccounts.create("Owner Tenant", "owner@tenant.test", "123123")).thenReturn(staffAdmin)
        `when`(memberships.save(any(Membership::class.java))).thenReturn(membership)
        `when`(subscriptions.findByOrganizationId(organization.id)).thenReturn(subscription)
        `when`(capabilities.forOrganization(organization.id)).thenReturn(OrganizationCapabilities(setOf(InstitutionType.DAYCARE), emptySet()))
        `when`(memberships.findAllByOrganizationId(organization.id)).thenReturn(listOf(membership))
        `when`(users.findById(staffAdmin.id)).thenReturn(Optional.of(staffAdmin))
        `when`(branches.findFirstByOrganizationId(organization.id)).thenReturn(Branch(organizationId = organization.id, name = "Cabang Utama"))
        `when`(invitations.findAllByOrganizationIdAndStatus(organization.id, InvitationStatus.PENDING)).thenReturn(emptyList())
        `when`(payments.findAllByOrganizationIdOrderByCreatedAtDesc(organization.id)).thenReturn(emptyList())
        val service = PlatformAdministrationService(platformAccess, organizations, organizationTypes, capabilities, branches, subscriptions, payments, invitations, memberships, users, platformAdministrators, firebase, tenantAccounts)

        val response = service.createTenant(jwt, CreateTenantRequest("Tenant Baru", "Cabang Utama", setOf(InstitutionType.DAYCARE), TenantSubscriptionPlan.STARTER, null, 1, "Owner Tenant", "owner@tenant.test", "123123"))

        assertEquals("ACTIVE", response.staffAdmin?.status)
        assertEquals("owner@tenant.test", response.staffAdmin?.email)
        val membershipCaptor = ArgumentCaptor.forClass(Membership::class.java)
        verify(memberships).save(membershipCaptor.capture())
        assertEquals(Role.STAFF_ADMIN, membershipCaptor.value.role)
    }

    @Test
    fun `Staff Admin can create Staff Admin and Staff accounts only`() {
        val access = mock(AccessService::class.java)
        val branches = mock(BranchRepository::class.java)
        val children = mock(ChildRepository::class.java)
        val invitations = mock(InvitationRepository::class.java)
        val memberships = mock(MembershipRepository::class.java)
        val users = mock(UserProfileRepository::class.java)
        val deviceTokens = mock(DeviceTokenRepository::class.java)
        val notifications = mock(NotificationRepository::class.java)
        val tenantAccounts = mock(TenantUserAccountService::class.java)
        val jwt = mock(Jwt::class.java)
        val organizationId = UUID.randomUUID()
        val user = UserProfile(displayName = "Admin Baru", email = "admin-baru@tenant.test")
        val membership = Membership(userId = user.id, organizationId = organizationId, role = Role.STAFF_ADMIN)
        `when`(access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN))).thenReturn(AccessScope(UserProfile(), Membership(), emptySet(), emptySet()))
        `when`(tenantAccounts.create("Admin Baru", "admin-baru@tenant.test", "123123")).thenReturn(user)
        `when`(memberships.save(any(Membership::class.java))).thenReturn(membership)
        val service = AdministrationService(access, branches, children, invitations, memberships, users, deviceTokens, notifications, tenantAccounts)

        val response = service.createTenantUser(jwt, organizationId, CreateTenantUserRequest("Admin Baru", "admin-baru@tenant.test", "123123", Role.STAFF_ADMIN))

        assertEquals(Role.STAFF_ADMIN, response.role)
        assertEquals("ACTIVE", response.status)
        assertEquals("admin-baru@tenant.test", response.email)
        assertThrows(IllegalArgumentException::class.java) { service.createTenantUser(jwt, organizationId, CreateTenantUserRequest("Parent", "parent@tenant.test", "123123", Role.PARENT)) }
    }
}
