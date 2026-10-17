package com.daycare.api.service

// Mories Deo Hutapea,S.E.,S.Kom

import com.daycare.api.domain.InvitationStatus
import com.daycare.api.domain.InstitutionCapability
import com.daycare.api.domain.InstitutionTypeCodes
import com.daycare.api.domain.Role
import com.daycare.api.domain.RegistrationRole
import com.daycare.api.domain.TenantPaymentStatus
import com.daycare.api.domain.TenantSubscriptionAttentionGroup
import com.daycare.api.domain.TenantSubscriptionPlan
import com.daycare.api.domain.TenantSubscriptionStatus
import com.daycare.api.domain.attentionGroup
import com.daycare.api.persistence.Branch
import com.daycare.api.persistence.BranchRepository
import com.daycare.api.persistence.Invitation
import com.daycare.api.persistence.InvitationRepository
import com.daycare.api.persistence.Organization
import com.daycare.api.persistence.OrganizationRepository
import com.daycare.api.persistence.OrganizationTypeAssignment
import com.daycare.api.persistence.OrganizationTypeAssignmentRepository
import com.daycare.api.persistence.TenantPayment
import com.daycare.api.persistence.TenantPaymentRepository
import com.daycare.api.persistence.TenantSubscription
import com.daycare.api.persistence.TenantSubscriptionRepository
import com.daycare.api.persistence.TenantSubscriptionAuditEvent
import com.daycare.api.persistence.TenantSubscriptionAuditEventRepository
import com.daycare.api.persistence.UserProfile
import com.daycare.api.persistence.UserProfileRepository
import com.daycare.api.persistence.MembershipRepository
import com.daycare.api.persistence.Membership
import com.daycare.api.persistence.EducationOfferingRepository
import jakarta.validation.constraints.DecimalMin
import jakarta.validation.constraints.Email
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.Max
import jakarta.validation.constraints.Min
import jakarta.validation.constraints.Size
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.math.BigDecimal
import java.time.Instant
import java.time.LocalDate
import java.util.UUID
import org.springframework.data.domain.PageRequest

data class CreateTenantRequest(
    @field:NotBlank @field:Size(max = 200) val tenantName: String,
    @field:NotBlank @field:Size(max = 200) val branchName: String,
    val institutionTypes: Set<String>?,
    val subscriptionPlan: TenantSubscriptionPlan,
    @field:DecimalMin("1") val monthlyFee: BigDecimal?,
    @field:Min(1) @field:Max(12) val trialMonths: Int?,
    @field:NotBlank @field:Size(min = 2, max = 100) val staffAdminName: String,
    @field:Email @field:NotBlank val staffAdminEmail: String,
    @field:NotBlank @field:Size(min = 6, max = 128) val staffAdminPassword: String,
    @field:Size(min = 2, max = 100) val staffAdminUsername: String? = null,
)

data class TenantPaymentResponse(val id: UUID, val invoiceNumber: String, val amount: BigDecimal, val status: TenantPaymentStatus, val dueDate: LocalDate, val paidAt: Instant?, val periodStart: LocalDate?, val periodEnd: LocalDate?, val coveragePeriodStart: LocalDate?, val coveragePeriodEnd: LocalDate?, val planCodeSnapshot: String?)
data class TenantStaffAdminResponse(val id: UUID, val email: String?, val displayName: String?, val status: String, val primary: Boolean)
data class PlatformParentAccountResponse(
    val id: UUID,
    val displayName: String,
    val username: String?,
    val email: String?,
    val phoneNumber: String?,
    val status: String,
    val tenantCount: Int,
    val hasLocalPassword: Boolean,
)
data class TenantResponse(
    val id: UUID,
    val name: String,
    val branchName: String?,
    val branches: List<TenantBranchResponse>,
    val institutionTypes: Set<String>,
    val capabilities: Set<InstitutionCapability>,
    val subscriptionPlan: TenantSubscriptionPlan?,
    val subscriptionStatus: TenantSubscriptionStatus?,
    val periodStart: LocalDate?,
    val periodEnd: LocalDate?,
    val trialEndsAt: LocalDate?,
    val monthlyFee: BigDecimal?,
    val gracePeriodDays: Int,
    val graceEndsAt: LocalDate?,
    val staffAdmin: TenantStaffAdminResponse?,
    val staffAdmins: List<TenantStaffAdminResponse>,
    val payments: List<TenantPaymentResponse>,
)
data class TenantPageResponse(val items: List<TenantResponse>, val page: Int, val size: Int, val totalElements: Int, val totalPages: Int, val totalMatching: Int, val statusCounts: Map<TenantSubscriptionStatus, Int>)
data class UpdateTenantRequest(
    @field:NotBlank @field:Size(max = 200) val tenantName: String,
    val institutionTypes: Set<String>,
    val subscriptionPlan: TenantSubscriptionPlan,
    @field:DecimalMin("1") val monthlyFee: BigDecimal?,
    @field:Size(max = 1000) val reason: String? = null,
)
data class RenewTenantSubscriptionRequest(@field:DecimalMin("1") val monthlyFee: BigDecimal?)
data class UpdateTenantGracePeriodRequest(@field:Min(0) @field:Max(30) val gracePeriodDays: Int, @field:NotBlank @field:Size(max = 1000) val reason: String)
data class SetTenantSubscriptionStatusRequest(@field:NotBlank @field:Size(max = 1000) val reason: String)
data class TenantSubscriptionAuditResponse(val id: UUID, val action: String, val actorUserId: UUID, val reason: String, val beforeValue: String?, val afterValue: String?, val referenceId: UUID?, val correlationId: UUID?, val createdAt: Instant)
data class TenantGraceRolloutTenantResponse(
    val organizationId: UUID,
    val tenantName: String,
    val storedStatus: TenantSubscriptionStatus,
    val currentEffectiveStatus: TenantSubscriptionStatus,
    val currentAccessLevel: TenantGraceRolloutAccessLevel,
    val proposedEffectiveStatus: TenantSubscriptionStatus,
    val proposedAccessLevel: TenantGraceRolloutAccessLevel,
    val periodEnd: LocalDate,
    val gracePeriodDays: Int,
)
enum class TenantGraceRolloutAccessLevel { OPERATIONAL, GRACE_LIMITED, RESTRICTED }
data class TenantGraceRolloutPreviewResponse(
    val generatedAt: Instant,
    val graceLifecycleEnabled: Boolean,
    val snapshotToken: String,
    val totalTenantCount: Int,
    val affectedTenantCount: Int,
    val currentStatusCounts: Map<TenantSubscriptionStatus, Int>,
    val proposedStatusCounts: Map<TenantSubscriptionStatus, Int>,
    val page: Int,
    val size: Int,
    val totalPages: Int,
    val tenants: List<TenantGraceRolloutTenantResponse>,
)
data class TenantSubscriptionAuditPage(val items: List<TenantSubscriptionAuditResponse>, val page: Int, val size: Int, val totalElements: Long, val totalPages: Int)
class TenantSubscriptionIdempotencyConflict : RuntimeException("Idempotency key was already used with a different renewal request")
data class CreateTenantStaffAdminRequest(
    @field:NotBlank @field:Size(min = 2, max = 100) val displayName: String,
    @field:Size(min = 2, max = 100) val username: String? = null,
    @field:Email @field:NotBlank val email: String,
    @field:NotBlank @field:Size(min = 6, max = 128) val password: String,
)
data class UpdateTenantStaffAdminRequest(
    @field:NotBlank @field:Size(min = 2, max = 100) val displayName: String,
)
data class CreatePlatformAdminRequest(
    @field:Email @field:NotBlank val email: String,
    @field:NotBlank @field:Size(min = 2, max = 100) val username: String,
    @field:Size(min = 6, max = 128) val password: String,
)
@Service
class PlatformAdministrationService(
    private val platformAccess: PlatformAccessService,
    private val organizations: OrganizationRepository,
    private val organizationTypes: OrganizationTypeAssignmentRepository,
    private val organizationCapabilities: OrganizationCapabilitiesService,
    private val branches: BranchRepository,
    private val subscriptions: TenantSubscriptionRepository,
    private val payments: TenantPaymentRepository,
    private val invitations: InvitationRepository,
    private val memberships: MembershipRepository,
    private val users: UserProfileRepository,
    private val tenantUserAccounts: TenantUserAccountService,
    private val institutionTypeCatalog: InstitutionTypeCatalogService,
    private val defaultCurriculumActivities: TenantDefaultCurriculumActivitySeeder,
    private val educationOfferings: EducationOfferingRepository,
    private val tokenRevocations: AccessTokenRevocationService,
    private val subscriptionAudits: TenantSubscriptionAuditEventRepository,
    private val subscriptionBillingPolicy: TenantSubscriptionBillingPolicy,
    private val invoiceNumbers: TenantSubscriptionInvoiceNumberGenerator,
    private val subscriptionRenewals: TenantSubscriptionRenewalService,
    private val subscriptionLifecycle: TenantSubscriptionLifecyclePolicy = TenantSubscriptionLifecyclePolicy(graceEnabled = true),
) {
    @Transactional(readOnly = true)
    fun parents(jwt: Jwt, search: String?): List<PlatformParentAccountResponse> {
        platformAccess.requirePlatformAdmin(jwt)
        val query = search?.trim().orEmpty()
        val parentUsers = users.findRegisteredParents(query)
        if (parentUsers.isEmpty()) return emptyList()
        val membershipsByUser = memberships.findAllByRoleAndUserIdIn(Role.PARENT, parentUsers.map { it.id })
            .groupBy { it.userId }
        return parentUsers.map { user ->
            val parentMemberships = membershipsByUser[user.id].orEmpty()
            val activeTenantCount = parentMemberships.count { it.active }
            PlatformParentAccountResponse(
                id = user.id,
                displayName = user.displayName,
                username = user.username,
                email = user.email,
                phoneNumber = user.phoneNumber,
                status = when {
                    activeTenantCount > 0 -> "ACTIVE"
                    parentMemberships.isNotEmpty() -> "INACTIVE"
                    else -> "UNBOUND"
                },
                tenantCount = activeTenantCount,
                hasLocalPassword = user.localPasswordHash != null,
            )
        }
    }

    @Transactional
    fun resetParentPassword(jwt: Jwt, userId: UUID, request: ChangeTenantUserPasswordRequest) {
        platformAccess.requirePlatformAdmin(jwt)
        val user = users.findById(userId).orElseThrow { IllegalArgumentException("Parent account was not found") }
        require(user.registrationRole == RegistrationRole.PARENT) { "Parent account was not found" }
        tenantUserAccounts.changePassword(user, request.password)
        tokenRevocations.revokeUserSessions(user)
    }

    @Transactional
    fun tenants(jwt: Jwt, search: String?): List<TenantResponse> {
        platformAccess.requirePlatformAdmin(jwt)
        val query = search?.trim().orEmpty()
        if (query.isEmpty()) return organizations.findAll().map(::tenantResponse)
        val byName = organizations.findAllByNameContainingIgnoreCase(query)
        val staffAdminOrgIds = memberships.findOrganizationIdsByStaffAdminSearch(query)
        val byStaffAdmin = if (staffAdminOrgIds.isEmpty()) emptyList() else organizations.findAllById(staffAdminOrgIds)
        return (byName + byStaffAdmin).distinctBy { it.id }.map(::tenantResponse)
    }

    @Transactional(readOnly = true)
    fun tenantPage(jwt: Jwt, search: String?, status: TenantSubscriptionStatus?, institutionType: String?, page: Int, size: Int, attentionGroup: TenantSubscriptionAttentionGroup? = null): TenantPageResponse {
        platformAccess.requirePlatformAdmin(jwt)
        require(page >= 0) { "Page must be zero or greater" }
        require(size in 1..50) { "Page size must be between 1 and 50" }
        require(status == null || attentionGroup == null) { "Only one of status or attentionGroup can be set" }
        val query = search?.trim().orEmpty()
        val candidates = if (query.isEmpty()) organizations.findAll() else {
            val byName = organizations.findAllByNameContainingIgnoreCase(query)
            val staffIds = memberships.findOrganizationIdsByStaffAdminSearch(query)
            val byStaff = if (staffIds.isEmpty()) emptyList() else organizations.findAllById(staffIds)
            (byName + byStaff).distinctBy { it.id }
        }
        if (candidates.isEmpty()) return TenantPageResponse(emptyList(), page, size, 0, 0, 0, emptyMap())

        val ids = candidates.map { it.id }
        val typesByOrganization = organizationTypes.findAllByOrganizationIdIn(ids).groupBy { it.organizationId }
        val typeFiltered = institutionType?.takeIf { it.isNotBlank() }?.let { selected ->
            candidates.filter { organization -> typesByOrganization[organization.id].orEmpty().any { it.type == selected } }
        } ?: candidates
        val subscriptionsByOrganization = subscriptions.findAllByOrganizationIdIn(typeFiltered.map { it.id }).associateBy { it.organizationId }
        val today = LocalDate.now(BILLING_TIME_ZONE)
        val effectiveStatuses = typeFiltered.mapNotNull { organization ->
            subscriptionsByOrganization[organization.id]?.let { subscriptionLifecycle.effectiveStatus(it, today) }
        }
        val filtered = typeFiltered.filter { organization ->
            val organizationEffectiveStatus = subscriptionsByOrganization[organization.id]?.let { subscriptionLifecycle.effectiveStatus(it, today) }
            when {
                status != null -> organizationEffectiveStatus == status
                attentionGroup != null -> organizationEffectiveStatus?.attentionGroup() == attentionGroup
                else -> true
            }
        }.sortedBy { it.name.lowercase() }
        val start = (page.toLong() * size).coerceAtMost(Int.MAX_VALUE.toLong()).toInt()
        val totalPages = if (filtered.isEmpty()) 0 else (filtered.size + size - 1) / size
        return TenantPageResponse(filtered.drop(start).take(size).map(::tenantResponse), page, size, filtered.size, totalPages, typeFiltered.size, effectiveStatuses.groupingBy { it }.eachCount())
    }

    @Transactional(readOnly = true)
    fun previewGraceRollout(jwt: Jwt, page: Int, size: Int): TenantGraceRolloutPreviewResponse {
        platformAccess.requirePlatformAdmin(jwt)
        require(page >= 0) { "Page must be zero or greater" }
        require(size in 1..100) { "Page size must be between 1 and 100" }

        val today = LocalDate.now(BILLING_TIME_ZONE)
        val allSubscriptions = subscriptions.findAll().sortedBy { it.organizationId }
        val organizationsById = organizations.findAllById(allSubscriptions.map { it.organizationId }).associateBy { it.id }
        val evaluated = allSubscriptions.mapNotNull { subscription ->
            val organization = organizationsById[subscription.organizationId] ?: return@mapNotNull null
            val currentStatus = subscriptionLifecycle.effectiveStatus(subscription, today)
            val proposedStatus = subscriptionLifecycle.previewStatusWithGrace(subscription, today)
            TenantGraceRolloutTenantResponse(
                organizationId = organization.id,
                tenantName = organization.name,
                storedStatus = subscription.status,
                currentEffectiveStatus = currentStatus,
                currentAccessLevel = graceRolloutAccessLevel(currentStatus),
                proposedEffectiveStatus = proposedStatus,
                proposedAccessLevel = graceRolloutAccessLevel(proposedStatus),
                periodEnd = subscription.nextPeriodEnd?.takeIf { !today.isBefore(it) } ?: subscription.periodEnd,
                gracePeriodDays = subscription.nextGracePeriodDays ?: subscription.gracePeriodDays,
            )
        }
        val affected = evaluated.filter { it.currentEffectiveStatus != it.proposedEffectiveStatus }
        val start = (page.toLong() * size).coerceAtMost(Int.MAX_VALUE.toLong()).toInt()
        val items = affected.drop(start).take(size)
        val stateSnapshot = allSubscriptions.joinToString("\n") { subscription ->
            listOf(subscription.id, subscription.organizationId, subscription.version, subscription.status,
                subscription.periodStart, subscription.periodEnd, subscription.trialEndsAt,
                subscription.gracePeriodDays, subscription.nextPeriodStart, subscription.nextPeriodEnd,
                subscription.nextGracePeriodDays).joinToString("|")
        }
        val snapshotToken = sha256(stateSnapshot)
        return TenantGraceRolloutPreviewResponse(
            generatedAt = Instant.now(),
            graceLifecycleEnabled = subscriptionLifecycle.isGraceEnabled(),
            snapshotToken = snapshotToken,
            totalTenantCount = evaluated.size,
            affectedTenantCount = affected.size,
            currentStatusCounts = evaluated.groupingBy { it.currentEffectiveStatus }.eachCount(),
            proposedStatusCounts = evaluated.groupingBy { it.proposedEffectiveStatus }.eachCount(),
            page = page,
            size = size,
            totalPages = if (affected.isEmpty()) 0 else (affected.size + size - 1) / size,
            tenants = items,
        )
    }

    @Transactional
    fun tenant(jwt: Jwt, organizationId: UUID): TenantResponse {
        platformAccess.requirePlatformAdmin(jwt)
        return tenantResponse(requireOrganization(organizationId))
    }

    @Transactional
    fun createTenant(jwt: Jwt, request: CreateTenantRequest): TenantResponse {
        val actor = platformAccess.requirePlatformAdmin(jwt)
        val organization = organizations.save(Organization(name = request.tenantName.trim()))
        val institutionTypes = request.institutionTypes?.takeIf { it.isNotEmpty() } ?: setOf(InstitutionTypeCodes.DAYCARE)
        institutionTypeCatalog.requireActiveCodes(institutionTypes)
        organizationTypes.saveAll(institutionTypes.map { type -> OrganizationTypeAssignment(organizationId = organization.id, type = type) })
        branches.save(Branch(organizationId = organization.id, name = request.branchName.trim(), primary = true))
        defaultCurriculumActivities.seed(organization.id)
        val today = LocalDate.now(BILLING_TIME_ZONE)
        val isTrial = request.trialMonths != null
        require(isTrial || request.monthlyFee != null) { "Monthly fee is required when tenant does not use a trial" }
        require(!isTrial || request.monthlyFee == null) { "Monthly fee must not be set when tenant uses a trial" }
        request.monthlyFee?.let(subscriptionBillingPolicy::requireAllowedAmount)
        val periodEnd = if (isTrial) today.plusMonths(request.trialMonths!!.toLong()).minusDays(1) else today.plusMonths(1).minusDays(1)
        val subscription = subscriptions.save(TenantSubscription(
            organizationId = organization.id,
            plan = request.subscriptionPlan,
            status = if (isTrial) TenantSubscriptionStatus.TRIAL else TenantSubscriptionStatus.PENDING_PAYMENT,
            periodStart = today,
            periodEnd = periodEnd,
            trialEndsAt = if (isTrial) periodEnd else null,
            monthlyFee = request.monthlyFee,
        ))
        if (!isTrial) payments.save(TenantPayment(invoiceNumber = invoiceNumbers.next(today), subscriptionId = subscription.id, organizationId = organization.id, amount = request.monthlyFee!!, dueDate = today.plusDays(7), periodStart = today, periodEnd = periodEnd, planCodeSnapshot = request.subscriptionPlan.name))
        recordSubscriptionAudit(organization.id, subscription.id, actor.id, "SUBSCRIPTION_CREATED", "Tenant subscription created", null, "${subscription.plan}:${subscription.status}:${subscription.monthlyFee}")
        val staffAdmin = tenantUserAccounts.create(request.staffAdminName, request.staffAdminEmail, request.staffAdminPassword, request.staffAdminUsername)
        memberships.save(Membership(userId = staffAdmin.id, organizationId = organization.id, role = Role.STAFF_ADMIN, primaryStaffAdmin = true))
        return tenantResponse(organization)
    }

    @Transactional
    fun createPlatformAdmin(jwt: Jwt, request: CreatePlatformAdminRequest): UUID {
        platformAccess.requirePlatformAdmin(jwt)
        throw IllegalStateException(PlatformAdminError.SINGLETON)
    }

    @Transactional
    fun createTenantStaffAdmin(jwt: Jwt, organizationId: UUID, request: CreateTenantStaffAdminRequest): TenantResponse {
        platformAccess.requirePlatformAdmin(jwt)
        val organization = requireOrganization(organizationId)
        val user = tenantUserAccounts.create(request.displayName, request.email, request.password, request.username)
        memberships.save(Membership(userId = user.id, organizationId = organizationId, role = Role.STAFF_ADMIN))
        return tenantResponse(organization)
    }

    @Transactional
    fun removeTenantStaffAdmin(jwt: Jwt, organizationId: UUID, membershipId: UUID): TenantResponse {
        platformAccess.requirePlatformAdmin(jwt)
        val organization = requireOrganization(organizationId)
        val membership = memberships.findById(membershipId).orElseThrow { IllegalArgumentException("Staff Admin account was not found") }
        require(membership.organizationId == organizationId && membership.role == Role.STAFF_ADMIN) { "Staff Admin account was not found" }
        require(!membership.primaryStaffAdmin) { "Primary Staff Admin cannot be removed" }
        membership.active = false
        membership.deactivatedAt = Instant.now()
        return tenantResponse(organization)
    }

    @Transactional
    fun updateTenantStaffAdmin(jwt: Jwt, organizationId: UUID, membershipId: UUID, request: UpdateTenantStaffAdminRequest): TenantResponse {
        platformAccess.requirePlatformAdmin(jwt)
        val organization = requireOrganization(organizationId)
        val membership = memberships.findById(membershipId).orElseThrow { IllegalArgumentException("Staff Admin account was not found") }
        require(membership.organizationId == organizationId && membership.role == Role.STAFF_ADMIN) { "Staff Admin account was not found" }
        require(!membership.primaryStaffAdmin) { "Primary Staff Admin cannot be edited" }
        val user = users.findById(membership.userId).orElseThrow { IllegalArgumentException("Staff Admin account was not found") }
        user.displayName = request.displayName.trim()
        return tenantResponse(organization)
    }

    /**
     * Unlike update/removeTenantStaffAdmin, this is allowed for the primary
     * Staff Admin too: a password reset is the only account-recovery path
     * when a tenant's Staff Admin is locked out of their own account. See
     * docs/business-rules.md §2 (primaryStaffAdmin protection and its
     * explicit exception for this action).
     */
    @Transactional
    fun resetTenantStaffAdminPassword(jwt: Jwt, organizationId: UUID, membershipId: UUID, request: ChangeTenantUserPasswordRequest) {
        platformAccess.requirePlatformAdmin(jwt)
        requireOrganization(organizationId)
        val membership = memberships.findById(membershipId).orElseThrow { IllegalArgumentException("Staff Admin account was not found") }
        require(membership.organizationId == organizationId && membership.active && membership.role == Role.STAFF_ADMIN) { "Staff Admin account was not found" }
        val user = users.findById(membership.userId).orElseThrow { IllegalArgumentException("Staff Admin account was not found") }
        tenantUserAccounts.changePassword(user, request.password)
        tokenRevocations.revokeUserSessions(user)
    }

    @Transactional
    fun updateTenant(jwt: Jwt, organizationId: UUID, request: UpdateTenantRequest): TenantResponse {
        val actor = platformAccess.requirePlatformAdmin(jwt)
        require(request.institutionTypes.isNotEmpty()) { "Select at least one institution type" }
        institutionTypeCatalog.requireActiveCodes(request.institutionTypes)
        val organization = requireOrganization(organizationId)
        val offeredTypes = educationOfferings.findAllByOrganizationIdOrderByCreatedAtAsc(organizationId).map { it.institutionType }.toSet()
        require(offeredTypes.all { it in request.institutionTypes }) { "An institution type cannot be removed while an offering exists for it" }
        val subscription = subscriptions.findByOrganizationId(organizationId)
        require(effectiveSubscriptionStatus(subscription) != TenantSubscriptionStatus.TRIAL || request.monthlyFee == null) { "Monthly fee must not be set when tenant uses a trial" }
        val commercialChange = subscription != null && (subscription.plan != request.subscriptionPlan || (request.monthlyFee != null && subscription.monthlyFee != request.monthlyFee))
        if (commercialChange) require(!request.reason.isNullOrBlank()) { "A reason is required to change subscription plan or price" }
        if (subscription != null && request.monthlyFee != null && subscription.monthlyFee != request.monthlyFee) subscriptionBillingPolicy.requireAllowedAmount(request.monthlyFee)
        organization.name = request.tenantName.trim()
        organizationTypes.deleteAll(organizationTypes.findAllByOrganizationId(organizationId))
        organizationTypes.flush()
        organizationTypes.saveAll(request.institutionTypes.map { OrganizationTypeAssignment(organizationId = organizationId, type = it) })
        subscription?.let {
            val before = "${it.plan}:${it.monthlyFee}"
            subscription.plan = request.subscriptionPlan
            if (request.monthlyFee != null) subscription.monthlyFee = request.monthlyFee
            if (commercialChange) recordSubscriptionAudit(organizationId, it.id, actor.id, "COMMERCIAL_TERMS_UPDATED", request.reason!!.trim(), before, "${it.plan}:${it.monthlyFee}")
        }
        return tenantResponse(organization)
    }

    @Transactional
    fun renewSubscription(jwt: Jwt, organizationId: UUID, idempotencyKey: UUID, request: RenewTenantSubscriptionRequest): TenantResponse {
        val actor = platformAccess.requirePlatformAdmin(jwt)
        val organization = requireOrganization(organizationId)
        subscriptionRenewals.renew(organizationId, actor.id, idempotencyKey, request.monthlyFee)
        return tenantResponse(organization)
    }

    @Transactional
    fun updateGracePeriod(jwt: Jwt, organizationId: UUID, request: UpdateTenantGracePeriodRequest): TenantResponse {
        val actor = platformAccess.requirePlatformAdmin(jwt)
        val organization = requireOrganization(organizationId)
        val subscription = subscriptions.findByOrganizationId(organizationId) ?: throw IllegalArgumentException("Tenant subscription was not found")
        val previousDays = subscription.nextGracePeriodDays ?: subscription.gracePeriodDays
        subscription.nextGracePeriodDays = request.gracePeriodDays
        recordSubscriptionAudit(organizationId, subscription.id, actor.id, "GRACE_PERIOD_UPDATED", request.reason.trim(), previousDays.toString(), request.gracePeriodDays.toString())
        return tenantResponse(organization)
    }

    @Transactional(readOnly = true)
    fun subscriptionAudit(jwt: Jwt, organizationId: UUID, page: Int, size: Int): TenantSubscriptionAuditPage {
        platformAccess.requirePlatformAdmin(jwt)
        requireOrganization(organizationId)
        val safePage = page.coerceAtLeast(0)
        val safeSize = size.coerceIn(1, 100)
        val auditPage = subscriptionAudits.findAllByOrganizationIdOrderByCreatedAtDesc(organizationId, PageRequest.of(safePage, safeSize))
        return TenantSubscriptionAuditPage(auditPage.content.map { TenantSubscriptionAuditResponse(it.id, it.action, it.actorUserId, it.reason, it.beforeValue, it.afterValue, it.referenceId, it.correlationId, it.createdAt) }, safePage, safeSize, auditPage.totalElements, auditPage.totalPages)
    }

    @Transactional
    fun setSubscriptionStatus(jwt: Jwt, organizationId: UUID, status: TenantSubscriptionStatus, reason: String): TenantResponse {
        val actor = platformAccess.requirePlatformAdmin(jwt)
        require(reason.isNotBlank()) { "A reason is required to change tenant subscription status" }
        require(status in setOf(TenantSubscriptionStatus.ACTIVE, TenantSubscriptionStatus.SUSPENDED)) { "Only ACTIVE or SUSPENDED subscription status can be set manually" }
        val organization = requireOrganization(organizationId)
        val subscription = subscriptions.findByOrganizationId(organizationId) ?: throw IllegalArgumentException("Tenant subscription was not found")
        if (status == TenantSubscriptionStatus.ACTIVE) require(subscription.status == TenantSubscriptionStatus.SUSPENDED) { "Only a suspended subscription can be reactivated manually" }
        val previousStatus = subscription.status
        subscription.status = status
        recordSubscriptionAudit(organizationId, subscription.id, actor.id, if (status == TenantSubscriptionStatus.SUSPENDED) "SUBSCRIPTION_SUSPENDED" else "SUBSCRIPTION_REACTIVATED", reason.trim(), previousStatus.name, status.name)
        return tenantResponse(organization)
    }

    @Transactional
    fun markPaymentPaid(jwt: Jwt, organizationId: UUID, paymentId: UUID, idempotencyKey: UUID): TenantResponse {
        val actor = platformAccess.requirePlatformAdmin(jwt)
        users.findWithLockById(actor.id) ?: throw IllegalArgumentException("Platform Admin was not found")
        val payloadHash = sha256("$organizationId|$paymentId|MARK_PAID|${actor.id}")
        payments.findByOrganizationIdAndDecisionByUserIdAndDecisionOperationAndDecisionIdempotencyKey(organizationId, actor.id, "MARK_PAID", idempotencyKey)?.let { existing ->
            if (existing.decisionPayloadHash != payloadHash) throw TenantSubscriptionIdempotencyConflict()
            return tenantResponse(requireOrganization(existing.organizationId))
        }
        val payment = payments.findWithLockById(paymentId) ?: throw IllegalArgumentException("Tenant payment was not found")
        require(payment.organizationId == organizationId) { "Tenant payment belongs to a different tenant" }
        require(payment.status == TenantPaymentStatus.PENDING) { "Tenant payment is not awaiting payment" }
        payment.status = TenantPaymentStatus.PAID
        payment.paidAt = Instant.now()
        payment.decisionByUserId = actor.id
        payment.decisionOperation = "MARK_PAID"
        payment.decisionIdempotencyKey = idempotencyKey
        payment.decisionPayloadHash = payloadHash
        val subscription = subscriptions.findById(payment.subscriptionId).orElseThrow { IllegalArgumentException("Tenant subscription was not found") }
        val today = LocalDate.now(BILLING_TIME_ZONE)
        if (payment.periodStart != null && payment.periodEnd != null) {
            val statusAtConfirmation = subscriptionLifecycle.effectiveStatus(subscription, today)
            val startsFreshCoverage = statusAtConfirmation == TenantSubscriptionStatus.EXPIRED ||
                (statusAtConfirmation in setOf(TenantSubscriptionStatus.PENDING_PAYMENT, TenantSubscriptionStatus.SUSPENDED) && payment.periodEnd!!.isBefore(today))
            val coverageStart = if (startsFreshCoverage) today else payment.periodStart!!
            val coverageEnd = if (startsFreshCoverage) today.plusMonths(1).minusDays(1) else payment.periodEnd!!
            payment.coveragePeriodStart = coverageStart
            payment.coveragePeriodEnd = coverageEnd
            if (startsFreshCoverage) {
                subscription.periodStart = coverageStart
                subscription.periodEnd = coverageEnd
                subscription.nextPeriodStart = null
                subscription.nextPeriodEnd = null
                if (statusAtConfirmation != TenantSubscriptionStatus.SUSPENDED) subscription.status = TenantSubscriptionStatus.ACTIVE
                subscription.trialEndsAt = null
                subscription.nextGracePeriodDays?.let { subscription.gracePeriodDays = it; subscription.nextGracePeriodDays = null }
            } else if (payment.periodStart!! <= today) {
                subscription.periodStart = coverageStart
                subscription.periodEnd = coverageEnd
                subscription.nextPeriodStart = null
                subscription.nextPeriodEnd = null
                if (statusAtConfirmation != TenantSubscriptionStatus.SUSPENDED) subscription.status = TenantSubscriptionStatus.ACTIVE
                subscription.trialEndsAt = null
                subscription.nextGracePeriodDays?.let { subscription.gracePeriodDays = it; subscription.nextGracePeriodDays = null }
            } else {
                subscription.nextPeriodStart = coverageStart
                subscription.nextPeriodEnd = coverageEnd
            }
        } else {
            if (subscription.status != TenantSubscriptionStatus.SUSPENDED) subscription.status = TenantSubscriptionStatus.ACTIVE
            subscription.periodStart = today
            subscription.periodEnd = today.plusMonths(1).minusDays(1)
            subscription.trialEndsAt = null
            payment.coveragePeriodStart = subscription.periodStart
            payment.coveragePeriodEnd = subscription.periodEnd
        }
        recordSubscriptionAudit(organizationId, subscription.id, actor.id, "PAYMENT_CONFIRMED", "Payment manually confirmed by Platform Admin", TenantPaymentStatus.PENDING.name, "${TenantPaymentStatus.PAID}:$paymentId:${payment.amount}:${payment.coveragePeriodStart}/${payment.coveragePeriodEnd}", paymentId, idempotencyKey)
        val organization = organizations.findById(organizationId).orElseThrow { IllegalArgumentException("Tenant was not found") }
        return tenantResponse(organization)
    }

    @Transactional
    fun voidPayment(jwt: Jwt, organizationId: UUID, paymentId: UUID, idempotencyKey: UUID): TenantResponse {
        val actor = platformAccess.requirePlatformAdmin(jwt)
        users.findWithLockById(actor.id) ?: throw IllegalArgumentException("Platform Admin was not found")
        val payloadHash = sha256("$organizationId|$paymentId|VOID|${actor.id}")
        payments.findByOrganizationIdAndDecisionByUserIdAndDecisionOperationAndDecisionIdempotencyKey(organizationId, actor.id, "VOID", idempotencyKey)?.let { existing ->
            if (existing.decisionPayloadHash != payloadHash) throw TenantSubscriptionIdempotencyConflict()
            return tenantResponse(requireOrganization(existing.organizationId))
        }
        val payment = payments.findWithLockById(paymentId) ?: throw IllegalArgumentException("Tenant payment was not found")
        require(payment.organizationId == organizationId) { "Tenant payment belongs to a different tenant" }
        require(payment.status == TenantPaymentStatus.PENDING) { "Tenant payment is not awaiting payment" }
        payment.status = TenantPaymentStatus.VOID
        payment.decisionByUserId = actor.id
        payment.decisionOperation = "VOID"
        payment.decisionIdempotencyKey = idempotencyKey
        payment.decisionPayloadHash = payloadHash
        recordSubscriptionAudit(organizationId, payment.subscriptionId, actor.id, "PAYMENT_VOIDED", "Pending payment voided by Platform Admin", TenantPaymentStatus.PENDING.name, TenantPaymentStatus.VOID.name, paymentId, idempotencyKey)
        return tenantResponse(requireOrganization(organizationId))
    }

    @Transactional
    fun refreshStaffAdminInvitation(jwt: Jwt, organizationId: UUID): TenantResponse {
        platformAccess.requirePlatformAdmin(jwt)
        val invitation = invitations.findAllByOrganizationIdAndStatus(organizationId, InvitationStatus.PENDING)
            .firstOrNull { it.role == Role.STAFF_ADMIN }
            ?: throw IllegalArgumentException("Staff Admin invitation was not found")
        invitation.expiresAt = Instant.now().plusSeconds(604800)
        return tenantResponse(requireOrganization(organizationId))
    }

    @Transactional
    fun cancelStaffAdminInvitation(jwt: Jwt, organizationId: UUID): TenantResponse {
        platformAccess.requirePlatformAdmin(jwt)
        val invitation = invitations.findAllByOrganizationIdAndStatus(organizationId, InvitationStatus.PENDING)
            .firstOrNull { it.role == Role.STAFF_ADMIN }
            ?: throw IllegalArgumentException("Staff Admin invitation was not found")
        invitation.status = InvitationStatus.EXPIRED
        return tenantResponse(requireOrganization(organizationId))
    }

    private fun tenantResponse(organization: Organization): TenantResponse {
        val subscription = subscriptions.findByOrganizationId(organization.id)
        val effectiveStatus = subscription?.let { subscriptionLifecycle.effectiveStatus(it, LocalDate.now(BILLING_TIME_ZONE)) }
        val capabilities = organizationCapabilities.forOrganization(organization.id)
        val staffAdminMemberships = memberships.findAllByOrganizationId(organization.id)
            .filter { it.role == Role.STAFF_ADMIN }
            .sortedWith(compareByDescending<Membership> { it.primaryStaffAdmin }.thenBy { it.userId })
        val staffAdmins = staffAdminMemberships.map { membership ->
            val user = users.findById(membership.userId).orElse(null)
            TenantStaffAdminResponse(membership.id, user?.email, user?.displayName, if (membership.active) "ACTIVE" else "INACTIVE", membership.primaryStaffAdmin)
        }
        val activeStaffAdmin = staffAdmins.firstOrNull { it.status == "ACTIVE" }
        val pendingStaffAdmin = invitations.findAllByOrganizationIdAndStatus(organization.id, InvitationStatus.PENDING)
            .firstOrNull { it.role == Role.STAFF_ADMIN }
            ?.let { invitation -> TenantStaffAdminResponse(invitation.id, invitation.email ?: invitation.phoneNumber, null, "PENDING", true) }
        val tenantBranches = branches.findAllByOrganizationId(organization.id).sortedWith(compareByDescending<Branch> { it.primary }.thenBy { it.name })
        val today = LocalDate.now(BILLING_TIME_ZONE)
        val currentPeriod = subscription?.let { currentTenantSubscriptionPeriod(it, today) }
        val graceEndsAt = subscription?.takeIf { effectiveStatus == TenantSubscriptionStatus.GRACE }?.let { graceSubscription ->
            val gracePeriod = currentTenantSubscriptionPeriod(graceSubscription, today)
            val nextPeriodGrace = gracePeriod.end == graceSubscription.nextPeriodEnd
            val days = if (nextPeriodGrace) graceSubscription.nextGracePeriodDays ?: graceSubscription.gracePeriodDays else graceSubscription.gracePeriodDays
            gracePeriod.end.plusDays(days.toLong())
        }
        return TenantResponse(organization.id, organization.name, tenantBranches.firstOrNull { it.primary }?.name, tenantBranches.map(::branchResponse), capabilities.types, capabilities.capabilities, subscription?.plan, effectiveStatus, currentPeriod?.start, currentPeriod?.end, subscription?.trialEndsAt, subscription?.monthlyFee, subscription?.nextGracePeriodDays ?: subscription?.gracePeriodDays ?: 7, graceEndsAt, activeStaffAdmin ?: pendingStaffAdmin, staffAdmins, payments.findAllByOrganizationIdOrderByCreatedAtDesc(organization.id).map { TenantPaymentResponse(it.id, it.invoiceNumber, it.amount, it.status, it.dueDate, it.paidAt, it.periodStart, it.periodEnd, it.coveragePeriodStart, it.coveragePeriodEnd, it.planCodeSnapshot) })
    }

    private fun recordSubscriptionAudit(organizationId: UUID, subscriptionId: UUID, actorUserId: UUID, action: String, reason: String, beforeValue: String?, afterValue: String?, referenceId: UUID? = null, correlationId: UUID? = null) {
        subscriptionAudits.save(TenantSubscriptionAuditEvent(organizationId = organizationId, subscriptionId = subscriptionId, actorUserId = actorUserId, action = action, reason = reason, beforeValue = beforeValue, afterValue = afterValue, referenceId = referenceId, correlationId = correlationId))
    }

    private fun sha256(value: String): String = java.security.MessageDigest.getInstance("SHA-256").digest(value.toByteArray()).joinToString("") { "%02x".format(it) }

    private fun requireOrganization(organizationId: UUID) = organizations.findById(organizationId).orElseThrow { IllegalArgumentException("Tenant was not found") }
    private fun effectiveSubscriptionStatus(subscription: TenantSubscription?): TenantSubscriptionStatus? = subscription?.let { subscriptionLifecycle.effectiveStatus(it, LocalDate.now(BILLING_TIME_ZONE)) }
    private fun graceRolloutAccessLevel(status: TenantSubscriptionStatus): TenantGraceRolloutAccessLevel = when (status) {
        TenantSubscriptionStatus.ACTIVE, TenantSubscriptionStatus.TRIAL -> TenantGraceRolloutAccessLevel.OPERATIONAL
        TenantSubscriptionStatus.GRACE -> TenantGraceRolloutAccessLevel.GRACE_LIMITED
        else -> TenantGraceRolloutAccessLevel.RESTRICTED
    }
    private fun branchResponse(branch: Branch) = TenantBranchResponse(branch.id, branch.name, branch.timezone, branch.fullAddress, branch.googleMapsUrl, branch.active, branch.primary)
}
