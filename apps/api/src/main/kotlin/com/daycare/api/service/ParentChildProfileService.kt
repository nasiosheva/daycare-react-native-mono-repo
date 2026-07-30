package com.daycare.api.service

import com.daycare.api.domain.Role
import com.daycare.api.persistence.BranchRepository
import com.daycare.api.persistence.ChildPlacementRepository
import com.daycare.api.persistence.ChildProgramRepository
import com.daycare.api.persistence.ChildStaffAssignmentRepository
import com.daycare.api.persistence.ClassroomRepository
import com.daycare.api.persistence.LearningLevelRepository
import com.daycare.api.persistence.UserProfileRepository
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

data class ParentChildBranchResponse(val id: UUID, val name: String, val fullAddress: String?, val googleMapsUrl: String?)
data class ParentChildPlacementResponse(val classroomName: String, val learningLevelName: String?)
data class ParentChildStaffResponse(val displayName: String, val assignmentRole: String)
data class ParentChildProfileResponse(val child: ChildResponse, val branch: ParentChildBranchResponse, val placement: ParentChildPlacementResponse?, val programs: List<ChildProgramResponse>, val staffAssignments: List<ParentChildStaffResponse>)

@Service
class ParentChildProfileService(
    private val access: AccessService,
    private val childScopes: ChildScopeService,
    private val branches: BranchRepository,
    private val placements: ChildPlacementRepository,
    private val classrooms: ClassroomRepository,
    private val learningLevels: LearningLevelRepository,
    private val programs: ChildProgramRepository,
    private val assignments: ChildStaffAssignmentRepository,
    private val users: UserProfileRepository,
) {
    @Transactional(readOnly = true)
    fun profile(jwt: Jwt, organizationId: UUID, childId: UUID): ParentChildProfileResponse {
        val scope = access.require(jwt, organizationId, setOf(Role.PARENT), readOnly = true)
        val child = childScopes.requireParentLinkedChild(scope, childId, organizationId)
        val branch = branches.findById(child.branchId).orElseThrow { IllegalArgumentException("Branch was not found") }
        require(branch.organizationId == organizationId) { "Branch belongs to a different organization" }
        val placement = placements.findByChildIdAndEndedOnIsNull(child.id)
        val classroom = placement?.let { classrooms.findById(it.classroomId).orElse(null) }
        val level = placement?.learningLevelId?.let { learningLevels.findById(it).orElse(null) }
        return ParentChildProfileResponse(
            ChildResponse(child.id, child.organizationId, child.branchId, child.classroomId, child.firstName, child.lastName, child.nisn, child.gender, child.dateOfBirth),
            ParentChildBranchResponse(branch.id, branch.name, branch.fullAddress, branch.googleMapsUrl),
            classroom?.let { ParentChildPlacementResponse(it.name, level?.name) },
            programs.findAllByOrganizationIdAndChildIdOrderByCreatedAtDesc(organizationId, child.id).map { ChildProgramResponse(it.id, it.name, it.description) },
            assignments.findAllByOrganizationIdAndChildIdOrderByCreatedAtDesc(organizationId, child.id).mapNotNull { assignment -> users.findById(assignment.userId).map { user -> ParentChildStaffResponse(user.displayName, assignment.assignmentRole) }.orElse(null) },
        )
    }
}
