// Mories Deo Hutapea,S.E.,S.Kom
package com.daycare.api.service

import com.daycare.api.domain.Role
import com.daycare.api.domain.TenantPaymentStatus
import com.daycare.api.domain.TenantSubscriptionStatus
import com.daycare.api.persistence.MembershipRepository
import com.daycare.api.persistence.Notification
import com.daycare.api.persistence.NotificationRepository
import com.daycare.api.persistence.OrganizationRepository
import com.daycare.api.persistence.PlatformAdministratorRepository
import com.daycare.api.persistence.TenantPayment
import com.daycare.api.persistence.TenantPaymentRepository
import com.daycare.api.persistence.TenantSubscription
import com.daycare.api.persistence.TenantSubscriptionReminderRepository
import com.daycare.api.persistence.TenantSubscriptionRepository
import com.daycare.api.realtime.RealtimeFlag
import com.daycare.api.realtime.RealtimePublisher
import org.springframework.data.domain.PageRequest
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.nio.charset.StandardCharsets
import java.time.Clock
import java.time.LocalDate
import java.time.ZoneId
import java.util.UUID

private val SUBSCRIPTION_REMINDER_ZONE: ZoneId = ZoneId.of("Asia/Jakarta")
private val SUBSCRIPTION_REMINDER_LEAD_DAYS = setOf(7, 3, 1)

private enum class SubscriptionReminderType(val code: String, val title: String, val label: String) {
    TRIAL_END("TRIAL_END", "Masa uji coba akan berakhir", "masa uji coba"),
    PERIOD_END("PERIOD_END", "Langganan akan berakhir", "periode langganan"),
    PAYMENT_DUE("PAYMENT_DUE", "Tagihan langganan mendekati jatuh tempo", "tagihan langganan"),
}

data class PlatformTenantSubscriptionReminderItem(
    val id: UUID,
    val organizationId: UUID,
    val organizationName: String,
    val eventType: String,
    val eventDate: LocalDate,
    val leadDays: Int,
    val createdAt: java.time.Instant,
)

data class PlatformTenantSubscriptionReminderPage(
    val items: List<PlatformTenantSubscriptionReminderItem>,
    val page: Int,
    val size: Int,
    val totalElements: Long,
    val hasNext: Boolean,
)

@Service
class TenantSubscriptionReminderService(
    private val subscriptions: TenantSubscriptionRepository,
    private val payments: TenantPaymentRepository,
    private val reminders: TenantSubscriptionReminderRepository,
    private val memberships: MembershipRepository,
    private val platformAdministrators: PlatformAdministratorRepository,
    private val notifications: NotificationRepository,
    private val realtime: RealtimePublisher,
    private val platformAccess: PlatformAccessService,
    private val organizations: OrganizationRepository,
    private val clock: Clock = Clock.systemUTC(),
) {
    @Scheduled(cron = "0 10 0 * * *", zone = "Asia/Jakarta")
    @Transactional
    fun sendDueReminders() = dispatchForDate(LocalDate.now(clock.withZone(SUBSCRIPTION_REMINDER_ZONE)))

    @Transactional(readOnly = true)
    fun platformReminderPage(jwt: Jwt, page: Int = 0, size: Int = 20): PlatformTenantSubscriptionReminderPage {
        platformAccess.requirePlatformAdmin(jwt)
        require(page >= 0) { "Page must be zero or greater" }
        require(size in 1..50) { "Page size must be between 1 and 50" }
        val results = reminders.findAllByOrderByCreatedAtDesc(PageRequest.of(page, size))
        val organizationNames = organizations.findAllById(results.content.map { it.organizationId }).associate { it.id to it.name }
        return PlatformTenantSubscriptionReminderPage(
            items = results.content.map { reminder ->
                PlatformTenantSubscriptionReminderItem(
                    id = reminder.id,
                    organizationId = reminder.organizationId,
                    organizationName = organizationNames[reminder.organizationId] ?: "Tenant",
                    eventType = reminder.eventType,
                    eventDate = reminder.eventDate,
                    leadDays = reminder.leadDays,
                    createdAt = reminder.createdAt,
                )
            },
            page = results.number,
            size = results.size,
            totalElements = results.totalElements,
            hasNext = results.hasNext(),
        )
    }

    internal fun dispatchForDate(today: LocalDate) {
        val reminderDates = SUBSCRIPTION_REMINDER_LEAD_DAYS.sorted().map { today.plusDays(it.toLong()) }
        subscriptions.findAllByStatusAndTrialEndsAtIn(TenantSubscriptionStatus.TRIAL, reminderDates)
            .forEach { subscription ->
                subscription.trialEndsAt?.let { dispatch(subscription, SubscriptionReminderType.TRIAL_END, it, today) }
            }
        subscriptions.findAllByStatusInAndCoveredPeriodEndIn(
            listOf(TenantSubscriptionStatus.ACTIVE, TenantSubscriptionStatus.GRACE),
            reminderDates,
        ).forEach { subscription ->
            val coveredPeriodEnd = subscription.nextPeriodEnd ?: subscription.periodEnd
            dispatch(subscription, SubscriptionReminderType.PERIOD_END, coveredPeriodEnd, today)
        }

        payments.findAllByStatusAndDueDateIn(TenantPaymentStatus.PENDING, reminderDates).forEach { payment ->
            val subscription = subscriptions.findByOrganizationId(payment.organizationId) ?: return@forEach
            dispatch(subscription, SubscriptionReminderType.PAYMENT_DUE, payment.dueDate, today, payment)
        }
    }

    private fun dispatch(
        subscription: TenantSubscription,
        type: SubscriptionReminderType,
        eventDate: LocalDate,
        today: LocalDate,
        payment: TenantPayment? = null,
    ) {
        val daysUntil = java.time.temporal.ChronoUnit.DAYS.between(today, eventDate).toInt()
        if (daysUntil !in SUBSCRIPTION_REMINDER_LEAD_DAYS) return
        val eventKey = "${subscription.organizationId}:${type.code}:$eventDate:$daysUntil:${payment?.id ?: subscription.id}"
        val inserted = reminders.insertIfAbsent(
            id = UUID.nameUUIDFromBytes(eventKey.toByteArray(StandardCharsets.UTF_8)),
            eventKey = eventKey,
            organizationId = subscription.organizationId,
            subscriptionId = subscription.id,
            paymentId = payment?.id,
            eventType = type.code,
            eventDate = eventDate,
            leadDays = daysUntil,
            createdAt = java.time.Instant.now(clock),
        )
        if (inserted == 0) return

        val body = buildString {
            append("${type.label.replaceFirstChar { it.uppercase() }} berakhir pada $eventDate ($daysUntil hari lagi).")
            payment?.let { append(" Invoice ${it.invoiceNumber}.") }
        }
        memberships.findAllByOrganizationId(subscription.organizationId)
            .filter { it.active && it.role == Role.STAFF_ADMIN }
            .map { it.userId }
            .distinct()
            .forEach { userId ->
                notifications.save(
                    Notification(
                        organizationId = subscription.organizationId,
                        recipientUserId = userId,
                        title = type.title,
                        body = body,
                        actionPath = "/tenant-subscription",
                    ),
                )
                realtime.publishToUser(subscription.organizationId, userId, setOf(RealtimeFlag.NOTIFICATIONS))
            }

        // Platform admins have a cross-tenant dashboard, not a tenant-scoped inbox.
        // Broadcast a redacted invalidation so that their attention list can refresh.
        if (platformAdministrators.count() > 0) {
            realtime.publishToPlatformAdmins(
                setOf(RealtimeFlag.TENANTS),
                mapOf("organizationId" to subscription.organizationId, "reminderType" to type.code, "eventDate" to eventDate.toString(), "leadDays" to daysUntil),
            )
        }
    }
}
