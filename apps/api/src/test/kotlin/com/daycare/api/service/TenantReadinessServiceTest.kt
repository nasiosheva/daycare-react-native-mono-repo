package com.daycare.api.service

import com.daycare.api.domain.Role
import com.daycare.api.domain.TenantSubscriptionStatus
import com.daycare.api.persistence.Branch
import com.daycare.api.persistence.BranchCapacitySetting
import com.daycare.api.persistence.BranchCapacitySettingRepository
import com.daycare.api.persistence.BranchRepository
import com.daycare.api.persistence.Classroom
import com.daycare.api.persistence.ClassroomRepository
import com.daycare.api.persistence.Membership
import com.daycare.api.persistence.MembershipRepository
import com.daycare.api.persistence.Organization
import com.daycare.api.persistence.OrganizationRepository
import com.daycare.api.persistence.OrganizationTypeAssignment
import com.daycare.api.persistence.OrganizationTypeAssignmentRepository
import com.daycare.api.persistence.ServicePlan
import com.daycare.api.persistence.ServicePlanRepository
import com.daycare.api.persistence.TenantPaymentInstruction
import com.daycare.api.persistence.TenantPaymentInstructionRepository
import com.daycare.api.persistence.TenantSubscription
import com.daycare.api.persistence.TenantSubscriptionRepository
import com.daycare.api.persistence.UserProfile
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.mockito.Mockito.mock
import org.mockito.Mockito.verify
import org.mockito.Mockito.`when`
import org.springframework.security.oauth2.jwt.Jwt
import java.util.Optional
import java.util.UUID

class TenantReadinessServiceTest {
    private val access = mock(AccessService::class.java)
    private val platformAccess = mock(PlatformAccessService::class.java)
    private val organizations = mock(OrganizationRepository::class.java)
    private val organizationTypes = mock(OrganizationTypeAssignmentRepository::class.java)
    private val subscriptions = mock(TenantSubscriptionRepository::class.java)
    private val memberships = mock(MembershipRepository::class.java)
    private val branches = mock(BranchRepository::class.java)
    private val classrooms = mock(ClassroomRepository::class.java)
    private val plans = mock(ServicePlanRepository::class.java)
    private val capacities = mock(BranchCapacitySettingRepository::class.java)
    private val instructions = mock(TenantPaymentInstructionRepository::class.java)
    private val jwt = mock(Jwt::class.java)

    @Test
    fun `returns ready for a fully configured Daycare tenant`() {
        val tenant = Organization(name = "Umur Emas")
        val branch = Branch(organizationId = tenant.id, name = "Utama")
        defaults(listOf(tenant))
        `when`(organizationTypes.findAll()).thenReturn(listOf(OrganizationTypeAssignment(organizationId = tenant.id, type = "DAYCARE")))
        `when`(subscriptions.findAll()).thenReturn(listOf(TenantSubscription(organizationId = tenant.id, status = TenantSubscriptionStatus.ACTIVE)))
        `when`(memberships.findAll()).thenReturn(listOf(Membership(organizationId = tenant.id, role = Role.STAFF_ADMIN, active = true)))
        `when`(branches.findAll()).thenReturn(listOf(branch))
        `when`(classrooms.findAll()).thenReturn(listOf(Classroom(organizationId = tenant.id, branchId = branch.id, name = "Matahari", active = true)))
        `when`(plans.findAll()).thenReturn(listOf(ServicePlan(organizationId = tenant.id, name = "Bulanan", active = true)))
        `when`(capacities.findAll()).thenReturn(listOf(BranchCapacitySetting(organizationId = tenant.id, branchId = branch.id, dailyCapacity = 20)))
        `when`(instructions.findAll()).thenReturn(listOf(TenantPaymentInstruction(organizationId = tenant.id, name = "BCA", accountHolder = "Umur Emas", accountNumber = "123", active = true)))

        val response = service().readiness(jwt)

        assertEquals(1, response.readyCount)
        assertEquals(0, response.needsAttentionCount)
        assertEquals(TenantReadinessStatus.READY, response.tenants.single().status)
        verify(platformAccess).requirePlatformAdmin(jwt)
    }

    @Test
    fun `reports every missing Daycare configuration`() {
        val tenant = Organization(name = "Belum Lengkap")
        defaults(listOf(tenant))

        val response = service().readiness(jwt).tenants.single()

        assertEquals(TenantReadinessStatus.NEEDS_ATTENTION, response.status)
        assertEquals(
            setOf(
                TenantReadinessIssue.SUBSCRIPTION_NOT_ACTIVE,
                TenantReadinessIssue.STAFF_ADMIN_REQUIRED,
                TenantReadinessIssue.ACTIVE_BRANCH_REQUIRED,
                TenantReadinessIssue.ACTIVE_CLASSROOM_REQUIRED,
                TenantReadinessIssue.ACTIVE_SERVICE_PLAN_REQUIRED,
                TenantReadinessIssue.PAYMENT_INSTRUCTION_REQUIRED,
            ),
            response.issues,
        )
    }

    @Test
    fun `does not require Daycare configuration for an academic tenant`() {
        val tenant = Organization(name = "TK Ceria")
        val branch = Branch(organizationId = tenant.id, name = "Utama")
        defaults(listOf(tenant))
        `when`(organizationTypes.findAll()).thenReturn(listOf(OrganizationTypeAssignment(organizationId = tenant.id, type = "TK")))
        `when`(subscriptions.findAll()).thenReturn(listOf(TenantSubscription(organizationId = tenant.id, status = TenantSubscriptionStatus.TRIAL)))
        `when`(memberships.findAll()).thenReturn(listOf(Membership(organizationId = tenant.id, role = Role.STAFF_ADMIN, active = true)))
        `when`(branches.findAll()).thenReturn(listOf(branch))
        `when`(classrooms.findAll()).thenReturn(listOf(Classroom(organizationId = tenant.id, branchId = branch.id, name = "TK A", active = true)))

        val response = service().readiness(jwt).tenants.single()

        assertEquals(TenantReadinessStatus.READY, response.status)
        assertTrue(response.issues.isEmpty())
    }

    @Test
    fun `requires capacity for every active Daycare branch`() {
        val tenant = Organization(name = "Daycare Dua Cabang")
        val configuredBranch = Branch(organizationId = tenant.id, name = "Utama")
        val missingCapacityBranch = Branch(organizationId = tenant.id, name = "Timur")
        defaults(listOf(tenant))
        `when`(organizationTypes.findAll()).thenReturn(listOf(OrganizationTypeAssignment(organizationId = tenant.id, type = "DAYCARE")))
        `when`(subscriptions.findAll()).thenReturn(listOf(TenantSubscription(organizationId = tenant.id, status = TenantSubscriptionStatus.ACTIVE)))
        `when`(memberships.findAll()).thenReturn(listOf(Membership(organizationId = tenant.id, role = Role.STAFF_ADMIN, active = true)))
        `when`(branches.findAll()).thenReturn(listOf(configuredBranch, missingCapacityBranch))
        `when`(classrooms.findAll()).thenReturn(listOf(Classroom(organizationId = tenant.id, branchId = configuredBranch.id, name = "Kelas", active = true)))
        `when`(plans.findAll()).thenReturn(listOf(ServicePlan(organizationId = tenant.id, name = "Harian", active = true)))
        `when`(capacities.findAll()).thenReturn(listOf(BranchCapacitySetting(organizationId = tenant.id, branchId = configuredBranch.id, dailyCapacity = 20)))
        `when`(instructions.findAll()).thenReturn(listOf(TenantPaymentInstruction(organizationId = tenant.id, name = "BCA", accountHolder = "Umur Emas", accountNumber = "123", active = true)))

        val response = service().readiness(jwt).tenants.single()

        assertEquals(setOf(TenantReadinessIssue.BRANCH_CAPACITY_REQUIRED), response.issues)
    }

    private fun defaults(tenantList: List<Organization>) {
        `when`(organizations.findAll()).thenReturn(tenantList)
        `when`(organizationTypes.findAll()).thenReturn(emptyList())
        `when`(subscriptions.findAll()).thenReturn(emptyList())
        `when`(memberships.findAll()).thenReturn(emptyList())
        `when`(branches.findAll()).thenReturn(emptyList())
        `when`(classrooms.findAll()).thenReturn(emptyList())
        `when`(plans.findAll()).thenReturn(emptyList())
        `when`(capacities.findAll()).thenReturn(emptyList())
        `when`(instructions.findAll()).thenReturn(emptyList())
    }

    private fun service() = TenantReadinessService(access, platformAccess, organizations, organizationTypes, subscriptions, memberships, branches, classrooms, plans, capacities, instructions)

    @Test
    fun `Staff Admin sees needs-attention for a tenant missing core setup`() {
        val organizationId = UUID.randomUUID()
        stubStaffAdminAccess(organizationId)

        val response = service().organizationReadiness(jwt, organizationId)

        assertEquals(TenantReadinessStatus.NEEDS_ATTENTION, response.status)
        assertTrue(response.issues.contains(TenantReadinessIssue.SUBSCRIPTION_NOT_ACTIVE))
        assertTrue(response.issues.contains(TenantReadinessIssue.STAFF_ADMIN_REQUIRED))
        assertTrue(response.issues.contains(TenantReadinessIssue.ACTIVE_BRANCH_REQUIRED))
        assertTrue(response.issues.contains(TenantReadinessIssue.ACTIVE_CLASSROOM_REQUIRED))
        // No DAYCARE_OPERATIONS capability, so daycare-only setup must not be demanded.
        assertFalse(response.issues.contains(TenantReadinessIssue.ACTIVE_SERVICE_PLAN_REQUIRED))
        assertFalse(response.issues.contains(TenantReadinessIssue.PAYMENT_INSTRUCTION_REQUIRED))
    }

    @Test
    fun `Staff Admin sees ready once core setup is complete`() {
        val organizationId = UUID.randomUUID()
        stubStaffAdminAccess(organizationId)
        val branch = Branch(organizationId = organizationId, name = "Utama")
        `when`(subscriptions.findByOrganizationId(organizationId)).thenReturn(TenantSubscription(organizationId = organizationId, status = TenantSubscriptionStatus.ACTIVE))
        `when`(memberships.findAllByOrganizationId(organizationId)).thenReturn(listOf(Membership(organizationId = organizationId, role = Role.STAFF_ADMIN, active = true)))
        `when`(branches.findAllByOrganizationId(organizationId)).thenReturn(listOf(branch))
        `when`(classrooms.findAllByOrganizationIdAndActiveTrueOrderByNameAsc(organizationId)).thenReturn(listOf(Classroom(organizationId = organizationId, branchId = branch.id, name = "Matahari", active = true)))

        val response = service().organizationReadiness(jwt, organizationId)

        assertEquals(TenantReadinessStatus.READY, response.status)
        assertTrue(response.issues.isEmpty())
    }

    private fun stubStaffAdminAccess(organizationId: UUID) {
        val scope = AccessScope(mock(UserProfile::class.java), Membership(organizationId = organizationId, role = Role.STAFF_ADMIN, active = true), emptySet(), emptySet())
        `when`(access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN), null, true)).thenReturn(scope)
        `when`(organizations.findById(organizationId)).thenReturn(Optional.of(Organization(id = organizationId, name = "Nasio Care")))
    }
}
