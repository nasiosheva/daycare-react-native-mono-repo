package com.daycare.api.service

import com.daycare.api.domain.Gender
import com.daycare.api.domain.PushNotificationMuteDuration
import com.daycare.api.domain.Role
import com.daycare.api.persistence.Branch
import com.daycare.api.persistence.BranchRepository
import com.daycare.api.persistence.Child
import com.daycare.api.persistence.ChildRepository
import com.daycare.api.persistence.DeviceToken
import com.daycare.api.persistence.DeviceTokenRepository
import com.daycare.api.persistence.InvitationRepository
import com.daycare.api.persistence.Membership
import com.daycare.api.persistence.MembershipRepository
import com.daycare.api.persistence.Notification
import com.daycare.api.persistence.NotificationRepository
import com.daycare.api.persistence.UserProfile
import com.daycare.api.persistence.UserProfileRepository
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Test
import org.mockito.Mockito.any
import org.mockito.Mockito.mock
import org.mockito.Mockito.verify
import org.mockito.Mockito.`when`
import org.springframework.data.domain.PageImpl
import org.springframework.data.domain.PageRequest
import org.springframework.security.oauth2.jwt.Jwt
import java.time.LocalDate
import java.util.Optional
import java.util.UUID

class AdministrationServiceTest {
    @Test
    fun `staff admin can create child and invite staff`() {
        val fixture = fixture()
        val branch = Branch(id = fixture.branchId, organizationId = fixture.organizationId, name = "Primary", primary = true)
        `when`(fixture.branches.findByOrganizationIdAndPrimaryTrue(fixture.organizationId)).thenReturn(branch)
        `when`(fixture.branches.findById(fixture.branchId)).thenReturn(Optional.of(branch))
        `when`(fixture.children.save(any(Child::class.java))).thenAnswer { it.arguments[0] }
        val child = fixture.service.createChild(fixture.jwt, fixture.organizationId, CreateChildRequest("  Ayu ", " Lestari ", " NIS ", Gender.FEMALE, LocalDate.of(2022, 1, 1), null, null))
        assertEquals("Ayu", child.firstName)
        `when`(fixture.invitations.save(any(com.daycare.api.persistence.Invitation::class.java))).thenAnswer { it.arguments[0] }
        val invitationId = fixture.service.invite(fixture.jwt, fixture.organizationId, CreateInvitationRequest(" STAFF@EXAMPLE.COM ", null, Role.STAFF, fixture.branchId, null))
        assertNotNull(invitationId)
    }

    @Test
    fun `device registration and notification preferences are scoped to current user`() {
        val fixture = fixture()
        val device = DeviceToken(organizationId = fixture.organizationId, userId = fixture.staff.id, installationId = "install", token = "old", platform = "android")
        `when`(fixture.devices.findByInstallationId("install")).thenReturn(device)
        fixture.service.registerDevice(fixture.jwt, fixture.organizationId, RegisterDeviceRequest("new", "android", "install", "Asia/Jakarta"))
        assertEquals("new", device.token)
        val muted = fixture.service.updateDeviceNotificationPreference(fixture.jwt, fixture.organizationId, UpdateDeviceNotificationPreferenceRequest("install", PushNotificationMuteDuration.ONE_HOUR))
        assertNotNull(muted.pushMutedUntil)
        assertNotNull(fixture.service.deviceNotificationPreference(fixture.jwt, fixture.organizationId, "install").pushMutedUntil)
        assertThrows(IllegalArgumentException::class.java) { fixture.service.registerDevice(fixture.jwt, fixture.organizationId, RegisterDeviceRequest("x", "web", "other", "UTC")) }
    }

    @Test
    fun `notifications support search pagination and mark all read`() {
        val fixture = fixture()
        val notification = Notification(organizationId = fixture.organizationId, recipientUserId = fixture.staff.id, title = "Info", body = "Body")
        `when`(fixture.notifications.findAllByRecipientUserIdAndOrganizationIdOrderByCreatedAtDescIdDesc(fixture.staff.id, fixture.organizationId, PageRequest.of(0, 10))).thenReturn(PageImpl(listOf(notification)))
        `when`(fixture.notifications.searchByRecipientUserIdAndOrganizationId(fixture.staff.id, fixture.organizationId, "info", PageRequest.of(0, 10))).thenReturn(PageImpl(listOf(notification)))
        `when`(fixture.notifications.countByRecipientUserIdAndOrganizationIdAndReadAtIsNull(fixture.staff.id, fixture.organizationId)).thenReturn(1)
        assertEquals(1, fixture.service.notifications(fixture.jwt, fixture.organizationId, null).items.size)
        assertEquals(1, fixture.service.notifications(fixture.jwt, fixture.organizationId, " info ").items.size)
        `when`(fixture.notifications.findById(notification.id)).thenReturn(Optional.of(notification))
        assertNotNull(fixture.service.markNotificationRead(fixture.jwt, fixture.organizationId, notification.id).readAt)
        fixture.service.markAllNotificationsRead(fixture.jwt, fixture.organizationId)
    }

    private data class Fixture(
        val organizationId: UUID,
        val branchId: UUID,
        val jwt: Jwt,
        val staff: UserProfile,
        val access: AccessService,
        val branches: BranchRepository,
        val children: ChildRepository,
        val invitations: com.daycare.api.persistence.InvitationRepository,
        val memberships: MembershipRepository,
        val users: UserProfileRepository,
        val devices: DeviceTokenRepository,
        val notifications: NotificationRepository,
        val tenantUsers: TenantUserAccountService,
        val tokenRevocations: AccessTokenRevocationService,
        val service: AdministrationService,
    )

    private fun fixture(): Fixture {
        val organizationId = UUID.randomUUID(); val branchId = UUID.randomUUID(); val jwt = mock(Jwt::class.java); val staff = UserProfile(displayName = "Admin")
        val access = mock(AccessService::class.java); val branches = mock(BranchRepository::class.java); val children = mock(ChildRepository::class.java); val invitations = mock(com.daycare.api.persistence.InvitationRepository::class.java); val memberships = mock(MembershipRepository::class.java); val users = mock(UserProfileRepository::class.java); val devices = mock(DeviceTokenRepository::class.java); val notifications = mock(NotificationRepository::class.java); val tenantUsers = mock(TenantUserAccountService::class.java); val branchFilters = mock(BranchListFilterService::class.java); val revocations = mock(AccessTokenRevocationService::class.java)
        val scope = AccessScope(staff, Membership(organizationId = organizationId, role = Role.STAFF_ADMIN, active = true), emptySet(), emptySet())
        `when`(access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN))).thenReturn(scope)
        `when`(access.require(jwt, organizationId, Role.entries.toSet())).thenReturn(scope)
        `when`(access.require(jwt, organizationId, Role.entries.toSet(), readOnly = true, allowInactiveRoles = setOf(Role.PARENT))).thenReturn(scope)
        `when`(access.require(jwt, organizationId, Role.entries.toSet(), readOnly = true)).thenReturn(scope)
        return Fixture(organizationId, branchId, jwt, staff, access, branches, children, invitations, memberships, users, devices, notifications, tenantUsers, revocations, AdministrationService(access, branches, children, invitations, memberships, users, devices, notifications, tenantUsers, branchFilters, revocations))
    }

    @Test
    fun `staff admin manages tenant users and permissions safely`() {
        val fixture = fixture()
        val branch = Branch(id = fixture.branchId, organizationId = fixture.organizationId, name = "Branch", active = true)
        val staff = UserProfile(displayName = "Staff", email = "staff@example.test")
        val membership = Membership(userId = staff.id, organizationId = fixture.organizationId, role = Role.STAFF, branchId = fixture.branchId, active = true)
        `when`(fixture.branches.findById(fixture.branchId)).thenReturn(Optional.of(branch))
        `when`(fixture.tenantUsers.create("Staff", "staff@example.test", "secret", null)).thenReturn(staff)
        `when`(fixture.memberships.save(any(Membership::class.java))).thenReturn(membership)
        `when`(fixture.memberships.findAllByUserIdAndOrganizationId(staff.id, fixture.organizationId)).thenReturn(listOf(membership))
        `when`(fixture.users.findById(staff.id)).thenReturn(Optional.of(staff))
        assertEquals(staff.id, fixture.service.createTenantUser(fixture.jwt, fixture.organizationId, CreateTenantUserRequest("Staff", "staff@example.test", "secret", Role.STAFF, branchId = fixture.branchId)).userId)
        assertEquals(true, fixture.service.updateTenantUserChildProgramPermission(fixture.jwt, fixture.organizationId, staff.id, UpdateTenantUserChildProgramPermissionRequest(true)).canManageChildPrograms)
        assertEquals(true, fixture.service.updateTenantUserDevelopmentCategoryPermission(fixture.jwt, fixture.organizationId, staff.id, UpdateTenantUserDevelopmentCategoryPermissionRequest(true)).canManageDevelopmentCategories)
        fixture.service.updateTenantUser(fixture.jwt, fixture.organizationId, staff.id, UpdateTenantUserRequest(" Staff 2 ", "staff2@example.test", branchId = fixture.branchId))
        fixture.service.changeTenantUserPassword(fixture.jwt, fixture.organizationId, staff.id, ChangeTenantUserPasswordRequest("secret2"))
        verify(fixture.tenantUsers).changePassword(staff, "secret2")
    }

    @Test
    fun `tenant user listing includes scoped memberships and pending invitations`() {
        val fixture = fixture()
        val user = UserProfile(displayName = "Staff", email = "staff@example.test")
        val membership = Membership(userId = user.id, organizationId = fixture.organizationId, role = Role.STAFF, branchId = fixture.branchId, active = true)
        `when`(fixture.memberships.findAllByOrganizationId(fixture.organizationId)).thenReturn(listOf(membership))
        `when`(fixture.users.findAllById(listOf(user.id))).thenReturn(listOf(user))
        `when`(fixture.invitations.findAllByOrganizationIdAndStatus(fixture.organizationId, com.daycare.api.domain.InvitationStatus.PENDING)).thenReturn(listOf(com.daycare.api.persistence.Invitation(organizationId = fixture.organizationId, role = Role.PARENT, email = "parent@example.test")))
        assertEquals(2, fixture.service.tenantUsers(fixture.jwt, fixture.organizationId).size)
    }

    @Test
    fun `child and invitation validation rejects incomplete or unavailable input`() {
        val fixture = fixture()
        val activeBranch = Branch(id = fixture.branchId, organizationId = fixture.organizationId, name = "Branch", active = true)
        val foreignBranch = Branch(id = UUID.randomUUID(), organizationId = UUID.randomUUID(), name = "Foreign", active = true)
        `when`(fixture.branches.findByOrganizationIdAndPrimaryTrue(fixture.organizationId)).thenReturn(null)
        assertThrows(IllegalArgumentException::class.java) {
            fixture.service.createChild(fixture.jwt, fixture.organizationId, CreateChildRequest(" ", null, null, Gender.FEMALE, LocalDate.now(), null, null))
        }
        assertThrows(IllegalArgumentException::class.java) {
            fixture.service.createChild(fixture.jwt, fixture.organizationId, CreateChildRequest("Ayu", null, null, Gender.UNSPECIFIED, LocalDate.now(), null, null))
        }
        assertThrows(IllegalArgumentException::class.java) {
            fixture.service.createChild(fixture.jwt, fixture.organizationId, CreateChildRequest("Ayu", null, null, Gender.FEMALE, LocalDate.now(), null, null))
        }
        `when`(fixture.branches.findById(fixture.branchId)).thenReturn(Optional.empty())
        assertThrows(IllegalArgumentException::class.java) {
            fixture.service.createChild(fixture.jwt, fixture.organizationId, CreateChildRequest("Ayu", null, null, Gender.FEMALE, LocalDate.now(), fixture.branchId, null))
        }
        `when`(fixture.branches.findById(foreignBranch.id)).thenReturn(Optional.of(foreignBranch))
        assertThrows(IllegalArgumentException::class.java) {
            fixture.service.createChild(fixture.jwt, fixture.organizationId, CreateChildRequest("Ayu", null, null, Gender.FEMALE, LocalDate.now(), foreignBranch.id, null))
        }
        val inactiveBranch = Branch(id = fixture.branchId, organizationId = fixture.organizationId, name = "Branch", active = false)
        `when`(fixture.branches.findById(fixture.branchId)).thenReturn(Optional.of(inactiveBranch))
        assertThrows(IllegalArgumentException::class.java) {
            fixture.service.createChild(fixture.jwt, fixture.organizationId, CreateChildRequest("Ayu", null, null, Gender.FEMALE, LocalDate.now(), fixture.branchId, null))
        }

        assertThrows(IllegalArgumentException::class.java) {
            fixture.service.invite(fixture.jwt, fixture.organizationId, CreateInvitationRequest(null, " ", Role.PARENT, null, null))
        }
        assertThrows(IllegalArgumentException::class.java) {
            fixture.service.invite(fixture.jwt, fixture.organizationId, CreateInvitationRequest("x@example.test", null, Role.STAFF_ADMIN, null, null))
        }
        assertThrows(IllegalArgumentException::class.java) {
            fixture.service.invite(fixture.jwt, fixture.organizationId, CreateInvitationRequest("x@example.test", null, Role.STAFF, null, null))
        }
        `when`(fixture.branches.findById(fixture.branchId)).thenReturn(Optional.empty())
        assertThrows(IllegalArgumentException::class.java) {
            fixture.service.invite(fixture.jwt, fixture.organizationId, CreateInvitationRequest("x@example.test", null, Role.STAFF, fixture.branchId, null))
        }
        `when`(fixture.branches.findById(foreignBranch.id)).thenReturn(Optional.of(foreignBranch))
        assertThrows(IllegalArgumentException::class.java) {
            fixture.service.invite(fixture.jwt, fixture.organizationId, CreateInvitationRequest("x@example.test", null, Role.STAFF, foreignBranch.id, null))
        }
        `when`(fixture.invitations.save(any(com.daycare.api.persistence.Invitation::class.java))).thenAnswer { it.arguments[0] }
        assertNotNull(fixture.service.invite(fixture.jwt, fixture.organizationId, CreateInvitationRequest(" parent@example.test ", " 0812 ", Role.PARENT, null, null)))
    }

    @Test
    fun `tenant account creation covers admin and staff role boundaries`() {
        val fixture = fixture()
        val branch = Branch(id = fixture.branchId, organizationId = fixture.organizationId, name = "Branch", active = true)
        assertThrows(IllegalArgumentException::class.java) {
            fixture.service.createTenantUser(fixture.jwt, fixture.organizationId, CreateTenantUserRequest("User", "user@example.test", "secret", Role.PARENT))
        }
        assertThrows(IllegalArgumentException::class.java) {
            fixture.service.createTenantUser(fixture.jwt, fixture.organizationId, CreateTenantUserRequest("User", "user@example.test", "secret", Role.STAFF))
        }
        val inactiveBranch = Branch(id = fixture.branchId, organizationId = fixture.organizationId, name = "Branch", active = false)
        `when`(fixture.branches.findById(fixture.branchId)).thenReturn(Optional.of(inactiveBranch))
        assertThrows(IllegalArgumentException::class.java) {
            fixture.service.createTenantUser(fixture.jwt, fixture.organizationId, CreateTenantUserRequest("User", "user@example.test", "secret", Role.STAFF, branchId = fixture.branchId))
        }
        val admin = UserProfile(displayName = "Admin 2", email = "admin2@example.test")
        `when`(fixture.tenantUsers.create("Admin 2", "admin2@example.test", "secret", "admin2")).thenReturn(admin)
        val adminMembership = Membership(userId = admin.id, organizationId = fixture.organizationId, role = Role.STAFF_ADMIN, branchId = null)
        `when`(fixture.memberships.save(any(Membership::class.java))).thenReturn(adminMembership)
        val response = fixture.service.createTenantUser(fixture.jwt, fixture.organizationId, CreateTenantUserRequest("Admin 2", "admin2@example.test", "secret", Role.STAFF_ADMIN, username = "admin2", branchId = fixture.branchId, canManageChildPrograms = true, canManageDevelopmentCategories = true))
        assertEquals(Role.STAFF_ADMIN, response.role)
        assertEquals(null, response.branchId)
        assertFalse(response.canManageChildPrograms)
        assertFalse(response.canManageDevelopmentCategories)
    }

    @Test
    fun `tenant user listing applies branch and pending invitation filters`() {
        val fixture = fixture()
        val admin = Membership(userId = UUID.randomUUID(), organizationId = fixture.organizationId, role = Role.STAFF_ADMIN, branchId = null)
        val staff = Membership(userId = UUID.randomUUID(), organizationId = fixture.organizationId, role = Role.STAFF, branchId = fixture.branchId)
        val other = Membership(userId = UUID.randomUUID(), organizationId = fixture.organizationId, role = Role.STAFF, branchId = UUID.randomUUID())
        val inactive = Membership(userId = UUID.randomUUID(), organizationId = fixture.organizationId, role = Role.PARENT, active = false)
        `when`(fixture.memberships.findAllByOrganizationId(fixture.organizationId)).thenReturn(listOf(admin, staff, other, inactive))
        `when`(fixture.users.findAllById(any())).thenReturn(emptyList())
        val pendingStaff = com.daycare.api.persistence.Invitation(organizationId = fixture.organizationId, role = Role.STAFF, branchId = fixture.branchId, email = "staff@example.test")
        val pendingOther = com.daycare.api.persistence.Invitation(organizationId = fixture.organizationId, role = Role.STAFF, branchId = UUID.randomUUID(), email = "other@example.test")
        val pendingAdmin = com.daycare.api.persistence.Invitation(organizationId = fixture.organizationId, role = Role.STAFF_ADMIN, email = "admin@example.test")
        `when`(fixture.invitations.findAllByOrganizationIdAndStatus(fixture.organizationId, com.daycare.api.domain.InvitationStatus.PENDING)).thenReturn(listOf(pendingStaff, pendingOther, pendingAdmin))
        assertEquals(3, fixture.service.tenantUsers(fixture.jwt, fixture.organizationId, BranchListFilter(fixture.branchId)).size)
    }

    @Test
    fun `password and deactivation enforce active membership and admin safeguards`() {
        val fixture = fixture()
        val target = UserProfile(displayName = "Staff", email = "staff@example.test")
        val staffMembership = Membership(userId = target.id, organizationId = fixture.organizationId, role = Role.STAFF, active = true)
        `when`(fixture.memberships.findAllByUserIdAndOrganizationId(target.id, fixture.organizationId)).thenReturn(listOf(staffMembership))
        `when`(fixture.users.findById(target.id)).thenReturn(Optional.of(target))
        assertThrows(IllegalArgumentException::class.java) { fixture.service.changeTenantUserPassword(fixture.jwt, fixture.organizationId, target.id, ChangeTenantUserPasswordRequest("short")) }
        fixture.service.changeTenantUserPassword(fixture.jwt, fixture.organizationId, target.id, ChangeTenantUserPasswordRequest("longer"))
        verify(fixture.tenantUsers).changePassword(target, "longer")
        verify(fixture.tokenRevocations).revokeUserSessions(target)
        assertThrows(IllegalArgumentException::class.java) { fixture.service.deactivateTenantUser(fixture.jwt, fixture.organizationId, fixture.staff.id) }

        `when`(fixture.memberships.findAllByUserIdAndOrganizationId(UUID.randomUUID(), fixture.organizationId)).thenReturn(emptyList())
        assertThrows(IllegalArgumentException::class.java) { fixture.service.deactivateTenantUser(fixture.jwt, fixture.organizationId, UUID.randomUUID()) }
        val primary = Membership(userId = target.id, organizationId = fixture.organizationId, role = Role.STAFF_ADMIN, primaryStaffAdmin = true, active = true)
        `when`(fixture.memberships.findAllByUserIdAndOrganizationId(target.id, fixture.organizationId)).thenReturn(listOf(primary))
        assertThrows(IllegalArgumentException::class.java) { fixture.service.deactivateTenantUser(fixture.jwt, fixture.organizationId, target.id) }
        val admin = Membership(userId = target.id, organizationId = fixture.organizationId, role = Role.STAFF_ADMIN, primaryStaffAdmin = false, active = true)
        `when`(fixture.memberships.findAllByUserIdAndOrganizationId(target.id, fixture.organizationId)).thenReturn(listOf(admin))
        `when`(fixture.memberships.findAllByOrganizationId(fixture.organizationId)).thenReturn(listOf(admin))
        assertThrows(IllegalArgumentException::class.java) { fixture.service.deactivateTenantUser(fixture.jwt, fixture.organizationId, target.id) }
        val secondAdmin = Membership(userId = UUID.randomUUID(), organizationId = fixture.organizationId, role = Role.STAFF_ADMIN, active = true)
        `when`(fixture.memberships.findAllByOrganizationId(fixture.organizationId)).thenReturn(listOf(admin, secondAdmin))
        fixture.service.deactivateTenantUser(fixture.jwt, fixture.organizationId, target.id)
        assertFalse(admin.active)
        assertNotNull(admin.deactivatedAt)
    }

    @Test
    fun `tenant user update and permission changes reject missing resources`() {
        val fixture = fixture()
        val id = UUID.randomUUID()
        assertThrows(IllegalArgumentException::class.java) {
            fixture.service.updateTenantUser(fixture.jwt, fixture.organizationId, id, UpdateTenantUserRequest("Staff", "staff@example.test", branchId = fixture.branchId))
        }
        val staff = UserProfile(displayName = "Staff")
        val membership = Membership(userId = staff.id, organizationId = fixture.organizationId, role = Role.STAFF, active = true, branchId = fixture.branchId)
        `when`(fixture.memberships.findAllByUserIdAndOrganizationId(id, fixture.organizationId)).thenReturn(listOf(membership))
        `when`(fixture.branches.findById(fixture.branchId)).thenReturn(Optional.empty())
        assertThrows(IllegalArgumentException::class.java) {
            fixture.service.updateTenantUser(fixture.jwt, fixture.organizationId, id, UpdateTenantUserRequest("Staff", "staff@example.test", branchId = fixture.branchId))
        }
        val foreign = Branch(id = fixture.branchId, organizationId = UUID.randomUUID(), name = "Foreign", active = true)
        `when`(fixture.branches.findById(fixture.branchId)).thenReturn(Optional.of(foreign))
        assertThrows(IllegalArgumentException::class.java) {
            fixture.service.updateTenantUser(fixture.jwt, fixture.organizationId, id, UpdateTenantUserRequest("Staff", "staff@example.test", branchId = fixture.branchId))
        }
        val branch = Branch(id = fixture.branchId, organizationId = fixture.organizationId, name = "Branch", active = true)
        `when`(fixture.branches.findById(fixture.branchId)).thenReturn(Optional.of(branch))
        `when`(fixture.users.findById(staff.id)).thenReturn(Optional.empty())
        assertThrows(IllegalArgumentException::class.java) {
            fixture.service.updateTenantUser(fixture.jwt, fixture.organizationId, id, UpdateTenantUserRequest("Staff", "staff@example.test", branchId = fixture.branchId))
        }
        `when`(fixture.users.findById(staff.id)).thenReturn(Optional.of(staff))
        assertEquals(staff.id, fixture.service.updateTenantUser(fixture.jwt, fixture.organizationId, id, UpdateTenantUserRequest("Staff", "staff@example.test", branchId = fixture.branchId, canManageChildPrograms = true, canManageDevelopmentCategories = true)).userId)
        val missingPermissionUserId = UUID.randomUUID()
        assertThrows(IllegalArgumentException::class.java) { fixture.service.updateTenantUserChildProgramPermission(fixture.jwt, fixture.organizationId, missingPermissionUserId, UpdateTenantUserChildProgramPermissionRequest(true)) }
        assertThrows(IllegalArgumentException::class.java) { fixture.service.updateTenantUserDevelopmentCategoryPermission(fixture.jwt, fixture.organizationId, missingPermissionUserId, UpdateTenantUserDevelopmentCategoryPermissionRequest(true)) }
    }

    @Test
    fun `device registration handles replacement and preference duration variants`() {
        val fixture = fixture()
        `when`(fixture.devices.findByInstallationId("install")).thenReturn(null)
        `when`(fixture.devices.findByToken("token")).thenReturn(null)
        `when`(fixture.devices.save(any(DeviceToken::class.java))).thenAnswer { it.arguments[0] }
        fixture.service.registerDevice(fixture.jwt, fixture.organizationId, RegisterDeviceRequest("token", "ios", "install", "UTC"))
        verify(fixture.devices).save(any(DeviceToken::class.java))
        assertThrows(IllegalArgumentException::class.java) { fixture.service.registerDevice(fixture.jwt, fixture.organizationId, RegisterDeviceRequest("token", "web", "install", "UTC")) }
        assertThrows(IllegalArgumentException::class.java) { fixture.service.registerDevice(fixture.jwt, fixture.organizationId, RegisterDeviceRequest(" ", "ios", "install", "UTC")) }

        val device = DeviceToken(organizationId = fixture.organizationId, userId = fixture.staff.id, installationId = "mute", token = "mute-token", platform = "android")
        `when`(fixture.devices.findByInstallationId("mute")).thenReturn(device)
        fixture.service.updateDeviceNotificationPreference(fixture.jwt, fixture.organizationId, UpdateDeviceNotificationPreferenceRequest("mute", PushNotificationMuteDuration.ONE_WEEK))
        fixture.service.updateDeviceNotificationPreference(fixture.jwt, fixture.organizationId, UpdateDeviceNotificationPreferenceRequest("mute", PushNotificationMuteDuration.ONE_MONTH))
        fixture.service.updateDeviceNotificationPreference(fixture.jwt, fixture.organizationId, UpdateDeviceNotificationPreferenceRequest("mute", null))
        assertEquals(null, fixture.service.deviceNotificationPreference(fixture.jwt, fixture.organizationId, "mute").pushMutedUntil)
        `when`(fixture.devices.findByInstallationId("missing")).thenReturn(null)
        assertThrows(IllegalArgumentException::class.java) { fixture.service.deviceNotificationPreference(fixture.jwt, fixture.organizationId, "missing") }
        val foreign = DeviceToken(id = device.id, organizationId = UUID.randomUUID(), userId = device.userId, installationId = "foreign", token = device.token, platform = device.platform)
        `when`(fixture.devices.findByInstallationId("foreign")).thenReturn(foreign)
        assertThrows(IllegalArgumentException::class.java) { fixture.service.deviceNotificationPreference(fixture.jwt, fixture.organizationId, "foreign") }
    }

    @Test
    fun `notifications validate paging and ownership while preserving read state`() {
        val fixture = fixture()
        assertThrows(IllegalArgumentException::class.java) { fixture.service.notifications(fixture.jwt, fixture.organizationId, null, -1, 10) }
        assertThrows(IllegalArgumentException::class.java) { fixture.service.notifications(fixture.jwt, fixture.organizationId, null, 0, 0) }
        assertThrows(IllegalArgumentException::class.java) { fixture.service.notifications(fixture.jwt, fixture.organizationId, null, 0, 51) }
        val notification = Notification(organizationId = fixture.organizationId, recipientUserId = fixture.staff.id, title = "Info", body = "Body")
        notification.readAt = java.time.Instant.now()
        `when`(fixture.notifications.findById(notification.id)).thenReturn(Optional.of(notification))
        assertNotNull(fixture.service.markNotificationRead(fixture.jwt, fixture.organizationId, notification.id).readAt)
        val foreign = Notification(id = notification.id, organizationId = UUID.randomUUID(), recipientUserId = notification.recipientUserId, title = notification.title, body = notification.body, actionPath = notification.actionPath, createdAt = notification.createdAt, readAt = notification.readAt)
        `when`(fixture.notifications.findById(foreign.id)).thenReturn(Optional.of(foreign))
        assertThrows(IllegalArgumentException::class.java) { fixture.service.markNotificationRead(fixture.jwt, fixture.organizationId, foreign.id) }
        `when`(fixture.notifications.findById(UUID.randomUUID())).thenReturn(Optional.empty())
        assertThrows(IllegalArgumentException::class.java) { fixture.service.markNotificationRead(fixture.jwt, fixture.organizationId, UUID.randomUUID()) }
    }

}
