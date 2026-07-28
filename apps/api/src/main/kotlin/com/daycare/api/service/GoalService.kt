package com.daycare.api.service

import com.daycare.api.domain.ChildGoalOutcome
import com.daycare.api.domain.ChildGoalStatus
import com.daycare.api.domain.GoalDomain
import com.daycare.api.domain.GoalCheckInOutcome
import com.daycare.api.domain.Role
import com.daycare.api.persistence.AuditLog
import com.daycare.api.persistence.AuditLogRepository
import com.daycare.api.persistence.Child
import com.daycare.api.persistence.ChildGoal
import com.daycare.api.persistence.ChildGoalCheckIn
import com.daycare.api.persistence.ChildGoalCheckInRepository
import com.daycare.api.persistence.ChildGoalRepository
import com.daycare.api.persistence.ChildRepository
import com.daycare.api.persistence.ChildStaffAssignmentRepository
import com.daycare.api.persistence.ClassroomRepository
import com.daycare.api.persistence.ClassroomStaffAssignmentRepository
import com.daycare.api.persistence.CurriculumProgramRepository
import com.daycare.api.persistence.CurriculumProgramDevelopmentProgramRepository
import com.daycare.api.persistence.DevelopmentProgram
import com.daycare.api.persistence.DevelopmentProgramItem
import com.daycare.api.persistence.DevelopmentProgramItemRepository
import com.daycare.api.persistence.DevelopmentProgramRepository
import com.daycare.api.persistence.GuardianLinkRepository
import com.daycare.api.persistence.LearningLevelRepository
import com.daycare.api.persistence.MembershipRepository
import com.daycare.api.realtime.RealtimeFlag
import com.daycare.api.realtime.RealtimePublisher
import jakarta.validation.constraints.Max
import jakarta.validation.constraints.Min
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.Size
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.security.access.AccessDeniedException
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Instant
import java.time.LocalDate
import java.time.Period
import java.time.ZoneId
import java.time.temporal.ChronoUnit
import java.util.Base64
import java.util.UUID

data class UpsertDevelopmentProgramRequest(
    val learningLevelId: UUID,
    @field:NotBlank @field:Size(max = 120) val name: String,
    @field:Size(max = 2_000) val description: String = "",
    @field:Min(1) val durationDays: Int,
    @field:Min(0) @field:Max(100) val minimumYesPercent: Int,
    @field:Min(0) val minimumYesStreak: Int,
    val domain: GoalDomain,
    val indicatorNames: List<String> = emptyList(),
)
data class DevelopmentProgramResponse(val id: UUID, val learningLevelId: UUID, val name: String, val description: String, val durationDays: Int, val minimumYesPercent: Int, val minimumYesStreak: Int, val domain: GoalDomain, val source: DevelopmentProgramSource, val isTemplate: Boolean, val active: Boolean, val indicators: List<GoalIndicatorResponse>, val minAgeMonths: Int?, val maxAgeMonths: Int?)
enum class DevelopmentProgramSource { GLOBAL, TENANT }
data class AssignChildGoalRequest(val curriculumProgramId: UUID, val programId: UUID, val startsOn: LocalDate = LocalDate.now())
data class UpsertGoalIndicatorRequest(@field:NotBlank @field:Size(max = 120) val name: String, val displayOrder: Int = 0)
data class GoalIndicatorResponse(val id: UUID, val name: String, val displayOrder: Int, val active: Boolean)
data class GoalPhotoInput(@field:NotBlank val contentType: String, @field:NotBlank val dataBase64: String)
data class GoalAudioInput(@field:NotBlank val contentType: String, @field:NotBlank val dataBase64: String, val durationMs: Int? = null)
data class GoalCheckInRequest(val indicatorId: UUID, val outcome: GoalCheckInOutcome, @field:Size(max = 500) val note: String? = null, val photo: GoalPhotoInput? = null, val audio: GoalAudioInput? = null)
data class FinalizeChildGoalRequest(val outcome: ChildGoalOutcome, @field:NotBlank @field:Size(max = 2_000) val summary: String)
data class GoalIndicatorCheckInResponse(val indicatorId: UUID, val date: LocalDate, val outcome: GoalCheckInOutcome, val note: String?, val hasPhoto: Boolean, val hasAudio: Boolean, val audioDurationMs: Int?, val recordedAt: Instant)
data class GoalPhotoResponse(val contentType: String, val dataBase64: String)
data class GoalAudioResponse(val contentType: String, val dataBase64: String, val durationMs: Int?)
data class ChildGoalResponse(
    val id: UUID, val childId: UUID, val curriculumProgramId: UUID?, val curriculumProgramName: String?, val programId: UUID, val name: String, val description: String, val startsOn: LocalDate, val targetEndsOn: LocalDate,
    val durationDays: Int, val minimumYesPercent: Int, val minimumYesStreak: Int, val status: ChildGoalStatus, val finalOutcome: ChildGoalOutcome?, val finalSummary: String?, val finalizedAt: Instant?,
    val recordedDays: Int, val yesDays: Int, val noDays: Int, val yesPercent: Int?, val currentYesStreak: Int, val longestYesStreak: Int, val meetsYesPercent: Boolean, val meetsYesStreak: Boolean, val missedDays: Int,
    val indicators: List<GoalIndicatorResponse>, val checkIns: List<GoalIndicatorCheckInResponse>,
)

@Service
class GoalService(
    private val access: AccessService,
    private val platformAccess: PlatformAccessService,
    private val childScopes: ChildScopeService,
    private val programs: DevelopmentProgramRepository,
    private val curriculumPrograms: CurriculumProgramRepository,
    private val curriculumProgramPrograms: CurriculumProgramDevelopmentProgramRepository,
    private val goalIndicators: DevelopmentProgramItemRepository,
    private val goals: ChildGoalRepository,
    private val checkIns: ChildGoalCheckInRepository,
    private val levels: LearningLevelRepository,
    private val classrooms: ClassroomRepository,
    private val guardians: GuardianLinkRepository,
    private val audits: AuditLogRepository,
    private val realtime: RealtimePublisher,
    private val notifications: NotificationService,
    private val children: ChildRepository,
    private val childStaffAssignments: ChildStaffAssignmentRepository,
    private val classroomStaffAssignments: ClassroomStaffAssignmentRepository,
    private val memberships: MembershipRepository,
) {
    @Transactional(readOnly = true)
    fun globalPrograms(jwt: Jwt, search: String? = null): List<DevelopmentProgramResponse> {
        platformAccess.requirePlatformAdmin(jwt)
        val query = search?.trim().orEmpty()
        return (if (query.isBlank()) programs.findAllByOrganizationIdIsNullOrderByCreatedAtDesc() else programs.searchGlobal(query)).map(::programResponse)
    }

    @Transactional
    fun createGlobalProgram(jwt: Jwt, request: UpsertDevelopmentProgramRequest): DevelopmentProgramResponse {
        platformAccess.requirePlatformAdmin(jwt)
        validateGlobalLearningLevel(request.learningLevelId)
        require(programs.findByOrganizationIdAndLearningLevelIdAndDomain(null, request.learningLevelId, request.domain) == null) { "A program already exists for this learning level and domain" }
        val program = programs.save(DevelopmentProgram(organizationId = null, learningLevelId = request.learningLevelId, name = request.name.trim(), description = request.description.trim(), durationDays = request.durationDays, minimumYesPercent = request.minimumYesPercent, minimumYesStreak = request.minimumYesStreak, domain = request.domain, isTemplate = true))
        saveIndicators(null, program, request.indicatorNames)
        return programResponse(program)
    }

    @Transactional
    fun updateGlobalProgram(jwt: Jwt, programId: UUID, request: UpsertDevelopmentProgramRequest): DevelopmentProgramResponse {
        platformAccess.requirePlatformAdmin(jwt)
        validateGlobalLearningLevel(request.learningLevelId)
        val program = globalProgram(programId)
        if (program.learningLevelId != request.learningLevelId || program.domain != request.domain) {
            require(programs.findByOrganizationIdAndLearningLevelIdAndDomain(null, request.learningLevelId, request.domain) == null) { "A program already exists for this learning level and domain" }
        }
        program.learningLevelId = request.learningLevelId; program.name = request.name.trim(); program.description = request.description.trim(); program.durationDays = request.durationDays; program.minimumYesPercent = request.minimumYesPercent; program.minimumYesStreak = request.minimumYesStreak; program.domain = request.domain
        return programResponse(program)
    }

    @Transactional
    fun deleteGlobalProgram(jwt: Jwt, programId: UUID) {
        platformAccess.requirePlatformAdmin(jwt)
        val program = globalProgram(programId)
        require(!goals.existsByProgramId(program.id)) { "Program is already assigned to children and cannot be deleted" }
        programs.delete(program)
    }

    @Transactional(readOnly = true)
    fun programs(jwt: Jwt, organizationId: UUID, search: String? = null, curriculumProgramId: UUID? = null): List<DevelopmentProgramResponse> {
        access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN, Role.STAFF), readOnly = true)
        val query = search?.trim().orEmpty()
        val visible = if (query.isBlank()) programs.findVisibleToOrganization(organizationId) else programs.searchVisibleToOrganization(organizationId, query)
        val linkedProgramIds = curriculumProgramId?.let { id ->
            val curriculumProgram = curriculumPrograms.findById(id).orElseThrow { IllegalArgumentException("Curriculum program was not found") }
            require(curriculumProgram.active && (curriculumProgram.organizationId == null || curriculumProgram.organizationId == organizationId)) { "Curriculum program is not available" }
            curriculumProgramPrograms.findAllByCurriculumProgramId(id).map { it.developmentProgramId }.toSet()
        }
        return visible.filter { linkedProgramIds == null || it.id in linkedProgramIds }.map(::programResponse)
    }

    @Transactional
    fun createProgram(jwt: Jwt, organizationId: UUID, request: UpsertDevelopmentProgramRequest): DevelopmentProgramResponse {
        access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN))
        validateProgramScope(organizationId, request.learningLevelId)
        require(programs.findByOrganizationIdAndLearningLevelIdAndDomain(organizationId, request.learningLevelId, request.domain) == null) { "A program already exists for this learning level and domain" }
        val program = programs.save(DevelopmentProgram(organizationId = organizationId, learningLevelId = request.learningLevelId, name = request.name.trim(), description = request.description.trim(), durationDays = request.durationDays, minimumYesPercent = request.minimumYesPercent, minimumYesStreak = request.minimumYesStreak, domain = request.domain))
        saveIndicators(organizationId, program, request.indicatorNames)
        return programResponse(program)
    }

    @Transactional
    fun updateProgram(jwt: Jwt, organizationId: UUID, programId: UUID, request: UpsertDevelopmentProgramRequest): DevelopmentProgramResponse {
        access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN))
        validateProgramScope(organizationId, request.learningLevelId)
        val program = program(programId, organizationId); requireTenantOwned(program)
        if (program.learningLevelId != request.learningLevelId || program.domain != request.domain) {
            require(programs.findByOrganizationIdAndLearningLevelIdAndDomain(organizationId, request.learningLevelId, request.domain) == null) { "A program already exists for this learning level and domain" }
        }
        program.learningLevelId = request.learningLevelId; program.name = request.name.trim(); program.description = request.description.trim(); program.durationDays = request.durationDays; program.minimumYesPercent = request.minimumYesPercent; program.minimumYesStreak = request.minimumYesStreak; program.domain = request.domain
        realtime.publishToTenantRoles(organizationId, setOf(Role.STAFF_ADMIN, Role.STAFF, Role.PARENT), setOf(RealtimeFlag.GOALS))
        return programResponse(program)
    }

    @Transactional
    fun deleteProgram(jwt: Jwt, organizationId: UUID, programId: UUID) {
        access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN))
        val program = program(programId, organizationId); requireTenantOwned(program)
        require(!goals.existsByProgramId(program.id)) { "Program is already assigned to children and cannot be deleted" }
        programs.delete(program)
        realtime.publishToTenantRoles(organizationId, setOf(Role.STAFF_ADMIN, Role.STAFF, Role.PARENT), setOf(RealtimeFlag.GOALS))
    }

    @Transactional
    fun createIndicator(jwt: Jwt, organizationId: UUID, programId: UUID, request: UpsertGoalIndicatorRequest): DevelopmentProgramResponse {
        access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN))
        val program = program(programId, organizationId); requireTenantOwned(program)
        val displayOrder = goalIndicators.findAllByDevelopmentProgramIdOrderByDisplayOrderAsc(program.id).size
        goalIndicators.save(DevelopmentProgramItem(organizationId = organizationId, developmentProgramId = program.id, name = request.name.trim(), displayOrder = displayOrder))
        realtime.publishToTenantRoles(organizationId, setOf(Role.STAFF_ADMIN, Role.STAFF, Role.PARENT), setOf(RealtimeFlag.GOALS))
        return programResponse(program)
    }

    @Transactional
    fun updateIndicator(jwt: Jwt, organizationId: UUID, programId: UUID, indicatorId: UUID, request: UpsertGoalIndicatorRequest): DevelopmentProgramResponse {
        access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN))
        val program = program(programId, organizationId); requireTenantOwned(program)
        val indicator = indicator(indicatorId, program.id)
        indicator.name = request.name.trim(); indicator.displayOrder = request.displayOrder
        realtime.publishToTenantRoles(organizationId, setOf(Role.STAFF_ADMIN, Role.STAFF, Role.PARENT), setOf(RealtimeFlag.GOALS))
        return programResponse(program)
    }

    @Transactional
    fun archiveIndicator(jwt: Jwt, organizationId: UUID, programId: UUID, indicatorId: UUID): DevelopmentProgramResponse {
        access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN))
        val program = program(programId, organizationId); requireTenantOwned(program)
        val indicator = indicator(indicatorId, program.id)
        require(goalIndicators.findAllByDevelopmentProgramIdOrderByDisplayOrderAsc(program.id).count { it.active } > 1) { "Program needs at least one active indicator" }
        indicator.active = false
        realtime.publishToTenantRoles(organizationId, setOf(Role.STAFF_ADMIN, Role.STAFF, Role.PARENT), setOf(RealtimeFlag.GOALS))
        return programResponse(program)
    }

    @Transactional(readOnly = true)
    fun childGoals(jwt: Jwt, organizationId: UUID, childId: UUID): List<ChildGoalResponse> {
        val scope = access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN, Role.STAFF, Role.PARENT), readOnly = true)
        authorizeChild(scope, organizationId, childId)
        val childGoalsList = goals.findAllByOrganizationIdAndChildIdOrderByCreatedAtDesc(organizationId, childId)
        if (childGoalsList.isEmpty()) return emptyList()
        val programsById = programs.findAllById(childGoalsList.map { it.programId }.toSet()).associateBy { it.id }
        val curriculumProgramIds = childGoalsList.mapNotNull { it.curriculumProgramId }.toSet()
        val curriculumProgramNamesById = if (curriculumProgramIds.isEmpty()) emptyMap() else curriculumPrograms.findAllById(curriculumProgramIds).associateBy({ it.id }, { it.name })
        val indicatorsByProgramId = goalIndicators.findAllByDevelopmentProgramIdIn(programsById.keys).groupBy { it.developmentProgramId }
        val checkInsByGoalId = checkIns.findAllByChildGoalIdIn(childGoalsList.map { it.id }.toSet()).groupBy { it.childGoalId }
        return childGoalsList.map { goal ->
            val program = programsById[goal.programId] ?: throw IllegalArgumentException("Program was not found")
            val indicators = (indicatorsByProgramId[goal.programId] ?: emptyList()).sortedBy { it.displayOrder }
            val items = (checkInsByGoalId[goal.id] ?: emptyList()).sortedBy { it.checkInDate }
            buildGoalResponse(goal, program, goal.curriculumProgramId?.let { curriculumProgramNamesById[it] }, indicators, items)
        }
    }

    @Transactional
    fun assign(jwt: Jwt, organizationId: UUID, childId: UUID, request: AssignChildGoalRequest): ChildGoalResponse {
        val scope = access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN, Role.STAFF)); access.requireWritable(scope)
        val child = childScopes.requireStaffManagedChild(scope, childId, organizationId)
        val curriculumProgram = curriculumPrograms.findById(request.curriculumProgramId).orElseThrow { IllegalArgumentException("Curriculum program was not found") }
        require(curriculumProgram.active && (curriculumProgram.organizationId == null || curriculumProgram.organizationId == organizationId)) { "Curriculum program is not available" }
        val program = program(request.programId, organizationId)
        require(curriculumProgramPrograms.existsByCurriculumProgramIdAndDevelopmentProgramId(curriculumProgram.id, program.id)) { "Development program is not part of the curriculum program" }
        require(program.active) { "Program is inactive" }
        require(goalIndicators.findAllByDevelopmentProgramIdOrderByDisplayOrderAsc(program.id).any { it.active }) { "Program needs at least one active indicator" }
        require(matchesChildProgram(child, program)) { "Program does not match the child's class" }
        require(!goals.existsByChildIdAndProgramIdAndStatus(childId, program.id, ChildGoalStatus.ACTIVE)) { "Child already has this active program" }
        val goal = goals.save(ChildGoal(organizationId = organizationId, childId = childId, curriculumProgramId = curriculumProgram.id, programId = program.id, startsOn = request.startsOn))
        audits.save(AuditLog(organizationId = organizationId, actorUserId = scope.user.id, entityType = "CHILD_GOAL", entityId = goal.id, action = "ASSIGNED", source = "GOAL"))
        publishGoal(organizationId, childId)
        return goalResponse(goal)
    }

    @Transactional
    fun recordCheckIn(jwt: Jwt, organizationId: UUID, goalId: UUID, date: LocalDate, request: GoalCheckInRequest): ChildGoalResponse {
        val scope = access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN, Role.STAFF)); access.requireWritable(scope)
        val goal = goal(goalId, organizationId); require(goal.status == ChildGoalStatus.ACTIVE) { "Goal is already completed" }
        authorizeChild(scope, organizationId, goal.childId)
        val program = program(goal.programId, organizationId)
        val indicator = indicator(request.indicatorId, program.id)
        require(indicator.active) { "Program indicator is archived" }
        val targetEndsOn = goal.startsOn.plusDays(program.durationDays.toLong() - 1)
        require(!date.isBefore(goal.startsOn) && !date.isAfter(targetEndsOn)) { "Check-in date must be within the program period" }
        val checkIn = checkIns.findByChildGoalIdAndIndicatorIdAndCheckInDate(goalId, indicator.id, date) ?: ChildGoalCheckIn(organizationId = organizationId, childGoalId = goalId, indicatorId = indicator.id, checkInDate = date, recordedByUserId = scope.user.id)
        checkIn.outcome = request.outcome
        request.note?.let { checkIn.note = it.trim().ifBlank { null } }
        request.photo?.let { val bytes = decodePhoto(it); checkIn.photoContentType = it.contentType.lowercase(); checkIn.photoData = bytes }
        request.audio?.let { val bytes = decodeAudio(it); checkIn.audioContentType = it.contentType.lowercase(); checkIn.audioData = bytes; checkIn.audioDurationMs = it.durationMs }
        checkIn.recordedByUserId = scope.user.id; checkIn.recordedAt = Instant.now(); checkIns.save(checkIn)
        audits.save(AuditLog(organizationId = organizationId, actorUserId = scope.user.id, entityType = "CHILD_GOAL_CHECK_IN", entityId = checkIn.id, action = request.outcome.name, source = "GOAL"))
        publishGoal(organizationId, goal.childId)
        return goalResponse(goal)
    }

    @Transactional(readOnly = true)
    fun checkInPhoto(jwt: Jwt, organizationId: UUID, goalId: UUID, date: LocalDate, indicatorId: UUID): GoalPhotoResponse {
        val scope = access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN, Role.STAFF, Role.PARENT), readOnly = true)
        val goal = goal(goalId, organizationId)
        authorizeChild(scope, organizationId, goal.childId)
        val checkIn = checkIns.findByChildGoalIdAndIndicatorIdAndCheckInDate(goalId, indicatorId, date) ?: throw IllegalArgumentException("Check-in was not found")
        val data = checkIn.photoData ?: throw IllegalArgumentException("Check-in has no photo")
        return GoalPhotoResponse(checkIn.photoContentType ?: "image/jpeg", Base64.getEncoder().encodeToString(data))
    }

    @Transactional(readOnly = true)
    fun checkInAudio(jwt: Jwt, organizationId: UUID, goalId: UUID, date: LocalDate, indicatorId: UUID): GoalAudioResponse {
        val scope = access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN, Role.STAFF, Role.PARENT), readOnly = true)
        val goal = goal(goalId, organizationId)
        authorizeChild(scope, organizationId, goal.childId)
        val checkIn = checkIns.findByChildGoalIdAndIndicatorIdAndCheckInDate(goalId, indicatorId, date) ?: throw IllegalArgumentException("Check-in was not found")
        val data = checkIn.audioData ?: throw IllegalArgumentException("Check-in has no audio")
        return GoalAudioResponse(checkIn.audioContentType ?: "audio/mp4", Base64.getEncoder().encodeToString(data), checkIn.audioDurationMs)
    }

    @Transactional
    fun finalize(jwt: Jwt, organizationId: UUID, goalId: UUID, request: FinalizeChildGoalRequest): ChildGoalResponse {
        val scope = access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN, Role.STAFF)); access.requireWritable(scope)
        val goal = goal(goalId, organizationId); require(goal.status == ChildGoalStatus.ACTIVE) { "Goal is already completed" }
        authorizeChild(scope, organizationId, goal.childId)
        goal.status = ChildGoalStatus.COMPLETED; goal.finalOutcome = request.outcome; goal.finalSummary = request.summary.trim(); goal.finalizedByUserId = scope.user.id; goal.finalizedAt = Instant.now()
        audits.save(AuditLog(organizationId = organizationId, actorUserId = scope.user.id, entityType = "CHILD_GOAL", entityId = goal.id, action = "FINALIZED_${request.outcome.name}", source = "GOAL"))
        publishGoal(organizationId, goal.childId)
        return goalResponse(goal)
    }

    private fun authorizeChild(scope: AccessScope, organizationId: UUID, childId: UUID) = when (scope.membership.role) {
        Role.PARENT -> childScopes.requireParentLinkedChild(scope, childId, organizationId)
        Role.STAFF, Role.STAFF_ADMIN -> childScopes.requireStaffManagedChild(scope, childId, organizationId)
        Role.ADMIN -> throw AccessDeniedException("Platform administrators do not have tenant goal access")
    }
    private fun validateProgramScope(organizationId: UUID, learningLevelId: UUID) {
        val level = levels.findById(learningLevelId).orElseThrow { IllegalArgumentException("Learning level was not found") }
        require(level.organizationId == organizationId) { "Learning level belongs to a different organization" }
    }
    private fun validateGlobalLearningLevel(learningLevelId: UUID) {
        val level = levels.findById(learningLevelId).orElseThrow { IllegalArgumentException("Learning level was not found") }
        require(level.organizationId == null) { "Learning level is not global" }
    }
    private fun saveIndicators(organizationId: UUID?, program: DevelopmentProgram, requestedNames: List<String>) {
        val indicatorNames = requestedNames.map { it.trim() }.filter { it.isNotBlank() }.ifEmpty { listOf(program.name) }
        indicatorNames.forEachIndexed { index, name -> goalIndicators.save(DevelopmentProgramItem(organizationId = organizationId, developmentProgramId = program.id, name = name, displayOrder = index)) }
    }
    private fun matchesChildProgram(child: Child, program: DevelopmentProgram): Boolean {
        val level = levels.findById(program.learningLevelId).orElse(null) ?: return false
        if (program.organizationId == null) {
            if (level.minAgeMonths == null || level.maxAgeMonths == null) return true
            val ageMonths = Period.between(child.dateOfBirth, LocalDate.now()).let { it.years * 12 + it.months }
            return ageMonths in level.minAgeMonths!!..level.maxAgeMonths!!
        }
        val classroomId = child.classroomId ?: return false
        return classrooms.findById(classroomId).orElse(null)?.learningLevelId == program.learningLevelId
    }
    private fun requireTenantOwned(program: DevelopmentProgram) = require(!program.isTemplate) { "Global program cannot be modified" }
    private fun program(id: UUID, organizationId: UUID) = programs.findById(id).orElseThrow { IllegalArgumentException("Program was not found") }.also { require(it.organizationId == null || it.organizationId == organizationId) { "Program belongs to a different organization" } }
    private fun globalProgram(id: UUID) = programs.findById(id).orElseThrow { IllegalArgumentException("Program was not found") }.also { require(it.organizationId == null) { "Program is not global" } }
    private fun goal(id: UUID, organizationId: UUID) = goals.findById(id).orElseThrow { IllegalArgumentException("Child goal was not found") }.also { require(it.organizationId == organizationId) { "Child goal belongs to a different organization" } }
    private fun indicator(id: UUID, programId: UUID) = goalIndicators.findById(id).orElseThrow { IllegalArgumentException("Program indicator was not found") }.also { require(it.developmentProgramId == programId) { "Program indicator belongs to a different program" } }
    private fun decodePhoto(input: GoalPhotoInput): ByteArray {
        require(input.contentType.lowercase() in setOf("image/jpeg", "image/png")) { "Check-in photo must be a JPEG or PNG image" }
        val bytes = try { Base64.getDecoder().decode(input.dataBase64) } catch (_: IllegalArgumentException) { throw IllegalArgumentException("Check-in photo is invalid") }
        require(bytes.isNotEmpty() && bytes.size <= 5 * 1024 * 1024) { "Check-in photo must be at most 5 MB" }
        val isJpeg = bytes.size >= 3 && bytes[0] == 0xFF.toByte() && bytes[1] == 0xD8.toByte() && bytes[2] == 0xFF.toByte()
        val isPng = bytes.size >= 8 && bytes.copyOfRange(0, 8).contentEquals(byteArrayOf(0x89.toByte(), 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A))
        require(isJpeg || isPng) { "Check-in photo is invalid" }
        return bytes
    }
    private fun decodeAudio(input: GoalAudioInput): ByteArray {
        require(input.contentType.lowercase() in setOf("audio/mp4", "audio/m4a", "audio/x-m4a")) { "Check-in audio must be an M4A/MP4 recording" }
        val bytes = try { Base64.getDecoder().decode(input.dataBase64) } catch (_: IllegalArgumentException) { throw IllegalArgumentException("Check-in audio is invalid") }
        require(bytes.isNotEmpty() && bytes.size <= 10 * 1024 * 1024) { "Check-in audio must be at most 10 MB" }
        return bytes
    }
    private fun programResponse(program: DevelopmentProgram): DevelopmentProgramResponse {
        val level = levels.findById(program.learningLevelId).orElse(null)
        return DevelopmentProgramResponse(program.id, program.learningLevelId, program.name, program.description, program.durationDays, program.minimumYesPercent, program.minimumYesStreak, program.domain, if (program.organizationId == null) DevelopmentProgramSource.GLOBAL else DevelopmentProgramSource.TENANT, program.isTemplate, program.active, goalIndicators.findAllByDevelopmentProgramIdOrderByDisplayOrderAsc(program.id).map(::indicatorResponse), level?.minAgeMonths, level?.maxAgeMonths)
    }
    private fun indicatorResponse(indicator: DevelopmentProgramItem) = GoalIndicatorResponse(indicator.id, indicator.name, indicator.displayOrder, indicator.active)
    private fun goalResponse(goal: ChildGoal): ChildGoalResponse {
        val program = program(goal.programId, goal.organizationId)
        val curriculumProgramName = goal.curriculumProgramId?.let { curriculumPrograms.findById(it).orElse(null)?.name }
        val indicators = goalIndicators.findAllByDevelopmentProgramIdOrderByDisplayOrderAsc(program.id)
        val items = checkIns.findAllByChildGoalIdOrderByCheckInDateAsc(goal.id)
        return buildGoalResponse(goal, program, curriculumProgramName, indicators, items)
    }
    private fun buildGoalResponse(goal: ChildGoal, program: DevelopmentProgram, curriculumProgramName: String?, indicators: List<DevelopmentProgramItem>, items: List<ChildGoalCheckIn>): ChildGoalResponse {
        val activeIndicators = indicators.filter { it.active }
        val combinedValues = items.groupBy { it.checkInDate }.mapNotNull { (date, dayCheckIns) ->
            if (activeIndicators.isEmpty()) return@mapNotNull null
            val byIndicator = dayCheckIns.associateBy { it.indicatorId }
            if (!activeIndicators.all { byIndicator.containsKey(it.id) }) return@mapNotNull null
            val allYes = activeIndicators.all { byIndicator[it.id]?.outcome == GoalCheckInOutcome.YES }
            GoalCheckInValue(date, if (allYes) GoalCheckInOutcome.YES else GoalCheckInOutcome.NO)
        }
        val progress = GoalProgressCalculator.calculate(combinedValues)
        val targetEndsOn = goal.startsOn.plusDays(program.durationDays.toLong() - 1)
        val elapsedEndsOn = if (goal.status == ChildGoalStatus.ACTIVE) minOf(LocalDate.now(), targetEndsOn) else targetEndsOn
        val elapsedDays = if (elapsedEndsOn.isBefore(goal.startsOn)) 0 else ChronoUnit.DAYS.between(goal.startsOn, elapsedEndsOn).toInt() + 1
        val missedDays = (elapsedDays - progress.recordedDays).coerceAtLeast(0)
        return ChildGoalResponse(
            goal.id, goal.childId, goal.curriculumProgramId, curriculumProgramName, program.id, program.name, program.description, goal.startsOn, targetEndsOn, program.durationDays, program.minimumYesPercent, program.minimumYesStreak,
            goal.status, goal.finalOutcome, goal.finalSummary, goal.finalizedAt, progress.recordedDays, progress.yesDays, progress.noDays, progress.yesPercent, progress.currentYesStreak, progress.longestYesStreak,
            progress.yesPercent != null && progress.yesPercent >= program.minimumYesPercent, progress.longestYesStreak >= program.minimumYesStreak, missedDays,
            indicators.map(::indicatorResponse),
            items.map { GoalIndicatorCheckInResponse(it.indicatorId, it.checkInDate, it.outcome, it.note, it.photoData != null, it.audioData != null, it.audioDurationMs, it.recordedAt) },
        )
    }
    private fun Child.fullName() = listOfNotNull(firstName, lastName).joinToString(" ")

    @Scheduled(cron = "0 0 20 * * *", zone = "Asia/Jakarta")
    @Transactional
    fun sendMissedCheckInReminders() {
        val today = LocalDate.now(ZoneId.of("Asia/Jakarta"))
        val activeGoals = goals.findAllByStatus(ChildGoalStatus.ACTIVE)
        if (activeGoals.isEmpty()) return
        val programsById = programs.findAllById(activeGoals.map { it.programId }.toSet()).associateBy { it.id }
        val goalsInPeriod = activeGoals.filter { goal ->
            val program = programsById[goal.programId] ?: return@filter false
            val targetEndsOn = goal.startsOn.plusDays(program.durationDays.toLong() - 1)
            !today.isBefore(goal.startsOn) && !today.isAfter(targetEndsOn)
        }
        if (goalsInPeriod.isEmpty()) return
        val activeIndicatorsByProgramId = goalIndicators.findAllByDevelopmentProgramIdIn(goalsInPeriod.map { it.programId }.toSet()).filter { it.active }.groupBy { it.developmentProgramId }
        val goalsNeedingCheckIn = goalsInPeriod.filter { goal -> (activeIndicatorsByProgramId[goal.programId] ?: emptyList()).isNotEmpty() }
        if (goalsNeedingCheckIn.isEmpty()) return
        val doneIndicatorIdsByGoalId = checkIns.findAllByChildGoalIdInAndCheckInDate(goalsNeedingCheckIn.map { it.id }.toSet(), today).groupBy({ it.childGoalId }, { it.indicatorId })
        val childrenById = children.findAllById(goalsNeedingCheckIn.map { it.childId }.toSet()).associateBy { it.id }
        goalsNeedingCheckIn.forEach { goal ->
            val activeIndicators = activeIndicatorsByProgramId[goal.programId] ?: return@forEach
            val doneIndicatorIds = (doneIndicatorIdsByGoalId[goal.id] ?: emptyList()).toSet()
            if (activeIndicators.all { it.id in doneIndicatorIds }) return@forEach
            val child = childrenById[goal.childId]?.takeIf { it.active } ?: return@forEach
            notifyIncompleteCheckIn(goal.organizationId, child)
        }
    }
    private fun notifyIncompleteCheckIn(organizationId: UUID, child: Child) {
        val staffIds = mutableSetOf<UUID>()
        staffIds += childStaffAssignments.findAllByOrganizationIdAndChildIdOrderByCreatedAtDesc(organizationId, child.id).map { it.userId }
        child.classroomId?.let { classroomId -> staffIds += classroomStaffAssignments.findAllByOrganizationIdAndClassroomIdOrderByCreatedAtDesc(organizationId, classroomId).map { it.userId } }
        if (staffIds.isEmpty()) staffIds += memberships.findAllByOrganizationId(organizationId).filter { it.active && it.role == Role.STAFF_ADMIN }.map { it.userId }
        val childName = child.fullName()
        staffIds.forEach { userId ->
            notifications.notify(organizationId, userId, "Check-in program belum diisi", "Check-in program hari ini untuk $childName belum diisi.", actionPath = "/goals?childId=${child.id}", realtimeFlags = setOf(RealtimeFlag.GOALS))
        }
    }
    private fun publishGoal(organizationId: UUID, childId: UUID) {
        guardians.findAllByChildId(childId).forEach { realtime.publishToUser(organizationId, it.userId, setOf(RealtimeFlag.GOALS)) }
        realtime.publishToTenantRoles(organizationId, setOf(Role.STAFF_ADMIN, Role.STAFF), setOf(RealtimeFlag.GOALS))
    }
}
