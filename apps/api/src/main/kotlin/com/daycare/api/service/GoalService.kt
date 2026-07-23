package com.daycare.api.service

import com.daycare.api.domain.ChildGoalOutcome
import com.daycare.api.domain.ChildGoalStatus
import com.daycare.api.domain.GoalCheckInOutcome
import com.daycare.api.domain.Role
import com.daycare.api.persistence.AuditLog
import com.daycare.api.persistence.AuditLogRepository
import com.daycare.api.persistence.ChildGoal
import com.daycare.api.persistence.ChildGoalCheckIn
import com.daycare.api.persistence.ChildGoalCheckInRepository
import com.daycare.api.persistence.ChildGoalRepository
import com.daycare.api.persistence.ClassroomRepository
import com.daycare.api.persistence.GoalTemplate
import com.daycare.api.persistence.GoalTemplateRepository
import com.daycare.api.persistence.GuardianLinkRepository
import com.daycare.api.persistence.LearningLevelRepository
import com.daycare.api.realtime.RealtimeFlag
import com.daycare.api.realtime.RealtimePublisher
import jakarta.validation.constraints.Max
import jakarta.validation.constraints.Min
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.Size
import org.springframework.security.access.AccessDeniedException
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Instant
import java.time.LocalDate
import java.util.UUID

data class UpsertGoalTemplateRequest(
    val learningLevelId: UUID? = null,
    val classroomId: UUID? = null,
    @field:NotBlank @field:Size(max = 120) val name: String,
    @field:Size(max = 2_000) val description: String = "",
    @field:Min(1) val durationDays: Int,
    @field:Min(0) @field:Max(100) val minimumYesPercent: Int,
    @field:Min(0) val minimumYesStreak: Int,
)
data class GoalTemplateResponse(val id: UUID, val learningLevelId: UUID?, val classroomId: UUID?, val name: String, val description: String, val durationDays: Int, val minimumYesPercent: Int, val minimumYesStreak: Int, val active: Boolean)
data class AssignChildGoalRequest(val templateId: UUID, val startsOn: LocalDate = LocalDate.now())
data class GoalCheckInRequest(val outcome: GoalCheckInOutcome)
data class FinalizeChildGoalRequest(val outcome: ChildGoalOutcome, @field:NotBlank @field:Size(max = 2_000) val summary: String)
data class GoalCheckInResponse(val date: LocalDate, val outcome: GoalCheckInOutcome, val recordedAt: Instant)
data class ChildGoalResponse(
    val id: UUID, val childId: UUID, val templateId: UUID, val name: String, val description: String, val startsOn: LocalDate, val targetEndsOn: LocalDate,
    val durationDays: Int, val minimumYesPercent: Int, val minimumYesStreak: Int, val status: ChildGoalStatus, val finalOutcome: ChildGoalOutcome?, val finalSummary: String?, val finalizedAt: Instant?,
    val recordedDays: Int, val yesDays: Int, val noDays: Int, val yesPercent: Int?, val currentYesStreak: Int, val longestYesStreak: Int, val meetsYesPercent: Boolean, val meetsYesStreak: Boolean, val checkIns: List<GoalCheckInResponse>,
)

@Service
class GoalService(
    private val access: AccessService,
    private val childScopes: ChildScopeService,
    private val templates: GoalTemplateRepository,
    private val goals: ChildGoalRepository,
    private val checkIns: ChildGoalCheckInRepository,
    private val levels: LearningLevelRepository,
    private val classrooms: ClassroomRepository,
    private val guardians: GuardianLinkRepository,
    private val audits: AuditLogRepository,
    private val realtime: RealtimePublisher,
) {
    @Transactional(readOnly = true)
    fun templates(jwt: Jwt, organizationId: UUID): List<GoalTemplateResponse> {
        access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN, Role.STAFF), readOnly = true)
        return templates.findAllByOrganizationIdOrderByCreatedAtDesc(organizationId).map(::templateResponse)
    }

    @Transactional
    fun createTemplate(jwt: Jwt, organizationId: UUID, request: UpsertGoalTemplateRequest): GoalTemplateResponse {
        access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN))
        validateTemplateScope(organizationId, request)
        return templateResponse(templates.save(GoalTemplate(organizationId = organizationId, learningLevelId = request.learningLevelId, classroomId = request.classroomId, name = request.name.trim(), description = request.description.trim(), durationDays = request.durationDays, minimumYesPercent = request.minimumYesPercent, minimumYesStreak = request.minimumYesStreak)))
    }

    @Transactional
    fun updateTemplate(jwt: Jwt, organizationId: UUID, templateId: UUID, request: UpsertGoalTemplateRequest): GoalTemplateResponse {
        access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN))
        validateTemplateScope(organizationId, request)
        val template = template(templateId, organizationId)
        template.learningLevelId = request.learningLevelId; template.classroomId = request.classroomId; template.name = request.name.trim(); template.description = request.description.trim(); template.durationDays = request.durationDays; template.minimumYesPercent = request.minimumYesPercent; template.minimumYesStreak = request.minimumYesStreak
        realtime.publishToTenantRoles(organizationId, setOf(Role.STAFF_ADMIN, Role.STAFF, Role.PARENT), setOf(RealtimeFlag.GOALS))
        return templateResponse(template)
    }

    @Transactional
    fun archiveTemplate(jwt: Jwt, organizationId: UUID, templateId: UUID): GoalTemplateResponse {
        access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN))
        val template = template(templateId, organizationId); template.active = false
        realtime.publishToTenantRoles(organizationId, setOf(Role.STAFF_ADMIN, Role.STAFF, Role.PARENT), setOf(RealtimeFlag.GOALS))
        return templateResponse(template)
    }

    @Transactional(readOnly = true)
    fun childGoals(jwt: Jwt, organizationId: UUID, childId: UUID): List<ChildGoalResponse> {
        val scope = access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN, Role.STAFF, Role.PARENT), readOnly = true)
        authorizeChild(scope, organizationId, childId)
        return goals.findAllByOrganizationIdAndChildIdOrderByCreatedAtDesc(organizationId, childId).map(::goalResponse)
    }

    @Transactional
    fun assign(jwt: Jwt, organizationId: UUID, childId: UUID, request: AssignChildGoalRequest): ChildGoalResponse {
        val scope = access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN)); access.requireWritable(scope)
        val child = childScopes.requireStaffManagedChild(scope, childId, organizationId)
        val template = template(request.templateId, organizationId)
        require(template.active) { "Goal template is inactive" }
        require(matchesChildTemplate(child.classroomId, template)) { "Goal template does not match the child's class" }
        require(!goals.existsByChildIdAndTemplateIdAndStatus(childId, template.id, ChildGoalStatus.ACTIVE)) { "Child already has this active goal" }
        val goal = goals.save(ChildGoal(organizationId = organizationId, childId = childId, templateId = template.id, startsOn = request.startsOn))
        audits.save(AuditLog(organizationId = organizationId, actorUserId = scope.user.id, entityType = "CHILD_GOAL", entityId = goal.id, action = "ASSIGNED", source = "GOAL"))
        publishGoal(organizationId, childId)
        return goalResponse(goal)
    }

    @Transactional
    fun recordCheckIn(jwt: Jwt, organizationId: UUID, goalId: UUID, date: LocalDate, request: GoalCheckInRequest): ChildGoalResponse {
        val scope = access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN, Role.STAFF)); access.requireWritable(scope)
        val goal = goal(goalId, organizationId); require(goal.status == ChildGoalStatus.ACTIVE) { "Goal is already completed" }
        authorizeChild(scope, organizationId, goal.childId)
        val targetEndsOn = goal.startsOn.plusDays(template(goal.templateId, organizationId).durationDays.toLong() - 1)
        require(!date.isBefore(goal.startsOn) && !date.isAfter(targetEndsOn)) { "Check-in date must be within the goal period" }
        val checkIn = checkIns.findByChildGoalIdAndCheckInDate(goalId, date) ?: ChildGoalCheckIn(organizationId = organizationId, childGoalId = goalId, checkInDate = date, recordedByUserId = scope.user.id)
        checkIn.outcome = request.outcome; checkIn.recordedByUserId = scope.user.id; checkIn.recordedAt = Instant.now(); checkIns.save(checkIn)
        audits.save(AuditLog(organizationId = organizationId, actorUserId = scope.user.id, entityType = "CHILD_GOAL_CHECK_IN", entityId = checkIn.id, action = request.outcome.name, source = "GOAL"))
        publishGoal(organizationId, goal.childId)
        return goalResponse(goal)
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
    private fun validateTemplateScope(organizationId: UUID, request: UpsertGoalTemplateRequest) {
        require(request.learningLevelId != null || request.classroomId != null) { "Goal template needs a learning level or class" }
        request.learningLevelId?.let { id -> require(levels.findById(id).orElseThrow { IllegalArgumentException("Learning level was not found") }.organizationId == organizationId) { "Learning level belongs to a different organization" } }
        request.classroomId?.let { id ->
            val classroom = classrooms.findById(id).orElseThrow { IllegalArgumentException("Classroom was not found") }
            require(classroom.organizationId == organizationId) { "Classroom belongs to a different organization" }
            require(request.learningLevelId == null || classroom.learningLevelId == request.learningLevelId) { "Classroom does not belong to the selected learning level" }
        }
    }
    private fun matchesChildTemplate(childClassroomId: UUID?, template: GoalTemplate): Boolean {
        if (template.classroomId != null && childClassroomId != template.classroomId) return false
        if (template.learningLevelId == null) return true
        val classroomId = childClassroomId ?: return false
        return classrooms.findById(classroomId).orElse(null)?.learningLevelId == template.learningLevelId
    }
    private fun template(id: UUID, organizationId: UUID) = templates.findById(id).orElseThrow { IllegalArgumentException("Goal template was not found") }.also { require(it.organizationId == organizationId) { "Goal template belongs to a different organization" } }
    private fun goal(id: UUID, organizationId: UUID) = goals.findById(id).orElseThrow { IllegalArgumentException("Child goal was not found") }.also { require(it.organizationId == organizationId) { "Child goal belongs to a different organization" } }
    private fun templateResponse(template: GoalTemplate) = GoalTemplateResponse(template.id, template.learningLevelId, template.classroomId, template.name, template.description, template.durationDays, template.minimumYesPercent, template.minimumYesStreak, template.active)
    private fun goalResponse(goal: ChildGoal): ChildGoalResponse {
        val template = template(goal.templateId, goal.organizationId)
        val items = checkIns.findAllByChildGoalIdOrderByCheckInDateAsc(goal.id)
        val progress = GoalProgressCalculator.calculate(items.map { GoalCheckInValue(it.checkInDate, it.outcome) })
        return ChildGoalResponse(goal.id, goal.childId, template.id, template.name, template.description, goal.startsOn, goal.startsOn.plusDays(template.durationDays.toLong() - 1), template.durationDays, template.minimumYesPercent, template.minimumYesStreak, goal.status, goal.finalOutcome, goal.finalSummary, goal.finalizedAt, progress.recordedDays, progress.yesDays, progress.noDays, progress.yesPercent, progress.currentYesStreak, progress.longestYesStreak, progress.yesPercent != null && progress.yesPercent >= template.minimumYesPercent, progress.longestYesStreak >= template.minimumYesStreak, items.map { GoalCheckInResponse(it.checkInDate, it.outcome, it.recordedAt) })
    }
    private fun publishGoal(organizationId: UUID, childId: UUID) {
        guardians.findAllByChildId(childId).forEach { realtime.publishToUser(organizationId, it.userId, setOf(RealtimeFlag.GOALS)) }
        realtime.publishToTenantRoles(organizationId, setOf(Role.STAFF_ADMIN, Role.STAFF), setOf(RealtimeFlag.GOALS))
    }
}
