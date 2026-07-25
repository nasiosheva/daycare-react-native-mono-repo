package com.daycare.api.service

import com.daycare.api.domain.ChildEnrollmentStatus
import com.daycare.api.domain.Gender
import com.daycare.api.domain.InstitutionCapability
import com.daycare.api.domain.ParentEnrollmentStatus
import com.daycare.api.domain.InvoiceStatus
import com.daycare.api.domain.EntitlementStatus
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
import com.daycare.api.realtime.RealtimeFlag
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

data class ParentEnrollmentChildInput(@field:NotBlank @field:Size(max = 100) val firstName: String, @field:Size(max = 100) val lastName: String?, val gender: Gender, val dateOfBirth: LocalDate)
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
data class ParentEnrollmentResponse(val id: UUID, val organizationId: UUID, val branchId: UUID, val childId: UUID, val childName: String, val invoiceId: UUID?, val entitlementId: UUID?, val status: ParentEnrollmentStatus, val invoiceStatus: InvoiceStatus?, val planName: String, val totalAmount: java.math.BigDecimal, val rejectionReason: String?, val createdAt: Instant)

object ParentEnrollmentError {
    const val ALREADY_ACTIVE = "parent_enrollment.already_active"
    const val BOOKINGS_NOT_ALLOWED = "parent_enrollment.bookings_not_allowed"
    const val NOT_FOUND = "parent_enrollment.not_found"
    const val CANNOT_APPROVE = "parent_enrollment.cannot_approve"
    const val PAYMENT_INSTRUCTION_REQUIRED = "parent_enrollment.payment_instruction_required"
    const val PARENT_NOT_FOUND = "parent_enrollment.parent_not_found"
    const val CANNOT_RETRY = "parent_enrollment.cannot_retry"
    const val CANNOT_CANCEL = "parent_enrollment.cannot_cancel"
}

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
    private val branchFilters: BranchListFilterService,
    private val paymentInstructions: TenantPaymentInstructionService,
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
        require(memberships.findAllByUserIdAndOrganizationId(parent.id, request.organizationId).none { it.role == Role.PARENT && it.active }) { ParentEnrollmentError.ALREADY_ACTIVE }
        requireCatalogTenant(request.organizationId)
        val branch = branches.findById(request.branchId).orElseThrow { IllegalArgumentException("Branch was not found") }
        require(branch.organizationId == request.organizationId && branch.active) { "Branch is not available for this organization" }
        require(request.bookingDates.isEmpty()) { ParentEnrollmentError.BOOKINGS_NOT_ALLOWED }
        val snapshot = billing.quoteEnrollment(request.organizationId, request.planId, request.promoCode)
        val created = request.children.map { childInput ->
            require(childInput.gender != Gender.UNSPECIFIED) { "Gender is required" }
            val child = children.save(Child(organizationId = request.organizationId, branchId = branch.id, firstName = childInput.firstName.trim(), lastName = childInput.lastName?.trim()?.ifBlank { null }, gender = childInput.gender, dateOfBirth = childInput.dateOfBirth, enrollmentStatus = ChildEnrollmentStatus.PENDING))
            val enrollment = enrollments.save(ParentEnrollment(userId = parent.id, organizationId = request.organizationId, branchId = branch.id, childId = child.id, selectedPlanId = snapshot.planId, selectedPlanName = snapshot.planName, selectedPlanType = snapshot.planType, selectedSubtotalAmount = snapshot.subtotalAmount, selectedDiscountAmount = snapshot.discountAmount, selectedDiscountName = snapshot.discountName, selectedDiscountCode = snapshot.discountCode, selectedTotalAmount = snapshot.totalAmount, selectedCreditCount = snapshot.creditCount, selectedUnusedCreditPolicy = snapshot.unusedCreditPolicy, selectedCarryForwardDays = snapshot.carryForwardDays, selectedBookingRequiresApproval = snapshot.bookingRequiresApproval))
            response(enrollment)
        }
        notifyStaffAdmins(request.organizationId, "Pengajuan Parent baru", "Pengajuan ${created.joinToString { it.childName }} menunggu persetujuan.", "/booking-approvals")
        return created
    }

    @Transactional(readOnly = true)
    fun mine(jwt: Jwt): List<ParentEnrollmentResponse> {
        val user = identity.sync(jwt)
        return enrollments.findAllByUserIdOrderByCreatedAtDesc(user.id).map(::response)
    }

    @Transactional
    fun pendingApprovals(jwt: Jwt, organizationId: UUID, filter: BranchListFilter = BranchListFilter(), search: String? = null): List<ParentEnrollmentResponse> {
        access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN), InstitutionCapability.DAYCARE_OPERATIONS, readOnly = true)
        branchFilters.validate(organizationId, filter)
        val query = search?.trim().orEmpty()
        return enrollments.findAllByOrganizationIdAndStatusOrderByCreatedAtAsc(organizationId, ParentEnrollmentStatus.PENDING_APPROVAL)
            .filter { filter.branchId == null || it.branchId == filter.branchId }
            .map(::response)
            .filter { query.isEmpty() || it.childName.contains(query, ignoreCase = true) || it.planName.contains(query, ignoreCase = true) }
    }

    @Transactional
    fun decide(jwt: Jwt, organizationId: UUID, enrollmentId: UUID, request: ParentEnrollmentApprovalRequest): ParentEnrollmentResponse {
        access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN), InstitutionCapability.DAYCARE_OPERATIONS)
        val enrollment = enrollments.findById(enrollmentId).orElseThrow { IllegalArgumentException(ParentEnrollmentError.NOT_FOUND) }
        require(enrollment.organizationId == organizationId && enrollment.status == ParentEnrollmentStatus.PENDING_APPROVAL) { ParentEnrollmentError.CANNOT_APPROVE }
        val child = children.findById(enrollment.childId).orElseThrow { IllegalArgumentException("Child was not found") }
        if (request.approved) {
            require(paymentInstructions.hasActiveInstruction(organizationId)) { ParentEnrollmentError.PAYMENT_INSTRUCTION_REQUIRED }
            val parent = users.findById(enrollment.userId).orElseThrow { IllegalArgumentException(ParentEnrollmentError.PARENT_NOT_FOUND) }
            val purchase = billing.purchaseApprovedEnrollment(parent, organizationId, child, EnrollmentPlanSnapshot(enrollment.selectedPlanId, enrollment.selectedPlanName, enrollment.selectedPlanType, enrollment.selectedSubtotalAmount, enrollment.selectedDiscountAmount, enrollment.selectedDiscountName, enrollment.selectedDiscountCode, enrollment.selectedTotalAmount, enrollment.selectedCreditCount, enrollment.selectedUnusedCreditPolicy, enrollment.selectedCarryForwardDays, enrollment.selectedBookingRequiresApproval))
            enrollment.invoiceId = purchase.invoice.id
            enrollment.entitlementId = purchase.entitlement.id
            child.enrollmentStatus = ChildEnrollmentStatus.ACTIVE
            val parentMembership = memberships.findAllByUserIdAndOrganizationId(enrollment.userId, organizationId).firstOrNull { it.role == Role.PARENT }
            if (parentMembership == null) memberships.save(Membership(userId = enrollment.userId, organizationId = organizationId, role = Role.PARENT, branchId = enrollment.branchId)) else parentMembership.active = true
            if (!guardians.existsByChildIdAndUserId(child.id, enrollment.userId)) guardians.save(GuardianLink(childId = child.id, userId = enrollment.userId))
            enrollment.status = ParentEnrollmentStatus.APPROVED
            enrollment.approvedAt = Instant.now()
            notifications.notify(organizationId, enrollment.userId, "Pengajuan disetujui", "Pengajuan ${child.fullName()} disetujui. Selesaikan pembayaran untuk mengaktifkan paket layanan.", "/home", setOf(RealtimeFlag.PARENT_ENROLLMENTS, RealtimeFlag.PROFILE, RealtimeFlag.CHILDREN, RealtimeFlag.ENTITLEMENTS, RealtimeFlag.INVOICES))
        } else {
            enrollment.status = ParentEnrollmentStatus.REJECTED
            child.active = false
            enrollment.rejectionReason = request.rejectionReason?.trim()?.ifBlank { null }
            notifications.notify(organizationId, enrollment.userId, "Pengajuan ditolak", "Ajukan kembali saat data pendaftaran sudah siap.", "/parent-enrollment", setOf(RealtimeFlag.PARENT_ENROLLMENTS))
        }
        return response(enrollment)
    }

    @Transactional
    fun retry(jwt: Jwt, enrollmentId: UUID, request: ParentEnrollmentRetryRequest): ParentEnrollmentResponse {
        val parent = identity.sync(jwt)
        val enrollment = enrollments.findById(enrollmentId).orElseThrow { IllegalArgumentException(ParentEnrollmentError.NOT_FOUND) }
        require(enrollment.userId == parent.id && enrollment.status == ParentEnrollmentStatus.REJECTED) { ParentEnrollmentError.CANNOT_RETRY }
        require(request.bookingDates.isEmpty()) { ParentEnrollmentError.BOOKINGS_NOT_ALLOWED }
        enrollment.status = ParentEnrollmentStatus.PENDING_APPROVAL
        enrollment.rejectionReason = null
        children.findById(enrollment.childId).orElseThrow { IllegalArgumentException("Child was not found") }.active = true
        notifyStaffAdmins(enrollment.organizationId, "Pengajuan Parent menunggu persetujuan", "Pengajuan ${response(enrollment).childName} diajukan ulang.", "/booking-approvals")
        return response(enrollment)
    }

    @Transactional
    fun cancel(jwt: Jwt, enrollmentId: UUID): ParentEnrollmentResponse {
        val parent = identity.sync(jwt)
        val enrollment = enrollments.findById(enrollmentId).orElseThrow { IllegalArgumentException(ParentEnrollmentError.NOT_FOUND) }
        require(enrollment.userId == parent.id && enrollment.status == ParentEnrollmentStatus.PENDING_APPROVAL) { ParentEnrollmentError.CANNOT_CANCEL }
        children.findById(enrollment.childId).orElseThrow { IllegalArgumentException("Child was not found") }.active = false
        enrollment.status = ParentEnrollmentStatus.CANCELLED
        return response(enrollment)
    }

    @Transactional
    @EventListener
    fun invoicePaid(event: InvoicePaidEvent) {
        enrollments.findByInvoiceId(event.invoiceId) ?: return
    }

    @Transactional
    @EventListener
    fun invoiceExpired(event: InvoiceExpiredEvent) {
        val enrollment = enrollments.findByInvoiceId(event.invoiceId) ?: return
        if (enrollment.status != ParentEnrollmentStatus.APPROVED) return
        val hasActiveService = entitlements.findAllByOrganizationIdAndOwnerUserId(enrollment.organizationId, enrollment.userId).any { it.status == EntitlementStatus.ACTIVE }
        if (!hasActiveService) {
            memberships.findAllByUserIdAndOrganizationId(enrollment.userId, enrollment.organizationId).filter { it.role == Role.PARENT }.forEach { it.active = false }
            notifications.notify(enrollment.organizationId, enrollment.userId, "Tagihan kedaluwarsa", "Akses tenant dibatasi sampai Anda mengajukan pendaftaran baru.", "/parent-enrollment", setOf(RealtimeFlag.PARENT_ENROLLMENTS, RealtimeFlag.PROFILE, RealtimeFlag.INVOICES, RealtimeFlag.ENTITLEMENTS))
        }
    }

    private fun requireCatalogTenant(organizationId: UUID) {
        val subscription = subscriptions.findByOrganizationId(organizationId)
        require(subscription?.status in setOf(TenantSubscriptionStatus.ACTIVE, TenantSubscriptionStatus.TRIAL)) { "Tenant is not available" }
        require(InstitutionCapability.DAYCARE_OPERATIONS in organizationCapabilities.forOrganization(organizationId).capabilities) { "Tenant does not support daycare operations" }
    }

    private fun billingBranchCapacity(organizationId: UUID, branchId: UUID): Int? = billing.branchCapacityForCatalog(organizationId, branchId)
    private fun notifyStaffAdmins(organizationId: UUID, title: String, body: String, actionPath: String) {
        memberships.findAllByOrganizationId(organizationId).filter { it.active && it.role == Role.STAFF_ADMIN }.forEach { notifications.notify(organizationId, it.userId, title, body, actionPath, setOf(RealtimeFlag.PARENT_ENROLLMENTS, RealtimeFlag.INVOICES, RealtimeFlag.ENTITLEMENTS, RealtimeFlag.BOOKINGS)) }
    }
    private fun response(enrollment: ParentEnrollment): ParentEnrollmentResponse {
        val child = children.findById(enrollment.childId).orElseThrow { IllegalArgumentException("Child was not found") }
        val invoice = enrollment.invoiceId?.let { invoices.findById(it).orElseThrow { IllegalArgumentException("Invoice was not found") } }
        return ParentEnrollmentResponse(enrollment.id, enrollment.organizationId, enrollment.branchId, child.id, child.fullName(), enrollment.invoiceId, enrollment.entitlementId, enrollment.status, invoice?.status, enrollment.selectedPlanName, enrollment.selectedTotalAmount, enrollment.rejectionReason, enrollment.createdAt)
    }
    private fun Child.fullName() = listOfNotNull(firstName, lastName).joinToString(" ")
}
