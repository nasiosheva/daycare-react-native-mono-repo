// Mories Deo Hutapea,S.E.,S.Kom
package com.daycare.api.service

import com.daycare.api.domain.Role
import com.daycare.api.domain.TenantPaymentStatus
import com.daycare.api.domain.TenantSubscriptionStatus
import com.daycare.api.persistence.Membership
import com.daycare.api.persistence.MembershipRepository
import com.daycare.api.persistence.Notification
import com.daycare.api.persistence.NotificationRepository
import com.daycare.api.persistence.OrganizationRepository
import com.daycare.api.persistence.PlatformAdministratorRepository
import com.daycare.api.persistence.TenantPaymentRepository
import com.daycare.api.persistence.TenantSubscription
import com.daycare.api.persistence.TenantSubscriptionReminderRepository
import com.daycare.api.persistence.TenantSubscriptionRepository
import com.daycare.api.persistence.Organization
import com.daycare.api.persistence.TenantPayment
import com.daycare.api.realtime.RealtimeFlag
import com.daycare.api.realtime.RealtimePublisher
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Test
import org.mockito.Mockito.any
import org.mockito.Mockito.mock
import org.mockito.Mockito.never
import org.mockito.Mockito.verify
import org.mockito.Mockito.`when`
import org.springframework.data.domain.PageImpl
import org.springframework.data.domain.PageRequest
import org.springframework.security.oauth2.jwt.Jwt
import java.math.BigDecimal
import java.time.Instant
import java.time.Clock
import java.time.LocalDate
import java.time.ZoneOffset
import java.util.UUID

class TenantSubscriptionReminderServiceTest {
    private val subscriptions = mock(TenantSubscriptionRepository::class.java)
    private val payments = mock(TenantPaymentRepository::class.java)
    private val reminders = mock(TenantSubscriptionReminderRepository::class.java)
    private val memberships = mock(MembershipRepository::class.java)
    private val platformAdministrators = mock(PlatformAdministratorRepository::class.java)
    private val notifications = mock(NotificationRepository::class.java)
    private val realtime = mock(RealtimePublisher::class.java)
    private val platformAccess = mock(PlatformAccessService::class.java)
    private val organizations = mock(OrganizationRepository::class.java)

    @Test
    fun `creates one tenant scoped in-app notification at configured lead time`() {
        val today = LocalDate.of(2026, 10, 14)
        val clock = Clock.fixed(Instant.parse("2026-10-14T00:00:00Z"), ZoneOffset.UTC)
        val organizationId = UUID.randomUUID()
        val staffAdminId = UUID.randomUUID()
        val subscription = TenantSubscription(
            organizationId = organizationId,
            status = TenantSubscriptionStatus.TRIAL,
            trialEndsAt = today.plusDays(3),
        )
        `when`(subscriptions.findAllByStatusAndTrialEndsAtIn(TenantSubscriptionStatus.TRIAL, listOf(today.plusDays(1), today.plusDays(3), today.plusDays(7))))
            .thenReturn(listOf(subscription))
        `when`(subscriptions.findAllByStatusInAndCoveredPeriodEndIn(listOf(TenantSubscriptionStatus.ACTIVE, TenantSubscriptionStatus.GRACE), listOf(today.plusDays(1), today.plusDays(3), today.plusDays(7))))
            .thenReturn(emptyList())
        `when`(payments.findAllByStatusAndDueDateIn(TenantPaymentStatus.PENDING, listOf(today.plusDays(1), today.plusDays(3), today.plusDays(7)))).thenReturn(emptyList())
        `when`(memberships.findAllByOrganizationId(organizationId)).thenReturn(listOf(Membership(userId = staffAdminId, organizationId = organizationId, role = Role.STAFF_ADMIN)))
        `when`(platformAdministrators.count()).thenReturn(0L)
        val eventKey = "$organizationId:TRIAL_END:${today.plusDays(3)}:3:${subscription.id}"
        val eventId = UUID.nameUUIDFromBytes(eventKey.toByteArray(Charsets.UTF_8))
        `when`(reminders.insertIfAbsent(eventId, eventKey, organizationId, subscription.id, null, "TRIAL_END", today.plusDays(3), 3, clock.instant())).thenReturn(1, 0)
        val service = service(clock)

        service.dispatchForDate(today)
        service.dispatchForDate(today)

        val notification = org.mockito.ArgumentCaptor.forClass(Notification::class.java)
        verify(notifications).save(notification.capture())
        verify(subscriptions, never()).findAll()
        assertEquals(organizationId, notification.value.organizationId)
        assertEquals(staffAdminId, notification.value.recipientUserId)
        assertEquals("/tenant-subscription", notification.value.actionPath)
        assertEquals("Masa uji coba akan berakhir", notification.value.title)
    }

    @Test
    fun `does not create reminder outside H-7 H-3 and H-1 windows`() {
        val today = LocalDate.of(2026, 10, 14)
        val service = service(Clock.fixed(Instant.parse("2026-10-14T00:00:00Z"), ZoneOffset.UTC))
        `when`(subscriptions.findAllByStatusAndTrialEndsAtIn(TenantSubscriptionStatus.TRIAL, listOf(today.plusDays(1), today.plusDays(3), today.plusDays(7))))
            .thenReturn(emptyList())
        `when`(subscriptions.findAllByStatusInAndCoveredPeriodEndIn(listOf(TenantSubscriptionStatus.ACTIVE, TenantSubscriptionStatus.GRACE), listOf(today.plusDays(1), today.plusDays(3), today.plusDays(7))))
            .thenReturn(emptyList())
        `when`(payments.findAllByStatusAndDueDateIn(TenantPaymentStatus.PENDING, listOf(today.plusDays(1), today.plusDays(3), today.plusDays(7)))).thenReturn(emptyList())

        service.dispatchForDate(today)

        verify(notifications, never()).save(any(Notification::class.java))
        verify(subscriptions, never()).findAll()
    }

    @Test
    fun `creates a period-end reminder for an active subscription nearing its covered period end`() {
        val today = LocalDate.of(2026, 10, 14)
        val clock = Clock.fixed(Instant.parse("2026-10-14T00:00:00Z"), ZoneOffset.UTC)
        val organizationId = UUID.randomUUID()
        val staffAdminId = UUID.randomUUID()
        val subscription = TenantSubscription(organizationId = organizationId, status = TenantSubscriptionStatus.ACTIVE, periodEnd = today.plusDays(7))
        `when`(subscriptions.findAllByStatusAndTrialEndsAtIn(TenantSubscriptionStatus.TRIAL, listOf(today.plusDays(1), today.plusDays(3), today.plusDays(7)))).thenReturn(emptyList())
        `when`(subscriptions.findAllByStatusInAndCoveredPeriodEndIn(listOf(TenantSubscriptionStatus.ACTIVE, TenantSubscriptionStatus.GRACE), listOf(today.plusDays(1), today.plusDays(3), today.plusDays(7))))
            .thenReturn(listOf(subscription))
        `when`(payments.findAllByStatusAndDueDateIn(TenantPaymentStatus.PENDING, listOf(today.plusDays(1), today.plusDays(3), today.plusDays(7)))).thenReturn(emptyList())
        `when`(memberships.findAllByOrganizationId(organizationId)).thenReturn(listOf(Membership(userId = staffAdminId, organizationId = organizationId, role = Role.STAFF_ADMIN)))
        `when`(platformAdministrators.count()).thenReturn(0L)
        val eventKey = "$organizationId:PERIOD_END:${today.plusDays(7)}:7:${subscription.id}"
        val eventId = UUID.nameUUIDFromBytes(eventKey.toByteArray(Charsets.UTF_8))
        `when`(reminders.insertIfAbsent(eventId, eventKey, organizationId, subscription.id, null, "PERIOD_END", today.plusDays(7), 7, clock.instant())).thenReturn(1)
        val service = service(clock)

        service.dispatchForDate(today)

        val notification = org.mockito.ArgumentCaptor.forClass(Notification::class.java)
        verify(notifications).save(notification.capture())
        assertEquals("Langganan akan berakhir", notification.value.title)
    }

    @Test
    fun `creates a payment-due reminder for a pending payment approaching its due date`() {
        val today = LocalDate.of(2026, 10, 14)
        val clock = Clock.fixed(Instant.parse("2026-10-14T00:00:00Z"), ZoneOffset.UTC)
        val organizationId = UUID.randomUUID()
        val staffAdminId = UUID.randomUUID()
        val subscription = TenantSubscription(organizationId = organizationId, status = TenantSubscriptionStatus.ACTIVE)
        val payment = TenantPayment(organizationId = organizationId, subscriptionId = subscription.id, amount = BigDecimal("250000"), status = TenantPaymentStatus.PENDING, dueDate = today.plusDays(1), invoiceNumber = "UE-SUB-202610-000001")
        `when`(subscriptions.findAllByStatusAndTrialEndsAtIn(TenantSubscriptionStatus.TRIAL, listOf(today.plusDays(1), today.plusDays(3), today.plusDays(7)))).thenReturn(emptyList())
        `when`(subscriptions.findAllByStatusInAndCoveredPeriodEndIn(listOf(TenantSubscriptionStatus.ACTIVE, TenantSubscriptionStatus.GRACE), listOf(today.plusDays(1), today.plusDays(3), today.plusDays(7))))
            .thenReturn(emptyList())
        `when`(payments.findAllByStatusAndDueDateIn(TenantPaymentStatus.PENDING, listOf(today.plusDays(1), today.plusDays(3), today.plusDays(7)))).thenReturn(listOf(payment))
        `when`(subscriptions.findByOrganizationId(organizationId)).thenReturn(subscription)
        `when`(memberships.findAllByOrganizationId(organizationId)).thenReturn(listOf(Membership(userId = staffAdminId, organizationId = organizationId, role = Role.STAFF_ADMIN)))
        `when`(platformAdministrators.count()).thenReturn(1L)
        val eventKey = "$organizationId:PAYMENT_DUE:${today.plusDays(1)}:1:${payment.id}"
        val eventId = UUID.nameUUIDFromBytes(eventKey.toByteArray(Charsets.UTF_8))
        `when`(reminders.insertIfAbsent(eventId, eventKey, organizationId, subscription.id, payment.id, "PAYMENT_DUE", today.plusDays(1), 1, clock.instant())).thenReturn(1)
        val service = service(clock)

        service.dispatchForDate(today)

        val notification = org.mockito.ArgumentCaptor.forClass(Notification::class.java)
        verify(notifications).save(notification.capture())
        assertEquals("Tagihan langganan mendekati jatuh tempo", notification.value.title)
        assertEquals(true, notification.value.body.contains("UE-SUB-202610-000001"))
        verify(realtime).publishToPlatformAdmins(setOf(RealtimeFlag.TENANTS), mapOf("organizationId" to organizationId, "reminderType" to "PAYMENT_DUE", "eventDate" to today.plusDays(1).toString(), "leadDays" to 1))
    }

    @Test
    fun `platformReminderPage rejects an invalid page or size`() {
        val service = service()
        val jwt = mock(Jwt::class.java)
        `when`(platformAccess.requirePlatformAdmin(jwt)).thenReturn(com.daycare.api.persistence.UserProfile())

        assertThrows(IllegalArgumentException::class.java) { service.platformReminderPage(jwt, -1, 10) }
        assertThrows(IllegalArgumentException::class.java) { service.platformReminderPage(jwt, 0, 0) }
        assertThrows(IllegalArgumentException::class.java) { service.platformReminderPage(jwt, 0, 51) }
    }

    @Test
    fun `platformReminderPage maps reminders to tenant names for a platform admin`() {
        val service = service()
        val jwt = mock(Jwt::class.java)
        `when`(platformAccess.requirePlatformAdmin(jwt)).thenReturn(com.daycare.api.persistence.UserProfile())
        val organizationId = UUID.randomUUID()
        val reminder = com.daycare.api.persistence.TenantSubscriptionReminder(organizationId = organizationId, eventType = "PERIOD_END", eventDate = LocalDate.of(2026, 10, 21), leadDays = 7)
        `when`(reminders.findAllByOrderByCreatedAtDesc(PageRequest.of(0, 20))).thenReturn(PageImpl(listOf(reminder)))
        `when`(organizations.findAllById(listOf(organizationId))).thenReturn(listOf(Organization(id = organizationId, name = "Tenant")))

        val page = service.platformReminderPage(jwt, 0, 20)

        assertEquals(1, page.items.size)
        assertEquals("Tenant", page.items.single().organizationName)
        assertEquals(false, page.hasNext)
    }

    private fun service(clock: Clock = Clock.systemUTC()) = TenantSubscriptionReminderService(
        subscriptions, payments, reminders, memberships, platformAdministrators, notifications, realtime, platformAccess, organizations, clock,
    )
}
