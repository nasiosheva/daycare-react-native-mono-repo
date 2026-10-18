// Mories Deo Hutapea,S.E.,S.Kom
package com.daycare.api.service

import com.daycare.api.domain.Role
import com.daycare.api.domain.TenantPaymentStatus
import com.daycare.api.persistence.MembershipRepository
import com.daycare.api.persistence.Membership
import com.daycare.api.persistence.Organization
import com.daycare.api.persistence.OrganizationRepository
import com.daycare.api.persistence.TenantPayment
import com.daycare.api.persistence.TenantPaymentAdjustment
import com.daycare.api.persistence.TenantPaymentAdjustmentRepository
import com.daycare.api.persistence.TenantPaymentCorrectionRequest
import com.daycare.api.persistence.TenantPaymentCorrectionRequestRepository
import com.daycare.api.persistence.TenantPaymentRepository
import com.daycare.api.persistence.TenantSubscription
import com.daycare.api.persistence.TenantSubscriptionAuditEventRepository
import com.daycare.api.persistence.TenantSubscriptionRepository
import com.daycare.api.persistence.UserProfile
import com.daycare.api.persistence.UserProfileRepository
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Test
import org.mockito.ArgumentMatchers.any
import org.mockito.Mockito.mock
import org.mockito.Mockito.never
import org.mockito.Mockito.verify
import org.mockito.Mockito.`when`
import org.springframework.data.domain.PageImpl
import org.springframework.data.domain.PageRequest
import org.springframework.security.oauth2.jwt.Jwt
import java.math.BigDecimal
import java.util.Optional
import java.util.UUID

class TenantSubscriptionCorrectionServiceTest {
    private val access = mock(AccessService::class.java)
    private val platformAccess = mock(PlatformAccessService::class.java)
    private val organizations = mock(OrganizationRepository::class.java)
    private val payments = mock(TenantPaymentRepository::class.java)
    private val corrections = mock(TenantPaymentCorrectionRequestRepository::class.java)
    private val adjustments = mock(TenantPaymentAdjustmentRepository::class.java)
    private val subscriptions = mock(TenantSubscriptionRepository::class.java)
    private val audits = mock(TenantSubscriptionAuditEventRepository::class.java)
    private val memberships = mock(MembershipRepository::class.java)
    private val notifications = mock(NotificationService::class.java)
    private val users = mock(UserProfileRepository::class.java)
    private val jwt = mock(Jwt::class.java)
    private val organizationId = UUID.randomUUID()
    private val paymentId = UUID.randomUUID()
    private val staffUserId = UUID.randomUUID()
    private val payment = TenantPayment(id = paymentId, organizationId = organizationId, status = TenantPaymentStatus.PENDING, amount = BigDecimal("500000"), invoiceNumber = "UE-SUB-202610-000001")
    private val subscription = TenantSubscription(organizationId = organizationId)

    private fun service(enabled: Boolean = true, maxAmount: String = "10000000") = TenantSubscriptionCorrectionService(
        access, platformAccess, organizations, payments, corrections, adjustments, subscriptions, audits, memberships, notifications,
        TenantSubscriptionBillingPolicy(maxAmount), enabled, users,
    )

    private fun allowStaffAdmin() {
        val user = UserProfile(id = staffUserId)
        `when`(access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN), null, false, setOf(Role.STAFF_ADMIN), emptySet(), emptySet()))
            .thenReturn(AccessScope(user, Membership(userId = staffUserId, organizationId = organizationId, active = true), emptySet(), emptySet()))
        `when`(users.findWithLockById(staffUserId)).thenReturn(user)
    }

    private fun allowPaymentAndOrganization() {
        `when`(payments.findWithLockById(paymentId)).thenReturn(payment)
        `when`(payments.findById(paymentId)).thenReturn(Optional.of(payment))
        `when`(organizations.findById(organizationId)).thenReturn(Optional.of(Organization(id = organizationId, name = "Tenant")))
        `when`(subscriptions.findByOrganizationId(organizationId)).thenReturn(subscription)
    }

    @Test
    fun `create is fail closed when feature flag is disabled`() {
        allowStaffAdmin()
        val request = CreateTenantPaymentCorrectionRequest(TenantPaymentCorrectionCategory.WRONG_REFERENCE, "Reference typo", proposedReference = "REF-2")

        assertThrows(IllegalStateException::class.java) {
            service(enabled = false).create(jwt, organizationId, paymentId, UUID.randomUUID(), request)
        }
    }

    @Test
    fun `create fails closed when the authenticated actor row cannot be locked`() {
        val user = UserProfile(id = staffUserId)
        `when`(access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN), null, false, setOf(Role.STAFF_ADMIN), emptySet(), emptySet()))
            .thenReturn(AccessScope(user, Membership(userId = staffUserId, organizationId = organizationId, active = true), emptySet(), emptySet()))

        assertThrows(IllegalArgumentException::class.java) {
            service().create(jwt, organizationId, paymentId, UUID.randomUUID(), CreateTenantPaymentCorrectionRequest(TenantPaymentCorrectionCategory.WRONG_REFERENCE, "Reference typo", proposedReference = "REF-2"))
        }
        verify(payments, never()).findWithLockById(paymentId)
    }

    @Test
    fun `create persists a correction request and an audit event for a valid amount mismatch`() {
        allowStaffAdmin()
        allowPaymentAndOrganization()
        `when`(corrections.findFirstByOrganizationIdAndPaymentIdAndStatus(organizationId, paymentId, "PENDING")).thenReturn(null)
        `when`(corrections.save(any(TenantPaymentCorrectionRequest::class.java))).thenAnswer { it.arguments[0] }

        val response = service().create(jwt, organizationId, paymentId, UUID.randomUUID(), CreateTenantPaymentCorrectionRequest(TenantPaymentCorrectionCategory.AMOUNT_MISMATCH, "Amount looks wrong", proposedAmount = BigDecimal("450000")))

        assertEquals(TenantPaymentCorrectionCategory.AMOUNT_MISMATCH, response.category)
        assertEquals(BigDecimal("450000"), response.proposedAmount)
        assertEquals("PENDING", response.status)
        verify(audits).save(any(com.daycare.api.persistence.TenantSubscriptionAuditEvent::class.java))
        verify(users).findWithLockById(staffUserId)
    }

    @Test
    fun `create rejects a description outside the allowed length`() {
        allowStaffAdmin()

        assertThrows(IllegalArgumentException::class.java) {
            service().create(jwt, organizationId, paymentId, UUID.randomUUID(), CreateTenantPaymentCorrectionRequest(TenantPaymentCorrectionCategory.WRONG_REFERENCE, "ab", proposedReference = "REF-2"))
        }
    }

    @Test
    fun `create requires a proposed amount for amount mismatch and duplicate categories but rejects it for others`() {
        allowStaffAdmin()

        assertThrows(IllegalArgumentException::class.java) {
            service().create(jwt, organizationId, paymentId, UUID.randomUUID(), CreateTenantPaymentCorrectionRequest(TenantPaymentCorrectionCategory.AMOUNT_MISMATCH, "Amount looks wrong"))
        }
        assertThrows(IllegalArgumentException::class.java) {
            service().create(jwt, organizationId, paymentId, UUID.randomUUID(), CreateTenantPaymentCorrectionRequest(TenantPaymentCorrectionCategory.DUPLICATE_OR_OVERPAYMENT, "Paid twice"))
        }
        assertThrows(IllegalArgumentException::class.java) {
            service().create(jwt, organizationId, paymentId, UUID.randomUUID(), CreateTenantPaymentCorrectionRequest(TenantPaymentCorrectionCategory.WRONG_PROOF_OR_INVOICE, "Wrong file", proposedAmount = BigDecimal("100000")))
        }
    }

    @Test
    fun `duplicate or overpayment correction requires total paid to exceed the invoice amount`() {
        allowStaffAdmin()
        allowPaymentAndOrganization()

        assertThrows(IllegalArgumentException::class.java) {
            service().create(
                jwt,
                organizationId,
                paymentId,
                UUID.randomUUID(),
                CreateTenantPaymentCorrectionRequest(
                    TenantPaymentCorrectionCategory.DUPLICATE_OR_OVERPAYMENT,
                    "Duplicate transfer",
                    proposedAmount = payment.amount,
                ),
            )
        }
    }

    @Test
    fun `create requires a proposed reference only for wrong reference corrections`() {
        allowStaffAdmin()

        assertThrows(IllegalArgumentException::class.java) {
            service().create(jwt, organizationId, paymentId, UUID.randomUUID(), CreateTenantPaymentCorrectionRequest(TenantPaymentCorrectionCategory.WRONG_REFERENCE, "Reference typo"))
        }
    }

    @Test
    fun `create rejects a payment that does not belong to the requesting organization`() {
        allowStaffAdmin()
        `when`(payments.findWithLockById(paymentId)).thenReturn(payment.apply { organizationId = UUID.randomUUID() })

        assertThrows(IllegalArgumentException::class.java) {
            service().create(jwt, organizationId, paymentId, UUID.randomUUID(), CreateTenantPaymentCorrectionRequest(TenantPaymentCorrectionCategory.WRONG_REFERENCE, "Reference typo", proposedReference = "REF-2"))
        }
    }

    @Test
    fun `create rejects a second correction while one is already pending for the same payment`() {
        allowStaffAdmin()
        allowPaymentAndOrganization()
        `when`(corrections.findFirstByOrganizationIdAndPaymentIdAndStatus(organizationId, paymentId, "PENDING")).thenReturn(TenantPaymentCorrectionRequest(organizationId = organizationId, paymentId = paymentId))

        assertThrows(IllegalArgumentException::class.java) {
            service().create(jwt, organizationId, paymentId, UUID.randomUUID(), CreateTenantPaymentCorrectionRequest(TenantPaymentCorrectionCategory.WRONG_REFERENCE, "Reference typo", proposedReference = "REF-2"))
        }
    }

    @Test
    fun `ownRequests only returns correction requests submitted by the current staff admin`() {
        allowStaffAdmin()
        allowPaymentAndOrganization()
        val ownRequest = TenantPaymentCorrectionRequest(
            organizationId = organizationId,
            paymentId = paymentId,
            requestedByUserId = staffUserId,
            category = TenantPaymentCorrectionCategory.WRONG_REFERENCE.name,
            description = "My correction",
        )
        `when`(corrections.findAllByOrganizationIdAndPaymentIdAndRequestedByUserIdOrderByCreatedAtDesc(organizationId, paymentId, staffUserId))
            .thenReturn(listOf(ownRequest))

        val response = service().ownRequests(jwt, organizationId, paymentId)

        assertEquals(listOf(ownRequest.id), response.map { it.id })
        verify(corrections).findAllByOrganizationIdAndPaymentIdAndRequestedByUserIdOrderByCreatedAtDesc(organizationId, paymentId, staffUserId)
    }

    @Test
    fun `create replays the same response for a retried idempotency key with an identical payload`() {
        allowStaffAdmin()
        allowPaymentAndOrganization()
        val key = UUID.randomUUID()
        val request = CreateTenantPaymentCorrectionRequest(TenantPaymentCorrectionCategory.WRONG_REFERENCE, "Reference typo", proposedReference = "REF-2")
        val payloadHash = invokePrivate(service(), "sha256", "$paymentId|${request.category}|${request.description}|null|${request.proposedReference}") as String
        val existing = TenantPaymentCorrectionRequest(organizationId = organizationId, paymentId = paymentId, category = request.category.name, description = request.description, proposedReference = request.proposedReference, requestIdempotencyKey = key, requestPayloadHash = payloadHash)
        `when`(corrections.findByOrganizationIdAndRequestedByUserIdAndRequestIdempotencyKey(organizationId, staffUserId, key)).thenReturn(existing)

        val response = service().create(jwt, organizationId, paymentId, key, request)

        assertEquals(existing.id, response.id)
        verify(corrections, never()).save(any(TenantPaymentCorrectionRequest::class.java))
    }

    @Test
    fun `create rejects a retried idempotency key whose payload has changed`() {
        allowStaffAdmin()
        allowPaymentAndOrganization()
        val key = UUID.randomUUID()
        val existing = TenantPaymentCorrectionRequest(organizationId = organizationId, paymentId = paymentId, requestIdempotencyKey = key, requestPayloadHash = "different-hash")
        `when`(corrections.findByOrganizationIdAndRequestedByUserIdAndRequestIdempotencyKey(organizationId, staffUserId, key)).thenReturn(existing)

        assertThrows(TenantSubscriptionIdempotencyConflict::class.java) {
            service().create(jwt, organizationId, paymentId, key, CreateTenantPaymentCorrectionRequest(TenantPaymentCorrectionCategory.WRONG_REFERENCE, "Reference typo", proposedReference = "REF-2"))
        }
    }

    @Test
    fun `reviewQueue is fail closed and returns an empty page when the feature flag is disabled`() {
        `when`(platformAccess.requirePlatformAdmin(jwt)).thenReturn(UserProfile())

        val page = service(enabled = false).reviewQueue(jwt, 0, 10)

        assertEquals(emptyList<TenantPaymentCorrectionResponse>(), page.items)
        assertEquals(false, page.hasNext)
    }

    @Test
    fun `reviewQueue returns the pending page mapped to responses`() {
        `when`(platformAccess.requirePlatformAdmin(jwt)).thenReturn(UserProfile())
        val pending = TenantPaymentCorrectionRequest(organizationId = organizationId, paymentId = paymentId, category = TenantPaymentCorrectionCategory.WRONG_REFERENCE.name, proposedReference = "REF-2")
        `when`(corrections.findAllByStatusOrderByCreatedAtAsc("PENDING", PageRequest.of(0, 10))).thenReturn(PageImpl(listOf(pending)))
        `when`(payments.findById(paymentId)).thenReturn(Optional.of(payment))
        `when`(organizations.findById(organizationId)).thenReturn(Optional.of(Organization(id = organizationId, name = "Tenant")))
        `when`(adjustments.findByCorrectionRequestId(pending.id)).thenReturn(null)

        val page = service().reviewQueue(jwt, 0, 10)

        assertEquals(1, page.items.size)
        assertEquals(pending.id, page.items.single().id)
    }

    @Test
    fun `pending review count is platform admin only and respects the feature flag`() {
        `when`(platformAccess.requirePlatformAdmin(jwt)).thenReturn(UserProfile())
        `when`(corrections.countByStatus("PENDING")).thenReturn(2L)

        assertEquals(2L, service().pendingReviewCount(jwt))
        assertEquals(0L, service(enabled = false).pendingReviewCount(jwt))
        verify(corrections).countByStatus("PENDING")
    }

    @Test
    fun `approving an underpaid correction records an UNDERPAYMENT adjustment and notifies the requester`() {
        val actorId = UUID.randomUUID()
        `when`(platformAccess.requirePlatformAdmin(jwt)).thenReturn(UserProfile(id = actorId))
        `when`(users.findWithLockById(actorId)).thenReturn(UserProfile(id = actorId))
        val correction = TenantPaymentCorrectionRequest(organizationId = organizationId, paymentId = paymentId, requestedByUserId = staffUserId, category = TenantPaymentCorrectionCategory.AMOUNT_MISMATCH.name, proposedAmount = BigDecimal("700000"))
        `when`(corrections.findById(correction.id)).thenReturn(Optional.of(correction))
        `when`(corrections.findWithLockById(correction.id)).thenReturn(correction)
        `when`(payments.findWithLockById(paymentId)).thenReturn(payment)
        `when`(payments.findById(paymentId)).thenReturn(Optional.of(payment))
        `when`(subscriptions.findByOrganizationId(organizationId)).thenReturn(subscription)
        `when`(organizations.findById(organizationId)).thenReturn(Optional.of(Organization(id = organizationId, name = "Tenant")))
        `when`(adjustments.findByCorrectionRequestId(correction.id)).thenReturn(null)
        `when`(memberships.findAllByOrganizationId(organizationId)).thenReturn(listOf(Membership(userId = staffUserId, organizationId = organizationId, role = Role.STAFF_ADMIN, active = true)))

        val response = service().review(jwt, correction.id, UUID.randomUUID(), ReviewTenantPaymentCorrectionRequest(approved = true, reason = "Verified against bank statement"))

        assertEquals("APPROVED", response.status)
        verify(users).findWithLockById(actorId)
        val adjustmentCaptor = org.mockito.ArgumentCaptor.forClass(TenantPaymentAdjustment::class.java)
        verify(adjustments).save(adjustmentCaptor.capture())
        assertEquals("UNDERPAYMENT", adjustmentCaptor.value.kind)
        assertEquals(BigDecimal("200000"), adjustmentCaptor.value.amount)
        verify(notifications).notify(organizationId, staffUserId, "Koreksi pembayaran disetujui", "Pengajuan koreksi ${payment.invoiceNumber}: Verified against bank statement", "/tenant-subscription")
    }

    @Test
    fun `approving an overpayment records an excess credit rather than underpayment`() {
        val actorId = UUID.randomUUID()
        `when`(platformAccess.requirePlatformAdmin(jwt)).thenReturn(UserProfile(id = actorId))
        `when`(users.findWithLockById(actorId)).thenReturn(UserProfile(id = actorId))
        val correction = TenantPaymentCorrectionRequest(
            organizationId = organizationId,
            paymentId = paymentId,
            requestedByUserId = staffUserId,
            category = TenantPaymentCorrectionCategory.DUPLICATE_OR_OVERPAYMENT.name,
            proposedAmount = BigDecimal("700000"),
        )
        `when`(corrections.findById(correction.id)).thenReturn(Optional.of(correction))
        `when`(corrections.findWithLockById(correction.id)).thenReturn(correction)
        `when`(payments.findWithLockById(paymentId)).thenReturn(payment)
        `when`(payments.findById(paymentId)).thenReturn(Optional.of(payment))
        `when`(subscriptions.findByOrganizationId(organizationId)).thenReturn(subscription)
        `when`(organizations.findById(organizationId)).thenReturn(Optional.of(Organization(id = organizationId, name = "Tenant")))
        `when`(adjustments.findByCorrectionRequestId(correction.id)).thenReturn(null)
        `when`(memberships.findAllByOrganizationId(organizationId)).thenReturn(emptyList())

        service().review(jwt, correction.id, UUID.randomUUID(), ReviewTenantPaymentCorrectionRequest(approved = true, reason = "Verified two transfers"))

        val adjustmentCaptor = org.mockito.ArgumentCaptor.forClass(TenantPaymentAdjustment::class.java)
        verify(adjustments).save(adjustmentCaptor.capture())
        assertEquals("EXCESS_CREDIT", adjustmentCaptor.value.kind)
        assertEquals(BigDecimal("200000"), adjustmentCaptor.value.amount)
    }

    @Test
    fun `rejecting a correction leaves the payment untouched and records no adjustment`() {
        val actorId = UUID.randomUUID()
        `when`(platformAccess.requirePlatformAdmin(jwt)).thenReturn(UserProfile(id = actorId))
        `when`(users.findWithLockById(actorId)).thenReturn(UserProfile(id = actorId))
        val correction = TenantPaymentCorrectionRequest(organizationId = organizationId, paymentId = paymentId, requestedByUserId = staffUserId, category = TenantPaymentCorrectionCategory.WRONG_REFERENCE.name, proposedReference = "REF-2")
        `when`(corrections.findById(correction.id)).thenReturn(Optional.of(correction))
        `when`(corrections.findWithLockById(correction.id)).thenReturn(correction)
        `when`(payments.findWithLockById(paymentId)).thenReturn(payment)
        `when`(payments.findById(paymentId)).thenReturn(Optional.of(payment))
        `when`(subscriptions.findByOrganizationId(organizationId)).thenReturn(subscription)
        `when`(organizations.findById(organizationId)).thenReturn(Optional.of(Organization(id = organizationId, name = "Tenant")))
        `when`(adjustments.findByCorrectionRequestId(correction.id)).thenReturn(null)
        `when`(memberships.findAllByOrganizationId(organizationId)).thenReturn(emptyList())

        val response = service().review(jwt, correction.id, UUID.randomUUID(), ReviewTenantPaymentCorrectionRequest(approved = false, reason = "Reference matches the original"))

        assertEquals("REJECTED", response.status)
        assertNull(response.adjustmentKind)
        verify(adjustments, never()).save(any(TenantPaymentAdjustment::class.java))
    }

    @Test
    fun `review rejects a correction that is no longer pending`() {
        `when`(platformAccess.requirePlatformAdmin(jwt)).thenReturn(UserProfile(id = UUID.randomUUID()))
        val decided = TenantPaymentCorrectionRequest(organizationId = organizationId, paymentId = paymentId, status = "APPROVED")
        `when`(corrections.findById(decided.id)).thenReturn(Optional.of(decided))
        `when`(corrections.findWithLockById(decided.id)).thenReturn(decided)
        `when`(payments.findWithLockById(paymentId)).thenReturn(payment)

        assertThrows(IllegalArgumentException::class.java) {
            service().review(jwt, decided.id, UUID.randomUUID(), ReviewTenantPaymentCorrectionRequest(approved = true, reason = "Already decided"))
        }
    }

    @Test
    fun `review replays the same decision for a retried idempotency key and rejects a changed payload`() {
        val actorId = UUID.randomUUID()
        `when`(platformAccess.requirePlatformAdmin(jwt)).thenReturn(UserProfile(id = actorId))
        `when`(users.findWithLockById(actorId)).thenReturn(UserProfile(id = actorId))
        val key = UUID.randomUUID()
        val reviewed = TenantPaymentCorrectionRequest(organizationId = organizationId, paymentId = paymentId, status = "APPROVED", reviewIdempotencyKey = key, reviewPayloadHash = "stored-hash")
        `when`(corrections.findByReviewedByUserIdAndReviewIdempotencyKey(actorId, key)).thenReturn(reviewed)
        `when`(payments.findById(paymentId)).thenReturn(Optional.of(payment))
        `when`(organizations.findById(organizationId)).thenReturn(Optional.of(Organization(id = organizationId, name = "Tenant")))
        `when`(adjustments.findByCorrectionRequestId(reviewed.id)).thenReturn(null)

        assertThrows(TenantSubscriptionIdempotencyConflict::class.java) {
            service().review(jwt, reviewed.id, key, ReviewTenantPaymentCorrectionRequest(approved = true, reason = "Different reason this time"))
        }
        verify(corrections, never()).findWithLockById(reviewed.id)
        verify(users).findWithLockById(actorId)
    }
}
