package com.daycare.api.service

import com.daycare.api.persistence.StaffReminder
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import java.time.ZoneId
import java.time.ZonedDateTime

class StaffReminderFallbackTest {
    private val reminder = StaffReminder(hour = 17, minute = 0, weekdays = "1,2,3,4,5")
    private val mondayAtFive = ZonedDateTime.of(2026, 7, 20, 17, 0, 0, 0, ZoneId.of("Asia/Jakarta"))

    @Test
    fun `fallback sends only when a matching local schedule is not acknowledged`() {
        assertTrue(shouldSendReminderFallback(reminder, mondayAtFive, locallyScheduled = false))
        assertFalse(shouldSendReminderFallback(reminder, mondayAtFive, locallyScheduled = true))
    }

    @Test
    fun `fallback skips inactive reminder and non matching local time`() {
        reminder.active = false
        assertFalse(shouldSendReminderFallback(reminder, mondayAtFive, locallyScheduled = false))
        reminder.active = true
        assertFalse(shouldSendReminderFallback(reminder, mondayAtFive.plusMinutes(1), locallyScheduled = false))
        assertFalse(shouldSendReminderFallback(reminder, mondayAtFive.plusDays(5), locallyScheduled = false))
    }
}
