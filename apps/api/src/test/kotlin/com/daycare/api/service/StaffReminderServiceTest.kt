package com.daycare.api.service

import com.daycare.api.domain.InstitutionCapability
import com.daycare.api.domain.Role
import com.daycare.api.persistence.Membership
import com.daycare.api.persistence.StaffReminderDeviceScheduleRepository
import com.daycare.api.persistence.StaffReminderRepository
import com.daycare.api.persistence.DeviceTokenRepository
import com.daycare.api.persistence.DeviceToken
import com.daycare.api.persistence.StaffReminderDeviceSchedule
import com.daycare.api.persistence.UserProfile
import com.daycare.api.realtime.RealtimePublisher
import com.daycare.api.persistence.StaffReminder
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.mockito.Mockito.any
import org.mockito.Mockito.mock
import org.mockito.Mockito.verify
import org.mockito.Mockito.`when`
import org.springframework.security.oauth2.jwt.Jwt
import java.util.Optional
import java.util.UUID
import java.time.ZonedDateTime
import java.time.ZoneId

class StaffReminderServiceTest {
    @Test
    fun `fallback only sends active reminder at matching local weekday and time`() {
        val mondayAtNine = ZonedDateTime.parse("2026-10-05T09:00:00+07:00[Asia/Jakarta]")
        val reminder = StaffReminder(hour = 9, minute = 0, weekdays = "1,3")

        assertTrue(shouldSendReminderFallback(reminder, mondayAtNine, locallyScheduled = false))
        assertFalse(shouldSendReminderFallback(reminder, mondayAtNine.plusMinutes(1), locallyScheduled = false))
        assertFalse(shouldSendReminderFallback(reminder, mondayAtNine, locallyScheduled = true))
        reminder.active = false
        assertFalse(shouldSendReminderFallback(reminder, mondayAtNine, locallyScheduled = false))
        reminder.active = true
        reminder.weekdays = "2"
        assertFalse(shouldSendReminderFallback(reminder, mondayAtNine, locallyScheduled = false))
    }

    @Test
    fun `staff reminder CRUD validates target and publishes changes`() {
        val fixture = fixture()
        `when`(fixture.reminders.save(any(StaffReminder::class.java))).thenAnswer { it.arguments[0] }
        val created = fixture.service.create(fixture.jwt, fixture.organizationId, UpsertStaffReminderRequest("  Check  ", "  Kehadiran  ", 9, 15, listOf(3, 1, 3), "ATTENDANCE"))
        assertEquals("Check", created.title)
        assertEquals(listOf(1, 3), created.weekdays)
        val reminder = StaffReminder(id = created.id, organizationId = fixture.organizationId, userId = fixture.staff.id, title = "Old", description = "Old", targetCode = "HOME")
        `when`(fixture.reminders.findById(created.id)).thenReturn(Optional.of(reminder))
        val updated = fixture.service.update(fixture.jwt, fixture.organizationId, created.id, UpsertStaffReminderRequest("New", "Desc", 10, 0, listOf(2), "HOME"))
        assertEquals("New", updated.title)
        assertEquals(2, updated.ruleVersion)
        val inactive = fixture.service.setActive(fixture.jwt, fixture.organizationId, created.id, UpdateStaffReminderActiveRequest(false))
        assertFalse(inactive.active)
        fixture.service.delete(fixture.jwt, fixture.organizationId, created.id)
        verify(fixture.reminders).delete(reminder)
        assertThrows(IllegalArgumentException::class.java) { fixture.service.create(fixture.jwt, fixture.organizationId, UpsertStaffReminderRequest("x", "x", 1, 1, listOf(1), "UNKNOWN")) }
        assertThrows(IllegalArgumentException::class.java) { fixture.service.create(fixture.jwt, fixture.organizationId, UpsertStaffReminderRequest("x", "x", 1, 1, emptyList(), "HOME")) }
    }

    @Test
    fun `staff schedules sync only matching versions and fallback push respects local schedule`() {
        val fixture = fixture()
        val now = ZonedDateTime.now(ZoneId.of("Asia/Jakarta"))
        val reminder = StaffReminder(id = UUID.randomUUID(), organizationId = fixture.organizationId, userId = fixture.staff.id, hour = now.hour, minute = now.minute, weekdays = now.dayOfWeek.value.toString())
        val device = DeviceToken(organizationId = fixture.organizationId, userId = fixture.staff.id, token = "token", platform = "android", installationId = "install", timeZone = "Asia/Jakarta")
        `when`(fixture.reminders.findById(reminder.id)).thenReturn(Optional.of(reminder))
        `when`(fixture.devices.findByInstallationId("install")).thenReturn(device)
        `when`(fixture.schedules.findByReminderIdAndInstallationId(reminder.id, "install")).thenReturn(null)
        fixture.service.syncLocalSchedules(fixture.jwt, fixture.organizationId, SyncStaffReminderSchedulesRequest("install", listOf(StaffReminderScheduleAcknowledgement(reminder.id, reminder.ruleVersion, scheduled = true))))
        verify(fixture.schedules).save(any(StaffReminderDeviceSchedule::class.java))

        `when`(fixture.reminders.findAllByActiveTrue()).thenReturn(listOf(reminder))
        `when`(fixture.devices.findAllByUserIdIn(setOf(fixture.staff.id))).thenReturn(listOf(device))
        `when`(fixture.schedules.findAllByReminderIdIn(setOf(reminder.id))).thenReturn(emptyList())
        fixture.service.sendFallbackPushes()
        verify(fixture.notifications).sendPush(device, fixture.organizationId, reminder.title, reminder.description, reminder.actionPath)
    }

    @Test
    fun `booking approvals target requires daycare capability`() {
        val fixture = fixture()
        val academicOnly = fixture.scope.copy(capabilities = setOf(InstitutionCapability.ACADEMIC_CURRICULUM))
        `when`(fixture.access.require(fixture.jwt, fixture.organizationId, setOf(Role.STAFF))).thenReturn(academicOnly)
        assertThrows(IllegalArgumentException::class.java) {
            fixture.service.create(fixture.jwt, fixture.organizationId, UpsertStaffReminderRequest("x", "x", 1, 1, listOf(1), "BOOKING_APPROVALS"))
        }
    }

    @Test
    fun `reminder list and activation avoid unnecessary revisions`() {
        val fixture = fixture()
        val reminder = StaffReminder(organizationId = fixture.organizationId, userId = fixture.staff.id, title = "A", description = "B", weekdays = "1,garbage,8,2")
        `when`(fixture.reminders.findAllByOrganizationIdAndUserIdOrderByCreatedAtDesc(fixture.organizationId, fixture.staff.id)).thenReturn(listOf(reminder))
        assertEquals(listOf(1, 2), fixture.service.list(fixture.jwt, fixture.organizationId).single().weekdays)
        `when`(fixture.reminders.findById(reminder.id)).thenReturn(Optional.of(reminder))
        fixture.service.setActive(fixture.jwt, fixture.organizationId, reminder.id, UpdateStaffReminderActiveRequest(true))
        assertEquals(1, reminder.ruleVersion)
        fixture.service.setActive(fixture.jwt, fixture.organizationId, reminder.id, UpdateStaffReminderActiveRequest(false))
        assertEquals(2, reminder.ruleVersion)
    }

    @Test
    fun `schedule sync removes stale acknowledgements and rejects foreign devices`() {
        val fixture = fixture()
        val reminder = StaffReminder(id = UUID.randomUUID(), organizationId = fixture.organizationId, userId = fixture.staff.id, ruleVersion = 3)
        val device = DeviceToken(organizationId = fixture.organizationId, userId = fixture.staff.id, installationId = "install", token = "token", platform = "android")
        val existing = StaffReminderDeviceSchedule(reminderId = reminder.id, installationId = "install", ruleVersion = 2)
        `when`(fixture.devices.findByInstallationId("install")).thenReturn(device)
        `when`(fixture.reminders.findById(reminder.id)).thenReturn(Optional.of(reminder))
        `when`(fixture.schedules.findByReminderIdAndInstallationId(reminder.id, "install")).thenReturn(existing)
        fixture.service.syncLocalSchedules(fixture.jwt, fixture.organizationId, SyncStaffReminderSchedulesRequest("install", listOf(StaffReminderScheduleAcknowledgement(reminder.id, 2, scheduled = true))))
        verify(fixture.schedules).delete(existing)
        fixture.service.syncLocalSchedules(fixture.jwt, fixture.organizationId, SyncStaffReminderSchedulesRequest("install", listOf(StaffReminderScheduleAcknowledgement(reminder.id, 3, scheduled = false))))
        assertThrows(IllegalArgumentException::class.java) {
            fixture.service.syncLocalSchedules(fixture.jwt, fixture.organizationId, SyncStaffReminderSchedulesRequest("missing", emptyList()))
        }
    }

    @Test
    fun `fallback push skips empty, foreign, scheduled and malformed timezone devices`() {
        val fixture = fixture()
        fixture.service.sendFallbackPushes()
        val now = ZonedDateTime.now(ZoneId.of("Asia/Jakarta"))
        val reminder = StaffReminder(id = UUID.randomUUID(), organizationId = fixture.organizationId, userId = fixture.staff.id, hour = now.hour, minute = now.minute, weekdays = now.dayOfWeek.value.toString())
        val foreign = DeviceToken(organizationId = UUID.randomUUID(), userId = fixture.staff.id, token = "foreign", platform = "android", installationId = "f", timeZone = "bad")
        val malformed = DeviceToken(organizationId = fixture.organizationId, userId = fixture.staff.id, token = "local", platform = "android", installationId = "local", timeZone = "bad")
        `when`(fixture.reminders.findAllByActiveTrue()).thenReturn(listOf(reminder))
        `when`(fixture.devices.findAllByUserIdIn(setOf(fixture.staff.id))).thenReturn(listOf(foreign, malformed))
        `when`(fixture.schedules.findAllByReminderIdIn(setOf(reminder.id))).thenReturn(listOf(StaffReminderDeviceSchedule(reminderId = reminder.id, installationId = "local", ruleVersion = reminder.ruleVersion)))
        fixture.service.sendFallbackPushes()
        org.mockito.Mockito.verifyNoInteractions(fixture.notifications)
    }

    private data class Fixture(
        val organizationId: UUID,
        val jwt: Jwt,
        val staff: UserProfile,
        val access: AccessService,
        val reminders: StaffReminderRepository,
        val schedules: StaffReminderDeviceScheduleRepository,
        val devices: DeviceTokenRepository,
        val notifications: NotificationService,
        val scope: AccessScope,
        val service: StaffReminderService,
    )

    private fun fixture(): Fixture {
        val organizationId = UUID.randomUUID()
        val jwt = mock(Jwt::class.java)
        val staff = UserProfile(displayName = "Staff")
        val access = mock(AccessService::class.java)
        val reminders = mock(StaffReminderRepository::class.java)
        val schedules = mock(StaffReminderDeviceScheduleRepository::class.java)
        val devices = mock(DeviceTokenRepository::class.java)
        val notifications = mock(NotificationService::class.java)
        val realtime = mock(RealtimePublisher::class.java)
        val scope = AccessScope(staff, Membership(organizationId = organizationId, role = Role.STAFF, active = true), setOf("DAYCARE"), setOf(InstitutionCapability.DAYCARE_OPERATIONS))
        `when`(access.require(jwt, organizationId, setOf(Role.STAFF))).thenReturn(scope)
        `when`(access.require(jwt, organizationId, setOf(Role.STAFF), readOnly = true)).thenReturn(scope)
        return Fixture(organizationId, jwt, staff, access, reminders, schedules, devices, notifications, scope, StaffReminderService(access, reminders, schedules, devices, notifications, realtime))
    }
}
