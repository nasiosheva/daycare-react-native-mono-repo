package com.daycare.api.service

// Mories Deo Hutapea,S.E.,S.Kom

import com.daycare.api.domain.RegistrationRole
import com.daycare.api.domain.Role
import com.daycare.api.domain.TenantSubscriptionStatus
import com.daycare.api.domain.InstitutionCapability
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
import org.mockito.Mockito.verify
import org.mockito.Mockito.`when`
import org.springframework.security.access.AccessDeniedException
import org.springframework.security.oauth2.jwt.Jwt
import java.util.UUID
import java.util.Optional
import java.time.LocalDate

class AccessServiceTest {
    private class Fixtures {
        val organizationId: UUID = UUID.randomUUID()
        val jwt: Jwt = mock(Jwt::class.java)
        val identityService: IdentityService = mock(IdentityService::class.java)
        val memberships: MembershipRepository = mock(MembershipRepository::class.java)
        val subscriptions: TenantSubscriptionRepository = mock(TenantSubscriptionRepository::class.java)
        val organizationCapabilities: OrganizationCapabilitiesService = mock(OrganizationCapabilitiesService::class.java)
        val publishedCapabilities: PublishedOfferingCapabilityService = mock(PublishedOfferingCapabilityService::class.java)
        val organizations: OrganizationRepository = mock(OrganizationRepository::class.java)
        val platformAccess: PlatformAccessService = mock(PlatformAccessService::class.java)
        val parentFamilyProfiles: ParentFamilyProfileRepository = mock(ParentFamilyProfileRepository::class.java)
        val user = UserProfile()
        val service = AccessService(
            identityService,
            memberships,
            organizations,
            platformAccess,
            subscriptions,
            organizationCapabilities,
            publishedCapabilities,
            parentFamilyProfiles,
        )

        fun withSubscriptionStatus(status: TenantSubscriptionStatus) {
            `when`(identityService.sync(jwt)).thenReturn(user)
            `when`(subscriptions.findByOrganizationId(organizationId)).thenReturn(TenantSubscription(organizationId = organizationId, status = status))
            `when`(organizationCapabilities.forOrganization(organizationId)).thenReturn(OrganizationCapabilities(emptySet(), emptySet()))
        }
    }

    @Test
    fun `current user maps memberships subscriptions unknown organizations and parent family`() {
        val fixtures = Fixtures()
        val secondOrganization = UUID.randomUUID()
        val active = Membership(userId = fixtures.user.id, organizationId = fixtures.organizationId, role = Role.PARENT, active = true)
        val inactive = Membership(userId = fixtures.user.id, organizationId = secondOrganization, role = Role.STAFF, active = false)
        `when`(fixtures.identityService.sync(fixtures.jwt)).thenReturn(fixtures.user)
        `when`(fixtures.subscriptions.findAll()).thenReturn(listOf(TenantSubscription(organizationId = fixtures.organizationId, status = TenantSubscriptionStatus.ACTIVE)))
        `when`(fixtures.memberships.findAllByUserId(fixtures.user.id)).thenReturn(listOf(inactive, active))
        `when`(fixtures.organizations.findById(fixtures.organizationId)).thenReturn(Optional.of(com.daycare.api.persistence.Organization(id = fixtures.organizationId, name = "Utama")))
        `when`(fixtures.organizations.findById(secondOrganization)).thenReturn(Optional.empty())
        `when`(fixtures.organizationCapabilities.forOrganization(fixtures.organizationId)).thenReturn(OrganizationCapabilities(setOf("PAUD"), setOf(InstitutionCapability.DAYCARE_OPERATIONS)))
        `when`(fixtures.organizationCapabilities.forOrganization(secondOrganization)).thenReturn(OrganizationCapabilities(emptySet(), emptySet()))
        `when`(fixtures.platformAccess.isPlatformAdmin(fixtures.user)).thenReturn(false)
        `when`(fixtures.parentFamilyProfiles.findByUserId(fixtures.user.id)).thenReturn(null)

        val response = fixtures.service.currentUser(fixtures.jwt)

        assertEquals(2, response.memberships.size)
        assertEquals("Unknown organization", response.memberships.last().organizationName)
        assertEquals(TenantSubscriptionStatus.ACTIVE, response.memberships.first().subscriptionStatus)
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

    @Test
    fun `capability and writable guards fail closed and pass when configured`() {
        val fixtures = Fixtures()
        val scope = AccessScope(fixtures.user, Membership(active = false), emptySet(), emptySet())
        assertThrows(AccessDeniedException::class.java) { fixtures.service.requireWritable(scope) }
        assertThrows(AccessDeniedException::class.java) { fixtures.service.requireAnyCapability(scope, setOf(InstitutionCapability.ACADEMIC_CURRICULUM)) }
        val enabled = AccessScope(scope.user, Membership(active = true), emptySet(), setOf(InstitutionCapability.ACADEMIC_CURRICULUM))
        fixtures.service.requireWritable(enabled)
        fixtures.service.requireAnyCapability(enabled, setOf(InstitutionCapability.ACADEMIC_CURRICULUM))
    }

    @Test
    fun `required capability delegates published offering guard`() {
        val fixtures = Fixtures()
        fixtures.withSubscriptionStatus(TenantSubscriptionStatus.ACTIVE)
        val membership = Membership(userId = fixtures.user.id, organizationId = fixtures.organizationId, role = Role.STAFF_ADMIN)
        `when`(fixtures.memberships.findAllByUserIdAndOrganizationId(fixtures.user.id, fixtures.organizationId)).thenReturn(listOf(membership))
        `when`(fixtures.organizationCapabilities.forOrganization(fixtures.organizationId)).thenReturn(OrganizationCapabilities(setOf("PAUD"), setOf(InstitutionCapability.ACADEMIC_CURRICULUM)))
        fixtures.service.require(fixtures.jwt, fixtures.organizationId, setOf(Role.STAFF_ADMIN), InstitutionCapability.ACADEMIC_CURRICULUM)
        verify(fixtures.publishedCapabilities).requirePublishedCapability(fixtures.organizationId, InstitutionCapability.ACADEMIC_CURRICULUM)
    }

    @Test
    fun `trial expiration is derived without mutating storage and required capability fails closed`() {
        val fixtures = Fixtures()
        fixtures.withSubscriptionStatus(TenantSubscriptionStatus.TRIAL)
        val membership = Membership(userId = fixtures.user.id, organizationId = fixtures.organizationId, role = Role.STAFF_ADMIN)
        `when`(fixtures.memberships.findAllByUserIdAndOrganizationId(fixtures.user.id, fixtures.organizationId)).thenReturn(listOf(membership))
        val subscription = TenantSubscription(organizationId = fixtures.organizationId, status = TenantSubscriptionStatus.TRIAL, trialEndsAt = LocalDate.now().minusDays(1))
        `when`(fixtures.subscriptions.findByOrganizationId(fixtures.organizationId)).thenReturn(subscription)
        assertThrows(AccessDeniedException::class.java) { fixtures.service.require(fixtures.jwt, fixtures.organizationId, setOf(Role.STAFF_ADMIN)) }
        assertEquals(TenantSubscriptionStatus.TRIAL, subscription.status)

        `when`(fixtures.subscriptions.findByOrganizationId(fixtures.organizationId)).thenReturn(TenantSubscription(organizationId = fixtures.organizationId, status = TenantSubscriptionStatus.ACTIVE))
        `when`(fixtures.organizationCapabilities.forOrganization(fixtures.organizationId)).thenReturn(OrganizationCapabilities(emptySet(), emptySet()))
        assertThrows(AccessDeniedException::class.java) {
            fixtures.service.require(fixtures.jwt, fixtures.organizationId, setOf(Role.STAFF_ADMIN), InstitutionCapability.DAYCARE_OPERATIONS)
        }
    }

    @Test
    fun `grace access is deny by default and only granted to explicitly allowlisted roles`() {
        val fixtures = Fixtures()
        val today = LocalDate.now(BILLING_TIME_ZONE)
        fixtures.withSubscriptionStatus(TenantSubscriptionStatus.ACTIVE)
        val membership = Membership(userId = fixtures.user.id, organizationId = fixtures.organizationId, role = Role.STAFF)
        `when`(fixtures.memberships.findAllByUserIdAndOrganizationId(fixtures.user.id, fixtures.organizationId)).thenReturn(listOf(membership))
        `when`(fixtures.subscriptions.findByOrganizationId(fixtures.organizationId)).thenReturn(TenantSubscription(organizationId = fixtures.organizationId, status = TenantSubscriptionStatus.ACTIVE, periodEnd = today.minusDays(1), gracePeriodDays = 7))

        assertThrows(AccessDeniedException::class.java) { fixtures.service.require(fixtures.jwt, fixtures.organizationId, setOf(Role.STAFF)) }
        assertEquals(Role.STAFF, fixtures.service.require(fixtures.jwt, fixtures.organizationId, setOf(Role.STAFF), allowGraceForRoles = setOf(Role.STAFF)).membership.role)
    }

    @Test
    fun `missing membership and unsupported capability are rejected`() {
        val fixtures = Fixtures()
        fixtures.withSubscriptionStatus(TenantSubscriptionStatus.ACTIVE)
        `when`(fixtures.memberships.findAllByUserIdAndOrganizationId(fixtures.user.id, fixtures.organizationId)).thenReturn(emptyList())
        assertThrows(AccessDeniedException::class.java) { fixtures.service.require(fixtures.jwt, fixtures.organizationId, setOf(Role.STAFF_ADMIN)) }
        val scope = AccessScope(fixtures.user, Membership(active = true), emptySet(), setOf(InstitutionCapability.ACADEMIC_CURRICULUM))
        assertThrows(AccessDeniedException::class.java) { fixtures.service.requireAnyCapability(scope, setOf(InstitutionCapability.DAYCARE_OPERATIONS)) }
        assertThrows(AccessDeniedException::class.java) { fixtures.service.requireAnyCapability(scope, emptySet()) }
    }
}
