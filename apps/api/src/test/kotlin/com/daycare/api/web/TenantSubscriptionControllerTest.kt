// Mories Deo Hutapea,S.E.,S.Kom
package com.daycare.api.web

import com.daycare.api.domain.TenantSubscriptionStatus
import com.daycare.api.service.CreateTenantPaymentCorrectionRequest
import com.daycare.api.service.DevelopmentService
import com.daycare.api.service.GoalService
import com.daycare.api.service.InstitutionTypeCatalogService
import com.daycare.api.service.LearningStructureService
import com.daycare.api.service.PlatformAdminPinService
import com.daycare.api.service.PlatformAdministrationService
import com.daycare.api.service.PlatformCurriculumService
import com.daycare.api.service.ReviewTenantPaymentCorrectionRequest
import com.daycare.api.service.ReviewTenantPaymentProofRequest
import com.daycare.api.service.RenewTenantSubscriptionRequest
import com.daycare.api.service.SetTenantSubscriptionStatusRequest
import com.daycare.api.service.StaffTenantSubscriptionService
import com.daycare.api.service.SubmitTenantPaymentProofRequest
import com.daycare.api.service.TenantPaymentCorrectionCategory
import com.daycare.api.service.TenantSubscriptionCorrectionService
import com.daycare.api.service.TenantSubscriptionPaymentProofService
import com.daycare.api.service.TenantSubscriptionReminderService
import com.daycare.api.service.TenantReadinessService
import com.daycare.api.service.UpdateTenantGracePeriodRequest
import org.junit.jupiter.api.Test
import org.mockito.Mockito.mock
import org.mockito.Mockito.verify
import org.springframework.security.oauth2.jwt.Jwt
import java.math.BigDecimal
import java.util.UUID

class TenantSubscriptionControllerTest {
    private val jwt = mock(Jwt::class.java)
    private val organizationId = UUID.randomUUID()
    private val paymentId = UUID.randomUUID()
    private val resourceId = UUID.randomUUID()
    private val idempotencyKey = UUID.randomUUID()

    @Test
    fun `staff subscription controller delegates self-service endpoints with the supplied scope and keys`() {
        val service = mock(StaffTenantSubscriptionService::class.java)
        val proofs = mock(TenantSubscriptionPaymentProofService::class.java)
        val corrections = mock(TenantSubscriptionCorrectionService::class.java)
        val controller = StaffTenantSubscriptionController(service, proofs, corrections)
        val proofRequest = SubmitTenantPaymentProofRequest("receipt.pdf", "application/pdf", "cGRm")
        val correctionRequest = CreateTenantPaymentCorrectionRequest(
            TenantPaymentCorrectionCategory.WRONG_REFERENCE,
            "Reference on bank transfer differs",
            proposedReference = "REF-123",
        )

        controller.current(jwt, organizationId)
        controller.renew(jwt, organizationId, idempotencyKey)
        controller.submitProof(jwt, organizationId, paymentId, idempotencyKey, proofRequest)
        controller.ownProofs(jwt, organizationId, paymentId)
        controller.proofContent(jwt, resourceId)
        controller.createCorrection(jwt, organizationId, paymentId, idempotencyKey, correctionRequest)
        controller.ownCorrections(jwt, organizationId, paymentId)

        verify(service).current(jwt, organizationId)
        verify(service).renew(jwt, organizationId, idempotencyKey)
        verify(proofs).submit(jwt, organizationId, paymentId, idempotencyKey, proofRequest)
        verify(proofs).ownProofs(jwt, organizationId, paymentId)
        verify(proofs).content(jwt, resourceId)
        verify(corrections).create(jwt, organizationId, paymentId, idempotencyKey, correctionRequest)
        verify(corrections).ownRequests(jwt, organizationId, paymentId)
    }

    @Test
    fun `platform subscription controller delegates review queues and decisions with pagination and idempotency`() {
        val proofs = mock(TenantSubscriptionPaymentProofService::class.java)
        val corrections = mock(TenantSubscriptionCorrectionService::class.java)
        val reminders = mock(TenantSubscriptionReminderService::class.java)
        val controller = PlatformTenantSubscriptionController(proofs, corrections, reminders)
        val proofRequest = ReviewTenantPaymentProofRequest(approved = false, reason = "Unreadable proof")
        val correctionRequest = ReviewTenantPaymentCorrectionRequest(approved = true, reason = "Verified against bank statement")

        controller.subscriptionFeatures(jwt)
        controller.subscriptionReminders(jwt, 2, 17)
        controller.proofReviewQueue(jwt, 3, 19)
        controller.reviewProof(jwt, resourceId, idempotencyKey, proofRequest)
        controller.correctionReviewQueue(jwt, 4, 23)
        controller.reviewCorrection(jwt, resourceId, idempotencyKey, correctionRequest)

        verify(proofs).featureStatus(jwt)
        verify(reminders).platformReminderPage(jwt, 2, 17)
        verify(proofs).reviewQueue(jwt, 3, 19)
        verify(proofs).review(jwt, resourceId, idempotencyKey, proofRequest)
        verify(corrections).reviewQueue(jwt, 4, 23)
        verify(corrections).review(jwt, resourceId, idempotencyKey, correctionRequest)
    }

    @Test
    fun `platform administration controller delegates subscription renewal grace audit and status commands`() {
        val administration = mock(PlatformAdministrationService::class.java)
        val controller = PlatformController(
            administration,
            mock(TenantReadinessService::class.java),
            mock(PlatformAdminPinService::class.java),
            mock(PlatformCurriculumService::class.java),
            mock(InstitutionTypeCatalogService::class.java),
            mock(DevelopmentService::class.java),
            mock(GoalService::class.java),
            mock(LearningStructureService::class.java),
        )
        val renewRequest = RenewTenantSubscriptionRequest(monthlyFee = BigDecimal("500000"))
        val graceRequest = UpdateTenantGracePeriodRequest(gracePeriodDays = 7, reason = "Approved rollout")
        val statusRequest = SetTenantSubscriptionStatusRequest(reason = "Billing investigation")

        controller.renewSubscription(jwt, organizationId, idempotencyKey, renewRequest)
        controller.updateGracePeriod(jwt, organizationId, graceRequest)
        controller.subscriptionAudit(jwt, organizationId, 2, 17)
        controller.setSubscriptionStatus(jwt, organizationId, TenantSubscriptionStatus.SUSPENDED, statusRequest)

        verify(administration).renewSubscription(jwt, organizationId, idempotencyKey, renewRequest)
        verify(administration).updateGracePeriod(jwt, organizationId, graceRequest)
        verify(administration).subscriptionAudit(jwt, organizationId, 2, 17)
        verify(administration).setSubscriptionStatus(jwt, organizationId, TenantSubscriptionStatus.SUSPENDED, statusRequest.reason)
    }
}
