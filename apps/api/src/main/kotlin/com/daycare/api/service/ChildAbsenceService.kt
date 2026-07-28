package com.daycare.api.service

import com.daycare.api.domain.ChildAbsencePurpose
import com.daycare.api.domain.ChildAbsenceRequestStatus
import com.daycare.api.domain.Role
import com.daycare.api.persistence.BranchRepository
import com.daycare.api.persistence.Child
import com.daycare.api.persistence.ChildAbsenceRequest
import com.daycare.api.persistence.ChildAbsenceRequestRepository
import com.daycare.api.persistence.GuardianLinkRepository
import com.daycare.api.persistence.MembershipRepository
import com.daycare.api.persistence.UserProfile
import com.daycare.api.realtime.RealtimeFlag
import jakarta.validation.constraints.NotNull
import jakarta.validation.constraints.Size
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.util.UUID

data class CreateChildAbsenceRequest(
    @field:NotNull val childId: UUID,
    @field:NotNull val purpose: ChildAbsencePurpose,
    @field:NotNull val startDate: LocalDate,
    @field:NotNull val endDate: LocalDate,
    @field:Size(max = 500) val note: String? = null,
)

data class DecideChildAbsenceRequest(
    val approved: Boolean,
    @field:Size(max = 500) val rejectionReason: String? = null,
)

data class ChildAbsenceResponse(
    val id: UUID,
    val childId: UUID,
    val childName: String,
    val branchId: UUID,
    val purpose: ChildAbsencePurpose,
    val note: String?,
    val startDate: LocalDate,
    val endDate: LocalDate,
    val status: ChildAbsenceRequestStatus,
    val rejectionReason: String?,
    val createdAt: Instant,
    val decidedAt: Instant?,
)

@Service
class ChildAbsenceService(
    private val access: AccessService,
    private val childScopes: ChildScopeService,
    private val branches: BranchRepository,
    private val requests: ChildAbsenceRequestRepository,
    private val guardians: GuardianLinkRepository,
    private val memberships: MembershipRepository,
    private val branchFilters: BranchListFilterService,
    private val notifications: NotificationService,
) {
    @Transactional
    fun create(jwt: Jwt, organizationId: UUID, request: CreateChildAbsenceRequest): ChildAbsenceResponse {
        val scope = access.require(jwt, organizationId, setOf(Role.PARENT))
        access.requireWritable(scope)
        val child = childScopes.requireParentLinkedChild(scope, request.childId, organizationId)
        validateDates(child, request.startDate, request.endDate)
        val note = request.note?.trim()?.ifBlank { null }
        require(request.purpose != ChildAbsencePurpose.OTHER || note != null) { "A note is required when the purpose is OTHER" }
        val overlaps = requests.findAllByChildIdAndStatusIn(child.id, listOf(ChildAbsenceRequestStatus.PENDING, ChildAbsenceRequestStatus.APPROVED))
            .any { overlaps(it, request.startDate, request.endDate) }
        require(!overlaps) { "An absence request already covers these dates" }
        val saved = requests.save(ChildAbsenceRequest(organizationId = organizationId, branchId = child.branchId, childId = child.id, requesterUserId = scope.user.id, purpose = request.purpose, note = note, startDate = request.startDate, endDate = request.endDate))
        notifyApprovers(child, "Pengajuan tidak masuk", "${child.fullName()} mengajukan tidak masuk ${request.startDate} s.d. ${request.endDate}.")
        return response(saved, child)
    }

    @Transactional(readOnly = true)
    fun list(jwt: Jwt, organizationId: UUID, childId: UUID?, filter: BranchListFilter = BranchListFilter()): List<ChildAbsenceResponse> {
        val scope = access.require(jwt, organizationId, setOf(Role.PARENT, Role.STAFF_ADMIN, Role.STAFF), readOnly = true)
        return when (scope.membership.role) {
            Role.PARENT -> {
                val id = childId ?: throw IllegalArgumentException("Child is required")
                val child = childScopes.requireParentLinkedChild(scope, id, organizationId)
                requests.findAllByOrganizationIdAndChildIdOrderByCreatedAtDesc(organizationId, id).map { response(it, child) }
            }
            Role.STAFF_ADMIN, Role.STAFF -> {
                branchFilters.validate(organizationId, filter)
                requests.findAllByOrganizationIdAndStatusOrderByStartDateAscCreatedAtAsc(organizationId, ChildAbsenceRequestStatus.PENDING)
                    .asSequence()
                    .filter { filter.branchId == null || it.branchId == filter.branchId }
                    .mapNotNull { request -> childForStaffScope(scope, request)?.let { child -> response(request, child) } }
                    .toList()
            }
            Role.ADMIN -> emptyList()
        }
    }

    @Transactional
    fun decide(jwt: Jwt, organizationId: UUID, requestId: UUID, decision: DecideChildAbsenceRequest): ChildAbsenceResponse {
        val scope = access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN, Role.STAFF))
        access.requireWritable(scope)
        val request = requireRequest(requestId, organizationId)
        require(request.status == ChildAbsenceRequestStatus.PENDING) { "Absence request is no longer pending" }
        val child = childScopes.requireStaffManagedChild(scope, request.childId, organizationId)
        val rejectionReason = decision.rejectionReason?.trim()?.ifBlank { null }
        require(decision.approved || rejectionReason != null) { "A rejection reason is required" }
        request.status = if (decision.approved) ChildAbsenceRequestStatus.APPROVED else ChildAbsenceRequestStatus.REJECTED
        request.rejectionReason = if (decision.approved) null else rejectionReason
        request.decidedByUserId = scope.user.id
        request.decidedAt = Instant.now()
        notifyGuardians(child, if (decision.approved) "Pengajuan tidak masuk disetujui" else "Pengajuan tidak masuk ditolak", if (decision.approved) "Pengajuan ${child.fullName()} untuk ${request.startDate} s.d. ${request.endDate} telah disetujui." else "Pengajuan ${child.fullName()} ditolak: $rejectionReason")
        return response(request, child)
    }

    @Transactional
    fun cancel(jwt: Jwt, organizationId: UUID, requestId: UUID): ChildAbsenceResponse {
        val scope = access.require(jwt, organizationId, setOf(Role.PARENT))
        access.requireWritable(scope)
        val request = requireRequest(requestId, organizationId)
        require(request.status == ChildAbsenceRequestStatus.PENDING) { "Only pending absence requests can be cancelled" }
        val child = childScopes.requireParentLinkedChild(scope, request.childId, organizationId)
        require(request.requesterUserId == scope.user.id) { "Only the requesting Parent can cancel this absence request" }
        request.status = ChildAbsenceRequestStatus.CANCELLED
        notifyApprovers(child, "Pengajuan tidak masuk dibatalkan", "Pengajuan tidak masuk ${child.fullName()} telah dibatalkan oleh Parent.")
        return response(request, child)
    }

    private fun validateDates(child: Child, startDate: LocalDate, endDate: LocalDate) {
        require(!endDate.isBefore(startDate)) { "End date must not be before start date" }
        val branch = branches.findById(child.branchId).orElseThrow { IllegalArgumentException("Child branch was not found") }
        require(!startDate.isBefore(LocalDate.now(ZoneId.of(branch.timezone)))) { "Absence requests cannot start in the past" }
    }

    private fun childForStaffScope(scope: AccessScope, request: ChildAbsenceRequest): Child? = runCatching { childScopes.requireStaffManagedChild(scope, request.childId, request.organizationId) }.getOrNull()
    private fun requireRequest(requestId: UUID, organizationId: UUID) = requests.findById(requestId).orElseThrow { IllegalArgumentException("Absence request was not found") }.also { require(it.organizationId == organizationId) { "Absence request belongs to a different organization" } }
    private fun overlaps(existing: ChildAbsenceRequest, startDate: LocalDate, endDate: LocalDate) = !existing.endDate.isBefore(startDate) && !existing.startDate.isAfter(endDate)
    private fun response(request: ChildAbsenceRequest, child: Child) = ChildAbsenceResponse(request.id, child.id, child.fullName(), request.branchId, request.purpose, request.note, request.startDate, request.endDate, request.status, request.rejectionReason, request.createdAt, request.decidedAt)

    private fun notifyApprovers(child: Child, title: String, body: String) {
        memberships.findAllByOrganizationId(child.organizationId)
            .filter { it.active && it.role in setOf(Role.STAFF_ADMIN, Role.STAFF) }
            .filter { membership -> membership.role == Role.STAFF_ADMIN || childScopes.isStaffManagedChild(AccessScope(UserProfile(id = membership.userId), membership, emptySet(), emptySet()), child.id, child.organizationId) }
            .map { it.userId }
            .distinct()
            .forEach { userId -> notifications.notify(child.organizationId, userId, title, body, "/absence-requests", setOf(RealtimeFlag.ABSENCE_REQUESTS)) }
    }

    private fun notifyGuardians(child: Child, title: String, body: String) {
        guardians.findAllByChildId(child.id).map { it.userId }.distinct()
            .forEach { userId -> notifications.notify(child.organizationId, userId, title, body, "/absence-requests?childId=${child.id}", setOf(RealtimeFlag.ABSENCE_REQUESTS)) }
    }

    private fun Child.fullName() = listOfNotNull(firstName, lastName).joinToString(" ")
}
