package com.daycare.api.service

import com.daycare.api.domain.ChildGoalOutcome
import com.daycare.api.domain.ChildGoalStatus
import com.daycare.api.domain.GoalCheckInOutcome
import com.daycare.api.domain.Role
import com.daycare.api.persistence.AuditLogRepository
import com.daycare.api.persistence.Child
import com.daycare.api.persistence.ChildGoal
import com.daycare.api.persistence.ChildGoalCheckIn
import com.daycare.api.persistence.ChildGoalConclusionCorrection
import com.daycare.api.persistence.ChildGoalConclusionCorrectionRepository
import com.daycare.api.persistence.ChildGoalRepository
import com.daycare.api.persistence.ChildRepository
import com.daycare.api.persistence.ChildStaffAssignmentRepository
import com.daycare.api.persistence.ClassroomRepository
import com.daycare.api.persistence.ClassroomStaffAssignmentRepository
import com.daycare.api.persistence.CurriculumProgram
import com.daycare.api.persistence.CurriculumProgramDevelopmentProgram
import com.daycare.api.persistence.CurriculumProgramDevelopmentProgramRepository
import com.daycare.api.persistence.CurriculumProgramRepository
import com.daycare.api.persistence.DevelopmentProgram
import com.daycare.api.persistence.DevelopmentProgramItem
import com.daycare.api.persistence.DevelopmentProgramItemRepository
import com.daycare.api.persistence.DevelopmentProgramRepository
import com.daycare.api.persistence.GuardianLinkRepository
import com.daycare.api.persistence.LearningLevel
import com.daycare.api.persistence.LearningLevelRepository
import com.daycare.api.persistence.Membership
import com.daycare.api.persistence.MembershipRepository
import com.daycare.api.persistence.UserProfile
import com.daycare.api.realtime.RealtimePublisher
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Test
import org.mockito.ArgumentCaptor
import org.mockito.Mockito.any
import org.mockito.Mockito.mock
import org.mockito.Mockito.never
import org.mockito.Mockito.times
import org.mockito.Mockito.verify
import org.mockito.Mockito.verifyNoInteractions
import org.mockito.Mockito.`when`
import org.springframework.security.oauth2.jwt.Jwt
import java.time.LocalDate
import java.time.Instant
import java.util.Optional
import java.util.UUID

class GoalServiceTest {
    @Test
    fun `filters development programs by the selected curriculum program`() {
        val fixture = GoalServiceFixture()
        val jwt = mock(Jwt::class.java)
        val organizationId = UUID.randomUUID()
        val curriculumProgram = CurriculumProgram(name = "Bahasa")
        val linkedProgram = DevelopmentProgram(organizationId = organizationId, name = "Kosakata")
        val unlinkedProgram = DevelopmentProgram(organizationId = organizationId, name = "Bentuk")
        `when`(fixture.access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN, Role.STAFF), readOnly = true)).thenReturn(fixture.scope(organizationId))
        `when`(fixture.programs.findVisibleToOrganization(organizationId)).thenReturn(listOf(linkedProgram, unlinkedProgram))
        `when`(fixture.curriculumPrograms.findById(curriculumProgram.id)).thenReturn(Optional.of(curriculumProgram))
        `when`(fixture.curriculumProgramPrograms.findAllByCurriculumProgramId(curriculumProgram.id)).thenReturn(listOf(CurriculumProgramDevelopmentProgram(curriculumProgramId = curriculumProgram.id, developmentProgramId = linkedProgram.id)))

        val response = fixture.service.programs(jwt, organizationId, curriculumProgramId = curriculumProgram.id)

        assertEquals(listOf(linkedProgram.id), response.map { it.id })
    }

    @Test
    fun `rejects a Goal assignment when development program is not linked to curriculum program`() {
        val fixture = GoalServiceFixture()
        val jwt = mock(Jwt::class.java)
        val organizationId = UUID.randomUUID()
        val child = Child(organizationId = organizationId)
        val curriculumProgram = CurriculumProgram(organizationId = organizationId, name = "Bahasa")
        val developmentProgram = DevelopmentProgram(organizationId = organizationId, name = "Kosakata")
        val scope = fixture.scope(organizationId)
        `when`(fixture.access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN, Role.STAFF))).thenReturn(scope)
        `when`(fixture.childScopes.requireStaffManagedChild(scope, child.id, organizationId)).thenReturn(child)
        `when`(fixture.curriculumPrograms.findById(curriculumProgram.id)).thenReturn(Optional.of(curriculumProgram))
        `when`(fixture.programs.findById(developmentProgram.id)).thenReturn(Optional.of(developmentProgram))
        `when`(fixture.curriculumProgramPrograms.existsByCurriculumProgramIdAndDevelopmentProgramId(curriculumProgram.id, developmentProgram.id)).thenReturn(false)

        val error = assertThrows(IllegalArgumentException::class.java) {
            fixture.service.assign(jwt, organizationId, child.id, AssignChildGoalRequest(curriculumProgram.id, developmentProgram.id))
        }

        assertEquals("Development program is not part of the curriculum program", error.message)
        verify(fixture.goals, never()).save(any())
    }

    @Test
    fun `filtering programs throws when the curriculum program does not exist`() {
        val fixture = GoalServiceFixture()
        val jwt = mock(Jwt::class.java)
        val organizationId = UUID.randomUUID()
        val curriculumProgramId = UUID.randomUUID()
        `when`(fixture.access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN, Role.STAFF), readOnly = true)).thenReturn(fixture.scope(organizationId))
        `when`(fixture.programs.findVisibleToOrganization(organizationId)).thenReturn(emptyList())
        `when`(fixture.curriculumPrograms.findById(curriculumProgramId)).thenReturn(Optional.empty())

        val error = assertThrows(IllegalArgumentException::class.java) {
            fixture.service.programs(jwt, organizationId, curriculumProgramId = curriculumProgramId)
        }

        assertEquals("Curriculum program was not found", error.message)
    }

    @Test
    fun `filtering programs throws when the curriculum program is inactive`() {
        val fixture = GoalServiceFixture()
        val jwt = mock(Jwt::class.java)
        val organizationId = UUID.randomUUID()
        val curriculumProgram = CurriculumProgram(organizationId = organizationId, name = "Bahasa", active = false)
        `when`(fixture.access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN, Role.STAFF), readOnly = true)).thenReturn(fixture.scope(organizationId))
        `when`(fixture.programs.findVisibleToOrganization(organizationId)).thenReturn(emptyList())
        `when`(fixture.curriculumPrograms.findById(curriculumProgram.id)).thenReturn(Optional.of(curriculumProgram))

        val error = assertThrows(IllegalArgumentException::class.java) {
            fixture.service.programs(jwt, organizationId, curriculumProgramId = curriculumProgram.id)
        }

        assertEquals("Curriculum program is not available", error.message)
    }

    @Test
    fun `assign throws when the curriculum program does not exist`() {
        val fixture = GoalServiceFixture()
        val jwt = mock(Jwt::class.java)
        val organizationId = UUID.randomUUID()
        val child = Child(organizationId = organizationId)
        val curriculumProgramId = UUID.randomUUID()
        val scope = fixture.scope(organizationId)
        `when`(fixture.access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN, Role.STAFF))).thenReturn(scope)
        `when`(fixture.childScopes.requireStaffManagedChild(scope, child.id, organizationId)).thenReturn(child)
        `when`(fixture.curriculumPrograms.findById(curriculumProgramId)).thenReturn(Optional.empty())

        val error = assertThrows(IllegalArgumentException::class.java) {
            fixture.service.assign(jwt, organizationId, child.id, AssignChildGoalRequest(curriculumProgramId, UUID.randomUUID()))
        }

        assertEquals("Curriculum program was not found", error.message)
        verify(fixture.goals, never()).save(any())
    }

    @Test
    fun `assign throws when the curriculum program is inactive`() {
        val fixture = GoalServiceFixture()
        val jwt = mock(Jwt::class.java)
        val organizationId = UUID.randomUUID()
        val child = Child(organizationId = organizationId)
        val curriculumProgram = CurriculumProgram(organizationId = organizationId, name = "Bahasa", active = false)
        val scope = fixture.scope(organizationId)
        `when`(fixture.access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN, Role.STAFF))).thenReturn(scope)
        `when`(fixture.childScopes.requireStaffManagedChild(scope, child.id, organizationId)).thenReturn(child)
        `when`(fixture.curriculumPrograms.findById(curriculumProgram.id)).thenReturn(Optional.of(curriculumProgram))

        val error = assertThrows(IllegalArgumentException::class.java) {
            fixture.service.assign(jwt, organizationId, child.id, AssignChildGoalRequest(curriculumProgram.id, UUID.randomUUID()))
        }

        assertEquals("Curriculum program is not available", error.message)
        verify(fixture.goals, never()).save(any())
    }

    @Test
    fun `assigns a Goal and persists the curriculum program link`() {
        val fixture = GoalServiceFixture()
        val jwt = mock(Jwt::class.java)
        val organizationId = UUID.randomUUID()
        val child = Child(organizationId = organizationId)
        val curriculumProgram = CurriculumProgram(organizationId = organizationId, name = "Bahasa")
        val developmentProgram = DevelopmentProgram(name = "Kosakata", durationDays = 30)
        val indicator = DevelopmentProgramItem(developmentProgramId = developmentProgram.id, name = "Menyapa")
        val scope = fixture.scope(organizationId)
        `when`(fixture.access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN, Role.STAFF))).thenReturn(scope)
        `when`(fixture.childScopes.requireStaffManagedChild(scope, child.id, organizationId)).thenReturn(child)
        `when`(fixture.curriculumPrograms.findById(curriculumProgram.id)).thenReturn(Optional.of(curriculumProgram))
        `when`(fixture.programs.findById(developmentProgram.id)).thenReturn(Optional.of(developmentProgram))
        `when`(fixture.curriculumProgramPrograms.existsByCurriculumProgramIdAndDevelopmentProgramId(curriculumProgram.id, developmentProgram.id)).thenReturn(true)
        `when`(fixture.goalIndicators.findAllByDevelopmentProgramIdOrderByDisplayOrderAsc(developmentProgram.id)).thenReturn(listOf(indicator))
        `when`(fixture.levels.findById(developmentProgram.learningLevelId)).thenReturn(Optional.of(LearningLevel(id = developmentProgram.learningLevelId)))
        `when`(fixture.goals.existsByChildIdAndProgramIdAndStatus(child.id, developmentProgram.id, ChildGoalStatus.ACTIVE)).thenReturn(false)
        `when`(fixture.goals.save(any(ChildGoal::class.java))).thenAnswer { it.arguments[0] }

        val response = fixture.service.assign(jwt, organizationId, child.id, AssignChildGoalRequest(curriculumProgram.id, developmentProgram.id))

        assertEquals(curriculumProgram.id, response.curriculumProgramId)
        assertEquals(curriculumProgram.name, response.curriculumProgramName)
        assertEquals(developmentProgram.id, response.programId)
    }

    @Test
    fun `resolves the curriculum program name only for goals linked to a curriculum program`() {
        val fixture = GoalServiceFixture()
        val jwt = mock(Jwt::class.java)
        val organizationId = UUID.randomUUID()
        val childId = UUID.randomUUID()
        val developmentProgram = DevelopmentProgram(name = "Kosakata", durationDays = 30)
        val curriculumProgram = CurriculumProgram(organizationId = organizationId, name = "Bahasa")
        val legacyGoal = ChildGoal(organizationId = organizationId, childId = childId, programId = developmentProgram.id)
        val linkedGoal = ChildGoal(organizationId = organizationId, childId = childId, programId = developmentProgram.id, curriculumProgramId = curriculumProgram.id)
        val scope = fixture.scope(organizationId)
        `when`(fixture.access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN, Role.STAFF, Role.PARENT), readOnly = true)).thenReturn(scope)
        `when`(fixture.childScopes.requireStaffManagedChild(scope, childId, organizationId)).thenReturn(Child(organizationId = organizationId))
        `when`(fixture.goals.findAllByOrganizationIdAndChildIdOrderByCreatedAtDesc(organizationId, childId)).thenReturn(listOf(legacyGoal, linkedGoal))
        `when`(fixture.programs.findAllById(setOf(developmentProgram.id))).thenReturn(listOf(developmentProgram))
        `when`(fixture.curriculumPrograms.findAllById(setOf(curriculumProgram.id))).thenReturn(listOf(curriculumProgram))
        `when`(fixture.goalIndicators.findAllByDevelopmentProgramIdIn(setOf(developmentProgram.id))).thenReturn(emptyList())
        `when`(fixture.checkIns.findAllByChildGoalIdIn(setOf(legacyGoal.id, linkedGoal.id))).thenReturn(emptyList())

        val response = fixture.service.childGoals(jwt, organizationId, childId)

        val legacy = response.first { it.id == legacyGoal.id }
        val linked = response.first { it.id == linkedGoal.id }
        assertNull(legacy.curriculumProgramName)
        assertEquals(curriculumProgram.name, linked.curriculumProgramName)
    }

    @Test
    fun `records every active indicator in one daily check-in batch`() {
        val fixture = GoalServiceFixture()
        val jwt = mock(Jwt::class.java)
        val organizationId = UUID.randomUUID()
        val date = LocalDate.of(2026, 8, 1)
        val program = DevelopmentProgram(organizationId = organizationId, name = "Mandiri", durationDays = 30)
        val goal = ChildGoal(organizationId = organizationId, childId = UUID.randomUUID(), programId = program.id, startsOn = date)
        val firstIndicator = DevelopmentProgramItem(developmentProgramId = program.id, name = "Makan sendiri")
        val secondIndicator = DevelopmentProgramItem(developmentProgramId = program.id, name = "Merapikan mainan", displayOrder = 1)
        val scope = fixture.scope(organizationId)
        `when`(fixture.access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN, Role.STAFF))).thenReturn(scope)
        `when`(fixture.goals.findById(goal.id)).thenReturn(Optional.of(goal))
        `when`(fixture.childScopes.requireStaffManagedChild(scope, goal.childId, organizationId)).thenReturn(Child(organizationId = organizationId))
        `when`(fixture.programs.findById(program.id)).thenReturn(Optional.of(program))
        `when`(fixture.goalIndicators.findAllByDevelopmentProgramIdOrderByDisplayOrderAsc(program.id)).thenReturn(listOf(firstIndicator, secondIndicator))
        `when`(fixture.checkIns.findAllByChildGoalIdOrderByCheckInDateAsc(goal.id)).thenReturn(emptyList())

        fixture.service.recordCheckInBatch(
            jwt,
            organizationId,
            goal.id,
            date,
            GoalCheckInBatchRequest(listOf(GoalCheckInBatchItemRequest(firstIndicator.id, GoalCheckInOutcome.YES), GoalCheckInBatchItemRequest(secondIndicator.id, GoalCheckInOutcome.NO))),
        )

        verify(fixture.checkIns, times(2)).save(any(ChildGoalCheckIn::class.java))
        verify(fixture.realtime).publishToTenantRoles(organizationId, setOf(Role.STAFF_ADMIN, Role.STAFF), setOf(com.daycare.api.realtime.RealtimeFlag.GOALS))
    }

    @Test
    fun `rejects a partial daily check-in batch without persisting any result`() {
        val fixture = GoalServiceFixture()
        val jwt = mock(Jwt::class.java)
        val organizationId = UUID.randomUUID()
        val date = LocalDate.of(2026, 8, 1)
        val program = DevelopmentProgram(organizationId = organizationId, name = "Mandiri", durationDays = 30)
        val goal = ChildGoal(organizationId = organizationId, childId = UUID.randomUUID(), programId = program.id, startsOn = date)
        val firstIndicator = DevelopmentProgramItem(developmentProgramId = program.id, name = "Makan sendiri")
        val secondIndicator = DevelopmentProgramItem(developmentProgramId = program.id, name = "Merapikan mainan", displayOrder = 1)
        val scope = fixture.scope(organizationId)
        `when`(fixture.access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN, Role.STAFF))).thenReturn(scope)
        `when`(fixture.goals.findById(goal.id)).thenReturn(Optional.of(goal))
        `when`(fixture.childScopes.requireStaffManagedChild(scope, goal.childId, organizationId)).thenReturn(Child(organizationId = organizationId))
        `when`(fixture.programs.findById(program.id)).thenReturn(Optional.of(program))
        `when`(fixture.goalIndicators.findAllByDevelopmentProgramIdOrderByDisplayOrderAsc(program.id)).thenReturn(listOf(firstIndicator, secondIndicator))

        val error = assertThrows(IllegalArgumentException::class.java) {
            fixture.service.recordCheckInBatch(jwt, organizationId, goal.id, date, GoalCheckInBatchRequest(listOf(GoalCheckInBatchItemRequest(firstIndicator.id, GoalCheckInOutcome.YES))))
        }

        assertEquals("Batch check-ins must include every active indicator exactly once", error.message)
        verify(fixture.checkIns, never()).save(any(ChildGoalCheckIn::class.java))
    }

    @Test
    fun `Staff Admin correction keeps a completed Goal closed and records the prior conclusion`() {
        val fixture = GoalServiceFixture()
        val jwt = mock(Jwt::class.java)
        val organizationId = UUID.randomUUID()
        val finalizedAt = Instant.parse("2026-08-01T08:00:00Z")
        val goal = ChildGoal(
            organizationId = organizationId,
            childId = UUID.randomUUID(),
            programId = UUID.randomUUID(),
            status = ChildGoalStatus.COMPLETED,
            finalOutcome = ChildGoalOutcome.NOT_ACHIEVED,
            finalSummary = "Belum konsisten.",
            finalizedAt = finalizedAt,
        )
        val scope = fixture.scope(organizationId)
        `when`(fixture.access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN))).thenReturn(scope)
        `when`(fixture.goals.findById(goal.id)).thenReturn(Optional.of(goal))

        fixture.service.correctConclusion(jwt, organizationId, goal.id, CorrectChildGoalConclusionRequest(ChildGoalOutcome.ACHIEVED, "Sudah konsisten dengan pendampingan.", "Ringkasan awal salah pilih hasil."))

        val correctionCaptor = ArgumentCaptor.forClass(ChildGoalConclusionCorrection::class.java)
        verify(fixture.conclusionCorrections).save(correctionCaptor.capture())
        val correction = correctionCaptor.value
        assertEquals(ChildGoalOutcome.NOT_ACHIEVED, correction.previousOutcome)
        assertEquals("Belum konsisten.", correction.previousSummary)
        assertEquals(ChildGoalOutcome.ACHIEVED, correction.correctedOutcome)
        assertEquals("Sudah konsisten dengan pendampingan.", correction.correctedSummary)
        assertEquals("Ringkasan awal salah pilih hasil.", correction.reason)
        assertEquals(ChildGoalStatus.COMPLETED, goal.status)
        assertEquals(ChildGoalOutcome.ACHIEVED, goal.finalOutcome)
        assertEquals("Sudah konsisten dengan pendampingan.", goal.finalSummary)
        assertEquals(finalizedAt, goal.finalizedAt)
    }

    @Test
    fun `rejects a conclusion correction for an active Goal`() {
        val fixture = GoalServiceFixture()
        val jwt = mock(Jwt::class.java)
        val organizationId = UUID.randomUUID()
        val goal = ChildGoal(organizationId = organizationId, childId = UUID.randomUUID(), programId = UUID.randomUUID())
        `when`(fixture.access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN))).thenReturn(fixture.scope(organizationId))
        `when`(fixture.goals.findById(goal.id)).thenReturn(Optional.of(goal))

        val error = assertThrows(IllegalArgumentException::class.java) {
            fixture.service.correctConclusion(jwt, organizationId, goal.id, CorrectChildGoalConclusionRequest(ChildGoalOutcome.ACHIEVED, "Ringkasan", "Alasan koreksi"))
        }

        assertEquals("Only a completed Goal conclusion can be corrected", error.message)
        verify(fixture.conclusionCorrections, never()).save(any(ChildGoalConclusionCorrection::class.java))
    }

    @Test
    fun `returns correction history only to an active Staff Admin`() {
        val fixture = GoalServiceFixture()
        val jwt = mock(Jwt::class.java)
        val organizationId = UUID.randomUUID()
        val childId = UUID.randomUUID()
        val program = DevelopmentProgram(organizationId = organizationId, name = "Mandiri", durationDays = 30)
        val goal = ChildGoal(organizationId = organizationId, childId = childId, programId = program.id, status = ChildGoalStatus.COMPLETED, finalOutcome = ChildGoalOutcome.ACHIEVED, finalSummary = "Berhasil")
        val correction = ChildGoalConclusionCorrection(organizationId = organizationId, childGoalId = goal.id, previousOutcome = ChildGoalOutcome.NOT_ACHIEVED, previousSummary = "Belum berhasil", correctedOutcome = ChildGoalOutcome.ACHIEVED, correctedSummary = "Berhasil", reason = "Ringkasan awal diperbaiki")
        val scope = fixture.scope(organizationId)
        `when`(fixture.access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN, Role.STAFF, Role.PARENT), readOnly = true)).thenReturn(scope)
        `when`(fixture.childScopes.requireStaffManagedChild(scope, childId, organizationId)).thenReturn(Child(organizationId = organizationId))
        `when`(fixture.goals.findAllByOrganizationIdAndChildIdOrderByCreatedAtDesc(organizationId, childId)).thenReturn(listOf(goal))
        `when`(fixture.programs.findAllById(setOf(program.id))).thenReturn(listOf(program))
        `when`(fixture.goalIndicators.findAllByDevelopmentProgramIdIn(setOf(program.id))).thenReturn(emptyList())
        `when`(fixture.checkIns.findAllByChildGoalIdIn(setOf(goal.id))).thenReturn(emptyList())
        `when`(fixture.conclusionCorrections.findAllByOrganizationIdAndChildGoalIdInOrderByCorrectedAtAsc(organizationId, setOf(goal.id))).thenReturn(listOf(correction))

        val response = fixture.service.childGoals(jwt, organizationId, childId)

        assertEquals(listOf(correction.reason), response.single().conclusionCorrections.map { it.reason })
    }

    @Test
    fun `does not return correction history to a Parent`() {
        val fixture = GoalServiceFixture()
        val jwt = mock(Jwt::class.java)
        val organizationId = UUID.randomUUID()
        val childId = UUID.randomUUID()
        val program = DevelopmentProgram(organizationId = organizationId, name = "Mandiri", durationDays = 30)
        val goal = ChildGoal(organizationId = organizationId, childId = childId, programId = program.id, status = ChildGoalStatus.COMPLETED, finalOutcome = ChildGoalOutcome.ACHIEVED, finalSummary = "Berhasil")
        val scope = fixture.scope(organizationId, Role.PARENT)
        `when`(fixture.access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN, Role.STAFF, Role.PARENT), readOnly = true)).thenReturn(scope)
        `when`(fixture.childScopes.requireParentLinkedChild(scope, childId, organizationId)).thenReturn(Child(organizationId = organizationId))
        `when`(fixture.goals.findAllByOrganizationIdAndChildIdOrderByCreatedAtDesc(organizationId, childId)).thenReturn(listOf(goal))
        `when`(fixture.programs.findAllById(setOf(program.id))).thenReturn(listOf(program))
        `when`(fixture.goalIndicators.findAllByDevelopmentProgramIdIn(setOf(program.id))).thenReturn(emptyList())
        `when`(fixture.checkIns.findAllByChildGoalIdIn(setOf(goal.id))).thenReturn(emptyList())

        val response = fixture.service.childGoals(jwt, organizationId, childId)

        assertEquals(0, response.single().conclusionCorrections.size)
        verifyNoInteractions(fixture.conclusionCorrections)
    }
}

private class GoalServiceFixture {
    val access = mock(AccessService::class.java)
    val platformAccess = mock(PlatformAccessService::class.java)
    val childScopes = mock(ChildScopeService::class.java)
    val programs = mock(DevelopmentProgramRepository::class.java)
    val curriculumPrograms = mock(CurriculumProgramRepository::class.java)
    val curriculumProgramPrograms = mock(CurriculumProgramDevelopmentProgramRepository::class.java)
    val goalIndicators = mock(DevelopmentProgramItemRepository::class.java)
    val goals = mock(ChildGoalRepository::class.java)
    val checkIns = mock(com.daycare.api.persistence.ChildGoalCheckInRepository::class.java)
    val conclusionCorrections = mock(ChildGoalConclusionCorrectionRepository::class.java)
    val levels = mock(LearningLevelRepository::class.java)
    val classrooms = mock(ClassroomRepository::class.java)
    val guardians = mock(GuardianLinkRepository::class.java)
    val audits = mock(AuditLogRepository::class.java)
    val realtime = mock(RealtimePublisher::class.java)
    val notifications = mock(NotificationService::class.java)
    val children = mock(ChildRepository::class.java)
    val childStaffAssignments = mock(ChildStaffAssignmentRepository::class.java)
    val classroomStaffAssignments = mock(ClassroomStaffAssignmentRepository::class.java)
    val memberships = mock(MembershipRepository::class.java)
    val service = GoalService(access, platformAccess, childScopes, programs, curriculumPrograms, curriculumProgramPrograms, goalIndicators, goals, checkIns, conclusionCorrections, levels, classrooms, guardians, audits, realtime, notifications, children, childStaffAssignments, classroomStaffAssignments, memberships)

    fun scope(organizationId: UUID, role: Role = Role.STAFF_ADMIN) = AccessScope(UserProfile(), Membership(organizationId = organizationId, role = role), emptySet(), emptySet())
}
