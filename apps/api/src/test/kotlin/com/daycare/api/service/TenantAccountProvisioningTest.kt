package com.daycare.api.service

import com.daycare.api.domain.InstitutionTypeCodes
import com.daycare.api.domain.InvitationStatus
import com.daycare.api.domain.Role
import com.daycare.api.domain.PushNotificationMuteDuration
import com.daycare.api.domain.TenantSubscriptionPlan
import com.daycare.api.domain.TenantSubscriptionStatus
import com.daycare.api.persistence.Branch
import com.daycare.api.persistence.BranchRepository
import com.daycare.api.persistence.ChildRepository
import com.daycare.api.persistence.DeviceTokenRepository
import com.daycare.api.persistence.DeviceToken
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
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.mockito.ArgumentCaptor
import org.mockito.Mockito.any
import org.mockito.Mockito.mock
import org.mockito.Mockito.never
import org.mockito.Mockito.verify
import org.mockito.Mockito.`when`
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.security.oauth2.jwt.Jwt
import java.math.BigDecimal
import java.time.LocalDate
import java.time.Instant
import java.util.Optional
import java.util.UUID

class TenantAccountProvisioningTest {
    @Test
    fun `creates application credentials without Firebase`() {
        val users = mock(UserProfileRepository::class.java)
        val passwordEncoder = mock(PasswordEncoder::class.java)
        `when`(users.findByEmailIgnoreCase("staff@tenant.test")).thenReturn(null)
        `when`(passwordEncoder.encode("123123")).thenReturn("hashed-password")
        `when`(users.save(any(UserProfile::class.java))).thenAnswer { it.arguments[0] }
        val service = TenantUserAccountService(users, passwordEncoder)

        val user = service.create("Staff Baru", "Staff@Tenant.Test", "123123")

        assertEquals("staff@tenant.test", user.email)
        assertEquals("Staff Baru", user.displayName)
        assertEquals("hashed-password", user.localPasswordHash)
        assert(user.firebaseUid.startsWith("local:"))
    }

    @Test
    fun `stores a unique username when one is provided`() {
        val users = mock(UserProfileRepository::class.java)
        val passwordEncoder = mock(PasswordEncoder::class.java)
        `when`(users.findByEmailIgnoreCase("staff@tenant.test")).thenReturn(null)
        `when`(users.findByUsernameIgnoreCase("staffbaru")).thenReturn(null)
        `when`(passwordEncoder.encode("123123")).thenReturn("hashed-password")
        `when`(users.save(any(UserProfile::class.java))).thenAnswer { it.arguments[0] }
        val service = TenantUserAccountService(users, passwordEncoder)

        val user = service.create("Staff Baru", "staff@tenant.test", "123123", "staffbaru")

        assertEquals("staffbaru", user.username)
        assertEquals("hashed-password", user.localPasswordHash)
        assertTrue(user.firebaseUid.startsWith("local:"))
    }

    @Test
    fun `updates a staff account and permits its existing email and username`() {
        val users = mock(UserProfileRepository::class.java)
        val passwordEncoder = mock(PasswordEncoder::class.java)
        val user = UserProfile(displayName = "Staff Lama", email = "staff@tenant.test", username = "stafflama")
        `when`(users.findByEmailIgnoreCase("staff@tenant.test")).thenReturn(user)
        `when`(users.findByUsernameIgnoreCase("stafflama")).thenReturn(user)
        val service = TenantUserAccountService(users, passwordEncoder)

        service.update(user, "Staff Baru", "Staff@Tenant.Test", "stafflama")

        assertEquals("Staff Baru", user.displayName)
        assertEquals("staff@tenant.test", user.email)
        assertEquals("stafflama", user.username)
    }

    @Test
    fun `rejects an email that already belongs to an account`() {
        val users = mock(UserProfileRepository::class.java)
        val passwordEncoder = mock(PasswordEncoder::class.java)
        `when`(users.findByEmailIgnoreCase("staff@tenant.test")).thenReturn(UserProfile(email = "staff@tenant.test"))
        val service = TenantUserAccountService(users, passwordEncoder)

        assertThrows(IllegalArgumentException::class.java) { service.create("Staff Baru", "staff@tenant.test", "123123") }

    }

    @Test
    fun `creates application credentials when local auth is disabled`() {
        val users = mock(UserProfileRepository::class.java)
        val passwordEncoder = mock(PasswordEncoder::class.java)
        `when`(users.findByEmailIgnoreCase("staff@tenant.test")).thenReturn(null)
        `when`(passwordEncoder.encode("123123")).thenReturn("hashed-password")
        `when`(users.save(any(UserProfile::class.java))).thenAnswer { it.arguments[0] }
        val service = TenantUserAccountService(users, passwordEncoder)

        val user = service.create("Staff Baru", "staff@tenant.test", "123123")

        assertTrue(user.firebaseUid.startsWith("local:"))
        assertEquals("hashed-password", user.localPasswordHash)
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
        val tenantAccounts = mock(TenantUserAccountService::class.java)
        val institutionTypes = mock(InstitutionTypeCatalogService::class.java)
        val defaultCurriculumActivities = mock(TenantDefaultCurriculumActivitySeeder::class.java)
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
        `when`(capabilities.forOrganization(organization.id)).thenReturn(OrganizationCapabilities(setOf(InstitutionTypeCodes.DAYCARE), emptySet()))
        `when`(memberships.findAllByOrganizationId(organization.id)).thenReturn(listOf(membership))
        `when`(users.findById(staffAdmin.id)).thenReturn(Optional.of(staffAdmin))
        `when`(branches.findFirstByOrganizationId(organization.id)).thenReturn(Branch(organizationId = organization.id, name = "Cabang Utama"))
        `when`(invitations.findAllByOrganizationIdAndStatus(organization.id, InvitationStatus.PENDING)).thenReturn(emptyList())
        `when`(payments.findAllByOrganizationIdOrderByCreatedAtDesc(organization.id)).thenReturn(emptyList())
        val service = PlatformAdministrationService(platformAccess, organizations, organizationTypes, capabilities, branches, subscriptions, payments, invitations, memberships, users, platformAdministrators, tenantAccounts, institutionTypes, defaultCurriculumActivities, mock(com.daycare.api.persistence.EducationOfferingRepository::class.java))

        val response = service.createTenant(jwt, CreateTenantRequest("Tenant Baru", "Cabang Utama", setOf(InstitutionTypeCodes.DAYCARE), TenantSubscriptionPlan.STARTER, null, 1, "Owner Tenant", "owner@tenant.test", "123123"))

        assertEquals("ACTIVE", response.staffAdmin?.status)
        assertEquals("owner@tenant.test", response.staffAdmin?.email)
        val membershipCaptor = ArgumentCaptor.forClass(Membership::class.java)
        verify(memberships).save(membershipCaptor.capture())
        assertEquals(Role.STAFF_ADMIN, membershipCaptor.value.role)
        assertTrue(membershipCaptor.value.primaryStaffAdmin)
        verify(defaultCurriculumActivities).seed(organization.id)
    }

    @Test
    fun `primary Staff Admin cannot be removed from a tenant`() {
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
        val tenantAccounts = mock(TenantUserAccountService::class.java)
        val institutionTypes = mock(InstitutionTypeCatalogService::class.java)
        val defaultCurriculumActivities = mock(TenantDefaultCurriculumActivitySeeder::class.java)
        val organization = Organization(name = "Tenant")
        val primaryMembership = Membership(organizationId = organization.id, role = Role.STAFF_ADMIN, primaryStaffAdmin = true)
        val jwt = mock(Jwt::class.java)
        `when`(platformAccess.requirePlatformAdmin(jwt)).thenReturn(UserProfile())
        `when`(organizations.findById(organization.id)).thenReturn(Optional.of(organization))
        `when`(memberships.findById(primaryMembership.id)).thenReturn(Optional.of(primaryMembership))
        val service = PlatformAdministrationService(platformAccess, organizations, organizationTypes, capabilities, branches, subscriptions, payments, invitations, memberships, users, platformAdministrators, tenantAccounts, institutionTypes, defaultCurriculumActivities, mock(com.daycare.api.persistence.EducationOfferingRepository::class.java))

        assertThrows(IllegalArgumentException::class.java) { service.removeTenantStaffAdmin(jwt, organization.id, primaryMembership.id) }
        assertTrue(primaryMembership.active)
    }

    @Test
    fun `tenant trial cannot be updated with a monthly fee`() {
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
        val tenantAccounts = mock(TenantUserAccountService::class.java)
        val institutionTypes = mock(InstitutionTypeCatalogService::class.java)
        val defaultCurriculumActivities = mock(TenantDefaultCurriculumActivitySeeder::class.java)
        val organization = Organization(name = "Tenant Trial")
        val subscription = TenantSubscription(organizationId = organization.id, plan = TenantSubscriptionPlan.STARTER, status = TenantSubscriptionStatus.TRIAL, periodStart = LocalDate.now(), periodEnd = LocalDate.now().plusMonths(1))
        val jwt = mock(Jwt::class.java)
        `when`(platformAccess.requirePlatformAdmin(jwt)).thenReturn(UserProfile())
        `when`(organizations.findById(organization.id)).thenReturn(Optional.of(organization))
        `when`(subscriptions.findByOrganizationId(organization.id)).thenReturn(subscription)
        val service = PlatformAdministrationService(platformAccess, organizations, organizationTypes, capabilities, branches, subscriptions, payments, invitations, memberships, users, platformAdministrators, tenantAccounts, institutionTypes, defaultCurriculumActivities, mock(com.daycare.api.persistence.EducationOfferingRepository::class.java))

        assertThrows(IllegalArgumentException::class.java) {
            service.updateTenant(jwt, organization.id, UpdateTenantRequest("Tenant Trial", setOf(InstitutionTypeCodes.DAYCARE), TenantSubscriptionPlan.STARTER, BigDecimal("100000")))
        }

        verify(organizationTypes, never()).deleteAll(any())
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
        val user = UserProfile(displayName = "Admin Baru", username = "admin-baru", email = "admin-baru@tenant.test")
        val membership = Membership(userId = user.id, organizationId = organizationId, role = Role.STAFF_ADMIN)
        `when`(access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN))).thenReturn(AccessScope(UserProfile(), Membership(), emptySet(), emptySet()))
        `when`(tenantAccounts.create("Admin Baru", "admin-baru@tenant.test", "123123", "admin-baru")).thenReturn(user)
        `when`(memberships.save(any(Membership::class.java))).thenReturn(membership)
        val branchFilters = mock(BranchListFilterService::class.java)
        val service = AdministrationService(access, branches, children, invitations, memberships, users, deviceTokens, notifications, tenantAccounts, branchFilters)

        val response = service.createTenantUser(jwt, organizationId, CreateTenantUserRequest("Admin Baru", "admin-baru@tenant.test", "123123", Role.STAFF_ADMIN, username = "admin-baru", branchId = UUID.randomUUID(), canManageChildPrograms = true, canManageDevelopmentCategories = true))

        assertEquals(Role.STAFF_ADMIN, response.role)
        assertEquals("ACTIVE", response.status)
        assertEquals("admin-baru", response.username)
        assertEquals("admin-baru@tenant.test", response.email)
        assertEquals(null, response.branchId)
        assertEquals(false, response.canManageChildPrograms)
        assertEquals(false, response.canManageDevelopmentCategories)
        verify(tenantAccounts).create("Admin Baru", "admin-baru@tenant.test", "123123", "admin-baru")
        assertThrows(IllegalArgumentException::class.java) { service.createTenantUser(jwt, organizationId, CreateTenantUserRequest("Parent", "parent@tenant.test", "123123", Role.PARENT)) }
    }

    @Test
    fun `Staff account requires an active branch in the current tenant and stores its permissions`() {
        val access = mock(AccessService::class.java)
        val branches = mock(BranchRepository::class.java)
        val children = mock(ChildRepository::class.java)
        val invitations = mock(InvitationRepository::class.java)
        val memberships = mock(MembershipRepository::class.java)
        val users = mock(UserProfileRepository::class.java)
        val deviceTokens = mock(DeviceTokenRepository::class.java)
        val notifications = mock(NotificationRepository::class.java)
        val tenantAccounts = mock(TenantUserAccountService::class.java)
        val branchFilters = mock(BranchListFilterService::class.java)
        val jwt = mock(Jwt::class.java)
        val organizationId = UUID.randomUUID()
        val branch = Branch(organizationId = organizationId, name = "Cabang Aktif")
        val user = UserProfile(displayName = "Guru Baru", email = "guru@tenant.test")
        `when`(access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN))).thenReturn(AccessScope(UserProfile(), Membership(), emptySet(), emptySet()))
        `when`(branches.findById(branch.id)).thenReturn(Optional.of(branch))
        `when`(tenantAccounts.create("Guru Baru", "guru@tenant.test", "123123", null)).thenReturn(user)
        `when`(memberships.save(any(Membership::class.java))).thenAnswer { it.arguments[0] }
        val service = AdministrationService(access, branches, children, invitations, memberships, users, deviceTokens, notifications, tenantAccounts, branchFilters)

        val response = service.createTenantUser(jwt, organizationId, CreateTenantUserRequest("Guru Baru", "guru@tenant.test", "123123", Role.STAFF, branchId = branch.id, canManageChildPrograms = true, canManageDevelopmentCategories = true))

        assertEquals(branch.id, response.branchId)
        assertTrue(response.canManageChildPrograms)
        assertTrue(response.canManageDevelopmentCategories)
        val membershipCaptor = ArgumentCaptor.forClass(Membership::class.java)
        verify(memberships).save(membershipCaptor.capture())
        assertEquals(Role.STAFF, membershipCaptor.value.role)
        assertEquals(branch.id, membershipCaptor.value.branchId)
        assertTrue(membershipCaptor.value.canManageChildPrograms)
        assertTrue(membershipCaptor.value.canManageDevelopmentCategories)
    }

    @Test
    fun `Staff account rejects an inactive or foreign branch before creating credentials`() {
        val access = mock(AccessService::class.java)
        val branches = mock(BranchRepository::class.java)
        val children = mock(ChildRepository::class.java)
        val invitations = mock(InvitationRepository::class.java)
        val memberships = mock(MembershipRepository::class.java)
        val users = mock(UserProfileRepository::class.java)
        val deviceTokens = mock(DeviceTokenRepository::class.java)
        val notifications = mock(NotificationRepository::class.java)
        val tenantAccounts = mock(TenantUserAccountService::class.java)
        val branchFilters = mock(BranchListFilterService::class.java)
        val jwt = mock(Jwt::class.java)
        val organizationId = UUID.randomUUID()
        val unavailableBranch = Branch(organizationId = UUID.randomUUID(), name = "Cabang Tenant Lain", active = false)
        `when`(access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN))).thenReturn(AccessScope(UserProfile(), Membership(), emptySet(), emptySet()))
        `when`(branches.findById(unavailableBranch.id)).thenReturn(Optional.of(unavailableBranch))
        val service = AdministrationService(access, branches, children, invitations, memberships, users, deviceTokens, notifications, tenantAccounts, branchFilters)

        assertThrows(IllegalArgumentException::class.java) {
            service.createTenantUser(jwt, organizationId, CreateTenantUserRequest("Guru Baru", "guru@tenant.test", "123123", Role.STAFF, branchId = unavailableBranch.id))
        }

        verify(memberships, never()).save(any(Membership::class.java))
    }

    @Test
    fun `device notification preference mutes and restores only the authenticated device`() {
        val access = mock(AccessService::class.java)
        val branches = mock(BranchRepository::class.java)
        val children = mock(ChildRepository::class.java)
        val invitations = mock(InvitationRepository::class.java)
        val memberships = mock(MembershipRepository::class.java)
        val users = mock(UserProfileRepository::class.java)
        val deviceTokens = mock(DeviceTokenRepository::class.java)
        val notifications = mock(NotificationRepository::class.java)
        val tenantAccounts = mock(TenantUserAccountService::class.java)
        val branchFilters = mock(BranchListFilterService::class.java)
        val jwt = mock(Jwt::class.java)
        val organizationId = UUID.randomUUID()
        val user = UserProfile()
        val device = DeviceToken(organizationId = organizationId, userId = user.id, installationId = "installation-id")
        `when`(access.require(jwt, organizationId, Role.entries.toSet(), readOnly = true)).thenReturn(AccessScope(user, Membership(userId = user.id, organizationId = organizationId), emptySet(), emptySet()))
        `when`(deviceTokens.findByInstallationId("installation-id")).thenReturn(device)
        val service = AdministrationService(access, branches, children, invitations, memberships, users, deviceTokens, notifications, tenantAccounts, branchFilters)

        val muted = service.updateDeviceNotificationPreference(jwt, organizationId, UpdateDeviceNotificationPreferenceRequest("installation-id", PushNotificationMuteDuration.ONE_HOUR))
        val restored = service.updateDeviceNotificationPreference(jwt, organizationId, UpdateDeviceNotificationPreferenceRequest("installation-id", null))

        assertTrue(muted.pushMutedUntil?.isAfter(Instant.now()) == true)
        assertEquals(null, restored.pushMutedUntil)
    }
}
