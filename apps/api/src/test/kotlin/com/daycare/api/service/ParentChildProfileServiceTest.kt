package com.daycare.api.service

// Mories Deo Hutapea,S.E.,S.Kom

import com.daycare.api.domain.Gender
import com.daycare.api.domain.Role
import com.daycare.api.persistence.Branch
import com.daycare.api.persistence.BranchRepository
import com.daycare.api.persistence.Child
import com.daycare.api.persistence.ChildPlacement
import com.daycare.api.persistence.ChildPlacementRepository
import com.daycare.api.persistence.ChildStaffAssignment
import com.daycare.api.persistence.ChildStaffAssignmentRepository
import com.daycare.api.persistence.Classroom
import com.daycare.api.persistence.ClassroomRepository
import com.daycare.api.persistence.LearningLevel
import com.daycare.api.persistence.LearningLevelRepository
import com.daycare.api.persistence.Membership
import com.daycare.api.persistence.UserProfile
import com.daycare.api.persistence.UserProfileRepository
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.Assertions.assertThrows
import org.mockito.Mockito.mock
import org.mockito.Mockito.`when`
import org.springframework.security.oauth2.jwt.Jwt
import java.util.Optional
import java.util.UUID

class ParentChildProfileServiceTest {
    @Test
    fun `profile combines branch placement programs and assigned staff`() {
        val organizationId = UUID.randomUUID()
        val child = Child(organizationId = organizationId, firstName = "Ayu", gender = Gender.FEMALE)
        val branch = Branch(id = child.branchId, organizationId = organizationId, name = "Cabang", fullAddress = "Jl. A", googleMapsUrl = "https://maps.example")
        val learningLevelId = UUID.randomUUID()
        val placement = ChildPlacement(organizationId = organizationId, childId = child.id, classroomId = UUID.randomUUID(), learningLevelId = learningLevelId)
        val classroom = Classroom(id = placement.classroomId, organizationId = organizationId, branchId = child.branchId, name = "Toddler")
        val level = LearningLevel(id = learningLevelId, name = "2-3 Tahun")
        val staffId = UUID.randomUUID()
        val assignment = ChildStaffAssignment(organizationId = organizationId, childId = child.id, userId = staffId, assignmentRole = "Wali Kelas")
        val staff = UserProfile(id = staffId, displayName = "Bu Sari")
        val access = mock(AccessService::class.java)
        val childScopes = mock(ChildScopeService::class.java)
        val branches = mock(BranchRepository::class.java)
        val placements = mock(ChildPlacementRepository::class.java)
        val classrooms = mock(ClassroomRepository::class.java)
        val levels = mock(LearningLevelRepository::class.java)
        val childPrograms = mock(ChildManagementService::class.java)
        val assignments = mock(ChildStaffAssignmentRepository::class.java)
        val users = mock(UserProfileRepository::class.java)
        val jwt = mock(Jwt::class.java)
        val parent = UserProfile(displayName = "Parent")
        val scope = AccessScope(parent, Membership(), emptySet(), emptySet())
        `when`(access.require(jwt, organizationId, setOf(Role.PARENT), readOnly = true)).thenReturn(scope)
        `when`(childScopes.requireParentLinkedChild(scope, child.id, organizationId)).thenReturn(child)
        `when`(branches.findById(child.branchId)).thenReturn(Optional.of(branch))
        `when`(placements.findByChildIdAndEndedOnIsNull(child.id)).thenReturn(placement)
        `when`(classrooms.findById(placement.classroomId)).thenReturn(Optional.of(classroom))
        `when`(levels.findById(placement.learningLevelId)).thenReturn(Optional.of(level))
        `when`(childPrograms.parentProgramResponses(organizationId, child.id, parent.id)).thenReturn(emptyList())
        `when`(assignments.findAllByOrganizationIdAndChildIdOrderByCreatedAtDesc(organizationId, child.id)).thenReturn(listOf(assignment))
        `when`(users.findById(staffId)).thenReturn(Optional.of(staff))
        val service = ParentChildProfileService(access, childScopes, branches, placements, classrooms, levels, childPrograms, assignments, users)
        val result = service.profile(jwt, organizationId, child.id)

        assertEquals("Ayu", result.child.firstName)
        assertEquals("https://maps.example", result.branch.googleMapsUrl)
        assertEquals("Toddler", result.placement?.classroomName)
        assertEquals("2-3 Tahun", result.placement?.learningLevelName)
        assertEquals("Bu Sari", result.staffAssignments.single().displayName)
    }

    @Test
    fun `profile handles missing placement data and rejects foreign branches`() {
        val organizationId = UUID.randomUUID()
        val child = Child(organizationId = organizationId, firstName = "Ayu")
        val branch = Branch(id = child.branchId, organizationId = organizationId, name = "Cabang")
        val access = mock(AccessService::class.java)
        val childScopes = mock(ChildScopeService::class.java)
        val branches = mock(BranchRepository::class.java)
        val placements = mock(ChildPlacementRepository::class.java)
        val classrooms = mock(ClassroomRepository::class.java)
        val levels = mock(LearningLevelRepository::class.java)
        val childPrograms = mock(ChildManagementService::class.java)
        val assignments = mock(ChildStaffAssignmentRepository::class.java)
        val users = mock(UserProfileRepository::class.java)
        val jwt = mock(Jwt::class.java)
        val parent = UserProfile()
        val scope = AccessScope(parent, Membership(), emptySet(), emptySet())
        `when`(access.require(jwt, organizationId, setOf(Role.PARENT), readOnly = true)).thenReturn(scope)
        `when`(childScopes.requireParentLinkedChild(scope, child.id, organizationId)).thenReturn(child)
        `when`(branches.findById(child.branchId)).thenReturn(Optional.of(branch))
        `when`(placements.findByChildIdAndEndedOnIsNull(child.id)).thenReturn(null)
        `when`(childPrograms.parentProgramResponses(organizationId, child.id, parent.id)).thenReturn(emptyList())
        `when`(assignments.findAllByOrganizationIdAndChildIdOrderByCreatedAtDesc(organizationId, child.id)).thenReturn(listOf(ChildStaffAssignment(organizationId = organizationId, childId = child.id, userId = UUID.randomUUID())))
        val service = ParentChildProfileService(access, childScopes, branches, placements, classrooms, levels, childPrograms, assignments, users)

        val result = service.profile(jwt, organizationId, child.id)
        assertEquals(null, result.placement)
        assertEquals(emptyList<ParentChildStaffResponse>(), result.staffAssignments)

        val foreignBranch = Branch(id = branch.id, organizationId = UUID.randomUUID(), name = branch.name)
        `when`(branches.findById(child.branchId)).thenReturn(Optional.of(foreignBranch))
        assertThrows(IllegalArgumentException::class.java) { service.profile(jwt, organizationId, child.id) }
    }

    @Test
    fun `profile fails when branch is missing`() {
        val organizationId = UUID.randomUUID()
        val child = Child(organizationId = organizationId)
        val access = mock(AccessService::class.java)
        val childScopes = mock(ChildScopeService::class.java)
        val branches = mock(BranchRepository::class.java)
        val jwt = mock(Jwt::class.java)
        val scope = AccessScope(UserProfile(), Membership(), emptySet(), emptySet())
        `when`(access.require(jwt, organizationId, setOf(Role.PARENT), readOnly = true)).thenReturn(scope)
        `when`(childScopes.requireParentLinkedChild(scope, child.id, organizationId)).thenReturn(child)
        `when`(branches.findById(child.branchId)).thenReturn(Optional.empty())
        val service = ParentChildProfileService(access, childScopes, branches, mock(ChildPlacementRepository::class.java), mock(ClassroomRepository::class.java), mock(LearningLevelRepository::class.java), mock(ChildManagementService::class.java), mock(ChildStaffAssignmentRepository::class.java), mock(UserProfileRepository::class.java))
        assertThrows(IllegalArgumentException::class.java) { service.profile(jwt, organizationId, child.id) }
    }
}
