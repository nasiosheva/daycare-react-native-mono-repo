package com.daycare.api.service

import com.daycare.api.domain.ChildCareRole
import com.daycare.api.domain.ChildEnrollmentStatus
import com.daycare.api.domain.InstitutionType
import com.daycare.api.domain.Role
import com.daycare.api.persistence.AcademicYearRepository
import com.daycare.api.persistence.BranchCapacitySettingRepository
import com.daycare.api.persistence.BranchRepository
import com.daycare.api.persistence.Classroom
import com.daycare.api.persistence.ClassroomRepository
import com.daycare.api.persistence.ClassroomProgram
import com.daycare.api.persistence.ClassroomProgramRepository
import com.daycare.api.persistence.ClassroomStaffAssignment
import com.daycare.api.persistence.ClassroomStaffAssignmentRepository
import com.daycare.api.persistence.ChildPlacement
import com.daycare.api.persistence.ChildPlacementRepository
import com.daycare.api.persistence.ChildRepository
import com.daycare.api.persistence.CurriculumProgramRepository
import com.daycare.api.persistence.LearningLevel
import com.daycare.api.persistence.LearningLevelCurriculumProgram
import com.daycare.api.persistence.LearningLevelCurriculumProgramRepository
import com.daycare.api.persistence.LearningLevelRepository
import com.daycare.api.persistence.MembershipRepository
import com.daycare.api.persistence.UserProfileRepository
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.Size
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.LocalDate
import java.time.Period
import java.util.UUID

data class LearningLevelTemplateResponse(val code: String, val name: String, val minAgeMonths: Int?, val maxAgeMonths: Int?)
data class LearningBranchResponse(val id: UUID, val name: String)
data class UpsertLearningLevelRequest(
    @field:NotBlank @field:Size(max = 120) val name: String,
    val minAgeMonths: Int? = null,
    val maxAgeMonths: Int? = null,
    val displayOrder: Int = 0,
    val curriculumProgramIds: Set<UUID> = emptySet(),
)
data class LearningLevelResponse(val id: UUID, val name: String, val minAgeMonths: Int?, val maxAgeMonths: Int?, val displayOrder: Int, val active: Boolean, val curriculumProgramIds: Set<UUID>)
data class UpsertClassroomRequest(
    val branchId: UUID,
    val learningLevelId: UUID,
    val learningPeriodId: UUID? = null,
    @field:NotBlank @field:Size(max = 200) val name: String,
    val capacity: Int? = null,
)
data class ClassroomResponse(val id: UUID, val branchId: UUID, val learningLevelId: UUID?, val learningPeriodId: UUID?, val name: String, val capacity: Int?, val active: Boolean, val activeChildren: Long)
data class AssignClassroomStaffRequest(val userId: UUID, val assignmentRole: ChildCareRole)
data class ClassroomStaffAssignmentResponse(val id: UUID, val userId: UUID, val displayName: String, val email: String?, val assignmentRole: ChildCareRole)
data class ClassroomProgramResponse(val id: UUID, val name: String, val description: String)
data class CreateClassroomProgramRequest(@field:NotBlank @field:Size(max = 120) val name: String, @field:Size(max = 2_000) val description: String?)
data class CreateChildPlacementRequest(val classroomId: UUID, val startsOn: LocalDate = LocalDate.now())
data class ChildPlacementResponse(val id: UUID, val classroomId: UUID, val classroomName: String, val learningLevelId: UUID?, val learningLevelName: String?, val learningPeriodId: UUID?, val startsOn: LocalDate, val endedOn: LocalDate?, val ageGuidanceWarning: Boolean)

@Service
class LearningStructureService(
    private val access: AccessService,
    private val levels: LearningLevelRepository,
    private val levelPrograms: LearningLevelCurriculumProgramRepository,
    private val programs: CurriculumProgramRepository,
    private val classrooms: ClassroomRepository,
    private val placements: ChildPlacementRepository,
    private val children: ChildRepository,
    private val academicYears: AcademicYearRepository,
    private val memberships: MembershipRepository,
    private val users: UserProfileRepository,
    private val classroomAssignments: ClassroomStaffAssignmentRepository,
    private val classroomPrograms: ClassroomProgramRepository,
    private val branchCapacities: BranchCapacitySettingRepository,
    private val branches: BranchRepository,
    private val childScopes: ChildScopeService,
) {
    @Transactional(readOnly = true)
    fun branches(jwt: Jwt, organizationId: UUID): List<LearningBranchResponse> {
        access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN, Role.STAFF), readOnly = true)
        return branches.findAllByOrganizationIdAndActiveTrueOrderByNameAsc(organizationId).map { LearningBranchResponse(it.id, it.name) }
    }

    @Transactional(readOnly = true)
    fun templates(jwt: Jwt, organizationId: UUID): List<LearningLevelTemplateResponse> {
        val scope = access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN, Role.STAFF), readOnly = true)
        return buildList {
            if (InstitutionType.DAYCARE in scope.institutionTypes) addAll(daycareTemplates)
            if (InstitutionType.PAUD in scope.institutionTypes) add(LearningLevelTemplateResponse("PAUD", "PAUD", 36, 72))
            if (InstitutionType.TK in scope.institutionTypes) addAll(tkTemplates)
        }.distinctBy { it.code }
    }

    @Transactional(readOnly = true)
    fun levels(jwt: Jwt, organizationId: UUID): List<LearningLevelResponse> {
        access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN, Role.STAFF), readOnly = true)
        return levels.findAllByOrganizationIdOrderByDisplayOrderAscNameAsc(organizationId).map(::levelResponse)
    }

    @Transactional
    fun createLevel(jwt: Jwt, organizationId: UUID, request: UpsertLearningLevelRequest): LearningLevelResponse {
        access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN))
        validateLevel(request)
        validatePrograms(organizationId, request.curriculumProgramIds)
        val level = levels.save(LearningLevel(organizationId = organizationId, name = request.name.trim(), minAgeMonths = request.minAgeMonths, maxAgeMonths = request.maxAgeMonths, displayOrder = request.displayOrder))
        replacePrograms(level.id, request.curriculumProgramIds)
        return levelResponse(level)
    }

    @Transactional
    fun updateLevel(jwt: Jwt, organizationId: UUID, levelId: UUID, request: UpsertLearningLevelRequest): LearningLevelResponse {
        access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN))
        validateLevel(request)
        validatePrograms(organizationId, request.curriculumProgramIds)
        val level = level(levelId, organizationId)
        level.name = request.name.trim(); level.minAgeMonths = request.minAgeMonths; level.maxAgeMonths = request.maxAgeMonths; level.displayOrder = request.displayOrder
        replacePrograms(level.id, request.curriculumProgramIds)
        return levelResponse(level)
    }

    @Transactional
    fun archiveLevel(jwt: Jwt, organizationId: UUID, levelId: UUID): LearningLevelResponse {
        access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN))
        return level(levelId, organizationId).also { it.active = false }.let(::levelResponse)
    }

    @Transactional(readOnly = true)
    fun classrooms(jwt: Jwt, organizationId: UUID): List<ClassroomResponse> {
        access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN, Role.STAFF), readOnly = true)
        return classrooms.findAllByOrganizationIdOrderByNameAsc(organizationId).map(::classroomResponse)
    }

    @Transactional
    fun createClassroom(jwt: Jwt, organizationId: UUID, request: UpsertClassroomRequest): ClassroomResponse {
        access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN))
        validateClassroomReferences(organizationId, request)
        val classroom = classrooms.save(Classroom(organizationId = organizationId, branchId = request.branchId, learningLevelId = request.learningLevelId, academicYearId = request.learningPeriodId, name = request.name.trim(), capacity = request.capacity))
        return classroomResponse(classroom)
    }

    @Transactional
    fun updateClassroom(jwt: Jwt, organizationId: UUID, classroomId: UUID, request: UpsertClassroomRequest): ClassroomResponse {
        access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN))
        validateClassroomReferences(organizationId, request)
        val classroom = classroom(classroomId, organizationId)
        classroom.branchId = request.branchId; classroom.learningLevelId = request.learningLevelId; classroom.academicYearId = request.learningPeriodId; classroom.name = request.name.trim(); classroom.capacity = request.capacity
        return classroomResponse(classroom)
    }

    @Transactional
    fun archiveClassroom(jwt: Jwt, organizationId: UUID, classroomId: UUID): ClassroomResponse {
        access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN))
        return classroom(classroomId, organizationId).also { it.active = false }.let(::classroomResponse)
    }

    @Transactional(readOnly = true)
    fun classroomStaff(jwt: Jwt, organizationId: UUID, classroomId: UUID): List<ClassroomStaffAssignmentResponse> {
        access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN, Role.STAFF), readOnly = true)
        classroom(classroomId, organizationId)
        return classroomAssignments.findAllByOrganizationIdAndClassroomIdOrderByCreatedAtDesc(organizationId, classroomId).mapNotNull(::classroomStaffResponse)
    }

    @Transactional
    fun assignClassroomStaff(jwt: Jwt, organizationId: UUID, classroomId: UUID, request: AssignClassroomStaffRequest): ClassroomStaffAssignmentResponse {
        access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN))
        val classroom = classroom(classroomId, organizationId)
        val membership = memberships.findAllByUserIdAndOrganizationId(request.userId, organizationId).firstOrNull { it.active && it.role in setOf(Role.STAFF_ADMIN, Role.STAFF) }
            ?: throw IllegalArgumentException("Only active Staff Admin or Staff users can be assigned to a classroom")
        require(membership.role != Role.STAFF || membership.branchId == classroom.branchId) { "Staff member does not belong to this classroom's branch" }
        require(!classroomAssignments.existsByOrganizationIdAndClassroomIdAndUserId(organizationId, classroomId, request.userId)) { "Staff member is already assigned to this classroom" }
        val saved = classroomAssignments.save(ClassroomStaffAssignment(organizationId = organizationId, classroomId = classroomId, userId = membership.userId, assignmentRole = request.assignmentRole.name))
        return classroomStaffResponse(saved) ?: throw IllegalArgumentException("Staff member was not found")
    }

    @Transactional
    fun unassignClassroomStaff(jwt: Jwt, organizationId: UUID, classroomId: UUID, assignmentId: UUID) {
        access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN))
        classroom(classroomId, organizationId)
        val assignment = classroomAssignments.findById(assignmentId).orElseThrow { IllegalArgumentException("Classroom staff assignment was not found") }
        require(assignment.organizationId == organizationId && assignment.classroomId == classroomId) { "Classroom staff assignment belongs to a different classroom" }
        classroomAssignments.delete(assignment)
    }

    @Transactional(readOnly = true)
    fun classroomPrograms(jwt: Jwt, organizationId: UUID, classroomId: UUID): List<ClassroomProgramResponse> {
        access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN, Role.STAFF), readOnly = true)
        classroom(classroomId, organizationId)
        return classroomPrograms.findAllByOrganizationIdAndClassroomIdOrderByCreatedAtDesc(organizationId, classroomId).map(::classroomProgramResponse)
    }

    @Transactional
    fun createClassroomProgram(jwt: Jwt, organizationId: UUID, classroomId: UUID, request: CreateClassroomProgramRequest): ClassroomProgramResponse {
        access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN))
        classroom(classroomId, organizationId)
        return classroomProgramResponse(classroomPrograms.save(ClassroomProgram(organizationId = organizationId, classroomId = classroomId, name = request.name.trim(), description = request.description?.trim().orEmpty())))
    }

    @Transactional
    fun removeClassroomProgram(jwt: Jwt, organizationId: UUID, classroomId: UUID, programId: UUID) {
        access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN))
        classroom(classroomId, organizationId)
        val program = classroomPrograms.findById(programId).orElseThrow { IllegalArgumentException("Classroom program was not found") }
        require(program.organizationId == organizationId && program.classroomId == classroomId) { "Classroom program belongs to a different classroom" }
        classroomPrograms.delete(program)
    }

    @Transactional(readOnly = true)
    fun placements(jwt: Jwt, organizationId: UUID, childId: UUID): List<ChildPlacementResponse> {
        val scope = access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN, Role.STAFF), readOnly = true)
        if (scope.membership.role == Role.STAFF) childScopes.requireStaffManagedChild(scope, childId, organizationId) else requireChild(childId, organizationId)
        return placements.findAllByOrganizationIdAndChildIdOrderByStartsOnDesc(organizationId, childId).map(::placementResponse)
    }

    @Transactional
    fun placeChild(jwt: Jwt, organizationId: UUID, childId: UUID, request: CreateChildPlacementRequest): ChildPlacementResponse {
        val scope = access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN, Role.STAFF))
        access.requireWritable(scope)
        val child = if (scope.membership.role == Role.STAFF) childScopes.requireStaffManagedChild(scope, childId, organizationId) else requireChild(childId, organizationId)
        require(child.enrollmentStatus == ChildEnrollmentStatus.ACTIVE) { "Child enrollment is still pending Parent approval" }
        val classroom = classroom(request.classroomId, organizationId)
        require(classroom.active && classroom.learningLevelId != null) { "Classroom must be active and assigned to a learning level" }
        require(classroom.branchId == child.branchId) { "Child and classroom must belong to the same branch" }
        val current = placements.findByChildIdAndEndedOnIsNull(childId)
        if (current != null && request.startsOn == current.startsOn) {
            if (current.classroomId == classroom.id) return placementResponse(current)
            requireCapacity(classroom)
            current.classroomId = classroom.id; current.learningLevelId = classroom.learningLevelId; current.academicYearId = classroom.academicYearId
            child.classroomId = classroom.id
            return placementResponse(current)
        }
        require(current == null || request.startsOn.isAfter(current.startsOn)) { "Placement start date must be after the active placement" }
        if (current?.classroomId != classroom.id) requireCapacity(classroom)
        current?.let { it.endedOn = request.startsOn.minusDays(1) }
        child.classroomId = classroom.id
        val saved = placements.save(ChildPlacement(organizationId = organizationId, childId = childId, classroomId = classroom.id, learningLevelId = classroom.learningLevelId, academicYearId = classroom.academicYearId, startsOn = request.startsOn))
        return placementResponse(saved)
    }

    private fun validateLevel(request: UpsertLearningLevelRequest) {
        require(request.minAgeMonths == null || request.minAgeMonths >= 0) { "Minimum age must not be negative" }
        require(request.maxAgeMonths == null || request.maxAgeMonths >= 0) { "Maximum age must not be negative" }
        require(request.minAgeMonths == null || request.maxAgeMonths == null || request.minAgeMonths <= request.maxAgeMonths) { "Minimum age must not exceed maximum age" }
    }
    private fun validatePrograms(organizationId: UUID, ids: Set<UUID>) { ids.forEach { id ->
        val program = programs.findById(id).orElseThrow { IllegalArgumentException("Curriculum program was not found") }
        require(program.organizationId == null || program.organizationId == organizationId) { "Curriculum program belongs to a different organization" }
    } }
    private fun replacePrograms(levelId: UUID, ids: Set<UUID>) { levelPrograms.deleteAllByLearningLevelId(levelId); levelPrograms.saveAll(ids.map { LearningLevelCurriculumProgram(learningLevelId = levelId, curriculumProgramId = it) }) }
    private fun validateClassroomReferences(organizationId: UUID, request: UpsertClassroomRequest) {
        require(request.capacity == null || request.capacity > 0) { "Classroom capacity must be positive" }
        val branch = branches.findById(request.branchId).orElseThrow { IllegalArgumentException("Branch was not found") }
        require(branch.organizationId == organizationId && branch.active) { "Branch is not available for this organization" }
        level(request.learningLevelId, organizationId)
        request.learningPeriodId?.let { id -> require(academicYears.findById(id).orElseThrow { IllegalArgumentException("Learning period was not found") }.organizationId == organizationId) { "Learning period belongs to a different organization" } }
    }
    private fun requireCapacity(classroom: Classroom) {
        val capacity = classroom.capacity ?: branchCapacities.findByOrganizationIdAndBranchId(classroom.organizationId, classroom.branchId)?.dailyCapacity ?: return
        require(activeChildren(classroom.id) < capacity) { "Classroom capacity has been reached" }
    }
    private fun level(id: UUID, organizationId: UUID) = levels.findById(id).orElseThrow { IllegalArgumentException("Learning level was not found") }.also { require(it.organizationId == organizationId) { "Learning level belongs to a different organization" } }
    private fun classroom(id: UUID, organizationId: UUID) = classrooms.findById(id).orElseThrow { IllegalArgumentException("Classroom was not found") }.also { require(it.organizationId == organizationId) { "Classroom belongs to a different organization" } }
    private fun requireChild(id: UUID, organizationId: UUID) = children.findById(id).orElseThrow { IllegalArgumentException("Child was not found") }.also { require(it.organizationId == organizationId) { "Child belongs to a different organization" }; require(it.active) { "Child is inactive" } }
    private fun levelResponse(level: LearningLevel): LearningLevelResponse = LearningLevelResponse(level.id, level.name, level.minAgeMonths, level.maxAgeMonths, level.displayOrder, level.active, levelPrograms.findAllByLearningLevelId(level.id).map { it.curriculumProgramId }.toSet())
    private fun classroomResponse(classroom: Classroom): ClassroomResponse = ClassroomResponse(classroom.id, classroom.branchId, classroom.learningLevelId, classroom.academicYearId, classroom.name, classroom.capacity, classroom.active, activeChildren(classroom.id))
    private fun activeChildren(classroomId: UUID) = placements.countByClassroomIdAndActiveEnrollmentStatus(classroomId, ChildEnrollmentStatus.ACTIVE)
    private fun classroomStaffResponse(assignment: ClassroomStaffAssignment): ClassroomStaffAssignmentResponse? = users.findById(assignment.userId).map { ClassroomStaffAssignmentResponse(assignment.id, it.id, it.displayName, it.email, ChildCareRole.valueOf(assignment.assignmentRole)) }.orElse(null)
    private fun classroomProgramResponse(program: ClassroomProgram) = ClassroomProgramResponse(program.id, program.name, program.description)
    private fun placementResponse(placement: ChildPlacement): ChildPlacementResponse {
        val classroom = classroom(placement.classroomId, placement.organizationId)
        val level = placement.learningLevelId?.let { levels.findById(it).orElse(null) }
        val child = requireChild(placement.childId, placement.organizationId)
        val ageMonths = Period.between(child.dateOfBirth, placement.startsOn).let { it.years * 12 + it.months }
        val warning = level != null && ((level.minAgeMonths != null && ageMonths < level.minAgeMonths!!) || (level.maxAgeMonths != null && ageMonths > level.maxAgeMonths!!))
        return ChildPlacementResponse(placement.id, classroom.id, classroom.name, level?.id, level?.name, placement.academicYearId, placement.startsOn, placement.endedOn, warning)
    }

    private companion object {
        val daycareTemplates = listOf(LearningLevelTemplateResponse("NURSERY", "Nursery", 3, 24), LearningLevelTemplateResponse("TODDLER", "Toddler", 18, 48))
        val tkTemplates = listOf(LearningLevelTemplateResponse("TK_A", "TK A", 48, 60), LearningLevelTemplateResponse("TK_B", "TK B", 60, 72))
    }
}
