package com.daycare.api.service

import com.daycare.api.domain.ChildGoalStatus
import com.daycare.api.domain.Role
import com.daycare.api.persistence.AuditLogRepository
import com.daycare.api.persistence.Child
import com.daycare.api.persistence.ChildGoal
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
import org.mockito.Mockito.any
import org.mockito.Mockito.mock
import org.mockito.Mockito.never
import org.mockito.Mockito.verify
import org.mockito.Mockito.`when`
import org.springframework.security.oauth2.jwt.Jwt
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
    val service = GoalService(access, platformAccess, childScopes, programs, curriculumPrograms, curriculumProgramPrograms, goalIndicators, goals, checkIns, levels, classrooms, guardians, audits, realtime, notifications, children, childStaffAssignments, classroomStaffAssignments, memberships)

    fun scope(organizationId: UUID) = AccessScope(UserProfile(), Membership(organizationId = organizationId, role = Role.STAFF_ADMIN), emptySet(), emptySet())
}
