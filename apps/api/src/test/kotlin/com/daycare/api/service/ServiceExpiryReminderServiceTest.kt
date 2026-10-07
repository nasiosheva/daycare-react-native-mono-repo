package com.daycare.api.service

import com.daycare.api.domain.EntitlementStatus
import com.daycare.api.domain.InstitutionCapability
import com.daycare.api.domain.Role
import com.daycare.api.persistence.AuditLogRepository
import com.daycare.api.persistence.Membership
import com.daycare.api.persistence.MembershipRepository
import com.daycare.api.persistence.ServiceEntitlement
import com.daycare.api.persistence.ServiceEntitlementRepository
import com.daycare.api.persistence.ServiceExpiryReminder
import com.daycare.api.persistence.ServiceExpiryReminderRepository
import com.daycare.api.persistence.ServiceExpiryReminderSettingsRepository
import org.junit.jupiter.api.Test
import org.mockito.Mockito.any
import org.mockito.Mockito.mock
import org.mockito.Mockito.times
import org.mockito.Mockito.verify
import org.mockito.Mockito.`when`
import java.time.LocalDate
import java.time.ZoneId
import java.util.Optional
import java.util.UUID

class ServiceExpiryReminderServiceTest {
    @Test
    fun `scheduled reminder is idempotent and reaches the parent and active staff admin`() {
        val access = mock(AccessService::class.java)
        val capabilities = mock(PublishedOfferingCapabilityService::class.java)
        val entitlements = mock(ServiceEntitlementRepository::class.java)
        val settings = mock(ServiceExpiryReminderSettingsRepository::class.java)
        val reminders = mock(ServiceExpiryReminderRepository::class.java)
        val memberships = mock(MembershipRepository::class.java)
        val notifications = mock(NotificationService::class.java)
        val audits = mock(AuditLogRepository::class.java)
        val organizationId = UUID.randomUUID()
        val parentId = UUID.randomUUID()
        val staffAdminId = UUID.randomUUID()
        val entitlement = ServiceEntitlement(
            organizationId = organizationId,
            ownerUserId = parentId,
            planName = "Paket Bulanan",
            status = EntitlementStatus.ACTIVE,
            validUntil = LocalDate.now(ZoneId.of("Asia/Jakarta")).plusDays(3),
        )
        `when`(entitlements.findAll()).thenReturn(listOf(entitlement))
        `when`(capabilities.hasPublishedCapability(organizationId, InstitutionCapability.DAYCARE_OPERATIONS, entitlement.branchId)).thenReturn(true)
        `when`(settings.findById(organizationId)).thenReturn(Optional.empty())
        `when`(reminders.existsByEntitlementIdAndLeadDays(entitlement.id, 3)).thenReturn(false, true)
        `when`(reminders.save(any(ServiceExpiryReminder::class.java))).thenAnswer { it.arguments[0] }
        `when`(memberships.findAllByOrganizationId(organizationId)).thenReturn(listOf(Membership(userId = staffAdminId, organizationId = organizationId, role = Role.STAFF_ADMIN, active = true)))
        val service = ServiceExpiryReminderService(access, capabilities, entitlements, settings, reminders, memberships, notifications, audits)

        service.sendDueReminders()
        service.sendDueReminders()

        val body = "Layanan Paket Bulanan berakhir pada ${entitlement.validUntil}."
        verify(reminders, times(1)).save(any(ServiceExpiryReminder::class.java))
        verify(notifications, times(1)).notify(organizationId, parentId, "Masa layanan akan berakhir", body, "/payment-history", setOf(com.daycare.api.realtime.RealtimeFlag.ENTITLEMENTS))
        verify(notifications, times(1)).notify(organizationId, staffAdminId, "Masa layanan Parent akan berakhir", body, "/billing-admin", setOf(com.daycare.api.realtime.RealtimeFlag.ENTITLEMENTS))
    }
}
