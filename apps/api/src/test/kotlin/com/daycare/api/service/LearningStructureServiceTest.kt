package com.daycare.api.service

import com.daycare.api.domain.ChildEnrollmentStatus
import com.daycare.api.domain.InstitutionCapability
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
import com.daycare.api.persistence.ClassroomStaffAssignment
import com.daycare.api.persistence.ClassroomStaffAssignmentRepository
import com.daycare.api.persistence.CurriculumProgramRepository
import com.daycare.api.persistence.DevelopmentProgramRepository
import com.daycare.api.persistence.CurriculumProgram
import com.daycare.api.persistence.LearningLevelCurriculumProgramRepository
import com.daycare.api.persistence.LearningLevelRepository
import com.daycare.api.persistence.LearningLevel
import com.daycare.api.persistence.LearningLevelCurriculumProgram
import com.daycare.api.persistence.ChildPlacement
import com.daycare.api.domain.ChildCareRole
import java.time.LocalDate
import com.daycare.api.persistence.Membership
import com.daycare.api.persistence.MembershipRepository
import com.daycare.api.persistence.UserProfile
import com.daycare.api.persistence.UserProfileRepository
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.mockito.Mockito.mock
import org.mockito.Mockito.doThrow
import org.mockito.Mockito.verify
import org.mockito.Mockito.never
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
    private val developmentPrograms = mock(DevelopmentProgramRepository::class.java)
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
    private val defaultStaffScope = AccessScope(UserProfile(), Membership(role = Role.STAFF_ADMIN), emptySet(), emptySet())

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
    fun `Staff classroom list includes only their assigned classrooms`() {
        val staff = UserProfile()
        val assigned = Classroom(organizationId = organizationId, name = "Kelas Pelangi")
        val other = Classroom(organizationId = organizationId, name = "Kelas Bulan")
        val scope = AccessScope(staff, Membership(userId = staff.id, organizationId = organizationId, role = Role.STAFF), emptySet(), setOf(InstitutionCapability.DAYCARE_OPERATIONS))
        `when`(access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN, Role.STAFF), readOnly = true)).thenReturn(scope)
        `when`(classroomAssignments.findAllByOrganizationIdAndUserId(organizationId, staff.id)).thenReturn(listOf(ClassroomStaffAssignment(organizationId = organizationId, classroomId = assigned.id, userId = staff.id)))
        `when`(classrooms.findAllByOrganizationIdOrderByNameAsc(organizationId)).thenReturn(listOf(assigned, other))

        val response = service().classrooms(jwt, organizationId)

        assertEquals(listOf(assigned.id), response.map { it.id })
    }

    @Test
    fun `catalog-only tenant cannot read legacy classrooms`() {
        val scope = AccessScope(UserProfile(), Membership(role = Role.STAFF_ADMIN), emptySet(), emptySet())
        `when`(access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN, Role.STAFF), readOnly = true)).thenReturn(scope)
        doThrow(AccessDeniedException("This feature is not enabled for the institution"))
            .`when`(access).requireAnyCapability(scope, setOf(InstitutionCapability.DAYCARE_OPERATIONS, InstitutionCapability.ACADEMIC_CURRICULUM))

        assertThrows(AccessDeniedException::class.java) {
            service().classrooms(jwt, organizationId)
        }
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
        `when`(access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN)))
            .thenReturn(defaultStaffScope)
        `when`(access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN, Role.STAFF)))
            .thenReturn(defaultStaffScope)
        `when`(access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN, Role.STAFF), readOnly = true))
            .thenReturn(defaultStaffScope)
    }

    @Test
    fun `Platform Admin creates a global learning level`() {
        `when`(platformAccess.requirePlatformAdmin(jwt)).thenReturn(UserProfile())
        `when`(levels.save(any())).thenAnswer { it.arguments[0] }

        val response = service().createGlobalLevel(jwt, UpsertLearningLevelRequest(name = "Toddler", minAgeMonths = 12, maxAgeMonths = 24))

        assertEquals("Toddler", response.name)
        assertEquals(LearningLevelSource.GLOBAL, response.source)
    }

    @Test
    fun `templates and global level lifecycle expose institution-specific options`() {
        val scope = AccessScope(UserProfile(), Membership(role = Role.STAFF_ADMIN), setOf("DAYCARE", "PAUD", "TK"), setOf(InstitutionCapability.DAYCARE_OPERATIONS))
        `when`(access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN, Role.STAFF), readOnly = true)).thenReturn(scope)
        `when`(levels.findAllByOrganizationIdIsNullOrderByDisplayOrderAscNameAsc()).thenReturn(emptyList())
        `when`(platformAccess.requirePlatformAdmin(jwt)).thenReturn(UserProfile())
        `when`(levels.save(any(LearningLevel::class.java))).thenAnswer { it.arguments[0] }
        val global = LearningLevel(organizationId = null, name = "Global", minAgeMonths = 12, maxAgeMonths = 24)
        `when`(levels.findById(global.id)).thenReturn(Optional.of(global))
        `when`(levelPrograms.findAllByLearningLevelId(global.id)).thenReturn(emptyList())
        val service = service()

        val templates = service.templates(jwt, organizationId)
        assertEquals(listOf("NURSERY", "TODDLER", "PAUD", "TK_A", "TK_B"), templates.map { it.code })
        service.globalLevels(jwt)
        assertEquals("Updated", service.updateGlobalLevel(jwt, global.id, UpsertLearningLevelRequest(" Updated ", 1, 30)).name)
    }

    @Test
    fun `classroom and assignment lifecycle validates references and maps staff`() {
        allowStaffAccess()
        val branch = Branch(organizationId = organizationId, name = "Utama", active = true)
        val level = LearningLevel(organizationId = organizationId, name = "Toddler")
        val classroom = Classroom(organizationId = organizationId, branchId = branch.id, learningLevelId = level.id, name = "Old")
        `when`(branches.findById(branch.id)).thenReturn(Optional.of(branch))
        `when`(levels.findById(level.id)).thenReturn(Optional.of(level))
        `when`(classrooms.save(any(Classroom::class.java))).thenAnswer { it.arguments[0] }
        `when`(classrooms.findById(classroom.id)).thenReturn(Optional.of(classroom))
        `when`(placements.countByClassroomIdAndActiveEnrollmentStatus(classroom.id, ChildEnrollmentStatus.ACTIVE)).thenReturn(0)
        val service = service()

        assertThrows(IllegalArgumentException::class.java) { service.createClassroom(jwt, organizationId, UpsertClassroomRequest(branch.id, level.id, name = "X", capacity = 0)) }
        val created = service.createClassroom(jwt, organizationId, UpsertClassroomRequest(branch.id, level.id, name = " New ", capacity = 10))
        assertEquals("New", created.name)
        assertEquals("Changed", service.updateClassroom(jwt, organizationId, classroom.id, UpsertClassroomRequest(branch.id, level.id, name = "Changed")).name)
        assertEquals(false, service.archiveClassroom(jwt, organizationId, classroom.id).active)

        val staff = UserProfile(displayName = "Staff", email = "staff@example.test")
        val membership = Membership(userId = staff.id, organizationId = organizationId, role = Role.STAFF, branchId = branch.id, active = true)
        `when`(memberships.findAllByUserIdAndOrganizationId(staff.id, organizationId)).thenReturn(listOf(membership))
        `when`(classroomAssignments.existsByOrganizationIdAndClassroomIdAndUserId(organizationId, classroom.id, staff.id)).thenReturn(false)
        `when`(classroomAssignments.save(any(ClassroomStaffAssignment::class.java))).thenAnswer { it.arguments[0] }
        `when`(users.findById(staff.id)).thenReturn(Optional.of(staff))
        val assignment = service.assignClassroomStaff(jwt, organizationId, classroom.id, AssignClassroomStaffRequest(staff.id, ChildCareRole.STAFF))
        assertEquals("Staff", assignment.displayName)
        `when`(classroomAssignments.findById(assignment.id)).thenReturn(Optional.of(ClassroomStaffAssignment(id = assignment.id, organizationId = organizationId, classroomId = classroom.id, userId = staff.id, assignmentRole = ChildCareRole.STAFF.name)))
        service.unassignClassroomStaff(jwt, organizationId, classroom.id, assignment.id)
        verify(classroomAssignments).delete(any())
    }

    @Test
    fun `classroom programs and child placement lifecycle are persisted`() {
        allowStaffAccess()
        val branch = Branch(organizationId = organizationId, name = "Utama", active = true)
        val level = LearningLevel(organizationId = organizationId, name = "Toddler")
        val classroom = Classroom(organizationId = organizationId, branchId = branch.id, learningLevelId = level.id, name = "Toddler")
        val child = Child(organizationId = organizationId, branchId = branch.id, dateOfBirth = LocalDate.now().minusYears(3), enrollmentStatus = ChildEnrollmentStatus.ACTIVE)
        `when`(classrooms.findById(classroom.id)).thenReturn(Optional.of(classroom))
        `when`(branches.findById(branch.id)).thenReturn(Optional.of(branch))
        `when`(levels.findById(level.id)).thenReturn(Optional.of(level))
        `when`(children.findById(child.id)).thenReturn(Optional.of(child))
        `when`(childScopes.canStaffPlaceChildInClassroom(defaultStaffScope, child.id, classroom.id, organizationId)).thenReturn(true)
        `when`(placements.findByChildIdAndEndedOnIsNull(child.id)).thenReturn(null)
        `when`(placements.save(any(ChildPlacement::class.java))).thenAnswer { it.arguments[0] }
        `when`(placements.countByClassroomIdAndActiveEnrollmentStatus(classroom.id, ChildEnrollmentStatus.ACTIVE)).thenReturn(0)
        val program = com.daycare.api.persistence.ClassroomProgram(organizationId = organizationId, classroomId = classroom.id, name = "Daily", description = "Plan")
        `when`(classroomPrograms.save(any())).thenAnswer { it.arguments[0] }
        `when`(classroomPrograms.findById(program.id)).thenReturn(Optional.of(program))
        val service = service()

        assertEquals("Daily", service.createClassroomProgram(jwt, organizationId, classroom.id, CreateClassroomProgramRequest(" Daily ", " Plan ")).name)
        service.removeClassroomProgram(jwt, organizationId, classroom.id, program.id)
        val placement = service.placeChild(jwt, organizationId, child.id, CreateChildPlacementRequest(classroom.id, LocalDate.now()))
        assertEquals(classroom.id, placement.classroomId)
        assertEquals(classroom.id, child.classroomId)
    }

    @Test
    fun `Platform Admin deletes a global learning level that is not used by any Development Program`() {
        val level = com.daycare.api.persistence.LearningLevel(organizationId = null, name = "Toddler")
        `when`(platformAccess.requirePlatformAdmin(jwt)).thenReturn(UserProfile())
        `when`(levels.findById(level.id)).thenReturn(Optional.of(level))
        `when`(developmentPrograms.existsByLearningLevelId(level.id)).thenReturn(false)

        service().deleteGlobalLevel(jwt, level.id)

        verify(levels).delete(level)
    }

    @Test
    fun `rejects deleting a global learning level still used by a Development Program`() {
        val level = com.daycare.api.persistence.LearningLevel(organizationId = null, name = "Toddler")
        `when`(platformAccess.requirePlatformAdmin(jwt)).thenReturn(UserProfile())
        `when`(levels.findById(level.id)).thenReturn(Optional.of(level))
        `when`(developmentPrograms.existsByLearningLevelId(level.id)).thenReturn(true)

        val error = assertThrows(IllegalArgumentException::class.java) { service().deleteGlobalLevel(jwt, level.id) }

        assertEquals(LearningLevelError.ASSIGNED, error.message)
        verify(levels, never()).delete(any())
    }

    private fun service() = LearningStructureService(
        access, platformAccess, levels, levelPrograms, programs, developmentPrograms, classrooms, placements, children, academicYears,
        memberships, users, classroomAssignments, classroomPrograms, branchCapacities, branches, childScopes, branchFilters,
    )
}
