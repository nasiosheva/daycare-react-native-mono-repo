package com.daycare.api.service

import com.daycare.api.domain.ChildEnrollmentStatus
import com.daycare.api.domain.Role
import com.daycare.api.persistence.Child
import com.daycare.api.persistence.ChildRepository
import com.daycare.api.persistence.ChildStaffAssignment
import com.daycare.api.persistence.ChildStaffAssignmentRepository
import com.daycare.api.persistence.ClassroomStaffAssignmentRepository
import com.daycare.api.persistence.ChildPlacementRepository
import com.daycare.api.persistence.ChildPlacement
import com.daycare.api.persistence.ClassroomStaffAssignment
import com.daycare.api.persistence.GuardianLinkRepository
import com.daycare.api.persistence.Membership
import com.daycare.api.persistence.UserProfile
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.mockito.Mockito.mock
import org.mockito.Mockito.`when`
import org.springframework.security.access.AccessDeniedException
import java.util.Optional
import java.util.UUID

class ChildScopeServiceTest {
    private val children = mock(ChildRepository::class.java)
    private val guardians = mock(GuardianLinkRepository::class.java)
    private val assignments = mock(ChildStaffAssignmentRepository::class.java)
    private val classroomAssignments = mock(ClassroomStaffAssignmentRepository::class.java)
    private val placements = mock(ChildPlacementRepository::class.java)
    private val service = ChildScopeService(children, guardians, assignments, classroomAssignments, placements)
    private val organizationId = UUID.randomUUID()
    private val staffId = UUID.randomUUID()
    private val scope = AccessScope(UserProfile(id = staffId), Membership(userId = staffId, organizationId = organizationId, role = Role.STAFF), emptySet(), emptySet())

    @Test
    fun `staff sees only active children assigned to them`() {
        val assignedChild = Child(organizationId = organizationId, enrollmentStatus = ChildEnrollmentStatus.ACTIVE)
        val inactiveChild = Child(organizationId = organizationId, enrollmentStatus = ChildEnrollmentStatus.PENDING)
        `when`(assignments.findAllByOrganizationIdAndUserId(organizationId, staffId)).thenReturn(listOf(
            ChildStaffAssignment(organizationId = organizationId, childId = assignedChild.id, userId = staffId),
            ChildStaffAssignment(organizationId = organizationId, childId = inactiveChild.id, userId = staffId),
        ))
        `when`(classroomAssignments.findAllByOrganizationIdAndUserId(organizationId, staffId)).thenReturn(emptyList())
        `when`(children.findById(assignedChild.id)).thenReturn(Optional.of(assignedChild))
        `when`(children.findById(inactiveChild.id)).thenReturn(Optional.of(inactiveChild))

        assertEquals(listOf(assignedChild), service.visibleChildren(scope, organizationId))
    }

    @Test
    fun `staff cannot act on an unassigned child`() {
        val child = Child(organizationId = organizationId)
        `when`(children.findById(child.id)).thenReturn(Optional.of(child))
        `when`(assignments.existsByOrganizationIdAndChildIdAndUserId(organizationId, child.id, staffId)).thenReturn(false)

        assertThrows(AccessDeniedException::class.java) { service.requireStaffManagedChild(scope, child.id, organizationId) }
    }

    @Test
    fun `staff sees and manages children through active classroom assignment`() {
        val classroomId = UUID.randomUUID()
        val child = Child(organizationId = organizationId, enrollmentStatus = ChildEnrollmentStatus.ACTIVE)
        `when`(assignments.findAllByOrganizationIdAndUserId(organizationId, staffId)).thenReturn(emptyList())
        `when`(classroomAssignments.findAllByOrganizationIdAndUserId(organizationId, staffId)).thenReturn(listOf(ClassroomStaffAssignment(organizationId = organizationId, classroomId = classroomId, userId = staffId)))
        `when`(placements.findAllByClassroomIdAndEndedOnIsNull(classroomId)).thenReturn(listOf(ChildPlacement(organizationId = organizationId, childId = child.id, classroomId = classroomId)))
        `when`(children.findById(child.id)).thenReturn(Optional.of(child))
        `when`(placements.findByChildIdAndEndedOnIsNull(child.id)).thenReturn(ChildPlacement(organizationId = organizationId, childId = child.id, classroomId = classroomId))
        `when`(classroomAssignments.existsByOrganizationIdAndClassroomIdAndUserId(organizationId, classroomId, staffId)).thenReturn(true)

        assertEquals(listOf(child), service.visibleChildren(scope, organizationId))
        assertEquals(child, service.requireStaffManagedChild(scope, child.id, organizationId))
    }

    @Test
    fun `directly assigned staff can place their child in any same branch classroom`() {
        val childId = UUID.randomUUID()
        `when`(assignments.existsByOrganizationIdAndChildIdAndUserId(organizationId, childId, staffId)).thenReturn(true)

        assertTrue(service.canStaffPlaceChildInClassroom(scope, childId, UUID.randomUUID(), organizationId))
    }

    @Test
    fun `classroom scoped staff can place a child only into another assigned classroom`() {
        val childId = UUID.randomUUID()
        val currentClassroomId = UUID.randomUUID()
        val allowedClassroomId = UUID.randomUUID()
        val unavailableClassroomId = UUID.randomUUID()
        `when`(assignments.existsByOrganizationIdAndChildIdAndUserId(organizationId, childId, staffId)).thenReturn(false)
        `when`(placements.findByChildIdAndEndedOnIsNull(childId)).thenReturn(ChildPlacement(organizationId = organizationId, childId = childId, classroomId = currentClassroomId))
        `when`(classroomAssignments.existsByOrganizationIdAndClassroomIdAndUserId(organizationId, currentClassroomId, staffId)).thenReturn(true)
        `when`(classroomAssignments.existsByOrganizationIdAndClassroomIdAndUserId(organizationId, allowedClassroomId, staffId)).thenReturn(true)
        `when`(classroomAssignments.existsByOrganizationIdAndClassroomIdAndUserId(organizationId, unavailableClassroomId, staffId)).thenReturn(false)

        assertTrue(service.canStaffPlaceChildInClassroom(scope, childId, allowedClassroomId, organizationId))
        assertFalse(service.canStaffPlaceChildInClassroom(scope, childId, unavailableClassroomId, organizationId))
    }

    @Test
    fun `Staff Admin can place any tenant child`() {
        val adminScope = AccessScope(UserProfile(), Membership(organizationId = organizationId, role = Role.STAFF_ADMIN), emptySet(), emptySet())

        assertTrue(service.canStaffPlaceChildInClassroom(adminScope, UUID.randomUUID(), UUID.randomUUID(), organizationId))
    }
}
