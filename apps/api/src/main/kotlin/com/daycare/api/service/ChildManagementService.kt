package com.daycare.api.service

import com.daycare.api.domain.Role
import com.daycare.api.domain.Gender
import com.daycare.api.domain.ChildCareRole
import com.daycare.api.persistence.ChildProgram
import com.daycare.api.persistence.ChildProgramRepository
import com.daycare.api.persistence.ChildRepository
import com.daycare.api.persistence.ChildStaffAssignment
import com.daycare.api.persistence.ChildStaffAssignmentRepository
import com.daycare.api.persistence.GuardianLink
import com.daycare.api.persistence.GuardianLinkRepository
import com.daycare.api.persistence.Membership
import com.daycare.api.persistence.MembershipRepository
import com.daycare.api.persistence.UserProfileRepository
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.Size
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.security.access.AccessDeniedException
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.LocalDate
import java.util.UUID

data class UpdateChildRequest(@field:NotBlank @field:Size(max = 100) val firstName: String, @field:Size(max = 100) val lastName: String?, @field:Size(max = 20) val nisn: String?, val gender: Gender, val dateOfBirth: LocalDate)
data class CreateChildProgramRequest(@field:NotBlank @field:Size(max = 120) val name: String, @field:Size(max = 2_000) val description: String?)
data class AssignChildStaffRequest(val userId: UUID, val assignmentRole: ChildCareRole)
data class BindChildGuardianRequest(@field:NotBlank @field:Size(max = 254) val identifier: String)
data class ChildProgramResponse(val id: UUID, val name: String, val description: String)
data class ChildStaffAssignmentResponse(val id: UUID, val userId: UUID, val displayName: String, val email: String?, val assignmentRole: String)
data class ChildGuardianResponse(val userId: UUID, val displayName: String, val email: String?, val username: String?)
data class ChildProfileResponse(val child: ChildResponse, val programs: List<ChildProgramResponse>, val staffAssignments: List<ChildStaffAssignmentResponse>, val guardians: List<ChildGuardianResponse>)

@Service
class ChildManagementService(
    private val access: AccessService,
    private val children: ChildRepository,
    private val programs: ChildProgramRepository,
    private val assignments: ChildStaffAssignmentRepository,
    private val memberships: MembershipRepository,
    private val users: UserProfileRepository,
    private val guardianLinks: GuardianLinkRepository,
    private val childScopes: ChildScopeService,
) {
    @Transactional(readOnly = true)
    fun profile(jwt: Jwt, organizationId: UUID, childId: UUID): ChildProfileResponse {
        val scope = access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN, Role.STAFF), readOnly = true)
        val child = if (scope.membership.role == Role.STAFF) childScopes.requireStaffManagedChild(scope, childId, organizationId) else child(childId, organizationId)
        return ChildProfileResponse(childResponse(child), programResponses(organizationId, child.id), assignmentResponses(organizationId, child.id), guardianResponses(child.id))
    }

    @Transactional
    fun bindGuardian(jwt: Jwt, organizationId: UUID, childId: UUID, request: BindChildGuardianRequest): ChildGuardianResponse {
        access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN))
        val child = child(childId, organizationId)
        val identifier = request.identifier.trim()
        val parent = (if (identifier.contains("@")) users.findByEmailIgnoreCase(identifier) else users.findByUsernameIgnoreCase(identifier))
            ?: throw IllegalArgumentException("Parent account was not found")
        val parentMembership = memberships.findAllByUserIdAndOrganizationId(parent.id, organizationId).firstOrNull { it.role == Role.PARENT }
        if (parentMembership == null) memberships.save(Membership(userId = parent.id, organizationId = organizationId, role = Role.PARENT, branchId = child.branchId))
        else parentMembership.active = true
        if (!guardianLinks.existsByChildIdAndUserId(child.id, parent.id)) guardianLinks.save(GuardianLink(childId = child.id, userId = parent.id))
        return ChildGuardianResponse(parent.id, parent.displayName, parent.email, parent.username)
    }

    @Transactional
    fun unbindGuardian(jwt: Jwt, organizationId: UUID, childId: UUID, userId: UUID) {
        access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN))
        val child = child(childId, organizationId)
        val link = guardianLinks.findAllByChildId(child.id).firstOrNull { it.userId == userId } ?: throw IllegalArgumentException("This account is not linked to this child")
        guardianLinks.delete(link)
    }

    @Transactional
    fun update(jwt: Jwt, organizationId: UUID, childId: UUID, request: UpdateChildRequest): ChildResponse {
        access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN))
        val child = child(childId, organizationId)
        child.firstName = request.firstName.trim()
        child.lastName = request.lastName?.trim()?.ifBlank { null }
        child.nisn = request.nisn?.trim()?.ifBlank { null }
        require(request.gender != Gender.UNSPECIFIED) { "Gender is required" }
        child.gender = request.gender
        child.dateOfBirth = request.dateOfBirth
        return childResponse(child)
    }

    @Transactional
    fun deactivate(jwt: Jwt, organizationId: UUID, childId: UUID): ChildResponse {
        access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN))
        val child = children.findById(childId).orElseThrow { IllegalArgumentException("Child was not found") }
        require(child.organizationId == organizationId) { "Child belongs to a different organization" }
        child.active = false
        return childResponse(child)
    }

    @Transactional
    fun addProgram(jwt: Jwt, organizationId: UUID, childId: UUID, request: CreateChildProgramRequest): ChildProgramResponse {
        requireProgramManagement(jwt, organizationId, childId)
        val saved = programs.save(ChildProgram(organizationId = organizationId, childId = childId, name = request.name.trim(), description = request.description?.trim().orEmpty()))
        return ChildProgramResponse(saved.id, saved.name, saved.description)
    }

    @Transactional
    fun removeProgram(jwt: Jwt, organizationId: UUID, childId: UUID, programId: UUID) {
        requireProgramManagement(jwt, organizationId, childId)
        val program = programs.findById(programId).orElseThrow { IllegalArgumentException("Child program was not found") }
        require(program.organizationId == organizationId && program.childId == childId) { "Child program belongs to a different child" }
        programs.delete(program)
    }

    @Transactional
    fun assignStaff(jwt: Jwt, organizationId: UUID, childId: UUID, request: AssignChildStaffRequest): ChildStaffAssignmentResponse {
        access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN))
        val child = child(childId, organizationId)
        val staffMembership = memberships.findAllByUserIdAndOrganizationId(request.userId, organizationId).firstOrNull { it.active && it.role in setOf(Role.STAFF_ADMIN, Role.STAFF) }
            ?: throw IllegalArgumentException("Only active Staff Admin or Staff users can be assigned to a child")
        require(staffMembership.role != Role.STAFF || staffMembership.branchId == child.branchId) { "Staff member does not belong to this child's branch" }
        require(!assignments.existsByChildIdAndUserId(childId, request.userId)) { "Staff member is already assigned to this child" }
        val staff = users.findById(staffMembership.userId).orElseThrow { IllegalArgumentException("Tenant user was not found") }
        val saved = assignments.save(ChildStaffAssignment(organizationId = organizationId, childId = childId, userId = staff.id, assignmentRole = request.assignmentRole.name))
        return ChildStaffAssignmentResponse(saved.id, staff.id, staff.displayName, staff.email, saved.assignmentRole)
    }

    @Transactional
    fun unassignStaff(jwt: Jwt, organizationId: UUID, childId: UUID, assignmentId: UUID) {
        access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN))
        child(childId, organizationId)
        val assignment = assignments.findById(assignmentId).orElseThrow { IllegalArgumentException("Child staff assignment was not found") }
        require(assignment.organizationId == organizationId && assignment.childId == childId) { "Child staff assignment belongs to a different child" }
        assignments.delete(assignment)
    }

    private fun child(childId: UUID, organizationId: UUID) = children.findById(childId).orElseThrow { IllegalArgumentException("Child was not found") }.also { require(it.organizationId == organizationId) { "Child belongs to a different organization" }; require(it.active) { "Child is inactive" } }
    private fun requireProgramManagement(jwt: Jwt, organizationId: UUID, childId: UUID) {
        val scope = access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN, Role.STAFF))
        if (scope.membership.role == Role.STAFF) {
            if (!scope.membership.canManageChildPrograms) throw AccessDeniedException("You do not have permission to manage child programs")
            childScopes.requireStaffManagedChild(scope, childId, organizationId)
        } else child(childId, organizationId)
    }
    private fun childResponse(child: com.daycare.api.persistence.Child) = ChildResponse(child.id, child.organizationId, child.branchId, child.classroomId, child.firstName, child.lastName, child.nisn, child.gender, child.dateOfBirth)
    private fun programResponses(organizationId: UUID, childId: UUID) = programs.findAllByOrganizationIdAndChildIdOrderByCreatedAtDesc(organizationId, childId).map { ChildProgramResponse(it.id, it.name, it.description) }
    private fun assignmentResponses(organizationId: UUID, childId: UUID) = assignments.findAllByOrganizationIdAndChildIdOrderByCreatedAtDesc(organizationId, childId).mapNotNull { assignment -> users.findById(assignment.userId).map { user -> ChildStaffAssignmentResponse(assignment.id, user.id, user.displayName, user.email, assignment.assignmentRole) }.orElse(null) }
    private fun guardianResponses(childId: UUID) = guardianLinks.findAllByChildId(childId).mapNotNull { link -> users.findById(link.userId).map { user -> ChildGuardianResponse(user.id, user.displayName, user.email, user.username) }.orElse(null) }
}
