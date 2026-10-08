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
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertThrows
import org.mockito.Mockito.any
import org.mockito.Mockito.mock
import org.mockito.Mockito.never
import org.mockito.Mockito.times
import org.mockito.Mockito.verify
import org.mockito.Mockito.verifyNoInteractions
import org.mockito.Mockito.`when`
import org.springframework.security.oauth2.jwt.Jwt
import java.time.LocalDate
import java.time.ZoneId
import java.util.Optional
import java.util.UUID

class ServiceExpiryReminderServiceTest {
    @Test
    fun `settings normalize configured lead days and reject out of range values`() {
        val access = mock(AccessService::class.java)
        val capabilities = mock(PublishedOfferingCapabilityService::class.java)
        val entitlements = mock(ServiceEntitlementRepository::class.java)
        val settings = mock(ServiceExpiryReminderSettingsRepository::class.java)
        val reminders = mock(ServiceExpiryReminderRepository::class.java)
        val memberships = mock(MembershipRepository::class.java)
        val notifications = mock(NotificationService::class.java)
        val audits = mock(AuditLogRepository::class.java)
        val org = UUID.randomUUID(); val jwt = mock(Jwt::class.java)
        val staff = com.daycare.api.persistence.UserProfile()
        val scope = AccessScope(staff, Membership(role = Role.STAFF_ADMIN), emptySet(), setOf(InstitutionCapability.DAYCARE_OPERATIONS))
        `when`(access.require(jwt, org, setOf(Role.STAFF_ADMIN), InstitutionCapability.DAYCARE_OPERATIONS, readOnly = true)).thenReturn(scope)
        `when`(access.require(jwt, org, setOf(Role.STAFF_ADMIN), InstitutionCapability.DAYCARE_OPERATIONS)).thenReturn(scope)
        `when`(settings.findById(org)).thenReturn(Optional.empty())
        val service = ServiceExpiryReminderService(access, capabilities, entitlements, settings, reminders, memberships, notifications, audits)
        assertEquals(listOf(7, 3, 1), service.settings(jwt, org).leadDays)
        assertEquals(listOf(30, 3, 1), service.updateSettings(jwt, org, UpdateServiceExpiryReminderSettingsRequest(listOf(1, 30, 3, 3))).leadDays)
        assertThrows(IllegalArgumentException::class.java) { service.updateSettings(jwt, org, UpdateServiceExpiryReminderSettingsRequest(listOf(0))) }
    }

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

    @Test
    fun `scheduled reminder skips expired unpublished and already recorded entitlements`() {
        val access = mock(AccessService::class.java)
        val capabilities = mock(PublishedOfferingCapabilityService::class.java)
        val entitlements = mock(ServiceEntitlementRepository::class.java)
        val settings = mock(ServiceExpiryReminderSettingsRepository::class.java)
        val reminders = mock(ServiceExpiryReminderRepository::class.java)
        val memberships = mock(MembershipRepository::class.java)
        val notifications = mock(NotificationService::class.java)
        val audits = mock(AuditLogRepository::class.java)
        val org = UUID.randomUUID()
        val expired = ServiceEntitlement(organizationId = org, status = EntitlementStatus.ACTIVE, validUntil = LocalDate.now(ZoneId.of("Asia/Jakarta")).minusDays(1))
        val unpublished = ServiceEntitlement(organizationId = org, status = EntitlementStatus.ACTIVE, validUntil = LocalDate.now(ZoneId.of("Asia/Jakarta")).plusDays(3))
        `when`(entitlements.findAll()).thenReturn(listOf(expired, unpublished))
        `when`(capabilities.hasPublishedCapability(org, InstitutionCapability.DAYCARE_OPERATIONS, unpublished.branchId)).thenReturn(false)
        val service = ServiceExpiryReminderService(access, capabilities, entitlements, settings, reminders, memberships, notifications, audits)
        service.sendDueReminders()
        verify(reminders, never()).save(any(ServiceExpiryReminder::class.java))
        verifyNoInteractions(notifications)
    }
}
