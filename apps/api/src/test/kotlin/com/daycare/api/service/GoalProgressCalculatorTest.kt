package com.daycare.api.service

import com.daycare.api.domain.GoalCheckInOutcome
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Test
import java.time.LocalDate

class GoalProgressCalculatorTest {
    @Test
    fun `missing dates do not lower percentage but break the daily yes streak`() {
        val progress = GoalProgressCalculator.calculate(
            listOf(
                GoalCheckInValue(LocalDate.of(2026, 7, 1), GoalCheckInOutcome.YES),
                GoalCheckInValue(LocalDate.of(2026, 7, 2), GoalCheckInOutcome.YES),
                GoalCheckInValue(LocalDate.of(2026, 7, 4), GoalCheckInOutcome.YES),
            ),
        )

        assertEquals(3, progress.recordedDays)
        assertEquals(3, progress.yesDays)
        assertEquals(0, progress.noDays)
        assertEquals(100, progress.yesPercent)
        assertEquals(1, progress.currentYesStreak)
        assertEquals(2, progress.longestYesStreak)
    }

    @Test
    fun `empty progress has no percentage and no streak`() {
        val progress = GoalProgressCalculator.calculate(emptyList())

        assertEquals(0, progress.recordedDays)
        assertNull(progress.yesPercent)
        assertEquals(0, progress.currentYesStreak)
        assertEquals(0, progress.longestYesStreak)
    }
}
