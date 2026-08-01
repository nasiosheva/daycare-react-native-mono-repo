package com.daycare.api.service

import com.daycare.api.domain.ChildEnrollmentStatus
import com.daycare.api.domain.GoalCheckInOutcome
import com.daycare.api.domain.Role
import com.daycare.api.persistence.BranchCapacitySettingRepository
import com.daycare.api.persistence.BranchRepository
import com.daycare.api.persistence.ChildGoalCheckInRepository
import com.daycare.api.persistence.ChildGoalRepository
import com.daycare.api.persistence.ChildRepository
import com.daycare.api.persistence.DevelopmentProgramItemRepository
import com.daycare.api.persistence.DevelopmentProgramRepository
import com.daycare.api.persistence.MembershipRepository
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.YearMonth
import java.time.ZoneOffset
import java.util.UUID

data class BranchOccupancyResponse(val branchId: UUID, val branchName: String, val activeChildrenCount: Int, val dailyCapacity: Int?)
data class MonthlyParentAttritionResponse(val month: String, val deactivatedCount: Int)
data class ParentRetentionResponse(val currentActiveParents: Int, val monthly: List<MonthlyParentAttritionResponse>)
data class MonthlyDevelopmentTrendResponse(val month: String, val goalCount: Int, val averageYesPercent: Int?)

@Service
class AnalyticsService(
    private val access: AccessService,
    private val children: ChildRepository,
    private val branches: BranchRepository,
    private val branchCapacities: BranchCapacitySettingRepository,
    private val memberships: MembershipRepository,
    private val goals: ChildGoalRepository,
    private val goalPrograms: DevelopmentProgramRepository,
    private val goalIndicators: DevelopmentProgramItemRepository,
    private val goalCheckIns: ChildGoalCheckInRepository,
) {
    @Transactional(readOnly = true)
    fun occupancy(jwt: Jwt, organizationId: UUID): List<BranchOccupancyResponse> {
        access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN), readOnly = true)
        val activeChildren = children.findAllByOrganizationId(organizationId).filter { it.active && it.enrollmentStatus == ChildEnrollmentStatus.ACTIVE }
        val capacities = branchCapacities.findAllByOrganizationId(organizationId).associateBy { it.branchId }
        return branches.findAllByOrganizationIdAndActiveTrueOrderByNameAsc(organizationId).map { branch ->
            BranchOccupancyResponse(branch.id, branch.name, activeChildren.count { it.branchId == branch.id }, capacities[branch.id]?.dailyCapacity)
        }
    }

    @Transactional(readOnly = true)
    fun parentRetention(jwt: Jwt, organizationId: UUID, monthsBack: Int = 6): ParentRetentionResponse {
        access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN), readOnly = true)
        val parentMemberships = memberships.findAllByOrganizationId(organizationId).filter { it.role == Role.PARENT }
        val currentActive = parentMemberships.count { it.active }
        val months = recentMonths(monthsBack)
        val monthly = months.map { month ->
            val deactivatedCount = parentMemberships.count { membership ->
                membership.deactivatedAt?.let { YearMonth.from(it.atZone(ZoneOffset.UTC)) == month } == true
            }
            MonthlyParentAttritionResponse(month.toString(), deactivatedCount)
        }
        return ParentRetentionResponse(currentActive, monthly)
    }

    @Transactional(readOnly = true)
    fun developmentTrend(jwt: Jwt, organizationId: UUID, monthsBack: Int = 6): List<MonthlyDevelopmentTrendResponse> {
        access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN), readOnly = true)
        val tenantGoals = goals.findAllByOrganizationId(organizationId)
        val programsById = goalPrograms.findAllByOrganizationIdOrderByCreatedAtDesc(organizationId).associateBy { it.id } +
            goalPrograms.findAllByOrganizationIdIsNullOrderByCreatedAtDesc().associateBy { it.id }
        val indicatorsByProgram = goalIndicators.findAllByDevelopmentProgramIdIn(programsById.keys).groupBy { it.developmentProgramId }
        val checkInsByGoal = goalCheckIns.findAllByChildGoalIdIn(tenantGoals.map { it.id }).groupBy { it.childGoalId }
        val months = recentMonths(monthsBack)
        return months.map { month ->
            val monthGoals = tenantGoals.filter { YearMonth.from(it.startsOn) == month }
            val percents = monthGoals.mapNotNull { goal ->
                val activeIndicators = indicatorsByProgram[goal.programId]?.filter { it.active } ?: return@mapNotNull null
                if (activeIndicators.isEmpty()) return@mapNotNull null
                val items = checkInsByGoal[goal.id] ?: emptyList()
                val dailyOutcomes = items.groupBy { it.checkInDate }.mapNotNull { (_, dayCheckIns) ->
                    val byIndicator = dayCheckIns.associateBy { it.indicatorId }
                    if (!activeIndicators.all { byIndicator.containsKey(it.id) }) return@mapNotNull null
                    activeIndicators.all { byIndicator[it.id]?.outcome == GoalCheckInOutcome.YES }
                }
                if (dailyOutcomes.isEmpty()) return@mapNotNull null
                dailyOutcomes.count { it } * 100 / dailyOutcomes.size
            }
            MonthlyDevelopmentTrendResponse(month.toString(), monthGoals.size, if (percents.isEmpty()) null else percents.sum() / percents.size)
        }
    }

    private fun recentMonths(monthsBack: Int): List<YearMonth> {
        val current = YearMonth.now()
        return (0 until monthsBack.coerceIn(1, 24)).map { current.minusMonths(it.toLong()) }.reversed()
    }
}
