package com.daycare.api.service

import com.daycare.api.domain.Role
import com.daycare.api.domain.Gender
import com.daycare.api.domain.RegistrationRole
import com.daycare.api.domain.ChildCareRole
import com.daycare.api.domain.ChildProgramStatus
import com.daycare.api.persistence.ChildProgram
import com.daycare.api.persistence.ChildProgramParentFeedback
import com.daycare.api.persistence.ChildProgramParentFeedbackRepository
import com.daycare.api.persistence.ChildProgramRepository
import com.daycare.api.persistence.ChildProgramStaffNote
import com.daycare.api.persistence.ChildProgramStaffNoteRepository
import com.daycare.api.persistence.ChildProgramStep
import com.daycare.api.persistence.ChildProgramStepRepository
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
data class CreateChildProgramRequest(
    @field:NotBlank @field:Size(max = 120) val name: String,
    @field:Size(max = 2_000) val description: String?,
    val parentVisible: Boolean = false,
    @field:Size(max = 2_000) val parentSummary: String? = null,
    @field:Size(max = 2_000) val homeGuidance: String? = null,
)
data class UpdateChildProgramRequest(
    @field:NotBlank @field:Size(max = 120) val name: String,
    @field:Size(max = 2_000) val description: String?,
    val status: ChildProgramStatus,
    val parentVisible: Boolean,
    @field:Size(max = 2_000) val parentSummary: String? = null,
    @field:Size(max = 2_000) val homeGuidance: String? = null,
)
data class CreateChildProgramStepRequest(
    @field:NotBlank @field:Size(max = 200) val title: String,
    @field:Size(max = 2_000) val description: String?,
    @field:Size(max = 2_000) val homeGuidance: String? = null,
    val parentVisible: Boolean = false,
    val displayOrder: Int = 0,
)
data class UpdateChildProgramStepRequest(
    @field:NotBlank @field:Size(max = 200) val title: String,
    @field:Size(max = 2_000) val description: String?,
    @field:Size(max = 2_000) val homeGuidance: String? = null,
    val parentVisible: Boolean,
    val completed: Boolean,
    val displayOrder: Int,
)
data class CreateChildProgramStaffNoteRequest(val stepId: UUID? = null, @field:NotBlank @field:Size(max = 2_000) val note: String)
data class CreateChildProgramParentFeedbackRequest(@field:NotBlank @field:Size(max = 2_000) val note: String)
data class AssignChildStaffRequest(val userId: UUID, val assignmentRole: ChildCareRole)
data class BindChildGuardianRequest(@field:NotBlank @field:Size(max = 254) val identifier: String)
data class ChildProgramStepResponse(val id: UUID, val title: String, val description: String, val homeGuidance: String?, val parentVisible: Boolean, val completed: Boolean, val displayOrder: Int)
data class ChildProgramStaffNoteResponse(val id: UUID, val stepId: UUID?, val note: String, val authorName: String, val recordedAt: java.time.Instant)
data class ChildProgramParentFeedbackResponse(val id: UUID, val note: String, val parentName: String?, val createdAt: java.time.Instant)
data class ChildProgramResponse(
    val id: UUID,
    val name: String,
    val description: String,
    val status: ChildProgramStatus,
    val parentVisible: Boolean,
    val parentSummary: String?,
    val homeGuidance: String?,
    val steps: List<ChildProgramStepResponse>,
    val staffNotes: List<ChildProgramStaffNoteResponse>,
    val parentFeedback: List<ChildProgramParentFeedbackResponse>,
)
data class ParentChildProgramResponse(
    val id: UUID,
    val name: String,
    val parentSummary: String?,
    val status: ChildProgramStatus,
    val homeGuidance: String?,
    val steps: List<ChildProgramStepResponse>,
    val feedback: List<ChildProgramParentFeedbackResponse>,
)
data class ChildStaffAssignmentResponse(val id: UUID, val userId: UUID, val displayName: String, val email: String?, val assignmentRole: String)
data class ChildGuardianResponse(val userId: UUID, val displayName: String, val email: String?, val username: String?, val validParentAccount: Boolean)
data class ChildProfileResponse(val child: ChildResponse, val programs: List<ChildProgramResponse>, val staffAssignments: List<ChildStaffAssignmentResponse>, val guardians: List<ChildGuardianResponse>)

@Service
class ChildManagementService(
    private val access: AccessService,
    private val children: ChildRepository,
    private val programs: ChildProgramRepository,
    private val programSteps: ChildProgramStepRepository,
    private val programStaffNotes: ChildProgramStaffNoteRepository,
    private val programParentFeedback: ChildProgramParentFeedbackRepository,
    private val assignments: ChildStaffAssignmentRepository,
    private val memberships: MembershipRepository,
    private val users: UserProfileRepository,
    private val guardianLinks: GuardianLinkRepository,
    private val childScopes: ChildScopeService,
) {
    @Transactional(readOnly = true)
    fun profile(jwt: Jwt, organizationId: UUID, childId: UUID): ChildProfileResponse {
        val scope = access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN, Role.STAFF))
        val child = if (scope.membership.role == Role.STAFF) childScopes.requireStaffManagedChild(scope, childId, organizationId) else child(childId, organizationId)
        return ChildProfileResponse(childResponse(child), programResponses(organizationId, child.id), assignmentResponses(organizationId, child.id), if (scope.membership.role == Role.STAFF_ADMIN) guardianResponses(child.id) else emptyList())
    }

    @Transactional
    fun bindGuardian(jwt: Jwt, organizationId: UUID, childId: UUID, request: BindChildGuardianRequest): ChildGuardianResponse {
        access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN))
        val child = child(childId, organizationId)
        val identifier = request.identifier.trim()
        val parent = (if (identifier.contains("@")) users.findByEmailIgnoreCase(identifier) else users.findByUsernameIgnoreCase(identifier))
            ?: throw IllegalArgumentException("Parent account was not found")
        require(parent.registrationRole == RegistrationRole.PARENT) { "Only a registered Parent account can be linked to a child" }
        val parentMembership = memberships.findAllByUserIdAndOrganizationId(parent.id, organizationId).firstOrNull { it.role == Role.PARENT }
        if (parentMembership == null) memberships.save(Membership(userId = parent.id, organizationId = organizationId, role = Role.PARENT, branchId = child.branchId))
        else { parentMembership.active = true; parentMembership.deactivatedAt = null }
        if (!guardianLinks.existsByChildIdAndUserId(child.id, parent.id)) guardianLinks.save(GuardianLink(childId = child.id, userId = parent.id))
        return ChildGuardianResponse(parent.id, parent.displayName, parent.email, parent.username, validParentAccount = true)
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
        val saved = programs.save(ChildProgram(
            organizationId = organizationId,
            childId = childId,
            name = request.name.trim(),
            description = request.description?.trim().orEmpty(),
            parentVisible = request.parentVisible,
            parentSummary = request.parentSummary?.trim()?.ifBlank { null },
            homeGuidance = request.homeGuidance?.trim()?.ifBlank { null },
        ))
        return programResponse(saved)
    }

    @Transactional
    fun updateProgram(jwt: Jwt, organizationId: UUID, childId: UUID, programId: UUID, request: UpdateChildProgramRequest): ChildProgramResponse {
        requireProgramManagement(jwt, organizationId, childId)
        val program = program(programId, organizationId, childId)
        program.name = request.name.trim()
        program.description = request.description?.trim().orEmpty()
        program.status = request.status
        program.parentVisible = request.parentVisible
        program.parentSummary = request.parentSummary?.trim()?.ifBlank { null }
        program.homeGuidance = request.homeGuidance?.trim()?.ifBlank { null }
        program.updatedAt = java.time.Instant.now()
        return programResponse(program)
    }

    @Transactional
    fun removeProgram(jwt: Jwt, organizationId: UUID, childId: UUID, programId: UUID) {
        requireProgramManagement(jwt, organizationId, childId)
        val program = program(programId, organizationId, childId)
        require(programSteps.countByChildProgramId(program.id) == 0L && programStaffNotes.countByChildProgramId(program.id) == 0L && programParentFeedback.countByChildProgramId(program.id) == 0L) { "Child program has history and cannot be deleted" }
        programs.delete(program)
    }

    @Transactional
    fun addProgramStep(jwt: Jwt, organizationId: UUID, childId: UUID, programId: UUID, request: CreateChildProgramStepRequest): ChildProgramStepResponse {
        requireProgramManagement(jwt, organizationId, childId)
        val program = program(programId, organizationId, childId)
        require(!request.parentVisible || program.parentVisible) { "Child program must be shared with Parent first" }
        return stepResponse(programSteps.save(ChildProgramStep(
            organizationId = organizationId,
            childProgramId = program.id,
            title = request.title.trim(),
            description = request.description?.trim().orEmpty(),
            homeGuidance = request.homeGuidance?.trim()?.ifBlank { null },
            parentVisible = request.parentVisible,
            displayOrder = request.displayOrder.coerceAtLeast(0),
        )))
    }

    @Transactional
    fun updateProgramStep(jwt: Jwt, organizationId: UUID, childId: UUID, programId: UUID, stepId: UUID, request: UpdateChildProgramStepRequest): ChildProgramStepResponse {
        requireProgramManagement(jwt, organizationId, childId)
        val program = program(programId, organizationId, childId)
        require(!request.parentVisible || program.parentVisible) { "Child program must be shared with Parent first" }
        val step = step(stepId, organizationId, program.id)
        step.title = request.title.trim()
        step.description = request.description?.trim().orEmpty()
        step.homeGuidance = request.homeGuidance?.trim()?.ifBlank { null }
        step.parentVisible = request.parentVisible
        step.completed = request.completed
        step.displayOrder = request.displayOrder.coerceAtLeast(0)
        step.updatedAt = java.time.Instant.now()
        return stepResponse(step)
    }

    @Transactional
    fun removeProgramStep(jwt: Jwt, organizationId: UUID, childId: UUID, programId: UUID, stepId: UUID) {
        requireProgramManagement(jwt, organizationId, childId)
        val program = program(programId, organizationId, childId)
        val step = step(stepId, organizationId, program.id)
        require(programStaffNotes.countByChildProgramStepId(step.id) == 0L) { "Child program step has notes and cannot be deleted" }
        programSteps.delete(step)
    }

    @Transactional
    fun addProgramStaffNote(jwt: Jwt, organizationId: UUID, childId: UUID, programId: UUID, request: CreateChildProgramStaffNoteRequest): ChildProgramStaffNoteResponse {
        val scope = requireProgramManagement(jwt, organizationId, childId)
        val program = program(programId, organizationId, childId)
        request.stepId?.let { step(it, organizationId, program.id) }
        val note = programStaffNotes.save(ChildProgramStaffNote(organizationId = organizationId, childProgramId = program.id, childProgramStepId = request.stepId, authorUserId = scope.user.id, note = request.note.trim()))
        return staffNoteResponse(note)
    }

    @Transactional
    fun addParentFeedback(jwt: Jwt, organizationId: UUID, childId: UUID, programId: UUID, request: CreateChildProgramParentFeedbackRequest): ChildProgramParentFeedbackResponse {
        val scope = access.require(jwt, organizationId, setOf(Role.PARENT))
        childScopes.requireParentLinkedChild(scope, childId, organizationId)
        val program = program(programId, organizationId, childId)
        require(program.parentVisible) { "Child program is not shared with Parent" }
        val feedback = programParentFeedback.save(ChildProgramParentFeedback(organizationId = organizationId, childProgramId = program.id, parentUserId = scope.user.id, note = request.note.trim()))
        return parentFeedbackResponse(feedback, includeParentName = false)
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

    fun parentProgramResponses(organizationId: UUID, childId: UUID, parentUserId: UUID) = programs.findAllByOrganizationIdAndChildIdOrderByCreatedAtDesc(organizationId, childId)
        .filter { it.parentVisible }
        .map { program ->
            ParentChildProgramResponse(
                program.id,
                program.name,
                program.parentSummary,
                program.status,
                program.homeGuidance,
                programSteps.findAllByOrganizationIdAndChildProgramIdOrderByDisplayOrderAscCreatedAtAsc(organizationId, program.id).filter { it.parentVisible }.map(::stepResponse),
                programParentFeedback.findAllByOrganizationIdAndChildProgramIdAndParentUserIdOrderByCreatedAtDesc(organizationId, program.id, parentUserId).map { parentFeedbackResponse(it, includeParentName = false) },
            )
        }

    private fun child(childId: UUID, organizationId: UUID) = children.findById(childId).orElseThrow { IllegalArgumentException("Child was not found") }.also { require(it.organizationId == organizationId) { "Child belongs to a different organization" }; require(it.active) { "Child is inactive" } }
    private fun program(programId: UUID, organizationId: UUID, childId: UUID) = programs.findById(programId).orElseThrow { IllegalArgumentException("Child program was not found") }.also { require(it.organizationId == organizationId && it.childId == childId) { "Child program belongs to a different child" } }
    private fun step(stepId: UUID, organizationId: UUID, programId: UUID) = programSteps.findById(stepId).orElseThrow { IllegalArgumentException("Child program step was not found") }.also { require(it.organizationId == organizationId && it.childProgramId == programId) { "Child program step belongs to a different program" } }
    private fun requireProgramManagement(jwt: Jwt, organizationId: UUID, childId: UUID): AccessScope {
        val scope = access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN, Role.STAFF))
        if (scope.membership.role == Role.STAFF) {
            if (!scope.membership.canManageChildPrograms) throw AccessDeniedException("You do not have permission to manage child programs")
            childScopes.requireStaffManagedChild(scope, childId, organizationId)
        } else child(childId, organizationId)
        return scope
    }
    private fun childResponse(child: com.daycare.api.persistence.Child) = ChildResponse(child.id, child.organizationId, child.branchId, child.classroomId, child.firstName, child.lastName, child.nisn, child.gender, child.dateOfBirth)
    private fun programResponses(organizationId: UUID, childId: UUID) = programs.findAllByOrganizationIdAndChildIdOrderByCreatedAtDesc(organizationId, childId).map(::programResponse)
    private fun programResponse(program: ChildProgram) = ChildProgramResponse(
        program.id,
        program.name,
        program.description,
        program.status,
        program.parentVisible,
        program.parentSummary,
        program.homeGuidance,
        programSteps.findAllByOrganizationIdAndChildProgramIdOrderByDisplayOrderAscCreatedAtAsc(program.organizationId, program.id).map(::stepResponse),
        programStaffNotes.findAllByOrganizationIdAndChildProgramIdOrderByRecordedAtDesc(program.organizationId, program.id).map(::staffNoteResponse),
        programParentFeedback.findAllByOrganizationIdAndChildProgramIdOrderByCreatedAtDesc(program.organizationId, program.id).map { parentFeedbackResponse(it, includeParentName = true) },
    )
    private fun stepResponse(step: ChildProgramStep) = ChildProgramStepResponse(step.id, step.title, step.description, step.homeGuidance, step.parentVisible, step.completed, step.displayOrder)
    private fun staffNoteResponse(note: ChildProgramStaffNote) = ChildProgramStaffNoteResponse(note.id, note.childProgramStepId, note.note, users.findById(note.authorUserId).map { it.displayName }.orElse("Unknown"), note.recordedAt)
    private fun parentFeedbackResponse(feedback: ChildProgramParentFeedback, includeParentName: Boolean) = ChildProgramParentFeedbackResponse(feedback.id, feedback.note, if (includeParentName) users.findById(feedback.parentUserId).map { it.displayName }.orElse("Unknown") else null, feedback.createdAt)
    private fun assignmentResponses(organizationId: UUID, childId: UUID) = assignments.findAllByOrganizationIdAndChildIdOrderByCreatedAtDesc(organizationId, childId).mapNotNull { assignment -> users.findById(assignment.userId).map { user -> ChildStaffAssignmentResponse(assignment.id, user.id, user.displayName, user.email, assignment.assignmentRole) }.orElse(null) }
    private fun guardianResponses(childId: UUID) = guardianLinks.findAllByChildId(childId).mapNotNull { link -> users.findById(link.userId).map { user -> ChildGuardianResponse(user.id, user.displayName, user.email, user.username, user.registrationRole == RegistrationRole.PARENT) }.orElse(null) }
}
