package com.daycare.api.service

import com.daycare.api.domain.ChildEnrollmentStatus
import com.daycare.api.domain.Role
import com.daycare.api.persistence.AcademicYearRepository
import com.daycare.api.persistence.BranchCapacitySettingRepository
import com.daycare.api.persistence.BranchRepository
import com.daycare.api.persistence.Branch
import com.daycare.api.persistence.Child
import com.daycare.api.persistence.ChildPlacementRepository
import com.daycare.api.persistence.ChildRepository
import com.daycare.api.persistence.Classroom
import com.daycare.api.persistence.ClassroomProgramRepository
import com.daycare.api.persistence.ClassroomRepository
import com.daycare.api.persistence.ClassroomStaffAssignmentRepository
import com.daycare.api.persistence.CurriculumProgramRepository
import com.daycare.api.persistence.CurriculumProgram
import com.daycare.api.persistence.LearningLevelCurriculumProgramRepository
import com.daycare.api.persistence.LearningLevelRepository
import com.daycare.api.persistence.Membership
import com.daycare.api.persistence.MembershipRepository
import com.daycare.api.persistence.UserProfile
import com.daycare.api.persistence.UserProfileRepository
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.mockito.Mockito.mock
import org.mockito.Mockito.verify
import org.mockito.Mockito.`when`
import org.mockito.Mockito.any
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.security.access.AccessDeniedException
import java.util.Optional
import java.util.UUID

class LearningStructureServiceTest {
    private val access = mock(AccessService::class.java)
    private val platformAccess = mock(PlatformAccessService::class.java)
    private val levels = mock(LearningLevelRepository::class.java)
    private val levelPrograms = mock(LearningLevelCurriculumProgramRepository::class.java)
    private val programs = mock(CurriculumProgramRepository::class.java)
    private val classrooms = mock(ClassroomRepository::class.java)
    private val placements = mock(ChildPlacementRepository::class.java)
    private val children = mock(ChildRepository::class.java)
    private val academicYears = mock(AcademicYearRepository::class.java)
    private val memberships = mock(MembershipRepository::class.java)
    private val users = mock(UserProfileRepository::class.java)
    private val classroomAssignments = mock(ClassroomStaffAssignmentRepository::class.java)
    private val classroomPrograms = mock(ClassroomProgramRepository::class.java)
    private val branchCapacities = mock(BranchCapacitySettingRepository::class.java)
    private val branches = mock(BranchRepository::class.java)
    private val childScopes = mock(ChildScopeService::class.java)
    private val branchFilters = mock(BranchListFilterService::class.java)
    private val organizationId = UUID.randomUUID()
    private val jwt = mock(Jwt::class.java)

    @Test
    fun `classroom active total counts only approved Parent enrollments`() {
        val classroom = Classroom(organizationId = organizationId, name = "Kelas Matahari")
        allowStaffAccess()
        `when`(classrooms.findAllByOrganizationIdOrderByNameAsc(organizationId)).thenReturn(listOf(classroom))
        `when`(placements.countByClassroomIdAndActiveEnrollmentStatus(classroom.id, ChildEnrollmentStatus.ACTIVE)).thenReturn(1)

        val response = service().classrooms(jwt, organizationId).single()

        assertEquals(1, response.activeChildren)
        verify(placements).countByClassroomIdAndActiveEnrollmentStatus(classroom.id, ChildEnrollmentStatus.ACTIVE)
    }

    @Test
    fun `pending Parent application cannot be placed in a classroom`() {
        val child = Child(organizationId = organizationId, enrollmentStatus = ChildEnrollmentStatus.PENDING)
        allowStaffAccess()
        `when`(children.findById(child.id)).thenReturn(Optional.of(child))

        assertThrows(IllegalArgumentException::class.java) {
            service().placeChild(jwt, organizationId, child.id, CreateChildPlacementRequest(UUID.randomUUID()))
        }
    }

    @Test
    fun `Staff placement requires an assigned child`() {
        val childId = UUID.randomUUID()
        val scope = AccessScope(UserProfile(), Membership(role = Role.STAFF), emptySet(), emptySet())
        `when`(access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN, Role.STAFF))).thenReturn(scope)
        `when`(childScopes.requireStaffManagedChild(scope, childId, organizationId)).thenThrow(AccessDeniedException("Staff member is not assigned to this child"))

        assertThrows(AccessDeniedException::class.java) {
            service().placeChild(jwt, organizationId, childId, CreateChildPlacementRequest(UUID.randomUUID()))
        }

        verify(childScopes).requireStaffManagedChild(scope, childId, organizationId)
    }

    @Test
    fun `placement options include only current staff permitted same branch classrooms`() {
        val staffId = UUID.randomUUID()
        val child = Child(organizationId = organizationId, branchId = UUID.randomUUID(), enrollmentStatus = ChildEnrollmentStatus.ACTIVE)
        val allowed = Classroom(organizationId = organizationId, branchId = child.branchId, learningLevelId = UUID.randomUUID(), name = "Kelas Boleh")
        val differentBranch = Classroom(organizationId = organizationId, branchId = UUID.randomUUID(), learningLevelId = UUID.randomUUID(), name = "Cabang Lain")
        val noLevel = Classroom(organizationId = organizationId, branchId = child.branchId, name = "Tanpa Tingkatan")
        val scope = AccessScope(UserProfile(id = staffId), Membership(userId = staffId, organizationId = organizationId, role = Role.STAFF), emptySet(), emptySet())
        `when`(access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN, Role.STAFF))).thenReturn(scope)
        `when`(childScopes.requireStaffManagedChild(scope, child.id, organizationId)).thenReturn(child)
        `when`(branches.findAllByOrganizationIdAndActiveTrueOrderByNameAsc(organizationId)).thenReturn(listOf(Branch(id = child.branchId, organizationId = organizationId, name = "Utama")))
        `when`(classrooms.findAllByOrganizationIdAndActiveTrueOrderByNameAsc(organizationId)).thenReturn(listOf(allowed, differentBranch, noLevel))
        `when`(childScopes.canStaffPlaceChildInClassroom(scope, child.id, allowed.id, organizationId)).thenReturn(true)
        `when`(placements.countByClassroomIdAndActiveEnrollmentStatus(allowed.id, ChildEnrollmentStatus.ACTIVE)).thenReturn(0)

        val options = service().placementOptions(jwt, organizationId, child.id)

        assertEquals(listOf(allowed.id), options.map { it.id })
        assertTrue(options.single().active)
    }

    @Test
    fun `placement mutation rejects a classroom outside the staff assignment scope`() {
        val staffId = UUID.randomUUID()
        val child = Child(organizationId = organizationId, branchId = UUID.randomUUID(), enrollmentStatus = ChildEnrollmentStatus.ACTIVE)
        val classroom = Classroom(organizationId = organizationId, branchId = child.branchId, learningLevelId = UUID.randomUUID(), name = "Kelas Lain")
        val scope = AccessScope(UserProfile(id = staffId), Membership(userId = staffId, organizationId = organizationId, role = Role.STAFF), emptySet(), emptySet())
        `when`(access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN, Role.STAFF))).thenReturn(scope)
        `when`(childScopes.requireStaffManagedChild(scope, child.id, organizationId)).thenReturn(child)
        `when`(classrooms.findById(classroom.id)).thenReturn(Optional.of(classroom))
        `when`(childScopes.canStaffPlaceChildInClassroom(scope, child.id, classroom.id, organizationId)).thenReturn(false)

        assertThrows(IllegalArgumentException::class.java) {
            service().placeChild(jwt, organizationId, child.id, CreateChildPlacementRequest(classroom.id))
        }
    }

    @Test
    fun `tenant level can link a global curriculum program`() {
        val program = CurriculumProgram(name = "Fase Fondasi", description = "Program bersama")
        val scope = AccessScope(UserProfile(), Membership(role = Role.STAFF_ADMIN), emptySet(), emptySet())
        `when`(access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN))).thenReturn(scope)
        `when`(programs.findById(program.id)).thenReturn(Optional.of(program))
        `when`(levels.save(any(com.daycare.api.persistence.LearningLevel::class.java))).thenAnswer { it.arguments[0] }

        service().createLevel(jwt, organizationId, UpsertLearningLevelRequest(name = "TK A", curriculumProgramIds = setOf(program.id)))

        verify(programs).findById(program.id)
    }

    private fun allowStaffAccess() {
        `when`(access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN, Role.STAFF)))
            .thenReturn(AccessScope(UserProfile(), Membership(role = Role.STAFF_ADMIN), emptySet(), emptySet()))
    }

    private fun service() = LearningStructureService(
        access, platformAccess, levels, levelPrograms, programs, classrooms, placements, children, academicYears,
        memberships, users, classroomAssignments, classroomPrograms, branchCapacities, branches, childScopes, branchFilters,
    )
}
