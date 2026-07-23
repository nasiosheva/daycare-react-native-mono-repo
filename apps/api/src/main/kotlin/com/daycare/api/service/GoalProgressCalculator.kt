package com.daycare.api.service

import com.daycare.api.domain.GoalCheckInOutcome
import java.time.LocalDate
import java.time.temporal.ChronoUnit

data class GoalCheckInValue(val date: LocalDate, val outcome: GoalCheckInOutcome)

data class GoalProgressMetrics(
    val recordedDays: Int,
    val yesDays: Int,
    val noDays: Int,
    val yesPercent: Int?,
    val currentYesStreak: Int,
    val longestYesStreak: Int,
)

object GoalProgressCalculator {
    /** A missing day is excluded from the percentage, but it breaks a daily Yes streak. */
    fun calculate(checkIns: List<GoalCheckInValue>): GoalProgressMetrics {
        val ordered = checkIns.sortedBy(GoalCheckInValue::date)
        val yesDays = ordered.count { it.outcome == GoalCheckInOutcome.YES }
        var currentYesStreak = 0
        var longestYesStreak = 0
        var previousDate: LocalDate? = null

        ordered.forEach { checkIn ->
            val consecutive = previousDate?.let { ChronoUnit.DAYS.between(it, checkIn.date) == 1L } == true
            currentYesStreak = when {
                checkIn.outcome != GoalCheckInOutcome.YES -> 0
                consecutive -> currentYesStreak + 1
                else -> 1
            }
            longestYesStreak = maxOf(longestYesStreak, currentYesStreak)
            previousDate = checkIn.date
        }

        return GoalProgressMetrics(
            recordedDays = ordered.size,
            yesDays = yesDays,
            noDays = ordered.size - yesDays,
            yesPercent = ordered.takeIf { it.isNotEmpty() }?.let { yesDays * 100 / it.size },
            currentYesStreak = currentYesStreak,
            longestYesStreak = longestYesStreak,
        )
    }
}
