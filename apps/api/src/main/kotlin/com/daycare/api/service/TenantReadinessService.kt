package com.daycare.api.service

import com.daycare.api.domain.InstitutionCapability
import com.daycare.api.domain.InstitutionTypeCodes
import com.daycare.api.domain.Role
import com.daycare.api.domain.TenantSubscriptionStatus
import com.daycare.api.domain.institutionCapabilities
import com.daycare.api.persistence.BranchCapacitySettingRepository
import com.daycare.api.persistence.BranchRepository
import com.daycare.api.persistence.ClassroomRepository
import com.daycare.api.persistence.MembershipRepository
import com.daycare.api.persistence.OrganizationRepository
import com.daycare.api.persistence.OrganizationTypeAssignmentRepository
import com.daycare.api.persistence.TenantPaymentInstructionRepository
import com.daycare.api.persistence.TenantSubscriptionRepository
import com.daycare.api.persistence.ServicePlanRepository
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

enum class TenantReadinessStatus { READY, NEEDS_ATTENTION }

enum class TenantReadinessIssue {
    SUBSCRIPTION_NOT_ACTIVE,
    STAFF_ADMIN_REQUIRED,
    ACTIVE_BRANCH_REQUIRED,
    ACTIVE_CLASSROOM_REQUIRED,
    ACTIVE_SERVICE_PLAN_REQUIRED,
    BRANCH_CAPACITY_REQUIRED,
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
    private val platformAccess: PlatformAccessService,
    private val organizations: OrganizationRepository,
    private val organizationTypes: OrganizationTypeAssignmentRepository,
    private val subscriptions: TenantSubscriptionRepository,
    private val memberships: MembershipRepository,
    private val branches: BranchRepository,
    private val classrooms: ClassroomRepository,
    private val plans: ServicePlanRepository,
    private val branchCapacities: BranchCapacitySettingRepository,
    private val paymentInstructions: TenantPaymentInstructionRepository,
) {
    @Transactional(readOnly = true)
    fun readiness(jwt: Jwt): TenantReadinessSummaryResponse {
        platformAccess.requirePlatformAdmin(jwt)

        val typesByOrganization = organizationTypes.findAll().groupBy({ it.organizationId }, { it.type })
        val subscriptionsByOrganization = subscriptions.findAll().associateBy { it.organizationId }
        val membershipsByOrganization = memberships.findAll().groupBy { it.organizationId }
        val branchesByOrganization = branches.findAll().groupBy { it.organizationId }
        val classroomsByOrganization = classrooms.findAll().groupBy { it.organizationId }
        val plansByOrganization = plans.findAll().groupBy { it.organizationId }
        val capacitiesByOrganization = branchCapacities.findAll().groupBy { it.organizationId }
        val instructionsByOrganization = paymentInstructions.findAll().groupBy { it.organizationId }

        val tenantReadiness = organizations.findAll().map { organization ->
            val organizationId = organization.id
            val institutionTypes = typesByOrganization[organizationId].orEmpty().toSet().ifEmpty { setOf(InstitutionTypeCodes.DAYCARE) }
            val capabilities = institutionCapabilities(institutionTypes)
            val activeBranches = branchesByOrganization[organizationId].orEmpty().filter { it.active }
            val issues = buildSet {
                if (subscriptionsByOrganization[organizationId]?.status !in setOf(TenantSubscriptionStatus.ACTIVE, TenantSubscriptionStatus.TRIAL)) add(TenantReadinessIssue.SUBSCRIPTION_NOT_ACTIVE)
                if (membershipsByOrganization[organizationId].orEmpty().none { it.role == Role.STAFF_ADMIN && it.active }) add(TenantReadinessIssue.STAFF_ADMIN_REQUIRED)
                if (activeBranches.isEmpty()) add(TenantReadinessIssue.ACTIVE_BRANCH_REQUIRED)
                if (classroomsByOrganization[organizationId].orEmpty().none { it.active }) add(TenantReadinessIssue.ACTIVE_CLASSROOM_REQUIRED)
                if (InstitutionCapability.DAYCARE_OPERATIONS in capabilities) {
                    if (plansByOrganization[organizationId].orEmpty().none { it.active }) add(TenantReadinessIssue.ACTIVE_SERVICE_PLAN_REQUIRED)
                    val capacityBranchIds = capacitiesByOrganization[organizationId].orEmpty().map { it.branchId }.toSet()
                    if (activeBranches.any { it.id !in capacityBranchIds }) add(TenantReadinessIssue.BRANCH_CAPACITY_REQUIRED)
                    if (instructionsByOrganization[organizationId].orEmpty().none { it.active }) add(TenantReadinessIssue.PAYMENT_INSTRUCTION_REQUIRED)
                }
            }
            TenantReadinessResponse(organizationId, organization.name, if (issues.isEmpty()) TenantReadinessStatus.READY else TenantReadinessStatus.NEEDS_ATTENTION, issues)
        }.sortedWith(compareBy<TenantReadinessResponse> { it.status != TenantReadinessStatus.NEEDS_ATTENTION }.thenBy { it.tenantName.lowercase() })

        return TenantReadinessSummaryResponse(
            readyCount = tenantReadiness.count { it.status == TenantReadinessStatus.READY },
            needsAttentionCount = tenantReadiness.count { it.status == TenantReadinessStatus.NEEDS_ATTENTION },
            tenants = tenantReadiness,
        )
    }
}
