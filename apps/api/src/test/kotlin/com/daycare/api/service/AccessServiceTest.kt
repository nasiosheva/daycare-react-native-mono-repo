package com.daycare.api.service

import com.daycare.api.domain.RegistrationRole
import com.daycare.api.domain.Role
import com.daycare.api.domain.TenantSubscriptionStatus
import com.daycare.api.persistence.Membership
import com.daycare.api.persistence.MembershipRepository
import com.daycare.api.persistence.OrganizationRepository
import com.daycare.api.persistence.ParentFamilyProfileRepository
import com.daycare.api.persistence.TenantSubscription
import com.daycare.api.persistence.TenantSubscriptionRepository
import com.daycare.api.persistence.UserProfile
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Test
import org.mockito.Mockito.mock
import org.mockito.Mockito.`when`
import org.springframework.security.access.AccessDeniedException
import org.springframework.security.oauth2.jwt.Jwt
import java.util.UUID

class AccessServiceTest {
    private class Fixtures {
        val organizationId: UUID = UUID.randomUUID()
        val jwt: Jwt = mock(Jwt::class.java)
        val identityService: IdentityService = mock(IdentityService::class.java)
        val memberships: MembershipRepository = mock(MembershipRepository::class.java)
        val subscriptions: TenantSubscriptionRepository = mock(TenantSubscriptionRepository::class.java)
        val organizationCapabilities: OrganizationCapabilitiesService = mock(OrganizationCapabilitiesService::class.java)
        val user = UserProfile()
        val service = AccessService(
            identityService,
            memberships,
            mock(OrganizationRepository::class.java),
            mock(PlatformAccessService::class.java),
            subscriptions,
            organizationCapabilities,
            mock(PublishedOfferingCapabilityService::class.java),
            mock(ParentFamilyProfileRepository::class.java),
        )

        fun withSubscriptionStatus(status: TenantSubscriptionStatus) {
            `when`(identityService.sync(jwt)).thenReturn(user)
            `when`(subscriptions.findByOrganizationId(organizationId)).thenReturn(TenantSubscription(organizationId = organizationId, status = status))
            `when`(organizationCapabilities.forOrganization(organizationId)).thenReturn(OrganizationCapabilities(emptySet(), emptySet()))
        }
    }

    @Test
    fun `a Parent still reads a suspended tenant's child list through the explicit allowlist exception`() {
        val fixtures = Fixtures()
        fixtures.withSubscriptionStatus(TenantSubscriptionStatus.SUSPENDED)
        val membership = Membership(userId = fixtures.user.id, organizationId = fixtures.organizationId, role = Role.PARENT)
        `when`(fixtures.memberships.findAllByUserIdAndOrganizationId(fixtures.user.id, fixtures.organizationId)).thenReturn(listOf(membership))

        val scope = fixtures.service.require(fixtures.jwt, fixtures.organizationId, setOf(Role.PARENT), allowSubscriptionRestrictedForRoles = setOf(Role.PARENT))

        assertEquals(Role.PARENT, scope.membership.role)
    }

    @Test
    fun `a Staff Admin is still blocked from a suspended tenant even when the same allowlist is passed`() {
        val fixtures = Fixtures()
        fixtures.withSubscriptionStatus(TenantSubscriptionStatus.SUSPENDED)
        val membership = Membership(userId = fixtures.user.id, organizationId = fixtures.organizationId, role = Role.STAFF_ADMIN)
        `when`(fixtures.memberships.findAllByUserIdAndOrganizationId(fixtures.user.id, fixtures.organizationId)).thenReturn(listOf(membership))

        assertThrows(AccessDeniedException::class.java) {
            fixtures.service.require(fixtures.jwt, fixtures.organizationId, setOf(Role.STAFF_ADMIN), allowSubscriptionRestrictedForRoles = setOf(Role.PARENT))
        }
    }

    @Test
    fun `a Parent without the allowlist is still blocked from a suspended tenant`() {
        val fixtures = Fixtures()
        fixtures.withSubscriptionStatus(TenantSubscriptionStatus.SUSPENDED)
        val membership = Membership(userId = fixtures.user.id, organizationId = fixtures.organizationId, role = Role.PARENT)
        `when`(fixtures.memberships.findAllByUserIdAndOrganizationId(fixtures.user.id, fixtures.organizationId)).thenReturn(listOf(membership))

        assertThrows(AccessDeniedException::class.java) {
            fixtures.service.require(fixtures.jwt, fixtures.organizationId, setOf(Role.PARENT))
        }
    }

    @Test
    fun `an active tenant subscription never needs the allowlist`() {
        val fixtures = Fixtures()
        fixtures.withSubscriptionStatus(TenantSubscriptionStatus.ACTIVE)
        val membership = Membership(userId = fixtures.user.id, organizationId = fixtures.organizationId, role = Role.STAFF_ADMIN)
        `when`(fixtures.memberships.findAllByUserIdAndOrganizationId(fixtures.user.id, fixtures.organizationId)).thenReturn(listOf(membership))

        val scope = fixtures.service.require(fixtures.jwt, fixtures.organizationId, setOf(Role.STAFF_ADMIN))

        assertEquals(Role.STAFF_ADMIN, scope.membership.role)
    }

    @Test
    fun `inactive Parent is blocked from read-only routes unless explicitly allowlisted`() {
        val fixtures = Fixtures()
        fixtures.withSubscriptionStatus(TenantSubscriptionStatus.ACTIVE)
        val membership = Membership(userId = fixtures.user.id, organizationId = fixtures.organizationId, role = Role.PARENT, active = false)
        `when`(fixtures.memberships.findAllByUserIdAndOrganizationId(fixtures.user.id, fixtures.organizationId)).thenReturn(listOf(membership))

        assertThrows(AccessDeniedException::class.java) {
            fixtures.service.require(fixtures.jwt, fixtures.organizationId, setOf(Role.PARENT), readOnly = true)
        }

        val scope = fixtures.service.require(
            fixtures.jwt,
            fixtures.organizationId,
            setOf(Role.PARENT),
            readOnly = true,
            allowInactiveRoles = setOf(Role.PARENT),
        )
        assertEquals(Role.PARENT, scope.membership.role)
    }

    @Test
    fun `only a registered Parent account may use Parent self-service`() {
        assertThrows(AccessDeniedException::class.java) {
            requireRegisteredParent(UserProfile(registrationRole = null))
        }

        val parent = UserProfile(registrationRole = RegistrationRole.PARENT)
        assertEquals(parent, requireRegisteredParent(parent))
    }
}
