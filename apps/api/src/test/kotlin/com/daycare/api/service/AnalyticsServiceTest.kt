package com.daycare.api.service

import com.daycare.api.domain.ChildEnrollmentStatus
import com.daycare.api.domain.GoalCheckInOutcome
import com.daycare.api.domain.GoalDomain
import com.daycare.api.domain.Role
import com.daycare.api.persistence.Branch
import com.daycare.api.persistence.BranchCapacitySetting
import com.daycare.api.persistence.BranchCapacitySettingRepository
import com.daycare.api.persistence.BranchRepository
import com.daycare.api.persistence.Child
import com.daycare.api.persistence.ChildGoal
import com.daycare.api.persistence.ChildGoalCheckIn
import com.daycare.api.persistence.ChildGoalCheckInRepository
import com.daycare.api.persistence.ChildGoalRepository
import com.daycare.api.persistence.ChildRepository
import com.daycare.api.persistence.DevelopmentProgram
import com.daycare.api.persistence.DevelopmentProgramItem
import com.daycare.api.persistence.DevelopmentProgramItemRepository
import com.daycare.api.persistence.DevelopmentProgramRepository
import com.daycare.api.persistence.Membership
import com.daycare.api.persistence.MembershipRepository
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Test
import org.mockito.Mockito.mock
import org.mockito.Mockito.`when`
import org.springframework.security.oauth2.jwt.Jwt
import java.time.Instant
import java.time.LocalDate
import java.time.YearMonth
import java.time.ZoneOffset
import java.util.UUID

class AnalyticsServiceTest {
    @Test
    fun `occupancy counts only active enrolled children and includes capacity`() {
        val fixture = fixture()
        val branch = Branch(organizationId = fixture.organizationId, name = "Cabang A")
        val inactiveBranch = Branch(organizationId = fixture.organizationId, name = "Cabang B", active = false)
        val active = Child(organizationId = fixture.organizationId, branchId = branch.id, enrollmentStatus = ChildEnrollmentStatus.ACTIVE, active = true)
        val inactive = Child(organizationId = fixture.organizationId, branchId = branch.id, enrollmentStatus = ChildEnrollmentStatus.ACTIVE, active = false)
        val withdrawn = Child(organizationId = fixture.organizationId, branchId = branch.id, enrollmentStatus = ChildEnrollmentStatus.TRANSFERRED, active = true)
        `when`(fixture.branches.findAllByOrganizationIdAndActiveTrueOrderByNameAsc(fixture.organizationId)).thenReturn(listOf(branch))
        `when`(fixture.children.findAllByOrganizationId(fixture.organizationId)).thenReturn(listOf(active, inactive, withdrawn))
        `when`(fixture.capacities.findAllByOrganizationId(fixture.organizationId)).thenReturn(listOf(BranchCapacitySetting(organizationId = fixture.organizationId, branchId = branch.id, dailyCapacity = 12)))

        val result = fixture.service.occupancy(fixture.jwt, fixture.organizationId)

        assertEquals(listOf(BranchOccupancyResponse(branch.id, "Cabang A", 1, 12)), result)
        assertEquals(inactiveBranch.active, false)
    }

    @Test
    fun `parent retention reports active count and deactivations by month`() {
        val fixture = fixture()
        val thisMonth = YearMonth.now().atDay(2).atStartOfDay().toInstant(ZoneOffset.UTC)
        val lastMonth = YearMonth.now().minusMonths(1).atDay(2).atStartOfDay().toInstant(ZoneOffset.UTC)
        `when`(fixture.memberships.findAllByOrganizationId(fixture.organizationId)).thenReturn(listOf(
            Membership(organizationId = fixture.organizationId, role = Role.PARENT, active = true),
            Membership(organizationId = fixture.organizationId, role = Role.PARENT, active = false, deactivatedAt = thisMonth),
            Membership(organizationId = fixture.organizationId, role = Role.PARENT, active = false, deactivatedAt = lastMonth),
            Membership(organizationId = fixture.organizationId, role = Role.STAFF, active = false, deactivatedAt = thisMonth),
        ))

        val result = fixture.service.parentRetention(fixture.jwt, fixture.organizationId, monthsBack = 2)

        assertEquals(1, result.currentActiveParents)
        assertEquals(listOf(YearMonth.now().minusMonths(1).toString(), YearMonth.now().toString()), result.monthly.map { it.month })
        assertEquals(listOf(1, 1), result.monthly.map { it.deactivatedCount })
    }

    @Test
    fun `development trend averages complete daily outcomes and skips incomplete goals`() {
        val fixture = fixture()
        val today = LocalDate.now()
        val program = DevelopmentProgram(organizationId = fixture.organizationId, name = "Bahasa", domain = GoalDomain.BAHASA_KOMUNIKASI)
        val first = DevelopmentProgramItem(developmentProgramId = program.id, name = "A", active = true)
        val second = DevelopmentProgramItem(developmentProgramId = program.id, name = "B", active = true)
        val goal = ChildGoal(organizationId = fixture.organizationId, programId = program.id, startsOn = today)
        val completeYes = listOf(
            ChildGoalCheckIn(organizationId = fixture.organizationId, childGoalId = goal.id, indicatorId = first.id, checkInDate = today, outcome = GoalCheckInOutcome.YES),
            ChildGoalCheckIn(organizationId = fixture.organizationId, childGoalId = goal.id, indicatorId = second.id, checkInDate = today, outcome = GoalCheckInOutcome.YES),
        )
        `when`(fixture.goals.findAllByOrganizationId(fixture.organizationId)).thenReturn(listOf(goal))
        `when`(fixture.goalPrograms.findAllByOrganizationIdOrderByCreatedAtDesc(fixture.organizationId)).thenReturn(listOf(program))
        `when`(fixture.goalPrograms.findAllByOrganizationIdIsNullOrderByCreatedAtDesc()).thenReturn(emptyList())
        `when`(fixture.goalIndicators.findAllByDevelopmentProgramIdIn(setOf(program.id))).thenReturn(listOf(first, second))
        `when`(fixture.checkIns.findAllByChildGoalIdIn(listOf(goal.id))).thenReturn(completeYes)

        val result = fixture.service.developmentTrend(fixture.jwt, fixture.organizationId, monthsBack = 1)

        assertEquals(1, result.size)
        assertEquals(1, result.single().goalCount)
        assertEquals(100, result.single().averageYesPercent)

        `when`(fixture.checkIns.findAllByChildGoalIdIn(listOf(goal.id))).thenReturn(completeYes.dropLast(1))
        assertNull(fixture.service.developmentTrend(fixture.jwt, fixture.organizationId, monthsBack = 1).single().averageYesPercent)
    }

    private data class Fixture(
        val organizationId: UUID,
        val jwt: Jwt,
        val children: ChildRepository,
        val branches: BranchRepository,
        val capacities: BranchCapacitySettingRepository,
        val memberships: MembershipRepository,
        val goals: ChildGoalRepository,
        val goalPrograms: DevelopmentProgramRepository,
        val goalIndicators: DevelopmentProgramItemRepository,
        val checkIns: ChildGoalCheckInRepository,
        val service: AnalyticsService,
    )

    private fun fixture(): Fixture {
        val organizationId = UUID.randomUUID()
        val access = mock(AccessService::class.java)
        val jwt = mock(Jwt::class.java)
        val children = mock(ChildRepository::class.java)
        val branches = mock(BranchRepository::class.java)
        val capacities = mock(BranchCapacitySettingRepository::class.java)
        val memberships = mock(MembershipRepository::class.java)
        val goals = mock(ChildGoalRepository::class.java)
        val goalPrograms = mock(DevelopmentProgramRepository::class.java)
        val goalIndicators = mock(DevelopmentProgramItemRepository::class.java)
        val checkIns = mock(ChildGoalCheckInRepository::class.java)
        `when`(access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN), readOnly = true)).thenReturn(AccessScope(com.daycare.api.persistence.UserProfile(), Membership(), emptySet(), emptySet()))
        return Fixture(organizationId, jwt, children, branches, capacities, memberships, goals, goalPrograms, goalIndicators, checkIns, AnalyticsService(access, children, branches, capacities, memberships, goals, goalPrograms, goalIndicators, checkIns))
    }
}
