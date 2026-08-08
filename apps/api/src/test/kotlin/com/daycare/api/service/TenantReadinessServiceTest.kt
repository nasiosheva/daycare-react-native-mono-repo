package com.daycare.api.service

import com.daycare.api.domain.Role
import com.daycare.api.domain.EducationOfferingStatus
import com.daycare.api.domain.TenantSubscriptionStatus
import com.daycare.api.persistence.Branch
import com.daycare.api.persistence.BranchCapacitySetting
import com.daycare.api.persistence.BranchCapacitySettingRepository
import com.daycare.api.persistence.BranchOperatingHour
import com.daycare.api.persistence.BranchOperatingHourRepository
import com.daycare.api.persistence.BranchRepository
import com.daycare.api.persistence.Classroom
import com.daycare.api.persistence.ClassroomRepository
import com.daycare.api.persistence.EducationOffering
import com.daycare.api.persistence.EducationOfferingRepository
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
import java.time.DayOfWeek
import java.time.LocalTime
import java.util.Optional
import java.util.UUID

class TenantReadinessServiceTest {
    private val access = mock(AccessService::class.java)
    private val platformAccess = mock(PlatformAccessService::class.java)
    private val organizations = mock(OrganizationRepository::class.java)
    private val educationOfferings = mock(EducationOfferingRepository::class.java)
    private val subscriptions = mock(TenantSubscriptionRepository::class.java)
    private val memberships = mock(MembershipRepository::class.java)
    private val branches = mock(BranchRepository::class.java)
    private val classrooms = mock(ClassroomRepository::class.java)
    private val plans = mock(ServicePlanRepository::class.java)
    private val capacities = mock(BranchCapacitySettingRepository::class.java)
    private val operatingHours = mock(BranchOperatingHourRepository::class.java)
    private val instructions = mock(TenantPaymentInstructionRepository::class.java)
    private val jwt = mock(Jwt::class.java)

    @Test
    fun `returns ready for a fully configured Daycare tenant`() {
        val tenant = Organization(name = "Usia Emas")
        val branch = Branch(organizationId = tenant.id, name = "Utama")
        defaults(listOf(tenant))
        `when`(educationOfferings.findAll()).thenReturn(listOf(EducationOffering(organizationId = tenant.id, branchId = branch.id, institutionType = "DAYCARE", status = EducationOfferingStatus.PUBLISHED)))
        `when`(subscriptions.findAll()).thenReturn(listOf(TenantSubscription(organizationId = tenant.id, status = TenantSubscriptionStatus.ACTIVE)))
        `when`(memberships.findAll()).thenReturn(listOf(Membership(organizationId = tenant.id, role = Role.STAFF_ADMIN, active = true)))
        `when`(branches.findAll()).thenReturn(listOf(branch))
        `when`(classrooms.findAll()).thenReturn(listOf(Classroom(organizationId = tenant.id, branchId = branch.id, name = "Matahari", active = true)))
        `when`(plans.findAll()).thenReturn(listOf(ServicePlan(organizationId = tenant.id, name = "Bulanan", active = true)))
        `when`(capacities.findAll()).thenReturn(listOf(BranchCapacitySetting(organizationId = tenant.id, branchId = branch.id, dailyCapacity = 20)))
        `when`(operatingHours.findAll()).thenReturn(operatingHoursFor(branch.id))
        `when`(instructions.findAll()).thenReturn(listOf(TenantPaymentInstruction(organizationId = tenant.id, name = "BCA", accountHolder = "Usia Emas", accountNumber = "123", active = true)))

        val response = service().readiness(jwt)

        assertEquals(1, response.readyCount)
        assertEquals(0, response.needsAttentionCount)
        assertEquals(TenantReadinessStatus.READY, response.tenants.single().status)
        verify(platformAccess).requirePlatformAdmin(jwt)
    }

    @Test
    fun `does not require Daycare configuration before a Daycare offering is published`() {
        val tenant = Organization(name = "Belum Lengkap")
        defaults(listOf(tenant))

        val response = service().readiness(jwt).tenants.single()

        assertEquals(TenantReadinessStatus.NEEDS_ATTENTION, response.status)
        assertEquals(
            setOf(
                TenantReadinessIssue.SUBSCRIPTION_NOT_ACTIVE,
                TenantReadinessIssue.STAFF_ADMIN_REQUIRED,
                TenantReadinessIssue.ACTIVE_BRANCH_REQUIRED,
            ),
            response.issues,
        )
    }

    @Test
    fun `does not require Daycare configuration for an academic tenant`() {
        val tenant = Organization(name = "TK Ceria")
        val branch = Branch(organizationId = tenant.id, name = "Utama")
        defaults(listOf(tenant))
        `when`(subscriptions.findAll()).thenReturn(listOf(TenantSubscription(organizationId = tenant.id, status = TenantSubscriptionStatus.TRIAL)))
        `when`(memberships.findAll()).thenReturn(listOf(Membership(organizationId = tenant.id, role = Role.STAFF_ADMIN, active = true)))
        `when`(branches.findAll()).thenReturn(listOf(branch))
        `when`(classrooms.findAll()).thenReturn(listOf(Classroom(organizationId = tenant.id, branchId = branch.id, name = "TK A", active = true)))

        val response = service().readiness(jwt).tenants.single()

        assertEquals(TenantReadinessStatus.READY, response.status)
        assertTrue(response.issues.isEmpty())
    }

    @Test
    fun `does not require a legacy class for a catalog-only tenant`() {
        val tenant = Organization(name = "SMP Harapan")
        val branch = Branch(organizationId = tenant.id, name = "Utama")
        defaults(listOf(tenant))
        `when`(subscriptions.findAll()).thenReturn(listOf(TenantSubscription(organizationId = tenant.id, status = TenantSubscriptionStatus.ACTIVE)))
        `when`(memberships.findAll()).thenReturn(listOf(Membership(organizationId = tenant.id, role = Role.STAFF_ADMIN, active = true)))
        `when`(branches.findAll()).thenReturn(listOf(branch))

        val response = service().readiness(jwt).tenants.single()

        assertEquals(TenantReadinessStatus.READY, response.status)
        assertTrue(response.issues.isEmpty())
    }

    @Test
    fun `requires a legacy class for a published academic offering`() {
        val tenant = Organization(name = "TK Ceria")
        val branch = Branch(organizationId = tenant.id, name = "Utama")
        defaults(listOf(tenant))
        `when`(subscriptions.findAll()).thenReturn(listOf(TenantSubscription(organizationId = tenant.id, status = TenantSubscriptionStatus.ACTIVE)))
        `when`(memberships.findAll()).thenReturn(listOf(Membership(organizationId = tenant.id, role = Role.STAFF_ADMIN, active = true)))
        `when`(branches.findAll()).thenReturn(listOf(branch))
        `when`(educationOfferings.findAll()).thenReturn(listOf(EducationOffering(organizationId = tenant.id, branchId = branch.id, institutionType = "TK", status = EducationOfferingStatus.PUBLISHED)))

        val response = service().readiness(jwt).tenants.single()

        assertEquals(setOf(TenantReadinessIssue.ACTIVE_CLASSROOM_REQUIRED), response.issues)
    }

    @Test
    fun `requires capacity for every active Daycare branch`() {
        val tenant = Organization(name = "Daycare Dua Cabang")
        val configuredBranch = Branch(organizationId = tenant.id, name = "Utama")
        val missingCapacityBranch = Branch(organizationId = tenant.id, name = "Timur")
        defaults(listOf(tenant))
        `when`(educationOfferings.findAll()).thenReturn(listOf(
            EducationOffering(organizationId = tenant.id, branchId = configuredBranch.id, institutionType = "DAYCARE", status = EducationOfferingStatus.PUBLISHED),
            EducationOffering(organizationId = tenant.id, branchId = missingCapacityBranch.id, institutionType = "DAYCARE", status = EducationOfferingStatus.PUBLISHED),
        ))
        `when`(subscriptions.findAll()).thenReturn(listOf(TenantSubscription(organizationId = tenant.id, status = TenantSubscriptionStatus.ACTIVE)))
        `when`(memberships.findAll()).thenReturn(listOf(Membership(organizationId = tenant.id, role = Role.STAFF_ADMIN, active = true)))
        `when`(branches.findAll()).thenReturn(listOf(configuredBranch, missingCapacityBranch))
        `when`(classrooms.findAll()).thenReturn(listOf(Classroom(organizationId = tenant.id, branchId = configuredBranch.id, name = "Kelas", active = true)))
        `when`(plans.findAll()).thenReturn(listOf(ServicePlan(organizationId = tenant.id, name = "Harian", active = true)))
        `when`(capacities.findAll()).thenReturn(listOf(BranchCapacitySetting(organizationId = tenant.id, branchId = configuredBranch.id, dailyCapacity = 20)))
        `when`(operatingHours.findAll()).thenReturn(operatingHoursFor(configuredBranch.id) + operatingHoursFor(missingCapacityBranch.id))
        `when`(instructions.findAll()).thenReturn(listOf(TenantPaymentInstruction(organizationId = tenant.id, name = "BCA", accountHolder = "Usia Emas", accountNumber = "123", active = true)))

        val response = service().readiness(jwt).tenants.single()

        assertEquals(setOf(TenantReadinessIssue.BRANCH_CAPACITY_REQUIRED), response.issues)
    }

    @Test
    fun `requires configured hours for every active Daycare branch`() {
        val tenant = Organization(name = "Daycare Jam Belum Diatur")
        val branch = Branch(organizationId = tenant.id, name = "Utama")
        defaults(listOf(tenant))
        `when`(educationOfferings.findAll()).thenReturn(listOf(EducationOffering(organizationId = tenant.id, branchId = branch.id, institutionType = "DAYCARE", status = EducationOfferingStatus.PUBLISHED)))
        `when`(subscriptions.findAll()).thenReturn(listOf(TenantSubscription(organizationId = tenant.id, status = TenantSubscriptionStatus.ACTIVE)))
        `when`(memberships.findAll()).thenReturn(listOf(Membership(organizationId = tenant.id, role = Role.STAFF_ADMIN, active = true)))
        `when`(branches.findAll()).thenReturn(listOf(branch))
        `when`(classrooms.findAll()).thenReturn(listOf(Classroom(organizationId = tenant.id, branchId = branch.id, name = "Matahari", active = true)))
        `when`(plans.findAll()).thenReturn(listOf(ServicePlan(organizationId = tenant.id, name = "Bulanan", active = true)))
        `when`(capacities.findAll()).thenReturn(listOf(BranchCapacitySetting(organizationId = tenant.id, branchId = branch.id, dailyCapacity = 20)))
        `when`(instructions.findAll()).thenReturn(listOf(TenantPaymentInstruction(organizationId = tenant.id, name = "BCA", accountHolder = "Usia Emas", accountNumber = "123", active = true)))

        val response = service().readiness(jwt).tenants.single()

        assertEquals(setOf(TenantReadinessIssue.OPERATING_HOURS_REQUIRED), response.issues)
    }

    private fun defaults(tenantList: List<Organization>) {
        `when`(organizations.findAll()).thenReturn(tenantList)
        `when`(educationOfferings.findAll()).thenReturn(emptyList())
        `when`(subscriptions.findAll()).thenReturn(emptyList())
        `when`(memberships.findAll()).thenReturn(emptyList())
        `when`(branches.findAll()).thenReturn(emptyList())
        `when`(classrooms.findAll()).thenReturn(emptyList())
        `when`(plans.findAll()).thenReturn(emptyList())
        `when`(capacities.findAll()).thenReturn(emptyList())
        `when`(operatingHours.findAll()).thenReturn(emptyList())
        `when`(instructions.findAll()).thenReturn(emptyList())
    }

    private fun service() = TenantReadinessService(access, platformAccess, organizations, educationOfferings, subscriptions, memberships, branches, classrooms, plans, capacities, operatingHours, instructions)

    @Test
    fun `Staff Admin sees needs-attention for a tenant missing core setup`() {
        val organizationId = UUID.randomUUID()
        stubStaffAdminAccess(organizationId)

        val response = service().organizationReadiness(jwt, organizationId)

        assertEquals(TenantReadinessStatus.NEEDS_ATTENTION, response.status)
        assertTrue(response.issues.contains(TenantReadinessIssue.SUBSCRIPTION_NOT_ACTIVE))
        assertTrue(response.issues.contains(TenantReadinessIssue.STAFF_ADMIN_REQUIRED))
        assertTrue(response.issues.contains(TenantReadinessIssue.ACTIVE_BRANCH_REQUIRED))
        assertFalse(response.issues.contains(TenantReadinessIssue.ACTIVE_CLASSROOM_REQUIRED))
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
        `when`(operatingHours.findAllByBranchIdOrderByDayOfWeekAsc(branch.id)).thenReturn(operatingHoursFor(branch.id))

        val response = service().organizationReadiness(jwt, organizationId)

        assertEquals(TenantReadinessStatus.READY, response.status)
        assertTrue(response.issues.isEmpty())
    }

    private fun stubStaffAdminAccess(organizationId: UUID) {
        val scope = AccessScope(mock(UserProfile::class.java), Membership(organizationId = organizationId, role = Role.STAFF_ADMIN, active = true), emptySet(), emptySet())
        `when`(access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN), null, true)).thenReturn(scope)
        `when`(organizations.findById(organizationId)).thenReturn(Optional.of(Organization(id = organizationId, name = "Nasio Care")))
    }

    private fun operatingHoursFor(branchId: UUID) = DayOfWeek.entries.map { dayOfWeek ->
        BranchOperatingHour(branchId = branchId, dayOfWeek = dayOfWeek, active = dayOfWeek != DayOfWeek.SUNDAY, opensAt = if (dayOfWeek == DayOfWeek.SUNDAY) null else LocalTime.of(7, 0), closesAt = if (dayOfWeek == DayOfWeek.SUNDAY) null else LocalTime.of(16, 0))
    }
}
