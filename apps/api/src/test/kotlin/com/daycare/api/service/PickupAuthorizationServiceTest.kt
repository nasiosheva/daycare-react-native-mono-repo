package com.daycare.api.service

// Mories Deo Hutapea,S.E.,S.Kom

import com.daycare.api.domain.EducationOfferingStatus
import com.daycare.api.domain.PickupAuthorizationStatus
import com.daycare.api.domain.PickupVerificationMethod
import com.daycare.api.domain.Role
import com.daycare.api.persistence.AuditLogRepository
import com.daycare.api.persistence.Child
import com.daycare.api.persistence.EducationOffering
import com.daycare.api.persistence.EducationOfferingRepository
import com.daycare.api.persistence.Membership
import com.daycare.api.persistence.PickupAuthorization
import com.daycare.api.persistence.PickupAuthorizationRepository
import com.daycare.api.persistence.UserProfile
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Test
import org.mockito.Mockito.mock
import org.mockito.Mockito.never
import org.mockito.Mockito.verify
import org.mockito.Mockito.`when`
import java.time.Instant
import java.util.Optional
import java.util.UUID

class PickupAuthorizationServiceTest {
    private val access = mock(AccessService::class.java)
    private val childScopes = mock(ChildScopeService::class.java)
    private val authorizations = mock(PickupAuthorizationRepository::class.java)
    private val offerings = mock(EducationOfferingRepository::class.java)
    private val audits = mock(AuditLogRepository::class.java)
    private val service = PickupAuthorizationService(access, childScopes, authorizations, audits, offerings)
    private val organizationId = UUID.randomUUID()
    private val child = Child(organizationId = organizationId)
    private val scope = AccessScope(UserProfile(), Membership(role = Role.STAFF), emptySet(), emptySet())

    private fun publishedDaycareOffering() = EducationOffering(organizationId = organizationId, branchId = child.branchId, capabilities = "DAYCARE_OPERATIONS", status = EducationOfferingStatus.PUBLISHED)

    @Test
    fun `checkout verification accepts an active authorization for the child`() {
        val authorization = PickupAuthorization(organizationId = organizationId, childId = child.id, pickupPersonName = "Bibi Ani", relationship = "Bibi", verificationMethod = PickupVerificationMethod.PHOTO_ID, status = PickupAuthorizationStatus.ACTIVE, effectiveFrom = Instant.now().minusSeconds(60))
        `when`(authorizations.findById(authorization.id)).thenReturn(Optional.of(authorization))
        `when`(offerings.findAllByOrganizationIdAndBranchIdAndStatus(organizationId, child.branchId, EducationOfferingStatus.PUBLISHED)).thenReturn(listOf(publishedDaycareOffering()))

        val result = service.verifyCheckout(scope, child, authorization.id, null)

        assertEquals(authorization.id, result.authorizationId)
        assertEquals("Bibi Ani", result.pickupPersonName)
    }

    @Test
    fun `checkout without authorization requires a Staff Admin exception reason`() {
        `when`(offerings.findAllByOrganizationIdAndBranchIdAndStatus(organizationId, child.branchId, EducationOfferingStatus.PUBLISHED)).thenReturn(listOf(publishedDaycareOffering()))
        assertThrows(org.springframework.security.access.AccessDeniedException::class.java) { service.verifyCheckout(scope, child, null, null) }
        val staffAdmin = scope.copy(membership = Membership(role = Role.STAFF_ADMIN))

        val result = service.verifyCheckout(staffAdmin, child, null, "Parent terlambat mengirim otorisasi")

        assertEquals("Parent terlambat mengirim otorisasi", result.exceptionReason)
    }

    @Test
    fun `checkout rejects a child branch without a published Daycare offering`() {
        `when`(offerings.findAllByOrganizationIdAndBranchIdAndStatus(organizationId, child.branchId, EducationOfferingStatus.PUBLISHED)).thenReturn(emptyList())

        assertThrows(org.springframework.security.access.AccessDeniedException::class.java) { service.verifyCheckout(scope, child, null, null) }
    }

    @Test
    fun `parent can create authorization with defaults and staff admin can activate it`() {
        val jwt = mock(org.springframework.security.oauth2.jwt.Jwt::class.java)
        val parentScope = scope.copy(membership = Membership(organizationId = organizationId, role = Role.PARENT))
        val adminScope = scope.copy(membership = Membership(organizationId = organizationId, role = Role.STAFF_ADMIN))
        `when`(access.require(jwt, organizationId, setOf(Role.PARENT))).thenReturn(parentScope)
        `when`(access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN))).thenReturn(adminScope)
        `when`(childScopes.requireParentOperationalChild(parentScope, child.id, organizationId)).thenReturn(child)
        `when`(childScopes.requireStaffManagedChild(adminScope, child.id, organizationId)).thenReturn(child)
        `when`(offerings.findAllByOrganizationIdAndBranchIdAndStatus(organizationId, child.branchId, EducationOfferingStatus.PUBLISHED)).thenReturn(listOf(publishedDaycareOffering()))
        val authorization = PickupAuthorization(organizationId = organizationId, branchId = child.branchId, childId = child.id, pickupPersonName = "  Bibi  ", relationship = "  Bibi  ", verificationMethod = PickupVerificationMethod.PHOTO_ID, createdByUserId = parentScope.user.id)
        `when`(authorizations.save(org.mockito.ArgumentMatchers.any(PickupAuthorization::class.java))).thenAnswer { it.getArgument(0) }
        `when`(authorizations.findById(authorization.id)).thenReturn(Optional.of(authorization))

        val created = service.create(jwt, organizationId, child.id, CreatePickupAuthorizationRequest("  Bibi  ", "  Bibi  ", PickupVerificationMethod.PHOTO_ID))
        assertEquals("Bibi", created.pickupPersonName)
        assertEquals(PickupAuthorizationStatus.PENDING_VERIFICATION, created.status)
        val activated = service.activate(jwt, organizationId, child.id, authorization.id)
        assertEquals(PickupAuthorizationStatus.ACTIVE, activated.status)
        verify(audits, org.mockito.Mockito.times(2)).save(org.mockito.ArgumentMatchers.any())
    }

    @Test
    fun `parent cannot revoke another parent authorization and expired records cannot be revoked`() {
        val jwt = mock(org.springframework.security.oauth2.jwt.Jwt::class.java)
        val parentScope = scope.copy(membership = Membership(organizationId = organizationId, role = Role.PARENT))
        `when`(access.require(jwt, organizationId, setOf(Role.PARENT, Role.STAFF_ADMIN))).thenReturn(parentScope)
        `when`(childScopes.requireParentOperationalChild(parentScope, child.id, organizationId)).thenReturn(child)
        `when`(offerings.findAllByOrganizationIdAndBranchIdAndStatus(organizationId, child.branchId, EducationOfferingStatus.PUBLISHED)).thenReturn(listOf(publishedDaycareOffering()))
        val foreign = PickupAuthorization(organizationId = organizationId, childId = child.id, pickupPersonName = "A", relationship = "B", verificationMethod = PickupVerificationMethod.PHOTO_ID, createdByUserId = UUID.randomUUID())
        `when`(authorizations.findById(foreign.id)).thenReturn(Optional.of(foreign))
        assertThrows(org.springframework.security.access.AccessDeniedException::class.java) { service.revoke(jwt, organizationId, child.id, foreign.id, RevokePickupAuthorizationRequest("not me")) }
        foreign.createdByUserId = parentScope.user.id
        foreign.status = PickupAuthorizationStatus.EXPIRED
        assertThrows(IllegalArgumentException::class.java) { service.revoke(jwt, organizationId, child.id, foreign.id, RevokePickupAuthorizationRequest("expired")) }
        verify(audits, never()).save(org.mockito.ArgumentMatchers.any())
    }

    @Test
    fun `checkout rejects invalid exception and inactive authorization`() {
        `when`(offerings.findAllByOrganizationIdAndBranchIdAndStatus(organizationId, child.branchId, EducationOfferingStatus.PUBLISHED)).thenReturn(listOf(publishedDaycareOffering()))
        val adminScope = scope.copy(membership = Membership(organizationId = organizationId, role = Role.STAFF_ADMIN))
        assertThrows(IllegalArgumentException::class.java) { service.verifyCheckout(adminScope, child, UUID.randomUUID(), "reason") }
        val authorization = PickupAuthorization(organizationId = organizationId, childId = child.id, pickupPersonName = "A", relationship = "B", verificationMethod = PickupVerificationMethod.PHOTO_ID, status = PickupAuthorizationStatus.REVOKED, effectiveFrom = Instant.now().minusSeconds(100))
        `when`(authorizations.findById(authorization.id)).thenReturn(Optional.of(authorization))
        assertThrows(org.springframework.security.access.AccessDeniedException::class.java) { service.verifyCheckout(scope, child, authorization.id, null) }
    }

    @Test
    fun `list and revoke cover staff admin ownership and terminal states`() {
        val jwt = mock(org.springframework.security.oauth2.jwt.Jwt::class.java)
        val adminScope = scope.copy(membership = Membership(organizationId = organizationId, role = Role.STAFF_ADMIN))
        `when`(access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN, Role.STAFF, Role.PARENT))).thenReturn(adminScope)
        `when`(childScopes.requireStaffManagedChild(adminScope, child.id, organizationId)).thenReturn(child)
        `when`(offerings.findAllByOrganizationIdAndBranchIdAndStatus(organizationId, child.branchId, EducationOfferingStatus.PUBLISHED)).thenReturn(listOf(publishedDaycareOffering()))
        val active = PickupAuthorization(organizationId = organizationId, childId = child.id, pickupPersonName = "A", relationship = "B", verificationMethod = PickupVerificationMethod.PHOTO_ID, status = PickupAuthorizationStatus.ACTIVE)
        val revoked = PickupAuthorization(organizationId = organizationId, childId = child.id, pickupPersonName = "C", relationship = "D", verificationMethod = PickupVerificationMethod.PHOTO_ID, status = PickupAuthorizationStatus.REVOKED)
        `when`(authorizations.findAllByOrganizationIdAndChildIdOrderByCreatedAtDesc(organizationId, child.id)).thenReturn(listOf(active, revoked))
        val rows = service.list(jwt, organizationId, child.id)
        assertEquals(listOf(true, false), rows.map { it.canRevoke })

        `when`(access.require(jwt, organizationId, setOf(Role.PARENT, Role.STAFF_ADMIN))).thenReturn(adminScope)
        `when`(childScopes.requireStaffManagedChild(adminScope, child.id, organizationId)).thenReturn(child)
        `when`(authorizations.findById(active.id)).thenReturn(Optional.of(active))
        val result = service.revoke(jwt, organizationId, child.id, active.id, RevokePickupAuthorizationRequest("  Tidak diperlukan  "))
        assertEquals(PickupAuthorizationStatus.REVOKED, result.status)
        assertEquals(false, result.canRevoke)
    }

    @Test
    fun `authorization lifecycle rejects invalid expiry and terminal activation`() {
        val jwt = mock(org.springframework.security.oauth2.jwt.Jwt::class.java)
        val parentScope = scope.copy(membership = Membership(organizationId = organizationId, role = Role.PARENT))
        `when`(access.require(jwt, organizationId, setOf(Role.PARENT))).thenReturn(parentScope)
        `when`(childScopes.requireParentOperationalChild(parentScope, child.id, organizationId)).thenReturn(child)
        `when`(offerings.findAllByOrganizationIdAndBranchIdAndStatus(organizationId, child.branchId, EducationOfferingStatus.PUBLISHED)).thenReturn(listOf(publishedDaycareOffering()))
        val start = Instant.parse("2026-01-02T00:00:00Z")
        assertThrows(IllegalArgumentException::class.java) {
            service.create(jwt, organizationId, child.id, CreatePickupAuthorizationRequest("A", "B", PickupVerificationMethod.PHOTO_ID, start, start))
        }

        val adminScope = scope.copy(membership = Membership(organizationId = organizationId, role = Role.STAFF_ADMIN))
        `when`(access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN))).thenReturn(adminScope)
        `when`(childScopes.requireStaffManagedChild(adminScope, child.id, organizationId)).thenReturn(child)
        val revoked = PickupAuthorization(organizationId = organizationId, childId = child.id, pickupPersonName = "A", relationship = "B", verificationMethod = PickupVerificationMethod.PHOTO_ID, status = PickupAuthorizationStatus.REVOKED)
        `when`(authorizations.findById(revoked.id)).thenReturn(Optional.of(revoked))
        assertThrows(IllegalArgumentException::class.java) { service.activate(jwt, organizationId, child.id, revoked.id) }
    }

    @Test
    fun `checkout verification covers expired window, missing authorization, and invalid offering`() {
        `when`(offerings.findAllByOrganizationIdAndBranchIdAndStatus(organizationId, child.branchId, EducationOfferingStatus.PUBLISHED)).thenReturn(listOf(publishedDaycareOffering()))
        val expired = PickupAuthorization(organizationId = organizationId, childId = child.id, pickupPersonName = "A", relationship = "B", verificationMethod = PickupVerificationMethod.PHOTO_ID, status = PickupAuthorizationStatus.ACTIVE, effectiveFrom = Instant.now().minusSeconds(100), effectiveUntil = Instant.now().minusSeconds(1))
        `when`(authorizations.findById(expired.id)).thenReturn(Optional.of(expired))
        assertThrows(org.springframework.security.access.AccessDeniedException::class.java) { service.verifyCheckout(scope, child, expired.id, null) }
        `when`(authorizations.findById(UUID.randomUUID())).thenReturn(Optional.empty())
        assertThrows(IllegalArgumentException::class.java) { service.verifyCheckout(scope, child, UUID.randomUUID(), null) }

        `when`(offerings.findAllByOrganizationIdAndBranchIdAndStatus(organizationId, child.branchId, EducationOfferingStatus.PUBLISHED)).thenReturn(listOf(EducationOffering(organizationId = organizationId, branchId = child.branchId, capabilities = "ACADEMIC_CURRICULUM", status = EducationOfferingStatus.PUBLISHED)))
        assertThrows(org.springframework.security.access.AccessDeniedException::class.java) { service.verifyCheckout(scope, child, null, null) }
    }
}
