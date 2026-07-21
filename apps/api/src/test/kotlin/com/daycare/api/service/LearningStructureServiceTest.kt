package com.daycare.api.service

import com.daycare.api.domain.ChildEnrollmentStatus
import com.daycare.api.domain.Role
import com.daycare.api.persistence.AcademicYearRepository
import com.daycare.api.persistence.BranchCapacitySettingRepository
import com.daycare.api.persistence.BranchRepository
import com.daycare.api.persistence.Child
import com.daycare.api.persistence.ChildPlacementRepository
import com.daycare.api.persistence.ChildRepository
import com.daycare.api.persistence.Classroom
import com.daycare.api.persistence.ClassroomProgramRepository
import com.daycare.api.persistence.ClassroomRepository
import com.daycare.api.persistence.ClassroomStaffAssignmentRepository
import com.daycare.api.persistence.CurriculumProgramRepository
import com.daycare.api.persistence.LearningLevelCurriculumProgramRepository
import com.daycare.api.persistence.LearningLevelRepository
import com.daycare.api.persistence.Membership
import com.daycare.api.persistence.MembershipRepository
import com.daycare.api.persistence.UserProfile
import com.daycare.api.persistence.UserProfileRepository
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Test
import org.mockito.Mockito.mock
import org.mockito.Mockito.verify
import org.mockito.Mockito.`when`
import org.springframework.security.oauth2.jwt.Jwt
import java.util.Optional
import java.util.UUID

class LearningStructureServiceTest {
    private val access = mock(AccessService::class.java)
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

    private fun allowStaffAccess() {
        `when`(access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN, Role.STAFF)))
            .thenReturn(AccessScope(UserProfile(), Membership(), emptySet(), emptySet()))
    }

    private fun service() = LearningStructureService(
        access, levels, levelPrograms, programs, classrooms, placements, children, academicYears,
        memberships, users, classroomAssignments, classroomPrograms, branchCapacities, branches,
    )
}
