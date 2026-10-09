package com.daycare.api.service

import com.daycare.api.domain.ChildGoalOutcome
import com.daycare.api.domain.ChildGoalStatus
import com.daycare.api.domain.GoalCheckInOutcome
import com.daycare.api.domain.GoalDomain
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
import com.daycare.api.persistence.ChildStaffAssignment
import com.daycare.api.persistence.ClassroomRepository
import com.daycare.api.persistence.ClassroomStaffAssignmentRepository
import com.daycare.api.persistence.ClassroomStaffAssignment
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
import org.junit.jupiter.api.Assertions.assertTrue
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
import java.util.Base64

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

    @Test
    fun `platform admin can create update revise and delete global programs`() {
        val fixture = GoalServiceFixture()
        val jwt = mock(Jwt::class.java)
        val level = LearningLevel(organizationId = null, name = "Toddler")
        val program = DevelopmentProgram(organizationId = null, learningLevelId = level.id, name = "Old", isTemplate = true)
        `when`(fixture.platformAccess.requirePlatformAdmin(jwt)).thenReturn(UserProfile())
        `when`(fixture.levels.findById(level.id)).thenReturn(Optional.of(level))
        `when`(fixture.programs.findByOrganizationIdIsNullAndLearningLevelIdAndDomainAndActiveTrue(level.id, com.daycare.api.domain.GoalDomain.KEMANDIRIAN)).thenReturn(null)
        `when`(fixture.programs.save(any(DevelopmentProgram::class.java))).thenAnswer { it.arguments[0] }
        `when`(fixture.programs.findById(program.id)).thenReturn(Optional.of(program))
        `when`(fixture.goals.existsByProgramId(program.id)).thenReturn(false)
        val request = UpsertDevelopmentProgramRequest(level.id, " Program ", durationDays = 5, minimumYesPercent = 50, minimumYesStreak = 2, domain = com.daycare.api.domain.GoalDomain.KEMANDIRIAN, indicatorNames = listOf(" One ", " "))

        assertEquals("Program", fixture.service.createGlobalProgram(jwt, request).name)
        assertEquals("Updated", fixture.service.updateGlobalProgram(jwt, program.id, request.copy(name = "Updated")).name)
        val revision = fixture.service.reviseGlobalProgram(jwt, program.id, request.copy(name = "Revision"))
        assertEquals("Revision", revision.name)
        fixture.service.deleteGlobalProgram(jwt, program.id)
        verify(fixture.programs).delete(program)
    }

    @Test
    fun `goal check-in stores and serves validated photo and audio`() {
        val fixture = GoalServiceFixture()
        val jwt = mock(Jwt::class.java)
        val organizationId = UUID.randomUUID()
        val child = Child(organizationId = organizationId)
        val program = DevelopmentProgram(organizationId = organizationId, name = "Goal", durationDays = 3)
        val goal = ChildGoal(organizationId = organizationId, childId = child.id, programId = program.id, startsOn = LocalDate.now())
        val indicator = DevelopmentProgramItem(organizationId = organizationId, developmentProgramId = program.id, name = "Say")
        val scope = fixture.scope(organizationId)
        `when`(fixture.access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN, Role.STAFF))).thenReturn(scope)
        `when`(fixture.access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN, Role.STAFF, Role.PARENT), readOnly = true)).thenReturn(scope)
        `when`(fixture.childScopes.requireStaffManagedChild(scope, child.id, organizationId)).thenReturn(child)
        `when`(fixture.goals.findById(goal.id)).thenReturn(Optional.of(goal))
        `when`(fixture.programs.findById(program.id)).thenReturn(Optional.of(program))
        `when`(fixture.goalIndicators.findById(indicator.id)).thenReturn(Optional.of(indicator))
        `when`(fixture.goalIndicators.findAllByDevelopmentProgramIdOrderByDisplayOrderAsc(program.id)).thenReturn(listOf(indicator))
        `when`(fixture.checkIns.findByChildGoalIdAndIndicatorIdAndCheckInDate(goal.id, indicator.id, LocalDate.now())).thenReturn(null)
        `when`(fixture.checkIns.findAllByChildGoalIdOrderByCheckInDateAsc(goal.id)).thenReturn(emptyList())
        `when`(fixture.checkIns.save(any(ChildGoalCheckIn::class.java))).thenAnswer { it.arguments[0] }
        val photoData = Base64.getEncoder().encodeToString(byteArrayOf(0xFF.toByte(), 0xD8.toByte(), 0xFF.toByte()))
        val audioData = Base64.getEncoder().encodeToString(byteArrayOf(1, 2, 3))
        fixture.service.recordCheckIn(jwt, organizationId, goal.id, LocalDate.now(), GoalCheckInRequest(indicator.id, GoalCheckInOutcome.YES, photo = GoalPhotoInput("image/jpeg", photoData), audio = GoalAudioInput("audio/mp4", audioData, 1000)))
        val saved = ChildGoalCheckIn(organizationId = organizationId, childGoalId = goal.id, indicatorId = indicator.id, checkInDate = LocalDate.now(), photoContentType = "image/jpeg", photoData = byteArrayOf(1), audioContentType = "audio/mp4", audioData = byteArrayOf(2), audioDurationMs = 1000)
        `when`(fixture.checkIns.findByChildGoalIdAndIndicatorIdAndCheckInDate(goal.id, indicator.id, LocalDate.now())).thenReturn(saved)
        assertEquals(Base64.getEncoder().encodeToString(byteArrayOf(1)), fixture.service.checkInPhoto(jwt, organizationId, goal.id, LocalDate.now(), indicator.id).dataBase64)
        assertEquals(Base64.getEncoder().encodeToString(byteArrayOf(2)), fixture.service.checkInAudio(jwt, organizationId, goal.id, LocalDate.now(), indicator.id).dataBase64)
        assertThrows(IllegalArgumentException::class.java) { fixture.service.recordCheckIn(jwt, organizationId, goal.id, LocalDate.now(), GoalCheckInRequest(indicator.id, GoalCheckInOutcome.YES, photo = GoalPhotoInput("image/gif", photoData))) }
    }

    @Test
    fun `scheduled reminder notifies assigned staff or active admin fallback`() {
        val fixture = GoalServiceFixture()
        val organizationId = UUID.randomUUID()
        val child = Child(organizationId = organizationId, firstName = "Alya")
        val program = DevelopmentProgram(organizationId = organizationId, name = "Goal", durationDays = 10)
        val goal = ChildGoal(organizationId = organizationId, childId = child.id, programId = program.id, startsOn = LocalDate.now())
        val indicator = DevelopmentProgramItem(organizationId = organizationId, developmentProgramId = program.id, name = "Say", active = true)
        val admin = UserProfile()
        `when`(fixture.goals.findAllByStatus(ChildGoalStatus.ACTIVE)).thenReturn(listOf(goal))
        `when`(fixture.programs.findAllById(setOf(program.id))).thenReturn(listOf(program))
        `when`(fixture.goalIndicators.findAllByDevelopmentProgramIdIn(setOf(program.id))).thenReturn(listOf(indicator))
        `when`(fixture.checkIns.findAllByChildGoalIdInAndCheckInDate(setOf(goal.id), LocalDate.now())).thenReturn(emptyList())
        `when`(fixture.children.findAllById(setOf(child.id))).thenReturn(listOf(child))
        `when`(fixture.childStaffAssignments.findAllByOrganizationIdAndChildIdOrderByCreatedAtDesc(organizationId, child.id)).thenReturn(emptyList())
        `when`(fixture.memberships.findAllByOrganizationId(organizationId)).thenReturn(listOf(Membership(userId = admin.id, organizationId = organizationId, role = Role.STAFF_ADMIN, active = true)))
        fixture.service.sendMissedCheckInReminders()
        verify(fixture.notifications).notify(organizationId, admin.id, "Check-in program belum diisi", "Check-in program hari ini untuk Alya belum diisi.", "/goals?childId=${child.id}", setOf(com.daycare.api.realtime.RealtimeFlag.GOALS))
    }

    @Test
    fun `Staff Admin deletes an unassigned tenant Development Program`() {
        val fixture = GoalServiceFixture()
        val jwt = mock(Jwt::class.java)
        val organizationId = UUID.randomUUID()
        val program = DevelopmentProgram(organizationId = organizationId, name = "Kosakata")
        `when`(fixture.access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN), readOnly = false)).thenReturn(fixture.scope(organizationId))
        `when`(fixture.programs.findById(program.id)).thenReturn(Optional.of(program))
        `when`(fixture.goals.existsByProgramId(program.id)).thenReturn(false)

        fixture.service.deleteProgram(jwt, organizationId, program.id)

        verify(fixture.programs).delete(program)
    }

    @Test
    fun `rejects deleting a Development Program already assigned to a child`() {
        val fixture = GoalServiceFixture()
        val jwt = mock(Jwt::class.java)
        val organizationId = UUID.randomUUID()
        val program = DevelopmentProgram(organizationId = organizationId, name = "Kosakata")
        `when`(fixture.access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN), readOnly = false)).thenReturn(fixture.scope(organizationId))
        `when`(fixture.programs.findById(program.id)).thenReturn(Optional.of(program))
        `when`(fixture.goals.existsByProgramId(program.id)).thenReturn(true)

        val error = assertThrows(IllegalArgumentException::class.java) { fixture.service.deleteProgram(jwt, organizationId, program.id) }

        assertEquals(DevelopmentProgramError.ASSIGNED, error.message)
        verify(fixture.programs, never()).delete(program)
    }

    @Test
    fun `global and tenant program listings cover search and curriculum filters`() {
        val fixture = GoalServiceFixture()
        val jwt = mock(Jwt::class.java)
        val organizationId = UUID.randomUUID()
        val level = LearningLevel(organizationId = null, name = "Toddler")
        val global = DevelopmentProgram(organizationId = null, learningLevelId = level.id, name = "Bahasa")
        `when`(fixture.levels.findById(level.id)).thenReturn(Optional.of(level))
        `when`(fixture.goalIndicators.findAllByDevelopmentProgramIdOrderByDisplayOrderAsc(global.id)).thenReturn(emptyList())
        `when`(fixture.programs.findAllByOrganizationIdIsNullOrderByCreatedAtDesc()).thenReturn(listOf(global))
        `when`(fixture.programs.searchGlobal("bahasa")).thenReturn(listOf(global))
        assertEquals(1, fixture.service.globalPrograms(jwt).size)
        assertEquals(1, fixture.service.globalPrograms(jwt, " bahasa ").size)

        val tenant = DevelopmentProgram(organizationId = organizationId, learningLevelId = level.id, name = "Motorik")
        `when`(fixture.access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN, Role.STAFF), readOnly = true)).thenReturn(fixture.scope(organizationId))
        `when`(fixture.programs.findVisibleToOrganization(organizationId)).thenReturn(listOf(tenant))
        `when`(fixture.programs.searchVisibleToOrganization(organizationId, "motorik")).thenReturn(listOf(tenant))
        val curriculumId = UUID.randomUUID()
        `when`(fixture.curriculumPrograms.findById(curriculumId)).thenReturn(Optional.of(CurriculumProgram(id = curriculumId, organizationId = null, name = "Kurikulum", active = true)))
        `when`(fixture.curriculumProgramPrograms.findAllByCurriculumProgramId(curriculumId)).thenReturn(listOf(CurriculumProgramDevelopmentProgram(curriculumProgramId = curriculumId, developmentProgramId = tenant.id)))
        `when`(fixture.goalIndicators.findAllByDevelopmentProgramIdOrderByDisplayOrderAsc(tenant.id)).thenReturn(emptyList())
        assertEquals(1, fixture.service.programs(jwt, organizationId).size)
        assertEquals(1, fixture.service.programs(jwt, organizationId, " motorik ", curriculumId).size)
        val inactive = CurriculumProgram(organizationId = organizationId, name = "Inactive", active = false)
        val inactiveId = UUID.randomUUID()
        `when`(fixture.curriculumPrograms.findById(inactiveId)).thenReturn(Optional.of(inactive))
        assertThrows(IllegalArgumentException::class.java) { fixture.service.programs(jwt, organizationId, curriculumProgramId = inactiveId) }
    }

    @Test
    fun `global program mutations reject invalid level and duplicate combinations`() {
        val fixture = GoalServiceFixture()
        val jwt = mock(Jwt::class.java)
        val globalLevel = LearningLevel(organizationId = null, name = "Toddler")
        val tenantLevel = LearningLevel(organizationId = UUID.randomUUID(), name = "Tenant")
        val request = UpsertDevelopmentProgramRequest(globalLevel.id, " Program ", durationDays = 7, minimumYesPercent = 50, minimumYesStreak = 2, domain = GoalDomain.KEMANDIRIAN)
        `when`(fixture.levels.findById(globalLevel.id)).thenReturn(Optional.of(globalLevel))
        `when`(fixture.programs.findByOrganizationIdIsNullAndLearningLevelIdAndDomainAndActiveTrue(globalLevel.id, GoalDomain.KEMANDIRIAN)).thenReturn(DevelopmentProgram(learningLevelId = globalLevel.id))
        assertThrows(IllegalArgumentException::class.java) { fixture.service.createGlobalProgram(jwt, request) }
        `when`(fixture.levels.findById(globalLevel.id)).thenReturn(Optional.of(tenantLevel))
        assertThrows(IllegalArgumentException::class.java) { fixture.service.createGlobalProgram(jwt, request) }

        val program = DevelopmentProgram(learningLevelId = globalLevel.id, name = "Old", domain = GoalDomain.KEMANDIRIAN, isTemplate = true)
        `when`(fixture.levels.findById(globalLevel.id)).thenReturn(Optional.of(globalLevel))
        `when`(fixture.programs.findById(program.id)).thenReturn(Optional.of(program))
        `when`(fixture.programs.findByOrganizationIdIsNullAndLearningLevelIdAndDomainAndActiveTrue(globalLevel.id, GoalDomain.KOGNITIF)).thenReturn(DevelopmentProgram(learningLevelId = globalLevel.id, domain = GoalDomain.KOGNITIF))
        assertThrows(IllegalArgumentException::class.java) { fixture.service.updateGlobalProgram(jwt, program.id, request.copy(domain = GoalDomain.KOGNITIF)) }
        program.active = false
        assertThrows(IllegalArgumentException::class.java) { fixture.service.reviseGlobalProgram(jwt, program.id, request) }
    }

    @Test
    fun `tenant program indicators enforce ownership and active indicator rule`() {
        val fixture = GoalServiceFixture()
        val jwt = mock(Jwt::class.java)
        val organizationId = UUID.randomUUID()
        val level = LearningLevel(organizationId = organizationId, name = "Toddler")
        val program = DevelopmentProgram(organizationId = organizationId, learningLevelId = level.id, name = "Program")
        val global = DevelopmentProgram(organizationId = null, learningLevelId = level.id, name = "Global", isTemplate = true)
        val indicator = DevelopmentProgramItem(organizationId = organizationId, developmentProgramId = program.id, name = "Indikator")
        val request = UpsertDevelopmentProgramRequest(level.id, " Program ", durationDays = 7, minimumYesPercent = 50, minimumYesStreak = 2, domain = GoalDomain.KEMANDIRIAN)
        `when`(fixture.access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN), readOnly = false)).thenReturn(fixture.scope(organizationId))
        `when`(fixture.levels.findById(level.id)).thenReturn(Optional.of(level))
        `when`(fixture.programs.findById(program.id)).thenReturn(Optional.of(program))
        `when`(fixture.programs.findById(global.id)).thenReturn(Optional.of(global))
        `when`(fixture.goalIndicators.findAllByDevelopmentProgramIdOrderByDisplayOrderAsc(program.id)).thenReturn(listOf(indicator))
        `when`(fixture.goalIndicators.findById(indicator.id)).thenReturn(Optional.of(indicator))
        `when`(fixture.goalIndicators.findAllByDevelopmentProgramIdOrderByDisplayOrderAsc(global.id)).thenReturn(emptyList())
        assertEquals(indicator.id, fixture.service.createIndicator(jwt, organizationId, program.id, UpsertGoalIndicatorRequest(" New ", priority = true)).indicators.single().id)
        assertEquals("Updated", fixture.service.updateIndicator(jwt, organizationId, program.id, indicator.id, UpsertGoalIndicatorRequest("Updated")).indicators.single().name)
        assertThrows(IllegalArgumentException::class.java) { fixture.service.createIndicator(jwt, organizationId, global.id, UpsertGoalIndicatorRequest("Nope")) }
        assertThrows(IllegalArgumentException::class.java) { fixture.service.archiveIndicator(jwt, organizationId, program.id, indicator.id) }
        val second = DevelopmentProgramItem(organizationId = organizationId, developmentProgramId = program.id, name = "Second")
        `when`(fixture.goalIndicators.findAllByDevelopmentProgramIdOrderByDisplayOrderAsc(program.id)).thenReturn(listOf(indicator, second))
        assertEquals(false, fixture.service.archiveIndicator(jwt, organizationId, program.id, indicator.id).indicators.first { it.id == indicator.id }.active)
    }

    @Test
    fun `assign rejects inactive duplicate mismatched and indicatorless programs`() {
        val fixture = GoalServiceFixture()
        val jwt = mock(Jwt::class.java)
        val organizationId = UUID.randomUUID()
        val child = Child(organizationId = organizationId, dateOfBirth = LocalDate.now().minusYears(2))
        val level = LearningLevel(organizationId = null, name = "Toddler", minAgeMonths = 12, maxAgeMonths = 36)
        val curriculum = CurriculumProgram(organizationId = null, name = "Kurikulum", active = true)
        val program = DevelopmentProgram(organizationId = organizationId, learningLevelId = level.id, name = "Program", active = true)
        val scope = fixture.scope(organizationId)
        `when`(fixture.access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN, Role.STAFF), readOnly = false)).thenReturn(scope)
        `when`(fixture.childScopes.requireStaffManagedChild(scope, child.id, organizationId)).thenReturn(child)
        `when`(fixture.curriculumPrograms.findById(curriculum.id)).thenReturn(Optional.of(curriculum))
        `when`(fixture.programs.findById(program.id)).thenReturn(Optional.of(program))
        `when`(fixture.curriculumProgramPrograms.existsByCurriculumProgramIdAndDevelopmentProgramId(curriculum.id, program.id)).thenReturn(true)
        `when`(fixture.levels.findById(level.id)).thenReturn(Optional.of(level))
        `when`(fixture.goals.existsByChildIdAndProgramIdAndStatus(child.id, program.id, ChildGoalStatus.ACTIVE)).thenReturn(false)
        `when`(fixture.goalIndicators.findAllByDevelopmentProgramIdOrderByDisplayOrderAsc(program.id)).thenReturn(emptyList())
        assertThrows(IllegalArgumentException::class.java) { fixture.service.assign(jwt, organizationId, child.id, AssignChildGoalRequest(curriculum.id, program.id)) }
        `when`(fixture.goalIndicators.findAllByDevelopmentProgramIdOrderByDisplayOrderAsc(program.id)).thenReturn(listOf(DevelopmentProgramItem(developmentProgramId = program.id, active = true)))
        program.active = false
        assertThrows(IllegalArgumentException::class.java) { fixture.service.assign(jwt, organizationId, child.id, AssignChildGoalRequest(curriculum.id, program.id)) }
        program.active = true
        `when`(fixture.curriculumProgramPrograms.existsByCurriculumProgramIdAndDevelopmentProgramId(curriculum.id, program.id)).thenReturn(false)
        assertThrows(IllegalArgumentException::class.java) { fixture.service.assign(jwt, organizationId, child.id, AssignChildGoalRequest(curriculum.id, program.id)) }
        `when`(fixture.curriculumProgramPrograms.existsByCurriculumProgramIdAndDevelopmentProgramId(curriculum.id, program.id)).thenReturn(true)
        `when`(fixture.goals.existsByChildIdAndProgramIdAndStatus(child.id, program.id, ChildGoalStatus.ACTIVE)).thenReturn(true)
        assertThrows(IllegalArgumentException::class.java) { fixture.service.assign(jwt, organizationId, child.id, AssignChildGoalRequest(curriculum.id, program.id)) }
    }

    @Test
    fun `check-in media and date validation reject malformed data and expose stored media`() {
        val fixture = GoalServiceFixture()
        val jwt = mock(Jwt::class.java)
        val organizationId = UUID.randomUUID()
        val date = LocalDate.of(2026, 8, 1)
        val child = Child(organizationId = organizationId)
        val program = DevelopmentProgram(organizationId = organizationId, name = "Program", durationDays = 2)
        val goal = ChildGoal(organizationId = organizationId, childId = child.id, programId = program.id, startsOn = date)
        val indicator = DevelopmentProgramItem(organizationId = organizationId, developmentProgramId = program.id, name = "Indikator")
        val scope = fixture.scope(organizationId)
        `when`(fixture.access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN, Role.STAFF), readOnly = false)).thenReturn(scope)
        `when`(fixture.access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN, Role.STAFF, Role.PARENT), readOnly = true)).thenReturn(scope)
        `when`(fixture.goals.findById(goal.id)).thenReturn(Optional.of(goal))
        `when`(fixture.childScopes.requireStaffManagedChild(scope, child.id, organizationId)).thenReturn(child)
        `when`(fixture.programs.findById(program.id)).thenReturn(Optional.of(program))
        `when`(fixture.goalIndicators.findById(indicator.id)).thenReturn(Optional.of(indicator))
        `when`(fixture.goalIndicators.findAllByDevelopmentProgramIdOrderByDisplayOrderAsc(program.id)).thenReturn(listOf(indicator))
        `when`(fixture.checkIns.findByChildGoalIdAndIndicatorIdAndCheckInDate(goal.id, indicator.id, date)).thenReturn(null)
        `when`(fixture.checkIns.save(any(ChildGoalCheckIn::class.java))).thenAnswer { it.arguments[0] }
        val jpeg = Base64.getEncoder().encodeToString(byteArrayOf(0xFF.toByte(), 0xD8.toByte(), 0xFF.toByte()))
        val audio = Base64.getEncoder().encodeToString(byteArrayOf(1, 2, 3))
        fixture.service.recordCheckIn(jwt, organizationId, goal.id, date, GoalCheckInRequest(indicator.id, GoalCheckInOutcome.NO, note = "  ", photo = GoalPhotoInput("IMAGE/JPEG", jpeg), audio = GoalAudioInput("audio/m4a", audio, 20)))
        val saved = ChildGoalCheckIn(organizationId = organizationId, childGoalId = goal.id, indicatorId = indicator.id, checkInDate = date, photoContentType = null, photoData = byteArrayOf(1), audioContentType = null, audioData = byteArrayOf(2), audioDurationMs = 20)
        `when`(fixture.checkIns.findByChildGoalIdAndIndicatorIdAndCheckInDate(goal.id, indicator.id, date)).thenReturn(saved)
        assertEquals("image/jpeg", fixture.service.checkInPhoto(jwt, organizationId, goal.id, date, indicator.id).contentType)
        assertEquals("audio/mp4", fixture.service.checkInAudio(jwt, organizationId, goal.id, date, indicator.id).contentType)
        assertThrows(IllegalArgumentException::class.java) { fixture.service.recordCheckIn(jwt, organizationId, goal.id, date.minusDays(1), GoalCheckInRequest(indicator.id, GoalCheckInOutcome.YES)) }
        assertThrows(IllegalArgumentException::class.java) { fixture.service.recordCheckIn(jwt, organizationId, goal.id, date, GoalCheckInRequest(indicator.id, GoalCheckInOutcome.YES, photo = GoalPhotoInput("image/gif", jpeg))) }
        assertThrows(IllegalArgumentException::class.java) { fixture.service.recordCheckIn(jwt, organizationId, goal.id, date, GoalCheckInRequest(indicator.id, GoalCheckInOutcome.YES, audio = GoalAudioInput("audio/wav", audio))) }
    }

    @Test
    fun `goal media validators reject malformed headers, sizes, and encodings`() {
        val fixture = GoalServiceFixture()
        val jwt = mock(Jwt::class.java)
        val organizationId = UUID.randomUUID()
        val date = LocalDate.of(2026, 8, 1)
        val child = Child(organizationId = organizationId)
        val program = DevelopmentProgram(organizationId = organizationId, name = "Program", durationDays = 2)
        val goal = ChildGoal(organizationId = organizationId, childId = child.id, programId = program.id, startsOn = date)
        val indicator = DevelopmentProgramItem(organizationId = organizationId, developmentProgramId = program.id, name = "Indikator")
        val scope = fixture.scope(organizationId)
        `when`(fixture.access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN, Role.STAFF), readOnly = false)).thenReturn(scope)
        `when`(fixture.goals.findById(goal.id)).thenReturn(Optional.of(goal))
        `when`(fixture.childScopes.requireStaffManagedChild(scope, child.id, organizationId)).thenReturn(child)
        `when`(fixture.programs.findById(program.id)).thenReturn(Optional.of(program))
        `when`(fixture.goalIndicators.findById(indicator.id)).thenReturn(Optional.of(indicator))
        `when`(fixture.goalIndicators.findAllByDevelopmentProgramIdOrderByDisplayOrderAsc(program.id)).thenReturn(listOf(indicator))
        `when`(fixture.checkIns.findByChildGoalIdAndIndicatorIdAndCheckInDate(goal.id, indicator.id, date)).thenReturn(null)
        val invalidPhotos = listOf(
            GoalPhotoInput("image/gif", "AA=="),
            GoalPhotoInput("image/png", "not-base64"),
            GoalPhotoInput("image/png", ""),
            GoalPhotoInput("image/png", Base64.getEncoder().encodeToString(byteArrayOf(1, 2, 3))),
            GoalPhotoInput("image/png", Base64.getEncoder().encodeToString(ByteArray(5 * 1024 * 1024 + 1) { 1 })),
        )
        invalidPhotos.forEach { photo ->
            assertThrows(IllegalArgumentException::class.java) {
                fixture.service.recordCheckIn(jwt, organizationId, goal.id, date, GoalCheckInRequest(indicator.id, GoalCheckInOutcome.YES, photo = photo))
            }
        }
        val invalidAudio = listOf(
            GoalAudioInput("audio/wav", "AA=="),
            GoalAudioInput("audio/mp4", "not-base64"),
            GoalAudioInput("audio/mp4", ""),
            GoalAudioInput("audio/mp4", Base64.getEncoder().encodeToString(ByteArray(10 * 1024 * 1024 + 1) { 1 })),
        )
        invalidAudio.forEach { audio ->
            assertThrows(IllegalArgumentException::class.java) {
                fixture.service.recordCheckIn(jwt, organizationId, goal.id, date, GoalCheckInRequest(indicator.id, GoalCheckInOutcome.YES, audio = audio))
            }
        }
    }

    @Test
    fun `tenant program can be created and updated after validating its own learning level`() {
        val fixture = GoalServiceFixture()
        val jwt = mock(Jwt::class.java)
        val organizationId = UUID.randomUUID()
        val level = LearningLevel(organizationId = organizationId, name = "Toddler")
        val scope = fixture.scope(organizationId)
        val request = UpsertDevelopmentProgramRequest(level.id, "  Bahasa  ", "  Deskripsi  ", 14, 60, 3, GoalDomain.BAHASA_KOMUNIKASI, listOf(" Bicara "))
        `when`(fixture.access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN), readOnly = false)).thenReturn(scope)
        `when`(fixture.levels.findById(level.id)).thenReturn(Optional.of(level))
        `when`(fixture.programs.findByOrganizationIdAndLearningLevelIdAndDomain(organizationId, level.id, GoalDomain.BAHASA_KOMUNIKASI)).thenReturn(null)
        `when`(fixture.programs.save(any(DevelopmentProgram::class.java))).thenAnswer { it.arguments[0] }
        val created = fixture.service.createProgram(jwt, organizationId, request)
        assertEquals("Bahasa", created.name)
        assertEquals("Deskripsi", created.description)
        assertEquals(DevelopmentProgramSource.TENANT, created.source)

        val stored = DevelopmentProgram(id = created.id, organizationId = organizationId, learningLevelId = level.id, name = "Lama", domain = GoalDomain.BAHASA_KOMUNIKASI)
        `when`(fixture.programs.findById(stored.id)).thenReturn(Optional.of(stored))
        `when`(fixture.programs.findByOrganizationIdAndLearningLevelIdAndDomain(organizationId, level.id, GoalDomain.KOGNITIF)).thenReturn(null)
        val updated = fixture.service.updateProgram(jwt, organizationId, stored.id, request.copy(name = "  Baru  ", domain = GoalDomain.KOGNITIF))
        assertEquals("Baru", updated.name)
        assertEquals(GoalDomain.KOGNITIF, updated.domain)
    }

    @Test
    fun `tenant program mutations reject foreign levels and duplicate combinations`() {
        val fixture = GoalServiceFixture()
        val jwt = mock(Jwt::class.java)
        val organizationId = UUID.randomUUID()
        val foreignLevel = LearningLevel(organizationId = UUID.randomUUID())
        val scope = fixture.scope(organizationId)
        val request = UpsertDevelopmentProgramRequest(foreignLevel.id, "Program", durationDays = 1, minimumYesPercent = 0, minimumYesStreak = 0, domain = GoalDomain.KOGNITIF)
        `when`(fixture.access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN), readOnly = false)).thenReturn(scope)
        `when`(fixture.levels.findById(foreignLevel.id)).thenReturn(Optional.of(foreignLevel))
        assertThrows(IllegalArgumentException::class.java) { fixture.service.createProgram(jwt, organizationId, request) }

        val level = LearningLevel(organizationId = organizationId)
        val program = DevelopmentProgram(id = UUID.randomUUID(), organizationId = organizationId, learningLevelId = level.id, domain = GoalDomain.KOGNITIF)
        `when`(fixture.levels.findById(level.id)).thenReturn(Optional.of(level))
        `when`(fixture.programs.findById(program.id)).thenReturn(Optional.of(program))
        `when`(fixture.programs.findByOrganizationIdAndLearningLevelIdAndDomain(organizationId, level.id, GoalDomain.BAHASA_KOMUNIKASI)).thenReturn(DevelopmentProgram(organizationId = organizationId))
        assertThrows(IllegalArgumentException::class.java) { fixture.service.updateProgram(jwt, organizationId, program.id, request.copy(learningLevelId = level.id, domain = GoalDomain.BAHASA_KOMUNIKASI)) }
    }

    @Test
    fun `finalize requires an active goal and trims the final summary`() {
        val fixture = GoalServiceFixture()
        val jwt = mock(Jwt::class.java)
        val organizationId = UUID.randomUUID()
        val child = Child(organizationId = organizationId)
        val program = DevelopmentProgram(organizationId = organizationId, name = "Program", durationDays = 2)
        val goal = ChildGoal(organizationId = organizationId, childId = child.id, programId = program.id, startsOn = LocalDate.now())
        val scope = fixture.scope(organizationId)
        `when`(fixture.access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN, Role.STAFF), readOnly = false)).thenReturn(scope)
        `when`(fixture.goals.findById(goal.id)).thenReturn(Optional.of(goal))
        `when`(fixture.childScopes.requireStaffManagedChild(scope, child.id, organizationId)).thenReturn(child)
        `when`(fixture.programs.findById(program.id)).thenReturn(Optional.of(program))
        `when`(fixture.goalIndicators.findAllByDevelopmentProgramIdOrderByDisplayOrderAsc(program.id)).thenReturn(emptyList())
        `when`(fixture.checkIns.findAllByChildGoalIdOrderByCheckInDateAsc(goal.id)).thenReturn(emptyList())

        val result = fixture.service.finalize(jwt, organizationId, goal.id, FinalizeChildGoalRequest(ChildGoalOutcome.ACHIEVED, "  Selesai  "))
        assertEquals(ChildGoalStatus.COMPLETED, result.status)
        assertEquals("Selesai", result.finalSummary)
        assertThrows(IllegalArgumentException::class.java) { fixture.service.finalize(jwt, organizationId, goal.id, FinalizeChildGoalRequest(ChildGoalOutcome.ACHIEVED, "Again")) }
    }

    @Test
    fun `conclusion correction rejects missing outcome, unchanged values, and blank fields`() {
        val fixture = GoalServiceFixture()
        val jwt = mock(Jwt::class.java)
        val organizationId = UUID.randomUUID()
        val goal = ChildGoal(organizationId = organizationId, status = ChildGoalStatus.COMPLETED, finalOutcome = ChildGoalOutcome.ACHIEVED, finalSummary = "Berhasil")
        val scope = fixture.scope(organizationId)
        `when`(fixture.access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN), readOnly = false)).thenReturn(scope)
        `when`(fixture.goals.findById(goal.id)).thenReturn(Optional.of(goal))

        goal.finalOutcome = null
        assertThrows(IllegalArgumentException::class.java) { fixture.service.correctConclusion(jwt, organizationId, goal.id, CorrectChildGoalConclusionRequest(ChildGoalOutcome.NOT_ACHIEVED, "x", "y")) }
        goal.finalOutcome = ChildGoalOutcome.ACHIEVED
        assertThrows(IllegalArgumentException::class.java) { fixture.service.correctConclusion(jwt, organizationId, goal.id, CorrectChildGoalConclusionRequest(ChildGoalOutcome.ACHIEVED, "Berhasil", "y")) }
        assertThrows(IllegalArgumentException::class.java) { fixture.service.correctConclusion(jwt, organizationId, goal.id, CorrectChildGoalConclusionRequest(ChildGoalOutcome.NOT_ACHIEVED, "  ", "y")) }
        assertThrows(IllegalArgumentException::class.java) { fixture.service.correctConclusion(jwt, organizationId, goal.id, CorrectChildGoalConclusionRequest(ChildGoalOutcome.NOT_ACHIEVED, "x", "  ")) }
    }

    @Test
    fun `assign matches global age bands and tenant classroom levels`() {
        val fixture = GoalServiceFixture()
        val jwt = mock(Jwt::class.java)
        val organizationId = UUID.randomUUID()
        val child = Child(organizationId = organizationId, dateOfBirth = LocalDate.now().minusYears(5))
        val globalLevel = LearningLevel(organizationId = null, minAgeMonths = 12, maxAgeMonths = 36)
        val globalProgram = DevelopmentProgram(organizationId = null, learningLevelId = globalLevel.id, active = true)
        val curriculum = CurriculumProgram(organizationId = null, active = true)
        val scope = fixture.scope(organizationId)
        `when`(fixture.access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN, Role.STAFF), readOnly = false)).thenReturn(scope)
        `when`(fixture.childScopes.requireStaffManagedChild(scope, child.id, organizationId)).thenReturn(child)
        `when`(fixture.curriculumPrograms.findById(curriculum.id)).thenReturn(Optional.of(curriculum))
        `when`(fixture.programs.findById(globalProgram.id)).thenReturn(Optional.of(globalProgram))
        `when`(fixture.curriculumProgramPrograms.existsByCurriculumProgramIdAndDevelopmentProgramId(curriculum.id, globalProgram.id)).thenReturn(true)
        `when`(fixture.levels.findById(globalLevel.id)).thenReturn(Optional.of(globalLevel))
        `when`(fixture.goalIndicators.findAllByDevelopmentProgramIdOrderByDisplayOrderAsc(globalProgram.id)).thenReturn(listOf(DevelopmentProgramItem(developmentProgramId = globalProgram.id, active = true)))
        assertThrows(IllegalArgumentException::class.java) { fixture.service.assign(jwt, organizationId, child.id, AssignChildGoalRequest(curriculum.id, globalProgram.id)) }

        val tenantLevel = LearningLevel(organizationId = organizationId)
        val classroom = com.daycare.api.persistence.Classroom(organizationId = organizationId, learningLevelId = tenantLevel.id)
        val tenantProgram = DevelopmentProgram(organizationId = organizationId, learningLevelId = tenantLevel.id, active = true)
        child.classroomId = classroom.id
        `when`(fixture.programs.findById(tenantProgram.id)).thenReturn(Optional.of(tenantProgram))
        `when`(fixture.curriculumProgramPrograms.existsByCurriculumProgramIdAndDevelopmentProgramId(curriculum.id, tenantProgram.id)).thenReturn(true)
        `when`(fixture.levels.findById(tenantLevel.id)).thenReturn(Optional.of(tenantLevel))
        `when`(fixture.classrooms.findById(classroom.id)).thenReturn(Optional.of(classroom))
        `when`(fixture.goalIndicators.findAllByDevelopmentProgramIdOrderByDisplayOrderAsc(tenantProgram.id)).thenReturn(listOf(DevelopmentProgramItem(developmentProgramId = tenantProgram.id, active = true)))
        `when`(fixture.goals.existsByChildIdAndProgramIdAndStatus(child.id, tenantProgram.id, ChildGoalStatus.ACTIVE)).thenReturn(false)
        `when`(fixture.goals.save(any(ChildGoal::class.java))).thenAnswer { it.arguments[0] }
        assertEquals(tenantProgram.id, fixture.service.assign(jwt, organizationId, child.id, AssignChildGoalRequest(curriculum.id, tenantProgram.id)).programId)
    }

    @Test
    fun `child goal response ignores incomplete days and calculates yes and missed days`() {
        val fixture = GoalServiceFixture()
        val jwt = mock(Jwt::class.java)
        val organizationId = UUID.randomUUID()
        val child = Child(organizationId = organizationId)
        val program = DevelopmentProgram(organizationId = organizationId, name = "Program", durationDays = 10, minimumYesPercent = 50, minimumYesStreak = 2)
        val goal = ChildGoal(organizationId = organizationId, childId = child.id, programId = program.id, startsOn = LocalDate.now().minusDays(2))
        val one = DevelopmentProgramItem(organizationId = organizationId, developmentProgramId = program.id, name = "Satu", active = true)
        val two = DevelopmentProgramItem(organizationId = organizationId, developmentProgramId = program.id, name = "Dua", active = true)
        val partial = ChildGoalCheckIn(organizationId = organizationId, childGoalId = goal.id, indicatorId = one.id, checkInDate = goal.startsOn, outcome = GoalCheckInOutcome.YES)
        val complete = ChildGoalCheckIn(organizationId = organizationId, childGoalId = goal.id, indicatorId = one.id, checkInDate = goal.startsOn.plusDays(1), outcome = GoalCheckInOutcome.YES)
        val completeTwo = ChildGoalCheckIn(organizationId = organizationId, childGoalId = goal.id, indicatorId = two.id, checkInDate = goal.startsOn.plusDays(1), outcome = GoalCheckInOutcome.YES)
        val scope = fixture.scope(organizationId)
        `when`(fixture.access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN, Role.STAFF, Role.PARENT), readOnly = true)).thenReturn(scope)
        `when`(fixture.childScopes.requireStaffManagedChild(scope, child.id, organizationId)).thenReturn(child)
        `when`(fixture.goals.findAllByOrganizationIdAndChildIdOrderByCreatedAtDesc(organizationId, child.id)).thenReturn(listOf(goal))
        `when`(fixture.programs.findAllById(setOf(program.id))).thenReturn(listOf(program))
        `when`(fixture.goalIndicators.findAllByDevelopmentProgramIdIn(setOf(program.id))).thenReturn(listOf(one, two))
        `when`(fixture.checkIns.findAllByChildGoalIdIn(setOf(goal.id))).thenReturn(listOf(partial, complete, completeTwo))
        val result = fixture.service.childGoals(jwt, organizationId, child.id).single()
        assertEquals(1, result.recordedDays)
        assertEquals(1, result.yesDays)
        assertTrue(result.missedDays >= 1)
    }

    @Test
    fun `scheduled reminders skip inactive periods and complete goals, and notify assigned staff`() {
        val fixture = GoalServiceFixture()
        val organizationId = UUID.randomUUID()
        val child = Child(organizationId = organizationId, firstName = "Alya", classroomId = UUID.randomUUID())
        val program = DevelopmentProgram(organizationId = organizationId, durationDays = 5)
        val goal = ChildGoal(organizationId = organizationId, childId = child.id, programId = program.id, startsOn = LocalDate.now())
        val indicator = DevelopmentProgramItem(organizationId = organizationId, developmentProgramId = program.id, active = true)
        val assignedId = UUID.randomUUID()
        val classroomId = child.classroomId!!
        `when`(fixture.goals.findAllByStatus(ChildGoalStatus.ACTIVE)).thenReturn(listOf(goal))
        `when`(fixture.programs.findAllById(setOf(program.id))).thenReturn(listOf(program))
        `when`(fixture.goalIndicators.findAllByDevelopmentProgramIdIn(setOf(program.id))).thenReturn(listOf(indicator))
        `when`(fixture.checkIns.findAllByChildGoalIdInAndCheckInDate(setOf(goal.id), LocalDate.now())).thenReturn(emptyList())
        `when`(fixture.children.findAllById(setOf(child.id))).thenReturn(listOf(child))
        `when`(fixture.childStaffAssignments.findAllByOrganizationIdAndChildIdOrderByCreatedAtDesc(organizationId, child.id)).thenReturn(listOf(ChildStaffAssignment(organizationId = organizationId, childId = child.id, userId = assignedId)))
        `when`(fixture.classroomStaffAssignments.findAllByOrganizationIdAndClassroomIdOrderByCreatedAtDesc(organizationId, classroomId)).thenReturn(listOf(ClassroomStaffAssignment(organizationId = organizationId, classroomId = classroomId, userId = assignedId)))
        fixture.service.sendMissedCheckInReminders()
        verify(fixture.notifications, times(1)).notify(organizationId, assignedId, "Check-in program belum diisi", "Check-in program hari ini untuk Alya belum diisi.", "/goals?childId=${child.id}", setOf(com.daycare.api.realtime.RealtimeFlag.GOALS))

        `when`(fixture.checkIns.findAllByChildGoalIdInAndCheckInDate(setOf(goal.id), LocalDate.now())).thenReturn(listOf(ChildGoalCheckIn(indicatorId = indicator.id, childGoalId = goal.id)))
        fixture.service.sendMissedCheckInReminders()
        verify(fixture.notifications, times(1)).notify(organizationId, assignedId, "Check-in program belum diisi", "Check-in program hari ini untuk Alya belum diisi.", "/goals?childId=${child.id}", setOf(com.daycare.api.realtime.RealtimeFlag.GOALS))
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
