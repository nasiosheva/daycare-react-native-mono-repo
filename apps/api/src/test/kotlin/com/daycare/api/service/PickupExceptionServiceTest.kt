package com.daycare.api.service

// Mories Deo Hutapea,S.E.,S.Kom

import com.daycare.api.domain.EducationOfferingStatus
import com.daycare.api.domain.PickupExceptionStatus
import com.daycare.api.domain.PickupExceptionVerificationMethod
import com.daycare.api.domain.Role
import com.daycare.api.persistence.AttendanceRecord
import com.daycare.api.persistence.AttendanceRepository
import com.daycare.api.persistence.AuditLogRepository
import com.daycare.api.persistence.Branch
import com.daycare.api.persistence.BranchRepository
import com.daycare.api.persistence.Child
import com.daycare.api.persistence.ChildRepository
import com.daycare.api.persistence.EducationOffering
import com.daycare.api.persistence.EducationOfferingRepository
import com.daycare.api.persistence.Membership
import com.daycare.api.persistence.PickupExceptionRequest
import com.daycare.api.persistence.PickupExceptionRequestRepository
import com.daycare.api.persistence.PickupAuthorizationRepository
import com.daycare.api.persistence.UserProfile
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.ArgumentMatchers.any
import org.mockito.Mockito.mock
import org.mockito.Mockito.verify
import org.mockito.Mockito.`when`
import org.springframework.security.access.AccessDeniedException
import org.springframework.security.oauth2.jwt.Jwt
import java.time.Instant
import java.time.LocalDate
import java.util.Optional
import java.util.UUID

class PickupExceptionServiceTest {
    private val access = mock(AccessService::class.java)
    private val childScopes = mock(ChildScopeService::class.java)
    private val requests = mock(PickupExceptionRequestRepository::class.java)
    private val attendance = mock(AttendanceRepository::class.java)
    private val offerings = mock(EducationOfferingRepository::class.java)
    private val audits = mock(AuditLogRepository::class.java)
    private val branches = mock(BranchRepository::class.java)
    private val authorizations = mock(PickupAuthorizationRepository::class.java)
    private val children = mock(ChildRepository::class.java)
    private val service = PickupExceptionService(access, childScopes, requests, attendance, offerings, audits, branches, authorizations, children)
    private val organizationId = UUID.randomUUID()
    private val child = Child(organizationId = organizationId)
    private val jwt = mock(Jwt::class.java)
    private val staff = AccessScope(UserProfile(), Membership(organizationId = organizationId, role = Role.STAFF), emptySet(), emptySet())
    private val admin = AccessScope(UserProfile(), Membership(organizationId = organizationId, role = Role.STAFF_ADMIN), emptySet(), emptySet())
    private val today = LocalDate.now()

    @BeforeEach
    fun setUp() {
        `when`(authorizations.findAllByOrganizationIdAndChildIdOrderByCreatedAtDesc(organizationId, child.id)).thenReturn(emptyList())
        `when`(requests.findAllByOrganizationIdAndChildIdOrderByRequestedAtDesc(organizationId, child.id)).thenReturn(emptyList())
        `when`(childScopes.requireStaffManagedChild(staff, child.id, organizationId)).thenReturn(child)
        `when`(childScopes.requireStaffManagedChild(admin, child.id, organizationId)).thenReturn(child)
        `when`(children.findWithLockById(child.id)).thenReturn(child)
        `when`(offerings.findAllByOrganizationIdAndBranchIdAndStatus(organizationId, child.branchId, EducationOfferingStatus.PUBLISHED)).thenReturn(listOf(daycareOffering()))
    }

    private fun daycareOffering() = EducationOffering(organizationId = organizationId, branchId = child.branchId, capabilities = "DAYCARE_OPERATIONS", status = EducationOfferingStatus.PUBLISHED)

    @Test
    fun `staff can request scoped checkout approval only for a checked in child`() {
        `when`(access.require(jwt, organizationId, setOf(Role.STAFF), allowGraceForRoles = setOf(Role.STAFF))).thenReturn(staff)
        `when`(childScopes.requireStaffManagedChild(staff, child.id, organizationId)).thenReturn(child)
        `when`(attendance.findByChildIdAndOperationalDate(child.id, today)).thenReturn(AttendanceRecord(organizationId = organizationId, branchId = child.branchId, childId = child.id, operationalDate = today, checkedInAt = Instant.now()))
        `when`(branches.findById(child.branchId)).thenReturn(Optional.of(Branch(id = child.branchId, organizationId = organizationId, timezone = "Asia/Jakarta")))
        `when`(offerings.findAllByOrganizationIdAndBranchIdAndStatus(organizationId, child.branchId, EducationOfferingStatus.PUBLISHED)).thenReturn(listOf(daycareOffering()))
        `when`(requests.save(any(PickupExceptionRequest::class.java))).thenAnswer { it.getArgument(0) }

        val result = service.request(jwt, organizationId, child.id, CreatePickupExceptionRequest("  Bibi Ani ", " Bibi ", "Parent menghubungi Staff"))

        assertEquals(PickupExceptionStatus.PENDING, result.status)
        assertEquals("Bibi Ani", result.pickupPersonName)
        assertEquals("Bibi", result.relationship)
        assertTrue(result.requestExpiresAt.isAfter(Instant.now()))
        verify(audits).save(any())
        verify(children).findWithLockById(child.id)
    }

    @Test
    fun `staff in the same child scope can see a pending request raised by a colleague`() {
        val request = pendingRequest().apply { requestedByUserId = UUID.randomUUID() }
        `when`(access.require(jwt, organizationId, setOf(Role.STAFF, Role.STAFF_ADMIN), allowGraceForRoles = setOf(Role.STAFF, Role.STAFF_ADMIN))).thenReturn(staff)
        `when`(requests.findAllByOrganizationIdAndChildIdOrderByRequestedAtDesc(organizationId, child.id)).thenReturn(listOf(request))

        val result = service.forChild(jwt, organizationId, child.id)

        assertEquals(listOf(PickupExceptionStatus.PENDING), result.map { it.status })
        assertEquals(request.id, result.single().id)
    }

    @Test
    fun `staff admin approval is one time and expires shortly`() {
        val request = pendingRequest()
        `when`(access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN), allowGraceForRoles = setOf(Role.STAFF_ADMIN))).thenReturn(admin)
        `when`(childScopes.requireStaffManagedChild(admin, child.id, organizationId)).thenReturn(child)
        `when`(offerings.findAllByOrganizationIdAndBranchIdAndStatus(organizationId, child.branchId, EducationOfferingStatus.PUBLISHED)).thenReturn(listOf(daycareOffering()))
        `when`(requests.findByIdForUpdate(request.id)).thenReturn(Optional.of(request))
        `when`(requests.save(request)).thenReturn(request)

        val result = service.approve(jwt, organizationId, request.id, ApprovePickupExceptionRequest(PickupExceptionVerificationMethod.CALL_REGISTERED_GUARDIAN, "Dikonfirmasi ke nomor wali terdaftar"))

        assertEquals(PickupExceptionStatus.APPROVED, result.status)
        assertEquals(admin.user.id, request.reviewedByUserId)
        assertEquals(PickupExceptionVerificationMethod.CALL_REGISTERED_GUARDIAN, request.verificationMethod)
        assertTrue(request.approvalExpiresAt!!.isAfter(Instant.now()))
        assertTrue(request.approvalExpiresAt!!.isBefore(Instant.now().plusSeconds(6 * 60)))
        verify(audits).save(any())
    }

    @Test
    fun `approving expired request persists expiry instead of leaving it pending`() {
        val request = pendingRequest().apply { requestExpiresAt = Instant.now().minusSeconds(1) }
        `when`(access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN), allowGraceForRoles = setOf(Role.STAFF_ADMIN))).thenReturn(admin)
        `when`(childScopes.requireStaffManagedChild(admin, child.id, organizationId)).thenReturn(child)
        `when`(offerings.findAllByOrganizationIdAndBranchIdAndStatus(organizationId, child.branchId, EducationOfferingStatus.PUBLISHED)).thenReturn(listOf(daycareOffering()))
        `when`(requests.findByIdForUpdate(request.id)).thenReturn(Optional.of(request))
        `when`(requests.save(request)).thenReturn(request)

        val result = service.approve(jwt, organizationId, request.id, ApprovePickupExceptionRequest(PickupExceptionVerificationMethod.CALL_REGISTERED_GUARDIAN, "Dikonfirmasi"))

        assertEquals(PickupExceptionStatus.EXPIRED, result.status)
        assertEquals(PickupExceptionStatus.EXPIRED, request.status)
        verify(requests).save(request)
        verify(audits).save(any())
    }

    @Test
    fun `staff consumes only its child approved grant exactly once`() {
        val request = pendingRequest().apply {
            status = PickupExceptionStatus.APPROVED
            approvalExpiresAt = Instant.now().plusSeconds(120)
        }
        `when`(requests.findByIdForUpdate(request.id)).thenReturn(Optional.of(request))
        `when`(requests.save(request)).thenReturn(request)
        `when`(offerings.findAllByOrganizationIdAndBranchIdAndStatus(organizationId, child.branchId, EducationOfferingStatus.PUBLISHED)).thenReturn(listOf(daycareOffering()))

        val result = service.consumeCheckoutGrant(staff, child, request.id)

        assertEquals(request.id, result.requestId)
        assertEquals("Bibi Ani", result.pickupPersonName)
        assertEquals("Parent menghubungi Staff", result.reason)
        assertEquals(PickupExceptionStatus.CONSUMED, request.status)
        assertTrue(request.consumedAt != null)
        assertThrows(AccessDeniedException::class.java) { service.consumeCheckoutGrant(staff, child, request.id) }
    }

    @Test
    fun `approval rejects a request for another tenant and expires stale approval`() {
        val foreign = pendingRequest().apply { organizationId = UUID.randomUUID() }
        `when`(requests.findByIdForUpdate(foreign.id)).thenReturn(Optional.of(foreign))
        `when`(access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN), allowGraceForRoles = setOf(Role.STAFF_ADMIN))).thenReturn(admin)

        assertThrows(AccessDeniedException::class.java) {
            service.approve(jwt, organizationId, foreign.id, ApprovePickupExceptionRequest(PickupExceptionVerificationMethod.CALL_REGISTERED_GUARDIAN, "verified"))
        }

        val expired = pendingRequest().apply {
            status = PickupExceptionStatus.APPROVED
            approvalExpiresAt = Instant.now().minusSeconds(1)
        }
        `when`(requests.findByIdForUpdate(expired.id)).thenReturn(Optional.of(expired))
        assertThrows(AccessDeniedException::class.java) { service.consumeCheckoutGrant(staff, child, expired.id) }
    }

    @Test
    fun `non admin cannot approve and staff cannot create request for child not checked in`() {
        `when`(access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN), allowGraceForRoles = setOf(Role.STAFF_ADMIN))).thenThrow(AccessDeniedException("Staff Admin required"))
        assertThrows(AccessDeniedException::class.java) {
            service.approve(jwt, organizationId, UUID.randomUUID(), ApprovePickupExceptionRequest(PickupExceptionVerificationMethod.OTHER, "verified"))
        }

        `when`(access.require(jwt, organizationId, setOf(Role.STAFF), allowGraceForRoles = setOf(Role.STAFF))).thenReturn(staff)
        `when`(childScopes.requireStaffManagedChild(staff, child.id, organizationId)).thenReturn(child)
        `when`(attendance.findByChildIdAndOperationalDate(child.id, today)).thenReturn(null)
        `when`(branches.findById(child.branchId)).thenReturn(Optional.of(Branch(id = child.branchId, organizationId = organizationId, timezone = "Asia/Jakarta")))
        `when`(offerings.findAllByOrganizationIdAndBranchIdAndStatus(organizationId, child.branchId, EducationOfferingStatus.PUBLISHED)).thenReturn(listOf(daycareOffering()))
        assertThrows(IllegalArgumentException::class.java) {
            service.request(jwt, organizationId, child.id, CreatePickupExceptionRequest("Bibi Ani", "Bibi", "Parent menghubungi Staff"))
        }
    }

    private fun pendingRequest() = PickupExceptionRequest(
        organizationId = organizationId,
        branchId = child.branchId,
        childId = child.id,
        requestedByUserId = staff.user.id,
        pickupPersonName = "Bibi Ani",
        relationship = "Bibi",
        reason = "Parent menghubungi Staff",
        requestedAt = Instant.now(),
        requestExpiresAt = Instant.now().plusSeconds(600),
    )
}
