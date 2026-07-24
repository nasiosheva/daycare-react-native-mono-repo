package com.daycare.api.service

import com.daycare.api.domain.Role
import com.daycare.api.domain.InstitutionCapability
import com.daycare.api.persistence.DeviceTokenRepository
import com.daycare.api.persistence.StaffReminder
import com.daycare.api.persistence.StaffReminderDeviceSchedule
import com.daycare.api.persistence.StaffReminderDeviceScheduleRepository
import com.daycare.api.persistence.StaffReminderRepository
import com.daycare.api.realtime.RealtimeFlag
import com.daycare.api.realtime.RealtimePublisher
import jakarta.validation.constraints.Max
import jakarta.validation.constraints.Min
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.Size
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Instant
import java.time.ZoneId
import java.time.ZonedDateTime
import java.util.UUID

private val reminderTargets = mapOf(
    "HOME" to "/home",
    "ATTENDANCE" to "/attendance",
    "DEVELOPMENT" to "/development",
    "CHILDREN" to "/children",
    "BOOKING_APPROVALS" to "/booking-approvals",
)

data class UpsertStaffReminderRequest(
    @field:NotBlank @field:Size(max = 200) val title: String,
    @field:NotBlank @field:Size(max = 1_000) val description: String,
    @field:Min(0) @field:Max(23) val hour: Int,
    @field:Min(0) @field:Max(59) val minute: Int,
    val weekdays: List<@Min(1) @Max(7) Int>,
    @field:NotBlank val target: String,
)
data class UpdateStaffReminderActiveRequest(val active: Boolean)
data class StaffReminderScheduleAcknowledgement(val reminderId: UUID, @field:Min(1) val ruleVersion: Int, val scheduled: Boolean)
data class SyncStaffReminderSchedulesRequest(@field:NotBlank @field:Size(max = 128) val installationId: String, val schedules: List<StaffReminderScheduleAcknowledgement>)
data class StaffReminderResponse(val id: UUID, val title: String, val description: String, val hour: Int, val minute: Int, val weekdays: List<Int>, val target: String, val active: Boolean, val ruleVersion: Int)

@Service
class StaffReminderService(
    private val access: AccessService,
    private val reminders: StaffReminderRepository,
    private val deviceSchedules: StaffReminderDeviceScheduleRepository,
    private val deviceTokens: DeviceTokenRepository,
    private val notifications: NotificationService,
    private val realtime: RealtimePublisher,
) {
    @Transactional(readOnly = true)
    fun list(jwt: Jwt, organizationId: UUID): List<StaffReminderResponse> {
        val scope = access.require(jwt, organizationId, setOf(Role.STAFF), readOnly = true)
        return reminders.findAllByOrganizationIdAndUserIdOrderByCreatedAtDesc(organizationId, scope.user.id).map(::response)
    }

    @Transactional
    fun create(jwt: Jwt, organizationId: UUID, request: UpsertStaffReminderRequest): StaffReminderResponse {
        val scope = access.require(jwt, organizationId, setOf(Role.STAFF)); access.requireWritable(scope)
        val data = validated(request, scope.capabilities)
        val reminder = reminders.save(StaffReminder(organizationId = organizationId, userId = scope.user.id, title = data.title, description = data.description, hour = data.hour, minute = data.minute, weekdays = data.weekdays, targetCode = data.target, actionPath = data.actionPath))
        publish(reminder)
        return response(reminder)
    }

    @Transactional
    fun update(jwt: Jwt, organizationId: UUID, reminderId: UUID, request: UpsertStaffReminderRequest): StaffReminderResponse {
        val scope = access.require(jwt, organizationId, setOf(Role.STAFF)); access.requireWritable(scope)
        val data = validated(request, scope.capabilities)
        val reminder = owned(reminderId, organizationId, scope.user.id)
        reminder.title = data.title; reminder.description = data.description; reminder.hour = data.hour; reminder.minute = data.minute; reminder.weekdays = data.weekdays; reminder.targetCode = data.target; reminder.actionPath = data.actionPath; reminder.ruleVersion += 1; reminder.updatedAt = Instant.now()
        publish(reminder)
        return response(reminder)
    }

    @Transactional
    fun setActive(jwt: Jwt, organizationId: UUID, reminderId: UUID, request: UpdateStaffReminderActiveRequest): StaffReminderResponse {
        val scope = access.require(jwt, organizationId, setOf(Role.STAFF)); access.requireWritable(scope)
        val reminder = owned(reminderId, organizationId, scope.user.id)
        if (reminder.active != request.active) { reminder.active = request.active; reminder.ruleVersion += 1; reminder.updatedAt = Instant.now() }
        publish(reminder)
        return response(reminder)
    }

    @Transactional
    fun delete(jwt: Jwt, organizationId: UUID, reminderId: UUID) {
        val scope = access.require(jwt, organizationId, setOf(Role.STAFF)); access.requireWritable(scope)
        reminders.delete(owned(reminderId, organizationId, scope.user.id))
        realtime.publishToUser(organizationId, scope.user.id, setOf(RealtimeFlag.STAFF_REMINDERS))
    }

    @Transactional
    fun syncLocalSchedules(jwt: Jwt, organizationId: UUID, request: SyncStaffReminderSchedulesRequest) {
        val scope = access.require(jwt, organizationId, setOf(Role.STAFF)); access.requireWritable(scope)
        val device = deviceTokens.findByInstallationId(request.installationId)
        require(device != null && device.organizationId == organizationId && device.userId == scope.user.id) { "Device installation is not available" }
        request.schedules.forEach { acknowledgement ->
            val reminder = owned(acknowledgement.reminderId, organizationId, scope.user.id)
            val existing = deviceSchedules.findByReminderIdAndInstallationId(reminder.id, request.installationId)
            if (acknowledgement.scheduled && acknowledgement.ruleVersion == reminder.ruleVersion) {
                val schedule = existing ?: StaffReminderDeviceSchedule(reminderId = reminder.id, installationId = request.installationId)
                schedule.ruleVersion = reminder.ruleVersion; schedule.scheduledAt = Instant.now(); deviceSchedules.save(schedule)
            } else if (existing != null) deviceSchedules.delete(existing)
        }
    }

    @Scheduled(cron = "0 * * * * *")
    @Transactional(readOnly = true)
    fun sendFallbackPushes() {
        reminders.findAllByActiveTrue().forEach { reminder ->
            deviceTokens.findAllByUserIdAndOrganizationId(reminder.userId, reminder.organizationId).forEach { device ->
                val localTime = runCatching { ZonedDateTime.now(ZoneId.of(device.timeZone ?: "UTC")) }.getOrElse { ZonedDateTime.now(ZoneId.of("UTC")) }
                val locallyScheduled = device.installationId?.let { installationId -> deviceSchedules.findByReminderIdAndInstallationId(reminder.id, installationId)?.ruleVersion == reminder.ruleVersion } ?: false
                if (shouldSendReminderFallback(reminder, localTime, locallyScheduled)) notifications.sendPush(device, reminder.organizationId, reminder.title, reminder.description, reminder.actionPath)
            }
        }
    }

    private fun owned(id: UUID, organizationId: UUID, userId: UUID) = reminders.findById(id).orElseThrow { IllegalArgumentException("Reminder was not found") }.also { require(it.organizationId == organizationId && it.userId == userId) { "Reminder is not available" } }
    private fun validated(request: UpsertStaffReminderRequest, capabilities: Set<InstitutionCapability>): ValidReminder {
        val target = reminderTargets[request.target] ?: throw IllegalArgumentException("Reminder target is not available")
        require(request.target != "BOOKING_APPROVALS" || InstitutionCapability.DAYCARE_OPERATIONS in capabilities) { "Booking approvals are not enabled for this institution" }
        val weekdays = request.weekdays.distinct().sorted()
        require(weekdays.isNotEmpty() && weekdays.all { it in 1..7 }) { "Select at least one repeat day" }
        return ValidReminder(request.title.trim(), request.description.trim(), request.hour, request.minute, weekdays.joinToString(","), request.target, target)
    }
    private fun response(reminder: StaffReminder) = StaffReminderResponse(reminder.id, reminder.title, reminder.description, reminder.hour, reminder.minute, reminder.weekdaySet().sorted(), reminder.targetCode, reminder.active, reminder.ruleVersion)
    private fun publish(reminder: StaffReminder) = realtime.publishToUser(reminder.organizationId, reminder.userId, setOf(RealtimeFlag.STAFF_REMINDERS))
}

private data class ValidReminder(val title: String, val description: String, val hour: Int, val minute: Int, val weekdays: String, val target: String, val actionPath: String)
private fun StaffReminder.weekdaySet(): Set<Int> = weekdays.split(",").mapNotNull { it.toIntOrNull()?.takeIf { day -> day in 1..7 } }.toSet()
internal fun shouldSendReminderFallback(reminder: StaffReminder, localTime: ZonedDateTime, locallyScheduled: Boolean): Boolean = reminder.active && !locallyScheduled && localTime.hour == reminder.hour && localTime.minute == reminder.minute && localTime.dayOfWeek.value in reminder.weekdaySet()
