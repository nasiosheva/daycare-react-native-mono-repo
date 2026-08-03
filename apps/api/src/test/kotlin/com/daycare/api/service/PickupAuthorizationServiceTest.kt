package com.daycare.api.service

import com.daycare.api.domain.PickupAuthorizationStatus
import com.daycare.api.domain.PickupVerificationMethod
import com.daycare.api.domain.Role
import com.daycare.api.persistence.AuditLogRepository
import com.daycare.api.persistence.Child
import com.daycare.api.persistence.Membership
import com.daycare.api.persistence.PickupAuthorization
import com.daycare.api.persistence.PickupAuthorizationRepository
import com.daycare.api.persistence.UserProfile
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Test
import org.mockito.Mockito.mock
import org.mockito.Mockito.`when`
import java.time.Instant
import java.util.Optional
import java.util.UUID

class PickupAuthorizationServiceTest {
    private val authorizations = mock(PickupAuthorizationRepository::class.java)
    private val service = PickupAuthorizationService(mock(AccessService::class.java), mock(ChildScopeService::class.java), authorizations, mock(AuditLogRepository::class.java))
    private val organizationId = UUID.randomUUID()
    private val child = Child(organizationId = organizationId)
    private val scope = AccessScope(UserProfile(), Membership(role = Role.STAFF), emptySet(), emptySet())

    @Test
    fun `checkout verification accepts an active authorization for the child`() {
        val authorization = PickupAuthorization(organizationId = organizationId, childId = child.id, pickupPersonName = "Bibi Ani", relationship = "Bibi", verificationMethod = PickupVerificationMethod.PHOTO_ID, status = PickupAuthorizationStatus.ACTIVE, effectiveFrom = Instant.now().minusSeconds(60))
        `when`(authorizations.findById(authorization.id)).thenReturn(Optional.of(authorization))

        val result = service.verifyCheckout(scope, child, authorization.id, null)

        assertEquals(authorization.id, result.authorizationId)
        assertEquals("Bibi Ani", result.pickupPersonName)
    }

    @Test
    fun `checkout without authorization requires a Staff Admin exception reason`() {
        assertThrows(org.springframework.security.access.AccessDeniedException::class.java) { service.verifyCheckout(scope, child, null, null) }
        val staffAdmin = scope.copy(membership = Membership(role = Role.STAFF_ADMIN))

        val result = service.verifyCheckout(staffAdmin, child, null, "Parent terlambat mengirim otorisasi")

        assertEquals("Parent terlambat mengirim otorisasi", result.exceptionReason)
    }
}
