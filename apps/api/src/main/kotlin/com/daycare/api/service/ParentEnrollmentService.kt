package com.daycare.api.service

import com.daycare.api.domain.ChildEnrollmentStatus
import com.daycare.api.domain.InstitutionCapability
import com.daycare.api.domain.ParentEnrollmentStatus
import com.daycare.api.domain.InvoiceStatus
import com.daycare.api.domain.Role
import com.daycare.api.domain.TenantSubscriptionStatus
import com.daycare.api.persistence.BranchRepository
import com.daycare.api.persistence.Child
import com.daycare.api.persistence.ChildRepository
import com.daycare.api.persistence.GuardianLink
import com.daycare.api.persistence.GuardianLinkRepository
import com.daycare.api.persistence.Membership
import com.daycare.api.persistence.MembershipRepository
import com.daycare.api.persistence.OrganizationRepository
import com.daycare.api.persistence.ParentEnrollment
import com.daycare.api.persistence.ParentEnrollmentRepository
import com.daycare.api.persistence.ServiceEntitlementRepository
import com.daycare.api.persistence.ServicePlanRepository
import com.daycare.api.persistence.InvoiceRepository
import com.daycare.api.persistence.TenantSubscriptionRepository
import com.daycare.api.persistence.UserProfileRepository
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.Size
import jakarta.validation.Valid
import org.springframework.context.event.EventListener
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Instant
import java.time.LocalDate
import java.util.UUID

data class ParentEnrollmentChildInput(@field:NotBlank @field:Size(max = 100) val firstName: String, @field:Size(max = 100) val lastName: String?, val dateOfBirth: LocalDate)
data class ParentEnrollmentCheckoutRequest(
    val organizationId: UUID,
    val branchId: UUID,
    val planId: UUID,
    val bookingDates: List<LocalDate>,
    val promoCode: String? = null,
    @field:Size(min = 1, max = 10) @field:Valid val children: List<ParentEnrollmentChildInput>,
)
data class ParentEnrollmentApprovalRequest(val approved: Boolean, @field:Size(max = 500) val rejectionReason: String? = null)
data class ParentEnrollmentRetryRequest(val bookingDates: List<LocalDate> = emptyList())
data class ParentTenantPlanResponse(val id: UUID, val name: String, val type: com.daycare.api.domain.ServicePlanType, val price: java.math.BigDecimal, val creditCount: Int?, val bookingRequiresApproval: Boolean, val dailyCapacity: Int?)
data class ParentTenantBranchResponse(val id: UUID, val name: String, val dailyCapacity: Int?)
data class ParentTenantCatalogResponse(val organizationId: UUID, val organizationName: String, val branches: List<ParentTenantBranchResponse>, val plans: List<ParentTenantPlanResponse>)
data class ParentEnrollmentResponse(val id: UUID, val organizationId: UUID, val branchId: UUID, val childId: UUID, val childName: String, val invoiceId: UUID, val entitlementId: UUID, val status: ParentEnrollmentStatus, val invoiceStatus: InvoiceStatus, val rejectionReason: String?, val createdAt: Instant)

@Service
class ParentEnrollmentService(
    private val identity: IdentityService,
    private val access: AccessService,
    private val organizations: OrganizationRepository,
    private val subscriptions: TenantSubscriptionRepository,
    private val organizationCapabilities: OrganizationCapabilitiesService,
    private val branches: BranchRepository,
    private val plans: ServicePlanRepository,
    private val children: ChildRepository,
    private val enrollments: ParentEnrollmentRepository,
    private val memberships: MembershipRepository,
    private val guardians: GuardianLinkRepository,
    private val users: UserProfileRepository,
    private val entitlements: ServiceEntitlementRepository,
    private val invoices: InvoiceRepository,
    private val billing: BillingService,
    private val notifications: NotificationService,
) {
    @Transactional
    fun catalog(jwt: Jwt): List<ParentTenantCatalogResponse> {
        identity.sync(jwt)
        return organizations.findAll().mapNotNull { organization ->
            val subscription = subscriptions.findByOrganizationId(organization.id)
            val operational = subscription?.status in setOf(TenantSubscriptionStatus.ACTIVE, TenantSubscriptionStatus.TRIAL)
            if (!operational || InstitutionCapability.DAYCARE_OPERATIONS !in organizationCapabilities.forOrganization(organization.id).capabilities) null
            else ParentTenantCatalogResponse(
                organization.id,
                organization.name,
                branches.findAllByOrganizationIdAndActiveTrueOrderByNameAsc(organization.id).map { branch -> ParentTenantBranchResponse(branch.id, branch.name, billingBranchCapacity(organization.id, branch.id)) },
                plans.findAllByOrganizationIdAndActiveTrue(organization.id).map { plan -> ParentTenantPlanResponse(plan.id, plan.name, plan.type, plan.price, plan.creditCount, plan.bookingRequiresApproval, plan.dailyCapacity) },
            )
        }.filter { it.branches.isNotEmpty() && it.plans.isNotEmpty() }
    }

    @Transactional
    fun checkout(jwt: Jwt, request: ParentEnrollmentCheckoutRequest): List<ParentEnrollmentResponse> {
        val parent = identity.sync(jwt)
        require(memberships.findAllByUserIdAndOrganizationId(parent.id, request.organizationId).none { it.role == Role.PARENT }) { "Parent is already active in this tenant" }
        requireCatalogTenant(request.organizationId)
        val branch = branches.findById(request.branchId).orElseThrow { IllegalArgumentException("Branch was not found") }
        require(branch.organizationId == request.organizationId && branch.active) { "Branch is not available for this organization" }
        val created = request.children.map { childInput ->
            val child = children.save(Child(organizationId = request.organizationId, branchId = branch.id, firstName = childInput.firstName.trim(), lastName = childInput.lastName?.trim()?.ifBlank { null }, dateOfBirth = childInput.dateOfBirth, enrollmentStatus = ChildEnrollmentStatus.PENDING))
            val purchase = billing.purchaseForEnrollment(parent, request.organizationId, child, PurchaseServiceRequest(request.planId, child.id, request.bookingDates, request.promoCode))
            val enrollment = enrollments.save(ParentEnrollment(userId = parent.id, organizationId = request.organizationId, branchId = branch.id, childId = child.id, invoiceId = purchase.invoice.id, entitlementId = purchase.entitlement.id))
            response(enrollment)
        }
        notifyStaffAdmins(request.organizationId, "Pembayaran Parent baru", "Pengajuan ${created.joinToString { it.childName }} menunggu konfirmasi pembayaran.", "/parent-payments")
        return created
    }

    @Transactional(readOnly = true)
    fun mine(jwt: Jwt): List<ParentEnrollmentResponse> {
        val user = identity.sync(jwt)
        return enrollments.findAllByUserIdOrderByCreatedAtDesc(user.id).map(::response)
    }

    @Transactional
    fun pendingApprovals(jwt: Jwt, organizationId: UUID): List<ParentEnrollmentResponse> {
        access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN), InstitutionCapability.DAYCARE_OPERATIONS, readOnly = true)
        return enrollments.findAllByOrganizationIdAndStatusOrderByCreatedAtAsc(organizationId, ParentEnrollmentStatus.PENDING_APPROVAL).map(::response)
    }

    @Transactional
    fun decide(jwt: Jwt, organizationId: UUID, enrollmentId: UUID, request: ParentEnrollmentApprovalRequest): ParentEnrollmentResponse {
        access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN), InstitutionCapability.DAYCARE_OPERATIONS)
        val enrollment = enrollments.findById(enrollmentId).orElseThrow { IllegalArgumentException("Parent enrollment was not found") }
        require(enrollment.organizationId == organizationId && enrollment.status == ParentEnrollmentStatus.PENDING_APPROVAL) { "Parent enrollment cannot be approved" }
        val child = children.findById(enrollment.childId).orElseThrow { IllegalArgumentException("Child was not found") }
        if (request.approved) {
            child.enrollmentStatus = ChildEnrollmentStatus.ACTIVE
            if (memberships.findAllByUserIdAndOrganizationId(enrollment.userId, organizationId).none { it.role == Role.PARENT }) memberships.save(Membership(userId = enrollment.userId, organizationId = organizationId, role = Role.PARENT, branchId = enrollment.branchId))
            if (!guardians.existsByChildIdAndUserId(child.id, enrollment.userId)) guardians.save(GuardianLink(childId = child.id, userId = enrollment.userId))
            enrollment.status = ParentEnrollmentStatus.APPROVED
            enrollment.approvedAt = Instant.now()
            notifications.notify(organizationId, enrollment.userId, "Pengajuan disetujui", "Pengajuan ${child.fullName()} disetujui. Anda sekarang dapat memakai dashboard Parent.", "/home")
        } else {
            enrollment.status = ParentEnrollmentStatus.REJECTED
            enrollment.rejectionReason = request.rejectionReason?.trim()?.ifBlank { null }
            val entitlement = entitlements.findById(enrollment.entitlementId).orElseThrow { IllegalArgumentException("Service entitlement was not found") }
            notifications.notify(organizationId, enrollment.userId, "Pengajuan ditolak", "Paket tetap tersimpan. Ajukan ulang untuk ditinjau kembali.", "/parent-enrollment")
        }
        return response(enrollment)
    }

    @Transactional
    fun retry(jwt: Jwt, enrollmentId: UUID, request: ParentEnrollmentRetryRequest): ParentEnrollmentResponse {
        val parent = identity.sync(jwt)
        val enrollment = enrollments.findById(enrollmentId).orElseThrow { IllegalArgumentException("Parent enrollment was not found") }
        require(enrollment.userId == parent.id && enrollment.status == ParentEnrollmentStatus.REJECTED) { "Parent enrollment cannot be retried" }
        require(request.bookingDates.isEmpty()) { "Parent enrollment retry does not create bookings" }
        val entitlement = entitlements.findById(enrollment.entitlementId).orElseThrow { IllegalArgumentException("Service entitlement was not found") }
        require(entitlement.status == com.daycare.api.domain.EntitlementStatus.ACTIVE) { "Service entitlement is not active" }
        enrollment.status = ParentEnrollmentStatus.PENDING_APPROVAL
        enrollment.rejectionReason = null
        notifyStaffAdmins(enrollment.organizationId, "Pengajuan Parent menunggu persetujuan", "Pengajuan ${response(enrollment).childName} diajukan ulang menggunakan paket yang sudah dibayar.", "/booking-approvals")
        return response(enrollment)
    }

    @Transactional
    fun cancel(jwt: Jwt, enrollmentId: UUID): ParentEnrollmentResponse {
        val parent = identity.sync(jwt)
        val enrollment = enrollments.findById(enrollmentId).orElseThrow { IllegalArgumentException("Parent enrollment was not found") }
        require(enrollment.userId == parent.id && enrollment.status == ParentEnrollmentStatus.PENDING_PAYMENT) { "Only unpaid Parent applications can be cancelled" }
        billing.cancelPendingEnrollmentPurchase(enrollment.invoiceId, enrollment.entitlementId)
        enrollment.status = ParentEnrollmentStatus.CANCELLED
        return response(enrollment)
    }

    @Transactional
    @EventListener
    fun invoicePaid(event: InvoicePaidEvent) {
        val enrollment = enrollments.findByInvoiceId(event.invoiceId) ?: return
        if (enrollment.status != ParentEnrollmentStatus.PENDING_PAYMENT) return
        enrollment.status = ParentEnrollmentStatus.PENDING_APPROVAL
        val child = children.findById(enrollment.childId).orElseThrow { IllegalArgumentException("Child was not found") }
        notifyStaffAdmins(enrollment.organizationId, "Pengajuan Parent menunggu persetujuan", "Pengajuan ${child.fullName()} sudah dibayar dan menunggu persetujuan binding Parent.", "/booking-approvals")
    }

    @Transactional
    @EventListener
    fun invoiceExpired(event: InvoiceExpiredEvent) {
        val enrollment = enrollments.findByInvoiceId(event.invoiceId) ?: return
        if (enrollment.status == ParentEnrollmentStatus.PENDING_PAYMENT) enrollment.status = ParentEnrollmentStatus.EXPIRED
    }

    private fun requireCatalogTenant(organizationId: UUID) {
        val subscription = subscriptions.findByOrganizationId(organizationId)
        require(subscription?.status in setOf(TenantSubscriptionStatus.ACTIVE, TenantSubscriptionStatus.TRIAL)) { "Tenant is not available" }
        require(InstitutionCapability.DAYCARE_OPERATIONS in organizationCapabilities.forOrganization(organizationId).capabilities) { "Tenant does not support daycare operations" }
    }

    private fun billingBranchCapacity(organizationId: UUID, branchId: UUID): Int? = billing.branchCapacityForCatalog(organizationId, branchId)
    private fun notifyStaffAdmins(organizationId: UUID, title: String, body: String, actionPath: String) {
        memberships.findAllByOrganizationId(organizationId).filter { it.active && it.role == Role.STAFF_ADMIN }.forEach { notifications.notify(organizationId, it.userId, title, body, actionPath) }
    }
    private fun response(enrollment: ParentEnrollment): ParentEnrollmentResponse {
        val child = children.findById(enrollment.childId).orElseThrow { IllegalArgumentException("Child was not found") }
        val invoice = invoices.findById(enrollment.invoiceId).orElseThrow { IllegalArgumentException("Invoice was not found") }
        return ParentEnrollmentResponse(enrollment.id, enrollment.organizationId, enrollment.branchId, child.id, child.fullName(), enrollment.invoiceId, enrollment.entitlementId, enrollment.status, invoice.status, enrollment.rejectionReason, enrollment.createdAt)
    }
    private fun Child.fullName() = listOfNotNull(firstName, lastName).joinToString(" ")
}
