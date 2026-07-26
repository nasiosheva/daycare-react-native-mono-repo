package com.daycare.api.service

import com.daycare.api.domain.Role
import com.daycare.api.domain.ChildEnrollmentStatus
import com.daycare.api.persistence.Child
import com.daycare.api.persistence.ChildRepository
import com.daycare.api.persistence.ChildStaffAssignmentRepository
import com.daycare.api.persistence.ClassroomStaffAssignmentRepository
import com.daycare.api.persistence.ChildPlacementRepository
import com.daycare.api.persistence.GuardianLinkRepository
import org.springframework.security.access.AccessDeniedException
import org.springframework.stereotype.Service
import java.util.UUID

@Service
class ChildScopeService(
    private val children: ChildRepository,
    private val guardians: GuardianLinkRepository,
    private val staffAssignments: ChildStaffAssignmentRepository,
    private val classroomAssignments: ClassroomStaffAssignmentRepository,
    private val placements: ChildPlacementRepository,
) {
    fun visibleChildren(scope: AccessScope, organizationId: UUID): List<Child> = (when (scope.membership.role) {
        Role.STAFF_ADMIN -> children.findAllByOrganizationId(organizationId)
        Role.STAFF -> (
            staffAssignments.findAllByOrganizationIdAndUserId(organizationId, scope.user.id).map { it.childId } +
                classroomAssignments.findAllByOrganizationIdAndUserId(organizationId, scope.user.id)
                    .flatMap { assignment -> placements.findAllByClassroomIdAndEndedOnIsNull(assignment.classroomId).map { it.childId } }
            ).distinct().mapNotNull { childId -> children.findById(childId).orElse(null) }
        Role.PARENT -> guardians.findAllByUserId(scope.user.id).mapNotNull { children.findById(it.childId).orElse(null) }.filter { it.organizationId == organizationId }
        Role.ADMIN -> throw AccessDeniedException("Platform administrators do not have tenant child access")
    }).filter { it.organizationId == organizationId && it.enrollmentStatus == ChildEnrollmentStatus.ACTIVE && it.active }

    fun requireStaffManagedChild(scope: AccessScope, childId: UUID, organizationId: UUID): Child {
        val child = requireOrganizationChild(childId, organizationId)
        if (!isStaffManagedChild(scope, childId, organizationId)) throw AccessDeniedException("Staff member is not assigned to this child")
        return child
    }

    fun isStaffManagedChild(scope: AccessScope, childId: UUID, organizationId: UUID): Boolean = when (scope.membership.role) {
        Role.STAFF_ADMIN -> true
        Role.STAFF -> staffAssignments.existsByOrganizationIdAndChildIdAndUserId(organizationId, childId, scope.user.id) ||
            placements.findByChildIdAndEndedOnIsNull(childId)?.let { placement ->
                classroomAssignments.existsByOrganizationIdAndClassroomIdAndUserId(organizationId, placement.classroomId, scope.user.id)
            } == true
        else -> false
    }

    fun canStaffPlaceChildInClassroom(scope: AccessScope, childId: UUID, classroomId: UUID, organizationId: UUID): Boolean = when (scope.membership.role) {
        Role.STAFF_ADMIN -> true
        Role.STAFF -> {
            val directlyAssigned = staffAssignments.existsByOrganizationIdAndChildIdAndUserId(organizationId, childId, scope.user.id)
            val currentPlacement = placements.findByChildIdAndEndedOnIsNull(childId)
            directlyAssigned || (currentPlacement != null &&
                classroomAssignments.existsByOrganizationIdAndClassroomIdAndUserId(organizationId, currentPlacement.classroomId, scope.user.id) &&
                classroomAssignments.existsByOrganizationIdAndClassroomIdAndUserId(organizationId, classroomId, scope.user.id))
        }
        else -> false
    }

    fun requireParentLinkedChild(scope: AccessScope, childId: UUID, organizationId: UUID): Child {
        val child = requireOrganizationChild(childId, organizationId)
        if (!guardians.existsByChildIdAndUserId(childId, scope.user.id)) throw AccessDeniedException("You cannot access this child")
        return child
    }

    private fun requireOrganizationChild(childId: UUID, organizationId: UUID): Child {
        val child = children.findById(childId).orElseThrow { IllegalArgumentException("Child was not found") }
        if (child.organizationId != organizationId) throw AccessDeniedException("Child belongs to a different organization")
        require(child.active) { "Child is inactive" }
        return child
    }
}
