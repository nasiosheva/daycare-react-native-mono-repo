package com.daycare.api.service

import com.daycare.api.domain.EntitlementStatus
import com.daycare.api.domain.InstitutionCapability
import com.daycare.api.domain.Role
import com.daycare.api.persistence.AuditLog
import com.daycare.api.persistence.AuditLogRepository
import com.daycare.api.persistence.MembershipRepository
import com.daycare.api.persistence.ServiceEntitlement
import com.daycare.api.persistence.ServiceEntitlementRepository
import com.daycare.api.persistence.ServiceExpiryReminder
import com.daycare.api.persistence.ServiceExpiryReminderRepository
import com.daycare.api.persistence.ServiceExpiryReminderSettings
import com.daycare.api.persistence.ServiceExpiryReminderSettingsRepository
import com.daycare.api.realtime.RealtimeFlag
import jakarta.validation.constraints.NotEmpty
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.util.UUID

private const val DEFAULT_EXPIRY_LEAD_DAYS = "7,3,1"
private val EXPIRY_REMINDER_ZONE: ZoneId = ZoneId.of("Asia/Jakarta")

data class ServiceExpiryReminderSettingsResponse(val leadDays: List<Int>)
data class UpdateServiceExpiryReminderSettingsRequest(@field:NotEmpty val leadDays: List<Int>)

@Service
class ServiceExpiryReminderService(
    private val access: AccessService,
    private val publishedCapabilities: PublishedOfferingCapabilityService,
    private val entitlements: ServiceEntitlementRepository,
    private val settings: ServiceExpiryReminderSettingsRepository,
    private val reminders: ServiceExpiryReminderRepository,
    private val memberships: MembershipRepository,
    private val notifications: NotificationService,
    private val audits: AuditLogRepository,
) {
    @Transactional(readOnly = true)
    fun settings(jwt: Jwt, organizationId: UUID): ServiceExpiryReminderSettingsResponse {
        access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN), InstitutionCapability.DAYCARE_OPERATIONS, readOnly = true)
        return ServiceExpiryReminderSettingsResponse(parse(settings.findById(organizationId).orElse(null)?.leadDays))
    }

    @Transactional
    fun updateSettings(jwt: Jwt, organizationId: UUID, request: UpdateServiceExpiryReminderSettingsRequest): ServiceExpiryReminderSettingsResponse {
        val scope = access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN), InstitutionCapability.DAYCARE_OPERATIONS)
        access.requireWritable(scope)
        val normalized = request.leadDays.distinct().sortedDescending()
        require(normalized.all { it in 1..30 }) { DaycareOperationError.INVALID }
        val setting = settings.findById(organizationId).orElse(ServiceExpiryReminderSettings(organizationId = organizationId))
        setting.leadDays = normalized.joinToString(",")
        setting.updatedByUserId = scope.user.id
        setting.updatedAt = Instant.now()
        settings.save(setting)
        audits.save(AuditLog(organizationId = organizationId, actorUserId = scope.user.id, entityType = "SERVICE_EXPIRY_REMINDER_SETTINGS", entityId = organizationId, action = "UPDATED", source = "BILLING_CONFIGURATION"))
        return ServiceExpiryReminderSettingsResponse(normalized)
    }

    @Scheduled(cron = "0 5 0 * * *", zone = "Asia/Jakarta")
    @Transactional
    fun sendDueReminders() {
        val today = LocalDate.now(EXPIRY_REMINDER_ZONE)
        entitlements.findAll().filter { it.status == EntitlementStatus.ACTIVE && !it.validUntil.isBefore(today) }.forEach { entitlement ->
            if (!publishedCapabilities.hasPublishedCapability(entitlement.organizationId, InstitutionCapability.DAYCARE_OPERATIONS, entitlement.branchId)) return@forEach
            val daysUntilExpiry = java.time.temporal.ChronoUnit.DAYS.between(today, entitlement.validUntil).toInt()
            if (daysUntilExpiry !in parse(settings.findById(entitlement.organizationId).orElse(null)?.leadDays)) return@forEach
            if (reminders.existsByEntitlementIdAndLeadDays(entitlement.id, daysUntilExpiry)) return@forEach
            reminders.save(ServiceExpiryReminder(organizationId = entitlement.organizationId, entitlementId = entitlement.id, leadDays = daysUntilExpiry))
            val body = "Layanan ${entitlement.planName} berakhir pada ${entitlement.validUntil}."
            notifications.notify(entitlement.organizationId, entitlement.ownerUserId, "Masa layanan akan berakhir", body, "/payment-history", setOf(RealtimeFlag.ENTITLEMENTS))
            memberships.findAllByOrganizationId(entitlement.organizationId)
                .filter { it.active && it.role == Role.STAFF_ADMIN }
                .map { it.userId }
                .distinct()
                .forEach { userId -> notifications.notify(entitlement.organizationId, userId, "Masa layanan Parent akan berakhir", body, "/billing-admin", setOf(RealtimeFlag.ENTITLEMENTS)) }
        }
    }

    private fun parse(value: String?): List<Int> = (value ?: DEFAULT_EXPIRY_LEAD_DAYS)
        .split(',').mapNotNull { it.trim().toIntOrNull() }.filter { it in 1..30 }.distinct().sortedDescending()
}
