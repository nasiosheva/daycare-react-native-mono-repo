package com.daycare.api.service

import com.daycare.api.domain.InstitutionCapability
import com.daycare.api.domain.InstitutionTypeCodes
import com.daycare.api.domain.EducationOfferingStatus
import com.daycare.api.domain.Role
import com.daycare.api.domain.TenantSubscriptionStatus
import com.daycare.api.domain.institutionCapabilities
import com.daycare.api.persistence.BranchCapacitySettingRepository
import com.daycare.api.persistence.BranchOperatingHour
import com.daycare.api.persistence.BranchOperatingHourRepository
import com.daycare.api.persistence.BranchRepository
import com.daycare.api.persistence.ClassroomRepository
import com.daycare.api.persistence.EducationOffering
import com.daycare.api.persistence.EducationOfferingRepository
import com.daycare.api.persistence.MembershipRepository
import com.daycare.api.persistence.OrganizationRepository
import com.daycare.api.persistence.OrganizationTypeAssignmentRepository
import com.daycare.api.persistence.TenantPaymentInstructionRepository
import com.daycare.api.persistence.TenantSubscriptionRepository
import com.daycare.api.persistence.ServicePlanRepository
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.DayOfWeek
import java.util.UUID

enum class TenantReadinessStatus { READY, NEEDS_ATTENTION }

enum class TenantReadinessIssue {
    SUBSCRIPTION_NOT_ACTIVE,
    STAFF_ADMIN_REQUIRED,
    ACTIVE_BRANCH_REQUIRED,
    ACTIVE_CLASSROOM_REQUIRED,
    ACTIVE_SERVICE_PLAN_REQUIRED,
    BRANCH_CAPACITY_REQUIRED,
    OPERATING_HOURS_REQUIRED,
    PAYMENT_INSTRUCTION_REQUIRED,
}

data class TenantReadinessResponse(
    val tenantId: UUID,
    val tenantName: String,
    val status: TenantReadinessStatus,
    val issues: Set<TenantReadinessIssue>,
)

data class TenantReadinessSummaryResponse(
    val readyCount: Int,
    val needsAttentionCount: Int,
    val tenants: List<TenantReadinessResponse>,
)

@Service
class TenantReadinessService(
    private val access: AccessService,
    private val platformAccess: PlatformAccessService,
    private val organizations: OrganizationRepository,
    private val organizationTypes: OrganizationTypeAssignmentRepository,
    private val educationOfferings: EducationOfferingRepository,
    private val subscriptions: TenantSubscriptionRepository,
    private val memberships: MembershipRepository,
    private val branches: BranchRepository,
    private val classrooms: ClassroomRepository,
    private val plans: ServicePlanRepository,
    private val branchCapacities: BranchCapacitySettingRepository,
    private val operatingHours: BranchOperatingHourRepository,
    private val paymentInstructions: TenantPaymentInstructionRepository,
) {
    @Transactional(readOnly = true)
    fun readiness(jwt: Jwt): TenantReadinessSummaryResponse {
        platformAccess.requirePlatformAdmin(jwt)

        val typesByOrganization = organizationTypes.findAll().groupBy({ it.organizationId }, { it.type })
        val offeringsByOrganization = educationOfferings.findAll().groupBy { it.organizationId }
        val subscriptionsByOrganization = subscriptions.findAll().associateBy { it.organizationId }
        val membershipsByOrganization = memberships.findAll().groupBy { it.organizationId }
        val branchesByOrganization = branches.findAll().groupBy { it.organizationId }
        val classroomsByOrganization = classrooms.findAll().groupBy { it.organizationId }
        val plansByOrganization = plans.findAll().groupBy { it.organizationId }
        val capacitiesByOrganization = branchCapacities.findAll().groupBy { it.organizationId }
        val operatingHoursByBranch = operatingHours.findAll().groupBy { it.branchId }
        val instructionsByOrganization = paymentInstructions.findAll().groupBy { it.organizationId }

        val tenantReadiness = organizations.findAll().map { organization ->
            val organizationId = organization.id
            val institutionTypes = typesByOrganization[organizationId].orEmpty().toSet().ifEmpty { setOf(InstitutionTypeCodes.DAYCARE) }
            val capabilities = institutionCapabilities(institutionTypes)
            val activeBranchIds = branchesByOrganization[organizationId].orEmpty().filter { it.active }.map { it.id }.toSet()
            val issues = evaluateIssues(
                capabilities = capabilities,
                subscriptionActive = subscriptionsByOrganization[organizationId]?.status in ACTIVE_SUBSCRIPTION_STATUSES,
                hasActiveStaffAdmin = membershipsByOrganization[organizationId].orEmpty().any { it.role == Role.STAFF_ADMIN && it.active },
                activeBranchIds = activeBranchIds,
                hasActiveClassroom = classroomsByOrganization[organizationId].orEmpty().any { it.active },
                requiresLegacyClassroom = InstitutionCapability.DAYCARE_OPERATIONS in capabilities || hasPublishedAcademicOffering(offeringsByOrganization[organizationId].orEmpty()),
                hasActiveServicePlan = plansByOrganization[organizationId].orEmpty().any { it.active },
                capacityBranchIds = capacitiesByOrganization[organizationId].orEmpty().map { it.branchId }.toSet(),
                hasOperatingHoursForEveryActiveBranch = activeBranchIds.isNotEmpty() && activeBranchIds.all { branchId -> isOperatingHoursConfigured(operatingHoursByBranch[branchId].orEmpty()) },
                hasActivePaymentInstruction = instructionsByOrganization[organizationId].orEmpty().any { it.active },
            )
            TenantReadinessResponse(organizationId, organization.name, statusFor(issues), issues)
        }.sortedWith(compareBy<TenantReadinessResponse> { it.status != TenantReadinessStatus.NEEDS_ATTENTION }.thenBy { it.tenantName.lowercase() })

        return TenantReadinessSummaryResponse(
            readyCount = tenantReadiness.count { it.status == TenantReadinessStatus.READY },
            needsAttentionCount = tenantReadiness.count { it.status == TenantReadinessStatus.NEEDS_ATTENTION },
            tenants = tenantReadiness,
        )
    }

    @Transactional(readOnly = true)
    fun organizationReadiness(jwt: Jwt, organizationId: UUID): TenantReadinessResponse {
        val scope = access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN), readOnly = true)
        val organization = organizations.findById(organizationId).orElseThrow { IllegalArgumentException("Organization was not found") }
        val activeBranchIds = branches.findAllByOrganizationId(organizationId).filter { it.active }.map { it.id }.toSet()
        val hasPublishedAcademicOffering = hasPublishedAcademicOffering(educationOfferings.findAllByOrganizationIdOrderByCreatedAtAsc(organizationId))
        val issues = evaluateIssues(
            capabilities = scope.capabilities,
            subscriptionActive = subscriptions.findByOrganizationId(organizationId)?.status in ACTIVE_SUBSCRIPTION_STATUSES,
            hasActiveStaffAdmin = memberships.findAllByOrganizationId(organizationId).any { it.role == Role.STAFF_ADMIN && it.active },
            activeBranchIds = activeBranchIds,
            hasActiveClassroom = classrooms.findAllByOrganizationIdAndActiveTrueOrderByNameAsc(organizationId).isNotEmpty(),
            requiresLegacyClassroom = InstitutionCapability.DAYCARE_OPERATIONS in scope.capabilities || hasPublishedAcademicOffering,
            hasActiveServicePlan = plans.findAllByOrganizationIdAndActiveTrue(organizationId).isNotEmpty(),
            capacityBranchIds = branchCapacities.findAllByOrganizationId(organizationId).map { it.branchId }.toSet(),
            hasOperatingHoursForEveryActiveBranch = activeBranchIds.isNotEmpty() && activeBranchIds.all { branchId -> isOperatingHoursConfigured(operatingHours.findAllByBranchIdOrderByDayOfWeekAsc(branchId)) },
            hasActivePaymentInstruction = paymentInstructions.findAllByOrganizationIdAndActiveTrueOrderByDisplayOrderAscCreatedAtAsc(organizationId).isNotEmpty(),
        )
        return TenantReadinessResponse(organizationId, organization.name, statusFor(issues), issues)
    }

    private fun evaluateIssues(
        capabilities: Set<InstitutionCapability>,
        subscriptionActive: Boolean,
        hasActiveStaffAdmin: Boolean,
        activeBranchIds: Set<UUID>,
        hasActiveClassroom: Boolean,
        requiresLegacyClassroom: Boolean,
        hasActiveServicePlan: Boolean,
        capacityBranchIds: Set<UUID>,
        hasOperatingHoursForEveryActiveBranch: Boolean,
        hasActivePaymentInstruction: Boolean,
    ): Set<TenantReadinessIssue> = buildSet {
        if (!subscriptionActive) add(TenantReadinessIssue.SUBSCRIPTION_NOT_ACTIVE)
        if (!hasActiveStaffAdmin) add(TenantReadinessIssue.STAFF_ADMIN_REQUIRED)
        if (activeBranchIds.isEmpty()) add(TenantReadinessIssue.ACTIVE_BRANCH_REQUIRED)
        if (requiresLegacyClassroom && !hasActiveClassroom) add(TenantReadinessIssue.ACTIVE_CLASSROOM_REQUIRED)
        if (InstitutionCapability.DAYCARE_OPERATIONS in capabilities) {
            if (!hasActiveServicePlan) add(TenantReadinessIssue.ACTIVE_SERVICE_PLAN_REQUIRED)
            if (activeBranchIds.any { it !in capacityBranchIds }) add(TenantReadinessIssue.BRANCH_CAPACITY_REQUIRED)
            if (activeBranchIds.isNotEmpty() && !hasOperatingHoursForEveryActiveBranch) add(TenantReadinessIssue.OPERATING_HOURS_REQUIRED)
            if (!hasActivePaymentInstruction) add(TenantReadinessIssue.PAYMENT_INSTRUCTION_REQUIRED)
        }
    }

    private fun isOperatingHoursConfigured(hours: List<BranchOperatingHour>): Boolean =
        hours.size == DayOfWeek.entries.size &&
            hours.map { it.dayOfWeek }.toSet().size == DayOfWeek.entries.size &&
            hours.any { it.active } &&
            hours.filter { it.active }.all { hour ->
                val opensAt = hour.opensAt
                val closesAt = hour.closesAt
                opensAt != null && closesAt != null && opensAt.isBefore(closesAt)
            }

    private fun hasPublishedAcademicOffering(offerings: List<EducationOffering>) = offerings.any { offering ->
        offering.status == EducationOfferingStatus.PUBLISHED &&
            InstitutionCapability.ACADEMIC_CURRICULUM in institutionCapabilities(setOf(offering.institutionType))
    }

    private fun statusFor(issues: Set<TenantReadinessIssue>) =
        if (issues.isEmpty()) TenantReadinessStatus.READY else TenantReadinessStatus.NEEDS_ATTENTION

    private companion object {
        val ACTIVE_SUBSCRIPTION_STATUSES = setOf(TenantSubscriptionStatus.ACTIVE, TenantSubscriptionStatus.TRIAL)
    }
}
