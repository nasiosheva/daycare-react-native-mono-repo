// Mories Deo Hutapea,S.E.,S.Kom
package com.daycare.api.service

import com.daycare.api.domain.TenantPaymentStatus
import com.daycare.api.domain.Role
import com.daycare.api.persistence.MembershipRepository
import com.daycare.api.persistence.OrganizationRepository
import com.daycare.api.persistence.TenantPaymentProofRepository
import com.daycare.api.persistence.TenantPaymentRepository
import com.daycare.api.persistence.TenantSubscriptionAuditEvent
import com.daycare.api.persistence.TenantSubscriptionAuditEventRepository
import com.daycare.api.persistence.TenantSubscriptionRepository
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Test
import org.mockito.Mockito.mock
import org.mockito.Mockito.never
import org.mockito.Mockito.verify
import org.mockito.Mockito.verifyNoInteractions
import org.mockito.Mockito.`when`
import org.springframework.data.domain.PageImpl
import org.springframework.data.domain.PageRequest
import org.springframework.security.access.AccessDeniedException
import org.springframework.security.oauth2.jwt.Jwt
import java.util.Base64
import java.util.Optional
import java.util.UUID

class TenantSubscriptionPaymentProofServiceTest {
    private val access = mock(AccessService::class.java)
    private val platformAccess = mock(PlatformAccessService::class.java)
    private val memberships = mock(MembershipRepository::class.java)
    private val organizations = mock(OrganizationRepository::class.java)
    private val subscriptions = mock(TenantSubscriptionRepository::class.java)
    private val payments = mock(TenantPaymentRepository::class.java)
    private val proofs = mock(TenantPaymentProofRepository::class.java)
    private val audits = mock(TenantSubscriptionAuditEventRepository::class.java)
    private val platformAdministration = mock(PlatformAdministrationService::class.java)
    private val notifications = mock(NotificationService::class.java)
    private val jwt = mock(Jwt::class.java)
    private val organizationId = UUID.randomUUID()
    private val paymentId = UUID.randomUUID()

    @Test
    fun `payment proof is fail closed when feature flag is disabled`() {
        val service = createService(enabled = false)

        assertThrows(IllegalStateException::class.java) {
            service.submit(jwt, organizationId, paymentId, UUID.randomUUID(), pdfRequest())
        }
    }

    @Test
    fun `rejects unsupported proof type before persistence`() {
        allowPendingPayment()
        val service = createService(enabled = true)

        assertThrows(IllegalArgumentException::class.java) {
            service.submit(jwt, organizationId, paymentId, UUID.randomUUID(), SubmitTenantPaymentProofRequest("proof.txt", "text/plain", "dGVzdA=="))
        }
    }

    @Test
    fun `rejects proof above two megabytes before decoding`() {
        allowPendingPayment()
        val service = createService(enabled = true)

        assertThrows(IllegalArgumentException::class.java) {
            service.submit(jwt, organizationId, paymentId, UUID.randomUUID(), SubmitTenantPaymentProofRequest("proof.pdf", "application/pdf", "A".repeat(2_800_001)))
        }
    }

    @Test
    fun `rejects content whose bytes do not match declared pdf type`() {
        allowPendingPayment()
        val service = createService(enabled = true)

        assertThrows(IllegalArgumentException::class.java) {
            service.submit(jwt, organizationId, paymentId, UUID.randomUUID(), SubmitTenantPaymentProofRequest("proof.pdf", "application/pdf", Base64.getEncoder().encodeToString("not pdf".toByteArray())))
        }
    }

    @Test
    fun `submit persists a payment proof and an audit event for a valid pdf`() {
        allowPendingPayment()
        `when`(organizations.findById(organizationId)).thenReturn(Optional.of(com.daycare.api.persistence.Organization(id = organizationId, name = "Tenant")))
        `when`(subscriptions.findByOrganizationId(organizationId)).thenReturn(com.daycare.api.persistence.TenantSubscription(organizationId = organizationId))
        `when`(proofs.findFirstByPaymentIdOrderByVersionNumberDesc(paymentId)).thenReturn(null)
        `when`(proofs.save(org.mockito.ArgumentMatchers.any(com.daycare.api.persistence.TenantPaymentProof::class.java))).thenAnswer { it.arguments[0] }
        val service = createService(enabled = true)

        val response = service.submit(jwt, organizationId, paymentId, UUID.randomUUID(), pdfRequest())

        assertEquals("receipt.pdf", response.fileName)
        assertEquals(1, response.version)
        assertEquals("SUBMITTED", response.status)
        verify(audits).save(org.mockito.ArgumentMatchers.any(TenantSubscriptionAuditEvent::class.java))
    }

    @Test
    fun `submit rejects a new proof while the current one is still awaiting review or already verified`() {
        allowPendingPayment()
        `when`(proofs.findFirstByPaymentIdOrderByVersionNumberDesc(paymentId)).thenReturn(com.daycare.api.persistence.TenantPaymentProof(paymentId = paymentId, organizationId = organizationId, status = "SUBMITTED"))
        val service = createService(enabled = true)

        assertThrows(IllegalArgumentException::class.java) {
            service.submit(jwt, organizationId, paymentId, UUID.randomUUID(), pdfRequest())
        }
    }

    @Test
    fun `submit accepts a replacement proof after the previous one was rejected`() {
        allowPendingPayment()
        `when`(organizations.findById(organizationId)).thenReturn(Optional.of(com.daycare.api.persistence.Organization(id = organizationId, name = "Tenant")))
        `when`(subscriptions.findByOrganizationId(organizationId)).thenReturn(com.daycare.api.persistence.TenantSubscription(organizationId = organizationId))
        `when`(proofs.findFirstByPaymentIdOrderByVersionNumberDesc(paymentId)).thenReturn(com.daycare.api.persistence.TenantPaymentProof(paymentId = paymentId, organizationId = organizationId, versionNumber = 1, status = "REJECTED"))
        `when`(proofs.save(org.mockito.ArgumentMatchers.any(com.daycare.api.persistence.TenantPaymentProof::class.java))).thenAnswer { it.arguments[0] }
        val service = createService(enabled = true)

        val response = service.submit(jwt, organizationId, paymentId, UUID.randomUUID(), pdfRequest())

        assertEquals(2, response.version)
    }

    @Test
    fun `submit replays the same response for a retried idempotency key with an identical payload`() {
        val user = allowPendingPayment()
        `when`(organizations.findById(organizationId)).thenReturn(Optional.of(com.daycare.api.persistence.Organization(id = organizationId, name = "Tenant")))
        val service = createService(enabled = true)
        val key = UUID.randomUUID()
        val request = pdfRequest()
        val bytes = Base64.getDecoder().decode(request.fileBase64)
        val fileHash = invokePrivate(service, "sha256", bytes) as String
        val payloadHash = invokePrivate(service, "sha256", "$paymentId|${request.fileName.trim()}|${request.contentType}|$fileHash") as String
        val existing = com.daycare.api.persistence.TenantPaymentProof(paymentId = paymentId, organizationId = organizationId, uploadIdempotencyKey = key, uploadPayloadHash = payloadHash)
        `when`(proofs.findByOrganizationIdAndUploadedByUserIdAndUploadIdempotencyKey(organizationId, user.id, key)).thenReturn(existing)

        val response = service.submit(jwt, organizationId, paymentId, key, request)

        assertEquals(existing.id, response.id)
        verify(proofs, never()).save(org.mockito.ArgumentMatchers.any(com.daycare.api.persistence.TenantPaymentProof::class.java))
    }

    @Test
    fun `submit rejects a retried idempotency key whose payload has changed`() {
        val user = allowPendingPayment()
        val service = createService(enabled = true)
        val key = UUID.randomUUID()
        val existing = com.daycare.api.persistence.TenantPaymentProof(paymentId = paymentId, organizationId = organizationId, uploadIdempotencyKey = key, uploadPayloadHash = "different-hash")
        `when`(proofs.findByOrganizationIdAndUploadedByUserIdAndUploadIdempotencyKey(organizationId, user.id, key)).thenReturn(existing)

        assertThrows(TenantSubscriptionIdempotencyConflict::class.java) {
            service.submit(jwt, organizationId, paymentId, key, pdfRequest())
        }
    }

    @Test
    fun `ownProofs returns every proof version for the payment newest first`() {
        allowPendingPayment()
        `when`(organizations.findById(organizationId)).thenReturn(Optional.of(com.daycare.api.persistence.Organization(id = organizationId, name = "Tenant")))
        val newest = com.daycare.api.persistence.TenantPaymentProof(id = UUID.randomUUID(), paymentId = paymentId, organizationId = organizationId, versionNumber = 2)
        val older = com.daycare.api.persistence.TenantPaymentProof(id = UUID.randomUUID(), paymentId = paymentId, organizationId = organizationId, versionNumber = 1)
        `when`(proofs.findAllByPaymentIdOrderByVersionNumberDesc(paymentId)).thenReturn(listOf(newest, older))
        val service = createService(enabled = true)

        val result = service.ownProofs(jwt, organizationId, paymentId)

        assertEquals(listOf(newest.id, older.id), result.map { it.id })
    }

    @Test
    fun `reviewQueue is fail closed and returns an empty page when the feature flag is disabled`() {
        val service = createService(enabled = false)
        `when`(platformAccess.requirePlatformAdmin(jwt)).thenReturn(com.daycare.api.persistence.UserProfile())

        val page = service.reviewQueue(jwt, 0, 10)

        assertEquals(emptyList<TenantPaymentProofResponse>(), page.items)
        assertEquals(false, page.hasNext)
    }

    @Test
    fun `reviewQueue returns the pending page mapped to responses`() {
        val service = createService(enabled = true)
        `when`(platformAccess.requirePlatformAdmin(jwt)).thenReturn(com.daycare.api.persistence.UserProfile())
        val proof = com.daycare.api.persistence.TenantPaymentProof(id = UUID.randomUUID(), paymentId = paymentId, organizationId = organizationId, status = "SUBMITTED")
        `when`(proofs.findAllByStatusOrderBySubmittedAtAsc("SUBMITTED", PageRequest.of(0, 10))).thenReturn(PageImpl(listOf(proof)))
        `when`(payments.findById(paymentId)).thenReturn(Optional.of(com.daycare.api.persistence.TenantPayment(id = paymentId, organizationId = organizationId, status = TenantPaymentStatus.PENDING)))
        `when`(organizations.findById(organizationId)).thenReturn(Optional.of(com.daycare.api.persistence.Organization(id = organizationId, name = "Tenant")))

        val page = service.reviewQueue(jwt, 0, 10)

        assertEquals(1, page.items.size)
        assertEquals(proof.id, page.items.single().id)
    }

    @Test
    fun `reviewQueue rejects an invalid page or size`() {
        val service = createService(enabled = true)
        `when`(platformAccess.requirePlatformAdmin(jwt)).thenReturn(com.daycare.api.persistence.UserProfile())

        assertThrows(IllegalArgumentException::class.java) { service.reviewQueue(jwt, -1, 10) }
        assertThrows(IllegalArgumentException::class.java) { service.reviewQueue(jwt, 0, 0) }
        assertThrows(IllegalArgumentException::class.java) { service.reviewQueue(jwt, 0, 51) }
    }

    @Test
    fun `featureStatus reports both feature flags for a platform admin`() {
        val service = createService(enabled = true)
        `when`(platformAccess.requirePlatformAdmin(jwt)).thenReturn(com.daycare.api.persistence.UserProfile())

        val status = service.featureStatus(jwt)

        assertEquals(true, status.paymentProofEnabled)
        assertEquals(false, status.correctionEnabled)
    }

    @Test
    fun `content is accessible to a platform admin regardless of tenant`() {
        val service = createService(enabled = true)
        val proof = com.daycare.api.persistence.TenantPaymentProof(id = UUID.randomUUID(), paymentId = paymentId, organizationId = organizationId, fileName = "proof.pdf", contentType = "application/pdf", fileData = "data".toByteArray())
        `when`(proofs.findById(proof.id)).thenReturn(Optional.of(proof))
        `when`(platformAccess.requirePlatformAdmin(jwt)).thenReturn(com.daycare.api.persistence.UserProfile(id = UUID.randomUUID()))
        `when`(payments.findById(paymentId)).thenReturn(Optional.of(com.daycare.api.persistence.TenantPayment(id = paymentId, organizationId = organizationId, status = TenantPaymentStatus.PENDING)))
        `when`(subscriptions.findByOrganizationId(organizationId)).thenReturn(com.daycare.api.persistence.TenantSubscription(organizationId = organizationId))

        val response = service.content(jwt, proof.id)

        assertEquals("proof.pdf", response.fileName)
        verify(audits).save(org.mockito.ArgumentMatchers.any(TenantSubscriptionAuditEvent::class.java))
    }

    @Test
    fun `content is accessible to the staff admin of the same tenant`() {
        val service = createService(enabled = true)
        val proof = com.daycare.api.persistence.TenantPaymentProof(id = UUID.randomUUID(), paymentId = paymentId, organizationId = organizationId, fileName = "proof.pdf", contentType = "application/pdf", fileData = "data".toByteArray())
        `when`(proofs.findById(proof.id)).thenReturn(Optional.of(proof))
        `when`(platformAccess.requirePlatformAdmin(jwt)).thenThrow(AccessDeniedException("You do not have platform administrator access"))
        val user = com.daycare.api.persistence.UserProfile(id = UUID.randomUUID())
        `when`(access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN), null, false, setOf(Role.STAFF_ADMIN), emptySet(), emptySet()))
            .thenReturn(AccessScope(user, com.daycare.api.persistence.Membership(userId = user.id, organizationId = organizationId, active = true), emptySet(), emptySet()))
        `when`(payments.findById(paymentId)).thenReturn(Optional.of(com.daycare.api.persistence.TenantPayment(id = paymentId, organizationId = organizationId, status = TenantPaymentStatus.PENDING)))
        `when`(subscriptions.findByOrganizationId(organizationId)).thenReturn(com.daycare.api.persistence.TenantSubscription(organizationId = organizationId))

        val response = service.content(jwt, proof.id)

        assertEquals(proof.id, response.id)
    }

    @Test
    fun `content rejects a staff admin whose active membership belongs to a different tenant`() {
        val service = createService(enabled = true)
        val proof = com.daycare.api.persistence.TenantPaymentProof(id = UUID.randomUUID(), paymentId = paymentId, organizationId = organizationId, fileName = "proof.pdf", contentType = "application/pdf", fileData = "data".toByteArray())
        `when`(proofs.findById(proof.id)).thenReturn(Optional.of(proof))
        `when`(platformAccess.requirePlatformAdmin(jwt)).thenThrow(AccessDeniedException("You do not have platform administrator access"))
        val user = com.daycare.api.persistence.UserProfile(id = UUID.randomUUID())
        `when`(access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN), null, false, setOf(Role.STAFF_ADMIN), emptySet(), emptySet()))
            .thenReturn(AccessScope(user, com.daycare.api.persistence.Membership(userId = user.id, organizationId = UUID.randomUUID(), active = true), emptySet(), emptySet()))

        assertThrows(IllegalArgumentException::class.java) { service.content(jwt, proof.id) }
    }

    @Test
    fun `content rejects an inactive staff admin membership`() {
        val service = createService(enabled = true)
        val proof = com.daycare.api.persistence.TenantPaymentProof(id = UUID.randomUUID(), paymentId = paymentId, organizationId = organizationId, fileName = "proof.pdf", contentType = "application/pdf", fileData = "data".toByteArray())
        `when`(proofs.findById(proof.id)).thenReturn(Optional.of(proof))
        `when`(platformAccess.requirePlatformAdmin(jwt)).thenThrow(AccessDeniedException("You do not have platform administrator access"))
        val user = com.daycare.api.persistence.UserProfile(id = UUID.randomUUID())
        `when`(access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN), null, false, setOf(Role.STAFF_ADMIN), emptySet(), emptySet()))
            .thenReturn(AccessScope(user, com.daycare.api.persistence.Membership(userId = user.id, organizationId = organizationId, active = false), emptySet(), emptySet()))

        assertThrows(IllegalArgumentException::class.java) { service.content(jwt, proof.id) }
    }

    @Test
    fun `review approves a proof, marks the payment paid, and notifies staff admins`() {
        val service = createService(enabled = true)
        `when`(platformAccess.requirePlatformAdmin(jwt)).thenReturn(com.daycare.api.persistence.UserProfile(id = UUID.randomUUID()))
        val staffUserId = UUID.randomUUID()
        val proof = com.daycare.api.persistence.TenantPaymentProof(id = UUID.randomUUID(), paymentId = paymentId, organizationId = organizationId, uploadedByUserId = staffUserId, status = "SUBMITTED")
        val payment = com.daycare.api.persistence.TenantPayment(id = paymentId, organizationId = organizationId, status = TenantPaymentStatus.PENDING, invoiceNumber = "UE-SUB-202610-000001")
        `when`(proofs.findById(proof.id)).thenReturn(Optional.of(proof))
        `when`(payments.findWithLockById(paymentId)).thenReturn(payment)
        `when`(proofs.findWithLockById(proof.id)).thenReturn(proof)
        `when`(subscriptions.findByOrganizationId(organizationId)).thenReturn(com.daycare.api.persistence.TenantSubscription(organizationId = organizationId))
        `when`(organizations.findById(organizationId)).thenReturn(Optional.of(com.daycare.api.persistence.Organization(id = organizationId, name = "Tenant")))
        `when`(memberships.findAllByOrganizationId(organizationId)).thenReturn(listOf(com.daycare.api.persistence.Membership(userId = staffUserId, organizationId = organizationId, role = Role.STAFF_ADMIN, active = true)))
        val key = UUID.randomUUID()

        val response = service.review(jwt, proof.id, key, ReviewTenantPaymentProofRequest(approved = true, reason = "Matches bank statement"))

        assertEquals("VERIFIED", response.status)
        verify(platformAdministration).markPaymentPaid(jwt, organizationId, paymentId, key)
        verify(notifications).notify(organizationId, staffUserId, "Pembayaran langganan diterima", "Pembayaran ${payment.invoiceNumber} telah dikonfirmasi.", "/tenant-subscription")
    }

    @Test
    fun `review rejects a proof without marking the payment paid`() {
        val service = createService(enabled = true)
        `when`(platformAccess.requirePlatformAdmin(jwt)).thenReturn(com.daycare.api.persistence.UserProfile(id = UUID.randomUUID()))
        val staffUserId = UUID.randomUUID()
        val proof = com.daycare.api.persistence.TenantPaymentProof(id = UUID.randomUUID(), paymentId = paymentId, organizationId = organizationId, uploadedByUserId = staffUserId, status = "SUBMITTED")
        val payment = com.daycare.api.persistence.TenantPayment(id = paymentId, organizationId = organizationId, status = TenantPaymentStatus.PENDING, invoiceNumber = "UE-SUB-202610-000001")
        `when`(proofs.findById(proof.id)).thenReturn(Optional.of(proof))
        `when`(payments.findWithLockById(paymentId)).thenReturn(payment)
        `when`(proofs.findWithLockById(proof.id)).thenReturn(proof)
        `when`(subscriptions.findByOrganizationId(organizationId)).thenReturn(com.daycare.api.persistence.TenantSubscription(organizationId = organizationId))
        `when`(organizations.findById(organizationId)).thenReturn(Optional.of(com.daycare.api.persistence.Organization(id = organizationId, name = "Tenant")))
        `when`(memberships.findAllByOrganizationId(organizationId)).thenReturn(listOf(com.daycare.api.persistence.Membership(userId = staffUserId, organizationId = organizationId, role = Role.STAFF_ADMIN, active = true)))

        val response = service.review(jwt, proof.id, UUID.randomUUID(), ReviewTenantPaymentProofRequest(approved = false, reason = "File is unreadable"))

        assertEquals("REJECTED", response.status)
        verifyNoInteractions(platformAdministration)
        verify(notifications).notify(organizationId, staffUserId, "Bukti pembayaran perlu diperbaiki", "Bukti ${payment.invoiceNumber} ditolak: File is unreadable", "/tenant-subscription")
    }

    @Test
    fun `review rejects a reason outside the allowed length`() {
        val service = createService(enabled = true)
        `when`(platformAccess.requirePlatformAdmin(jwt)).thenReturn(com.daycare.api.persistence.UserProfile())

        assertThrows(IllegalArgumentException::class.java) {
            service.review(jwt, UUID.randomUUID(), UUID.randomUUID(), ReviewTenantPaymentProofRequest(approved = true, reason = "ab"))
        }
    }

    @Test
    fun `review rejects a proof that is no longer pending`() {
        val service = createService(enabled = true)
        `when`(platformAccess.requirePlatformAdmin(jwt)).thenReturn(com.daycare.api.persistence.UserProfile())
        val proof = com.daycare.api.persistence.TenantPaymentProof(id = UUID.randomUUID(), paymentId = paymentId, organizationId = organizationId, status = "VERIFIED")
        val payment = com.daycare.api.persistence.TenantPayment(id = paymentId, organizationId = organizationId, status = TenantPaymentStatus.PAID)
        `when`(proofs.findById(proof.id)).thenReturn(Optional.of(proof))
        `when`(payments.findWithLockById(paymentId)).thenReturn(payment)
        `when`(proofs.findWithLockById(proof.id)).thenReturn(proof)

        assertThrows(IllegalArgumentException::class.java) {
            service.review(jwt, proof.id, UUID.randomUUID(), ReviewTenantPaymentProofRequest(approved = true, reason = "Already decided"))
        }
    }

    @Test
    fun `review rejects when the underlying payment is no longer pending`() {
        val service = createService(enabled = true)
        `when`(platformAccess.requirePlatformAdmin(jwt)).thenReturn(com.daycare.api.persistence.UserProfile())
        val proof = com.daycare.api.persistence.TenantPaymentProof(id = UUID.randomUUID(), paymentId = paymentId, organizationId = organizationId, status = "SUBMITTED")
        val payment = com.daycare.api.persistence.TenantPayment(id = paymentId, organizationId = organizationId, status = TenantPaymentStatus.VOID)
        `when`(proofs.findById(proof.id)).thenReturn(Optional.of(proof))
        `when`(payments.findWithLockById(paymentId)).thenReturn(payment)
        `when`(proofs.findWithLockById(proof.id)).thenReturn(proof)

        assertThrows(IllegalArgumentException::class.java) {
            service.review(jwt, proof.id, UUID.randomUUID(), ReviewTenantPaymentProofRequest(approved = true, reason = "Looks fine"))
        }
    }

    @Test
    fun `review replays the same response for a retried idempotency key with an identical payload`() {
        val service = createService(enabled = true)
        val actorId = UUID.randomUUID()
        `when`(platformAccess.requirePlatformAdmin(jwt)).thenReturn(com.daycare.api.persistence.UserProfile(id = actorId))
        val key = UUID.randomUUID()
        val reason = "Matches bank statement"
        val reviewed = com.daycare.api.persistence.TenantPaymentProof(id = UUID.randomUUID(), paymentId = paymentId, organizationId = organizationId, status = "VERIFIED")
        val payloadHash = invokePrivate(service, "sha256", "${reviewed.id}|true|$reason") as String
        reviewed.reviewIdempotencyKey = key
        reviewed.reviewPayloadHash = payloadHash
        `when`(proofs.findByReviewedByUserIdAndReviewIdempotencyKey(actorId, key)).thenReturn(reviewed)
        `when`(payments.findById(paymentId)).thenReturn(Optional.of(com.daycare.api.persistence.TenantPayment(id = paymentId, organizationId = organizationId, status = TenantPaymentStatus.PAID, invoiceNumber = "UE-SUB-202610-000001")))
        `when`(organizations.findById(organizationId)).thenReturn(Optional.of(com.daycare.api.persistence.Organization(id = organizationId, name = "Tenant")))

        val response = service.review(jwt, reviewed.id, key, ReviewTenantPaymentProofRequest(approved = true, reason = reason))

        assertEquals(reviewed.id, response.id)
        verify(proofs, never()).findWithLockById(reviewed.id)
    }

    @Test
    fun `review rejects a retried idempotency key whose payload has changed`() {
        val service = createService(enabled = true)
        val actorId = UUID.randomUUID()
        `when`(platformAccess.requirePlatformAdmin(jwt)).thenReturn(com.daycare.api.persistence.UserProfile(id = actorId))
        val key = UUID.randomUUID()
        val reviewed = com.daycare.api.persistence.TenantPaymentProof(id = UUID.randomUUID(), paymentId = paymentId, organizationId = organizationId, status = "VERIFIED", reviewIdempotencyKey = key, reviewPayloadHash = "stored-hash")
        `when`(proofs.findByReviewedByUserIdAndReviewIdempotencyKey(actorId, key)).thenReturn(reviewed)

        assertThrows(TenantSubscriptionIdempotencyConflict::class.java) {
            service.review(jwt, reviewed.id, key, ReviewTenantPaymentProofRequest(approved = true, reason = "Different reason this time"))
        }
        verify(proofs, never()).findWithLockById(reviewed.id)
    }

    private fun createService(enabled: Boolean) = TenantSubscriptionPaymentProofService(
        access,
        platformAccess,
        memberships,
        organizations,
        subscriptions,
        payments,
        proofs,
        audits,
        platformAdministration,
        notifications,
        enabled,
    )

    /** Stubs a STAFF_ADMIN caller with an active membership and a PENDING payment; returns the caller's profile. */
    private fun allowPendingPayment(): com.daycare.api.persistence.UserProfile {
        val user = com.daycare.api.persistence.UserProfile(id = UUID.randomUUID())
        `when`(access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN), null, false, setOf(Role.STAFF_ADMIN), emptySet(), emptySet()))
            .thenReturn(AccessScope(user, com.daycare.api.persistence.Membership(userId = user.id, organizationId = organizationId, active = true), emptySet(), emptySet()))
        `when`(payments.findById(paymentId)).thenReturn(Optional.of(com.daycare.api.persistence.TenantPayment(id = paymentId, organizationId = organizationId, status = TenantPaymentStatus.PENDING)))
        `when`(payments.findWithLockById(paymentId)).thenReturn(com.daycare.api.persistence.TenantPayment(id = paymentId, organizationId = organizationId, status = TenantPaymentStatus.PENDING))
        return user
    }

    private fun pdfRequest() = SubmitTenantPaymentProofRequest("receipt.pdf", "application/pdf", Base64.getEncoder().encodeToString("%PDF-1.7 test".toByteArray()))
}
