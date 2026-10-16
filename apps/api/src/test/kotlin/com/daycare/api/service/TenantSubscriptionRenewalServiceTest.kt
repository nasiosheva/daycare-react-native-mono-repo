// Mories Deo Hutapea,S.E.,S.Kom
package com.daycare.api.service

import com.daycare.api.domain.TenantSubscriptionPlan
import com.daycare.api.domain.TenantSubscriptionStatus
import com.daycare.api.persistence.TenantPayment
import com.daycare.api.persistence.TenantPaymentRepository
import com.daycare.api.persistence.TenantSubscription
import com.daycare.api.persistence.TenantSubscriptionAuditEventRepository
import com.daycare.api.persistence.TenantSubscriptionRepository
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertSame
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Test
import org.mockito.ArgumentMatchers.any
import org.mockito.ArgumentMatchers.anyString
import org.mockito.ArgumentMatchers.eq
import org.mockito.Mockito.mock
import org.mockito.Mockito.`when`
import org.springframework.jdbc.core.JdbcTemplate
import java.math.BigDecimal
import java.security.MessageDigest
import java.time.LocalDate
import java.util.UUID

class TenantSubscriptionRenewalServiceTest {
    private val subscriptions = mock(TenantSubscriptionRepository::class.java)
    private val payments = mock(TenantPaymentRepository::class.java)
    private val audits = mock(TenantSubscriptionAuditEventRepository::class.java)
    private val jdbc = mock(JdbcTemplate::class.java)
    private val invoiceNumbers = TenantSubscriptionInvoiceNumberGenerator(jdbc)
    private val service = TenantSubscriptionRenewalService(
        subscriptions, payments, TenantSubscriptionBillingPolicy("1000000"), TenantSubscriptionLifecyclePolicy(), audits, invoiceNumbers,
    )
    private val organizationId = UUID.randomUUID()
    private val actorId = UUID.randomUUID()

    @Test
    fun `preview terms use the already-paid next period as renewal baseline`() {
        val today = LocalDate.now(BILLING_TIME_ZONE)
        val subscription = TenantSubscription(
            organizationId = organizationId,
            status = TenantSubscriptionStatus.ACTIVE,
            periodStart = today.minusMonths(1),
            periodEnd = today.plusDays(5),
            nextPeriodStart = today.plusDays(6),
            nextPeriodEnd = today.plusDays(35),
            monthlyFee = BigDecimal("250000"),
        )

        val terms = service.previewTerms(subscription, today)

        assertEquals(today.plusDays(36), terms?.periodStart)
        assertEquals(today.plusDays(36).plusMonths(1).minusDays(1), terms?.periodEnd)
        assertEquals(today.plusDays(35), terms?.dueDate)
    }

    @Test
    fun `preview terms use trial end and WIB date for trial and expired subscriptions`() {
        val today = LocalDate.now(BILLING_TIME_ZONE)
        val trial = TenantSubscription(
            organizationId = organizationId,
            status = TenantSubscriptionStatus.TRIAL,
            periodEnd = today.plusDays(4),
            trialEndsAt = today.plusDays(10),
        )
        val trialTerms = service.previewTerms(trial, today)
        assertEquals(today.plusDays(11), trialTerms?.periodStart)
        assertEquals(today.plusDays(10), trialTerms?.dueDate)

        val expired = TenantSubscription(
            organizationId = organizationId,
            status = TenantSubscriptionStatus.EXPIRED,
            periodEnd = today.minusDays(1),
        )
        val expiredTerms = service.previewTerms(expired, today)
        assertEquals(today, expiredTerms?.periodStart)
        assertEquals(today.plusMonths(1).minusDays(1), expiredTerms?.periodEnd)
        assertEquals(today.plusDays(7), expiredTerms?.dueDate)
    }

    @Test
    fun `preview terms omit suspended subscriptions and fall back to period end when trial end is absent`() {
        val today = LocalDate.now(BILLING_TIME_ZONE)
        val suspended = TenantSubscription(
            organizationId = organizationId,
            status = TenantSubscriptionStatus.SUSPENDED,
            periodEnd = today.plusDays(5),
        )
        val trialWithoutExplicitEnd = TenantSubscription(
            organizationId = organizationId,
            status = TenantSubscriptionStatus.TRIAL,
            periodEnd = today.plusDays(5),
            trialEndsAt = null,
        )

        assertEquals(null, service.previewTerms(suspended, today))
        val terms = service.previewTerms(trialWithoutExplicitEnd, today)
        assertEquals(today.plusDays(6), terms?.periodStart)
        assertEquals(today.plusDays(5), terms?.dueDate)
    }

    /**
     * Stubs the create path: no pending payment and an allocatable invoice
     * sequence. The idempotency-key lookup is left unstubbed so Mockito's
     * default `null` return simulates "no prior payment for this key" (a
     * literal or `any()`-matcher call into this Kotlin-declared, non-null-UUID
     * repository method would throw instead of matching, per the Kotlin/
     * Mockito `any()` pitfall documented in TenantSubscriptionCorrectionServiceTest).
     */
    private fun allowCreate(subscription: TenantSubscription) {
        `when`(subscriptions.findByOrganizationIdForUpdate(organizationId)).thenReturn(subscription)
        `when`(payments.findAllByOrganizationIdOrderByCreatedAtDesc(organizationId)).thenReturn(emptyList())
        `when`(payments.save(any())).thenAnswer { it.arguments[0] }
        `when`(jdbc.queryForObject(anyString(), eq(Int::class.javaObjectType), any<Any>())).thenReturn(1)
    }

    @Test
    fun `idempotency replay is actor bound`() {
        val organizationId = UUID.randomUUID()
        val actorId = UUID.randomUUID()
        val otherActorId = UUID.randomUUID()
        val idempotencyKey = UUID.randomUUID()
        val subscription = TenantSubscription(
            organizationId = organizationId,
            plan = TenantSubscriptionPlan.STANDARD,
            status = TenantSubscriptionStatus.ACTIVE,
            periodStart = LocalDate.of(2026, 10, 1),
            periodEnd = LocalDate.of(2026, 10, 31),
            monthlyFee = BigDecimal("250000"),
        )
        val payment = TenantPayment(
            subscriptionId = subscription.id,
            organizationId = organizationId,
            amount = BigDecimal("250000"),
            idempotencyKey = idempotencyKey,
            idempotencyPayloadHash = hash("$organizationId|$actorId|TENANT_SUBSCRIPTION_RENEWAL|${subscription.id}|USE_CURRENT_PRICE"),
        )
        `when`(subscriptions.findByOrganizationIdForUpdate(organizationId)).thenReturn(subscription)
        `when`(payments.findByOrganizationIdAndIdempotencyKey(organizationId, idempotencyKey)).thenReturn(payment)

        assertSame(payment, service.renew(organizationId, actorId, idempotencyKey))
        assertThrows(TenantSubscriptionIdempotencyConflict::class.java) {
            service.renew(organizationId, otherActorId, idempotencyKey)
        }
    }

    @Test
    fun `renew converts a trial into its first billed period using the trial end date`() {
        val today = LocalDate.now(BILLING_TIME_ZONE)
        val subscription = TenantSubscription(organizationId = organizationId, plan = TenantSubscriptionPlan.STANDARD, status = TenantSubscriptionStatus.TRIAL, periodStart = today.minusDays(29), periodEnd = today, trialEndsAt = today, monthlyFee = null)
        allowCreate(subscription)

        val payment = service.renew(organizationId, actorId, UUID.randomUUID(), BigDecimal("250000"))

        assertEquals(today.plusDays(1), payment.periodStart)
        assertEquals(today.plusDays(1).plusMonths(1).minusDays(1), payment.periodEnd)
        assertEquals(today, payment.dueDate)
    }

    @Test
    fun `renew chains onto an already-started next period instead of the stored period end`() {
        val today = LocalDate.now(BILLING_TIME_ZONE)
        val subscription = TenantSubscription(organizationId = organizationId, plan = TenantSubscriptionPlan.STANDARD, status = TenantSubscriptionStatus.ACTIVE, periodStart = today.minusDays(31), periodEnd = today.minusDays(1), nextPeriodStart = today, nextPeriodEnd = today.plusDays(29), monthlyFee = BigDecimal("250000"))
        allowCreate(subscription)

        val payment = service.renew(organizationId, actorId, UUID.randomUUID())

        assertEquals(today.plusDays(30), payment.periodStart)
        assertEquals(today.plusDays(29), payment.dueDate)
    }

    @Test
    fun `renew chains after an already-paid future period`() {
        val today = LocalDate.now(BILLING_TIME_ZONE)
        val subscription = TenantSubscription(organizationId = organizationId, plan = TenantSubscriptionPlan.STANDARD, status = TenantSubscriptionStatus.ACTIVE, periodStart = today.minusDays(1), periodEnd = today.plusDays(20), nextPeriodStart = today.plusDays(21), nextPeriodEnd = today.plusDays(50), monthlyFee = BigDecimal("250000"))
        allowCreate(subscription)

        val payment = service.renew(organizationId, actorId, UUID.randomUUID())

        assertEquals(today.plusDays(51), payment.periodStart)
        assertEquals(today.plusDays(51).plusMonths(1).minusDays(1), payment.periodEnd)
        assertEquals(today.plusDays(50), payment.dueDate)
    }

    @Test
    fun `renew chains after an already-paid future period while trial is still active`() {
        val today = LocalDate.now(BILLING_TIME_ZONE)
        val subscription = TenantSubscription(
            organizationId = organizationId,
            plan = TenantSubscriptionPlan.STANDARD,
            status = TenantSubscriptionStatus.TRIAL,
            periodStart = today.minusDays(1),
            periodEnd = today.plusDays(20),
            trialEndsAt = today.plusDays(20),
            nextPeriodStart = today.plusDays(21),
            nextPeriodEnd = today.plusDays(50),
            monthlyFee = BigDecimal("250000"),
        )
        allowCreate(subscription)

        val payment = service.renew(organizationId, actorId, UUID.randomUUID())

        assertEquals(today.plusDays(51), payment.periodStart)
        assertEquals(today.plusDays(51).plusMonths(1).minusDays(1), payment.periodEnd)
        assertEquals(today.plusDays(50), payment.dueDate)
    }

    @Test
    fun `renew starts a fresh period with no continuity once a subscription has expired`() {
        val today = LocalDate.now(BILLING_TIME_ZONE)
        val subscription = TenantSubscription(organizationId = organizationId, plan = TenantSubscriptionPlan.STANDARD, status = TenantSubscriptionStatus.ACTIVE, periodStart = today.minusMonths(3), periodEnd = today.minusDays(60), monthlyFee = BigDecimal("250000"))
        allowCreate(subscription)

        val payment = service.renew(organizationId, actorId, UUID.randomUUID())

        assertEquals(today, payment.periodStart)
        assertEquals(today.plusMonths(1).minusDays(1), payment.periodEnd)
        assertEquals(today.plusDays(7), payment.dueDate)
    }

    @Test
    fun `renew requires a monthly fee when none is requested and the subscription has none configured`() {
        val subscription = TenantSubscription(organizationId = organizationId, status = TenantSubscriptionStatus.ACTIVE, periodEnd = LocalDate.now(BILLING_TIME_ZONE).plusDays(5), monthlyFee = null)
        allowCreate(subscription)

        assertThrows(IllegalArgumentException::class.java) { service.renew(organizationId, actorId, UUID.randomUUID()) }
    }

    @Test
    fun `renew rejects a status that cannot be renewed`() {
        val subscription = TenantSubscription(organizationId = organizationId, status = TenantSubscriptionStatus.SUSPENDED, periodEnd = LocalDate.now(BILLING_TIME_ZONE).plusDays(5), monthlyFee = BigDecimal("250000"))
        allowCreate(subscription)

        assertThrows(IllegalArgumentException::class.java) { service.renew(organizationId, actorId, UUID.randomUUID()) }
    }

    @Test
    fun `renew rejects a second renewal while a payment is already pending`() {
        val subscription = TenantSubscription(organizationId = organizationId, status = TenantSubscriptionStatus.ACTIVE, periodEnd = LocalDate.now(BILLING_TIME_ZONE).plusDays(5), monthlyFee = BigDecimal("250000"))
        `when`(subscriptions.findByOrganizationIdForUpdate(organizationId)).thenReturn(subscription)
        `when`(payments.findAllByOrganizationIdOrderByCreatedAtDesc(organizationId)).thenReturn(listOf(TenantPayment(organizationId = organizationId, subscriptionId = subscription.id, amount = BigDecimal("250000"), status = com.daycare.api.domain.TenantPaymentStatus.PENDING)))

        assertThrows(IllegalArgumentException::class.java) { service.renew(organizationId, actorId, UUID.randomUUID()) }
    }

    @Test
    fun `renew applies the billing policy maximum to an explicitly requested amount`() {
        val subscription = TenantSubscription(organizationId = organizationId, status = TenantSubscriptionStatus.ACTIVE, periodEnd = LocalDate.now(BILLING_TIME_ZONE).plusDays(5), monthlyFee = BigDecimal("250000"))
        `when`(subscriptions.findByOrganizationIdForUpdate(organizationId)).thenReturn(subscription)
        `when`(payments.findAllByOrganizationIdOrderByCreatedAtDesc(organizationId)).thenReturn(emptyList())

        assertThrows(IllegalArgumentException::class.java) { service.renew(organizationId, actorId, UUID.randomUUID(), BigDecimal("2000000")) }
    }

    private fun hash(value: String): String = MessageDigest.getInstance("SHA-256")
        .digest(value.toByteArray()).joinToString("") { "%02x".format(it) }
}
