package com.daycare.api.service

import com.daycare.api.domain.BookingStatus
import com.daycare.api.domain.EntitlementStatus
import com.daycare.api.domain.InvoiceStatus
import com.daycare.api.domain.InstitutionCapability
import com.daycare.api.domain.Role
import com.daycare.api.domain.ServicePlanDiscountKind
import com.daycare.api.domain.ServicePlanDiscountType
import com.daycare.api.domain.ServicePlanType
import com.daycare.api.domain.UnusedCreditPolicy
import com.daycare.api.persistence.Booking
import com.daycare.api.persistence.BookingRepository
import com.daycare.api.persistence.BranchCapacitySetting
import com.daycare.api.persistence.BranchRepository
import com.daycare.api.persistence.ChildRepository
import com.daycare.api.persistence.Invoice
import com.daycare.api.persistence.InvoiceRepository
import com.daycare.api.persistence.ServiceEntitlement
import com.daycare.api.persistence.ServiceEntitlementRepository
import com.daycare.api.persistence.ServicePlan
import com.daycare.api.persistence.ServicePlanDiscount
import com.daycare.api.persistence.ServicePlanDiscountRedemption
import com.daycare.api.persistence.ServicePlanDiscountRedemptionRepository
import com.daycare.api.persistence.ServicePlanDiscountRepository
import com.daycare.api.persistence.ServicePlanRepository
import com.daycare.api.persistence.ServicePlanTemplate
import com.daycare.api.persistence.ServicePlanTemplateRepository
import com.daycare.api.persistence.UserProfileRepository
import com.daycare.api.persistence.UserProfile
import com.daycare.api.persistence.Child
import com.daycare.api.persistence.ParentEnrollmentRepository
import jakarta.validation.constraints.DecimalMin
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.NotEmpty
import jakarta.validation.constraints.Size
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.stereotype.Service
import org.springframework.context.ApplicationEventPublisher
import org.springframework.transaction.annotation.Transactional
import java.math.BigDecimal
import java.math.RoundingMode
import java.time.Instant
import java.time.LocalDate
import java.time.YearMonth
import java.util.UUID

data class CreateServicePlanRequest(@field:NotBlank @field:Size(max = 120) val name: String, val type: ServicePlanType, @field:DecimalMin("1") val price: BigDecimal, val creditCount: Int?, val unusedCreditPolicy: UnusedCreditPolicy?, val carryForwardDays: Int?, val bookingRequiresApproval: Boolean, val dailyCapacity: Int? = null)
data class PurchaseServiceRequest(val planId: UUID, val childId: UUID, val bookingDates: List<LocalDate>, @field:Size(max = 80) val promoCode: String? = null)
data class CreateEntitlementBookingsRequest(@field:NotEmpty val bookingDates: List<LocalDate>)
data class BookingApprovalRequest(val approved: Boolean)
data class SetBranchCapacityRequest(val dailyCapacity: Int)
data class BranchCapacityResponse(val branchId: UUID, val dailyCapacity: Int?)
data class CreateServicePlanDiscountRequest(val kind: ServicePlanDiscountKind, @field:NotBlank @field:Size(max = 120) val name: String, @field:Size(max = 80) val promoCode: String?, val type: ServicePlanDiscountType, @field:DecimalMin("0.01") val value: BigDecimal, val startsOn: LocalDate?, val endsOn: LocalDate?, val usageLimit: Int?)
data class ServicePlanDiscountResponse(val id: UUID, val planId: UUID, val kind: ServicePlanDiscountKind, val name: String, val promoCode: String?, val type: ServicePlanDiscountType, val value: BigDecimal, val startsOn: LocalDate?, val endsOn: LocalDate?, val usageLimit: Int?, val active: Boolean)
data class UpsertServicePlanTemplateRequest(@field:NotBlank @field:Size(max = 120) val name: String, val type: ServicePlanType, val suggestedPrice: BigDecimal?, val creditCount: Int?, val unusedCreditPolicy: UnusedCreditPolicy?, val carryForwardDays: Int?, val bookingRequiresApproval: Boolean, val dailyCapacity: Int?)
data class ServicePlanTemplateResponse(val id: String, val source: String, val name: String, val type: ServicePlanType, val suggestedPrice: BigDecimal?, val creditCount: Int?, val unusedCreditPolicy: UnusedCreditPolicy?, val carryForwardDays: Int?, val bookingRequiresApproval: Boolean, val dailyCapacity: Int?)
data class ServicePlanResponse(val id: UUID, val name: String, val type: ServicePlanType, val price: BigDecimal, val creditCount: Int?, val unusedCreditPolicy: UnusedCreditPolicy?, val carryForwardDays: Int?, val bookingRequiresApproval: Boolean, val dailyCapacity: Int?)
data class EntitlementResponse(val id: UUID, val childId: UUID, val childName: String, val parentName: String?, val parentEmail: String?, val planName: String, val type: ServicePlanType, val status: EntitlementStatus, val totalCredits: Int?, val remainingCredits: Int?, val validUntil: LocalDate)
data class BookingResponse(val id: UUID, val childId: UUID, val childName: String, val bookingDate: LocalDate, val status: BookingStatus, val planName: String, val invoiceId: UUID)
data class InvoiceResponse(val id: UUID, val invoiceNumber: String, val childId: UUID, val childName: String, val parentName: String?, val parentEmail: String?, val subtotalAmount: BigDecimal, val discountAmount: BigDecimal, val discountName: String?, val discountCode: String?, val totalAmount: BigDecimal, val status: InvoiceStatus, val dueDate: LocalDate, val createdAt: Instant)
data class PurchaseServiceResponse(val entitlement: EntitlementResponse, val invoice: InvoiceResponse, val bookings: List<BookingResponse>)

@Service
class BillingService(
    private val access: AccessService,
    private val childScopes: ChildScopeService,
    private val children: ChildRepository,
    private val branches: BranchRepository,
    private val plans: ServicePlanRepository,
    private val invoices: InvoiceRepository,
    private val entitlements: ServiceEntitlementRepository,
    private val bookings: BookingRepository,
    private val users: UserProfileRepository,
    private val discounts: ServicePlanDiscountRepository,
    private val discountRedemptions: ServicePlanDiscountRedemptionRepository,
    private val templates: ServicePlanTemplateRepository,
    private val capacity: CapacityReservationService,
    private val notifications: NotificationService,
    private val events: ApplicationEventPublisher,
    private val parentEnrollments: ParentEnrollmentRepository,
) {
    @Transactional
    fun plans(jwt: Jwt, organizationId: UUID): List<ServicePlanResponse> {
        access.require(jwt, organizationId, Role.entries.toSet(), InstitutionCapability.DAYCARE_OPERATIONS)
        return plans.findAllByOrganizationIdAndActiveTrue(organizationId).map(::planResponse)
    }

    @Transactional
    fun createPlan(jwt: Jwt, organizationId: UUID, request: CreateServicePlanRequest): ServicePlanResponse {
        access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN), InstitutionCapability.DAYCARE_OPERATIONS)
        validatePlanConfiguration(request.type, request.price, request.creditCount, request.unusedCreditPolicy, request.carryForwardDays, request.dailyCapacity)
        return planResponse(plans.save(ServicePlan(organizationId = organizationId, name = request.name.trim(), type = request.type, price = request.price, creditCount = request.creditCount, unusedCreditPolicy = request.unusedCreditPolicy, carryForwardDays = request.carryForwardDays, bookingRequiresApproval = request.bookingRequiresApproval, dailyCapacity = request.dailyCapacity)))
    }

    @Transactional(readOnly = true)
    fun branchCapacities(jwt: Jwt, organizationId: UUID): List<BranchCapacityResponse> {
        access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN), InstitutionCapability.DAYCARE_OPERATIONS)
        val capacities = capacity.branchSettings(organizationId).associateBy { it.branchId }
        return branches.findAllByOrganizationIdAndActiveTrueOrderByNameAsc(organizationId).map { branch -> BranchCapacityResponse(branch.id, capacities[branch.id]?.dailyCapacity) }
    }

    @Transactional(readOnly = true)
    fun branchCapacityForCatalog(organizationId: UUID, branchId: UUID): Int? = capacity.branchSettings(organizationId).firstOrNull { it.branchId == branchId }?.dailyCapacity

    @Transactional
    fun setBranchCapacity(jwt: Jwt, organizationId: UUID, branchId: UUID, request: SetBranchCapacityRequest): BranchCapacityResponse {
        access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN), InstitutionCapability.DAYCARE_OPERATIONS)
        return branchCapacityResponse(capacity.setBranchCapacity(organizationId, branchId, request.dailyCapacity))
    }

    @Transactional(readOnly = true)
    fun planDiscounts(jwt: Jwt, organizationId: UUID, planId: UUID): List<ServicePlanDiscountResponse> {
        access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN), InstitutionCapability.DAYCARE_OPERATIONS)
        requirePlan(planId, organizationId)
        return discounts.findAllByOrganizationIdAndServicePlanIdOrderByCreatedAtDesc(organizationId, planId).map(::discountResponse)
    }

    @Transactional
    fun createPlanDiscount(jwt: Jwt, organizationId: UUID, planId: UUID, request: CreateServicePlanDiscountRequest): ServicePlanDiscountResponse {
        access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN), InstitutionCapability.DAYCARE_OPERATIONS)
        val plan = requirePlan(planId, organizationId)
        validateDiscount(request, plan.price)
        val saved = discounts.save(ServicePlanDiscount(organizationId = organizationId, servicePlanId = plan.id, kind = request.kind, name = request.name.trim(), promoCode = request.promoCode?.trim()?.uppercase(), type = request.type, value = request.value, startsOn = request.startsOn, endsOn = request.endsOn, usageLimit = request.usageLimit))
        return discountResponse(saved)
    }

    @Transactional
    fun deactivatePlanDiscount(jwt: Jwt, organizationId: UUID, planId: UUID, discountId: UUID): ServicePlanDiscountResponse {
        access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN), InstitutionCapability.DAYCARE_OPERATIONS)
        requirePlan(planId, organizationId)
        val discount = discounts.findById(discountId).orElseThrow { IllegalArgumentException("Service plan discount was not found") }
        require(discount.organizationId == organizationId && discount.servicePlanId == planId) { "Service plan discount belongs to a different service plan" }
        discount.active = false
        return discountResponse(discount)
    }

    @Transactional(readOnly = true)
    fun planTemplates(jwt: Jwt, organizationId: UUID): List<ServicePlanTemplateResponse> {
        access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN), InstitutionCapability.DAYCARE_OPERATIONS)
        return systemTemplates + templates.findAllByOrganizationIdOrderByNameAsc(organizationId).map(::templateResponse)
    }

    @Transactional
    fun createPlanTemplate(jwt: Jwt, organizationId: UUID, request: UpsertServicePlanTemplateRequest): ServicePlanTemplateResponse {
        access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN), InstitutionCapability.DAYCARE_OPERATIONS)
        validatePlanConfiguration(request.type, request.suggestedPrice, request.creditCount, request.unusedCreditPolicy, request.carryForwardDays, request.dailyCapacity)
        return templateResponse(templates.save(templateFromRequest(organizationId, request)))
    }

    @Transactional
    fun updatePlanTemplate(jwt: Jwt, organizationId: UUID, templateId: UUID, request: UpsertServicePlanTemplateRequest): ServicePlanTemplateResponse {
        access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN), InstitutionCapability.DAYCARE_OPERATIONS)
        validatePlanConfiguration(request.type, request.suggestedPrice, request.creditCount, request.unusedCreditPolicy, request.carryForwardDays, request.dailyCapacity)
        val template = templates.findById(templateId).orElseThrow { IllegalArgumentException("Service plan template was not found") }
        require(template.organizationId == organizationId) { "Service plan template belongs to a different organization" }
        template.name = request.name.trim(); template.type = request.type; template.suggestedPrice = request.suggestedPrice; template.creditCount = request.creditCount; template.unusedCreditPolicy = request.unusedCreditPolicy; template.carryForwardDays = request.carryForwardDays; template.bookingRequiresApproval = request.bookingRequiresApproval; template.dailyCapacity = request.dailyCapacity
        return templateResponse(template)
    }

    @Transactional
    fun deletePlanTemplate(jwt: Jwt, organizationId: UUID, templateId: UUID) {
        access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN), InstitutionCapability.DAYCARE_OPERATIONS)
        val template = templates.findById(templateId).orElseThrow { IllegalArgumentException("Service plan template was not found") }
        require(template.organizationId == organizationId) { "Service plan template belongs to a different organization" }
        templates.delete(template)
    }

    @Transactional
    fun purchase(jwt: Jwt, organizationId: UUID, request: PurchaseServiceRequest): PurchaseServiceResponse {
        val scope = access.require(jwt, organizationId, setOf(Role.PARENT), InstitutionCapability.DAYCARE_OPERATIONS)
        val child = childScopes.requireParentLinkedChild(scope, request.childId, organizationId)
        return purchaseForChild(scope.user, organizationId, child, request)
    }

    @Transactional
    fun purchaseForEnrollment(parent: UserProfile, organizationId: UUID, child: Child, request: PurchaseServiceRequest): PurchaseServiceResponse = purchaseForChild(parent, organizationId, child, request, deferBookings = true)

    private fun purchaseForChild(parent: UserProfile, organizationId: UUID, child: Child, request: PurchaseServiceRequest, deferBookings: Boolean = false): PurchaseServiceResponse {
        reconcileExpiredInvoices(organizationId)
        val initialPlan = requirePlan(request.planId, organizationId)
        val today = LocalDate.now()
        val dates = request.bookingDates.distinct().sorted()
        validatePurchase(initialPlan, dates, today, deferBookings)
        if (!deferBookings) requireAvailableDates(organizationId, child.id, dates)
        val periodEnd = if (deferBookings) deferredPeriodEnd(initialPlan.type, today) else periodEnd(initialPlan.type, dates, today)
        val plan = if (deferBookings) initialPlan else capacity.requireAvailability(organizationId, child.branchId, initialPlan.id, capacityDates(initialPlan.type, dates, today, periodEnd))
        val appliedDiscount = applicableDiscount(organizationId, plan, request.promoCode, today)
        val discountAmount = appliedDiscount?.amount ?: BigDecimal.ZERO
        val totalAmount = plan.price.subtract(discountAmount)
        require(totalAmount > BigDecimal.ZERO) { "Discount must leave a positive total" }
        val invoice = invoices.save(Invoice(organizationId = organizationId, payerUserId = parent.id, invoiceNumber = "INV-${UUID.randomUUID().toString().take(8).uppercase()}", subtotalAmount = plan.price, discountAmount = discountAmount, discountName = appliedDiscount?.discount?.name, discountCode = appliedDiscount?.discount?.promoCode, totalAmount = totalAmount, dueDate = today.plusDays(2)))
        val validUntil = if (plan.type == ServicePlanType.WEEKLY && plan.unusedCreditPolicy == UnusedCreditPolicy.CARRY_FORWARD) periodEnd.plusDays(plan.carryForwardDays?.toLong() ?: 30) else periodEnd
        val entitlement = entitlements.save(ServiceEntitlement(organizationId = organizationId, branchId = child.branchId, childId = child.id, ownerUserId = parent.id, planId = plan.id, invoiceId = invoice.id, planName = plan.name, planType = plan.type, totalCredits = plan.creditCount, reservedCredits = if (deferBookings) 0 else dates.size, bookingRequiresApproval = plan.bookingRequiresApproval, periodStart = today, periodEnd = periodEnd, validUntil = validUntil))
        val createdBookings = if (deferBookings) emptyList() else dates.map { date -> bookings.save(Booking(organizationId = organizationId, branchId = child.branchId, childId = child.id, entitlementId = entitlement.id, invoiceId = invoice.id, bookingDate = date, planName = plan.name)) }
        if (!deferBookings) capacity.reserve(organizationId, child.branchId, plan.id, entitlement.id, capacityDates(plan.type, dates, today, periodEnd), createdBookings.associate { it.bookingDate to it.id })
        if (appliedDiscount?.discount?.kind == ServicePlanDiscountKind.PROMO_CODE) discountRedemptions.save(ServicePlanDiscountRedemption(discountId = appliedDiscount.discount.id, invoiceId = invoice.id))
        return PurchaseServiceResponse(entitlementResponse(entitlement), invoiceResponse(invoice, child.id, child.fullName()), createdBookings.map { bookingResponse(it, child.fullName()) })
    }

    @Transactional
    fun createBookingsFromEntitlement(jwt: Jwt, organizationId: UUID, entitlementId: UUID, request: CreateEntitlementBookingsRequest): List<BookingResponse> {
        val scope = access.require(jwt, organizationId, setOf(Role.PARENT), InstitutionCapability.DAYCARE_OPERATIONS)
        reconcileExpiredInvoices(organizationId)
        val entitlement = entitlements.findById(entitlementId).orElseThrow { IllegalArgumentException("Service entitlement was not found") }
        require(entitlement.organizationId == organizationId && entitlement.ownerUserId == scope.user.id) { "Service entitlement is not available" }
        val child = childScopes.requireParentLinkedChild(scope, entitlement.childId, organizationId)
        return createBookingsForEntitlement(organizationId, entitlement, child, request.bookingDates, if (entitlement.bookingRequiresApproval) BookingStatus.PENDING_APPROVAL else BookingStatus.CONFIRMED)
    }

    @Transactional
    fun markInvoicePaid(jwt: Jwt, organizationId: UUID, invoiceId: UUID): InvoiceResponse {
        access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN), InstitutionCapability.DAYCARE_OPERATIONS)
        reconcileExpiredInvoices(organizationId)
        val invoice = requireInvoice(invoiceId, organizationId)
        require(invoice.status == InvoiceStatus.PENDING) { "Invoice is not awaiting payment" }
        invoice.status = InvoiceStatus.PAID; invoice.paidAt = Instant.now()
        val entitlement = entitlements.findAllByInvoiceId(invoice.id).singleOrNull() ?: throw IllegalArgumentException("Invoice entitlement was not found")
        entitlement.status = if (entitlement.validUntil.isBefore(LocalDate.now())) EntitlementStatus.EXPIRED else EntitlementStatus.ACTIVE
        bookings.findAllByInvoiceId(invoice.id).forEach { booking -> if (booking.status == BookingStatus.PENDING_PAYMENT) booking.status = if (entitlement.bookingRequiresApproval) BookingStatus.PENDING_APPROVAL else BookingStatus.CONFIRMED }
        notifications.notify(organizationId, invoice.payerUserId, "Pembayaran diterima", "Tagihan ${invoice.invoiceNumber} telah dikonfirmasi.")
        events.publishEvent(InvoicePaidEvent(invoice.id))
        return invoiceResponse(invoice, entitlement.childId, childName(entitlement.childId))
    }

    @Transactional
    fun approveBooking(jwt: Jwt, organizationId: UUID, bookingId: UUID, request: BookingApprovalRequest): BookingResponse {
        val scope = access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN, Role.STAFF), InstitutionCapability.DAYCARE_OPERATIONS)
        val booking = bookings.findById(bookingId).orElseThrow { IllegalArgumentException("Booking was not found") }
        require(booking.organizationId == organizationId && booking.status == BookingStatus.PENDING_APPROVAL) { "Booking cannot be approved" }
        require(parentEnrollments.findByInvoiceId(booking.invoiceId) == null) { "Self-registered Parent bookings must be decided through the Parent enrollment approval" }
        childScopes.requireStaffManagedChild(scope, booking.childId, organizationId)
        booking.status = if (request.approved) BookingStatus.CONFIRMED else BookingStatus.REJECTED
        if (!request.approved) { entitlements.findById(booking.entitlementId).ifPresent { entitlement -> entitlement.reservedCredits = (entitlement.reservedCredits - 1).coerceAtLeast(0) }; capacity.releaseForBooking(booking.id) }
        val entitlement = entitlements.findById(booking.entitlementId).orElseThrow()
        notifications.notify(organizationId, entitlement.ownerUserId, "Booking ${if (request.approved) "disetujui" else "ditolak"}", "Booking ${childName(booking.childId)} pada ${booking.bookingDate} ${if (request.approved) "disetujui" else "ditolak"}.")
        return bookingResponse(booking, childName(booking.childId))
    }

    @Transactional
    fun entitlements(jwt: Jwt, organizationId: UUID): List<EntitlementResponse> {
        val scope = access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN, Role.PARENT), InstitutionCapability.DAYCARE_OPERATIONS)
        reconcileExpiredInvoices(organizationId)
        val source = if (scope.membership.role == Role.STAFF_ADMIN) entitlements.findAllByOrganizationId(organizationId) else entitlements.findAllByOrganizationIdAndOwnerUserId(organizationId, scope.user.id)
        return source.onEach(::expireIfNeeded).sortedByDescending { it.validUntil }.map(::entitlementResponse)
    }

    @Transactional
    fun bookings(jwt: Jwt, organizationId: UUID, pendingOnly: Boolean): List<BookingResponse> {
        val scope = access.require(jwt, organizationId, if (pendingOnly) setOf(Role.STAFF_ADMIN, Role.STAFF) else setOf(Role.STAFF_ADMIN, Role.STAFF, Role.PARENT), InstitutionCapability.DAYCARE_OPERATIONS)
        val source = if (pendingOnly) bookings.findAllByOrganizationIdAndStatusOrderByBookingDateAsc(organizationId, BookingStatus.PENDING_APPROVAL) else bookings.findAllByOrganizationIdOrderByBookingDateDesc(organizationId)
        return source.filter { booking ->
            (!pendingOnly || parentEnrollments.findByInvoiceId(booking.invoiceId) == null) &&
                if (scope.membership.role == Role.PARENT) entitlements.findById(booking.entitlementId).map { it.ownerUserId == scope.user.id }.orElse(false) else childScopes.isStaffManagedChild(scope, booking.childId, organizationId)
        }.map { bookingResponse(it, childName(it.childId)) }
    }

    @Transactional
    fun invoices(jwt: Jwt, organizationId: UUID): List<InvoiceResponse> {
        val scope = access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN, Role.PARENT), InstitutionCapability.DAYCARE_OPERATIONS)
        reconcileExpiredInvoices(organizationId)
        val source = if (scope.membership.role == Role.STAFF_ADMIN) invoices.findAllByOrganizationIdOrderByCreatedAtDesc(organizationId) else invoices.findAllByOrganizationIdAndPayerUserIdOrderByCreatedAtDesc(organizationId, scope.user.id)
        return source.map { invoice -> val entitlement = entitlements.findAllByInvoiceId(invoice.id).singleOrNull() ?: throw IllegalArgumentException("Invoice entitlement was not found"); invoiceResponse(invoice, entitlement.childId, childName(entitlement.childId)) }
    }

    private fun validatePlanConfiguration(type: ServicePlanType, price: BigDecimal?, creditCount: Int?, unusedCreditPolicy: UnusedCreditPolicy?, carryForwardDays: Int?, dailyCapacity: Int?) {
        if (price != null) require(price > BigDecimal.ZERO) { "Price must be positive" }
        require(dailyCapacity == null || dailyCapacity > 0) { "Daily capacity must be positive" }
        if (type == ServicePlanType.MONTHLY) require(creditCount == null) { "Monthly plans do not use credits" }
        else require((creditCount ?: 0) > 0) { "Daily and weekly plans require credits" }
        if (type == ServicePlanType.DAILY) require(creditCount == 1) { "Daily plans require exactly one credit" }
        if (type == ServicePlanType.WEEKLY && unusedCreditPolicy == UnusedCreditPolicy.CARRY_FORWARD) require((carryForwardDays ?: 0) > 0) { "Carry-forward plans require a valid carry-forward period" }
    }

    private fun validateDiscount(request: CreateServicePlanDiscountRequest, planPrice: BigDecimal) {
        require(request.startsOn == null || request.endsOn == null || !request.startsOn.isAfter(request.endsOn)) { "Discount start date must be before its end date" }
        require(request.usageLimit == null || request.usageLimit > 0) { "Discount usage limit must be positive" }
        if (request.kind == ServicePlanDiscountKind.PROMO_CODE) require(!request.promoCode.isNullOrBlank()) { "Promo code is required" }
        else require(request.promoCode.isNullOrBlank() && request.usageLimit == null) { "Automatic discounts cannot have a promo code or usage limit" }
        require(request.value > BigDecimal.ZERO) { "Discount value must be positive" }
        if (request.type == ServicePlanDiscountType.PERCENTAGE) require(request.value < BigDecimal(100)) { "Percentage discount must be less than 100" }
        else require(request.value < planPrice) { "Fixed discount must be lower than the service plan price" }
    }

    private fun validatePurchase(plan: ServicePlan, dates: List<LocalDate>, today: LocalDate, deferBookings: Boolean = false) {
        if (deferBookings) {
            require(dates.isEmpty()) { "Parent enrollment does not create bookings before approval" }
            return
        }
        when (plan.type) {
            ServicePlanType.MONTHLY -> require(dates.isEmpty()) { "Monthly plans do not require daily bookings" }
            ServicePlanType.DAILY -> require(dates.size == 1) { "Daily plans require one booking date" }
            ServicePlanType.WEEKLY -> require(dates.isNotEmpty() && dates.size <= (plan.creditCount ?: 0)) { "Booking dates exceed available weekly credits" }
        }
        require(dates.all { !it.isBefore(today) }) { "Bookings cannot be in the past" }
        if (plan.type == ServicePlanType.WEEKLY) require(dates.all { !it.isAfter(today.plusDays(6)) }) { "Weekly booking dates must be within seven days" }
    }

    private fun applicableDiscount(organizationId: UUID, plan: ServicePlan, promoCode: String?, today: LocalDate): AppliedDiscount? {
        val normalizedCode = promoCode?.trim()?.uppercase()?.ifBlank { null }
        val activeDiscounts = discounts.findAllByOrganizationIdAndServicePlanIdAndActiveTrue(organizationId, plan.id).filter { discount ->
            val inPeriod = (discount.startsOn == null || !today.isBefore(discount.startsOn)) && (discount.endsOn == null || !today.isAfter(discount.endsOn))
            val usageLimit = discount.usageLimit
            val hasUsage = usageLimit == null || discountRedemptions.countByDiscountId(discount.id) < usageLimit
            inPeriod && hasUsage
        }
        if (normalizedCode != null) require(activeDiscounts.any { it.kind == ServicePlanDiscountKind.PROMO_CODE && it.promoCode == normalizedCode }) { "Promo code is invalid or expired" }
        val candidates = activeDiscounts.filter { it.kind == ServicePlanDiscountKind.AUTOMATIC || it.promoCode == normalizedCode }
        return candidates.map { discount -> AppliedDiscount(discount, discountAmount(discount, plan.price)) }.maxByOrNull { it.amount }
    }

    private fun discountAmount(discount: ServicePlanDiscount, price: BigDecimal) = when (discount.type) {
        ServicePlanDiscountType.PERCENTAGE -> price.multiply(discount.value).divide(BigDecimal(100), 2, RoundingMode.HALF_UP)
        ServicePlanDiscountType.FIXED_AMOUNT -> discount.value
    }

    private fun reconcileExpiredInvoices(organizationId: UUID) {
        val expired = invoices.findAllByOrganizationIdAndStatusAndDueDateBefore(organizationId, InvoiceStatus.PENDING, LocalDate.now())
        expired.forEach { invoice ->
            invoice.status = InvoiceStatus.OVERDUE
            val invoiceEntitlements = entitlements.findAllByInvoiceId(invoice.id)
            invoiceEntitlements.forEach { it.status = EntitlementStatus.EXPIRED }
            capacity.releaseForEntitlements(invoiceEntitlements.map { it.id })
            discountRedemptions.deleteAllByInvoiceId(invoice.id)
            events.publishEvent(InvoiceExpiredEvent(invoice.id))
        }
    }

    private fun requireAvailableDates(organizationId: UUID, childId: UUID, dates: List<LocalDate>) {
        val blockingStatuses = setOf(BookingStatus.PENDING_PAYMENT, BookingStatus.PENDING_APPROVAL, BookingStatus.CONFIRMED, BookingStatus.COMPLETED)
        require(dates.none { bookings.existsByOrganizationIdAndChildIdAndBookingDateAndStatusIn(organizationId, childId, it, blockingStatuses) }) { "One or more dates already have a booking" }
    }

    private fun createBookingsForEntitlement(organizationId: UUID, entitlement: ServiceEntitlement, child: Child, bookingDates: List<LocalDate>, status: BookingStatus): List<BookingResponse> {
        require(entitlement.status == EntitlementStatus.ACTIVE) { "Service entitlement is not active" }
        require(entitlement.planType != ServicePlanType.MONTHLY) { "Monthly plans do not require daily bookings" }
        val dates = bookingDates.distinct().sorted()
        require(dates.isNotEmpty()) { "At least one booking date is required" }
        require(dates.all { !it.isBefore(LocalDate.now()) && !it.isAfter(entitlement.validUntil) }) { "Booking dates are outside the valid service period" }
        require(dates.size <= remainingCredits(entitlement)) { "Booking dates exceed remaining service credits" }
        requireAvailableDates(organizationId, entitlement.childId, dates)
        capacity.requireAvailability(organizationId, child.branchId, entitlement.planId, dates, requireActivePlan = false)
        val created = dates.map { date -> bookings.save(Booking(organizationId = organizationId, branchId = child.branchId, childId = child.id, entitlementId = entitlement.id, invoiceId = entitlement.invoiceId, bookingDate = date, status = status, planName = entitlement.planName)) }
        capacity.reserve(organizationId, child.branchId, entitlement.planId, entitlement.id, dates, created.associate { it.bookingDate to it.id })
        entitlement.reservedCredits += dates.size
        return created.map { bookingResponse(it, child.fullName()) }
    }

    private fun periodEnd(type: ServicePlanType, dates: List<LocalDate>, today: LocalDate) = when (type) { ServicePlanType.DAILY -> dates.single(); ServicePlanType.WEEKLY -> today.plusDays(6); ServicePlanType.MONTHLY -> YearMonth.from(today).atEndOfMonth() }
    private fun deferredPeriodEnd(type: ServicePlanType, today: LocalDate) = when (type) { ServicePlanType.MONTHLY -> YearMonth.from(today).atEndOfMonth(); else -> today.plusDays(6) }
    private fun capacityDates(type: ServicePlanType, dates: List<LocalDate>, today: LocalDate, periodEnd: LocalDate) = if (type == ServicePlanType.MONTHLY) generateSequence(today) { date -> date.plusDays(1).takeIf { !it.isAfter(periodEnd) } }.toList() else dates
    private fun expireIfNeeded(entitlement: ServiceEntitlement) { if (entitlement.status == EntitlementStatus.ACTIVE && entitlement.validUntil.isBefore(LocalDate.now())) entitlement.status = EntitlementStatus.EXPIRED }
    private fun remainingCredits(entitlement: ServiceEntitlement) = (entitlement.totalCredits!! - entitlement.usedCredits - entitlement.reservedCredits).coerceAtLeast(0)
    private fun requirePlan(planId: UUID, organizationId: UUID) = plans.findById(planId).orElseThrow { IllegalArgumentException("Service plan was not found") }.also { require(it.organizationId == organizationId && it.active) { "Service plan is not available" } }
    private fun planResponse(plan: ServicePlan) = ServicePlanResponse(plan.id, plan.name, plan.type, plan.price, plan.creditCount, plan.unusedCreditPolicy, plan.carryForwardDays, plan.bookingRequiresApproval, plan.dailyCapacity)
    private fun branchCapacityResponse(setting: BranchCapacitySetting) = BranchCapacityResponse(setting.branchId, setting.dailyCapacity)
    private fun discountResponse(discount: ServicePlanDiscount) = ServicePlanDiscountResponse(discount.id, discount.servicePlanId, discount.kind, discount.name, discount.promoCode, discount.type, discount.value, discount.startsOn, discount.endsOn, discount.usageLimit, discount.active)
    private fun templateResponse(template: ServicePlanTemplate) = ServicePlanTemplateResponse(template.id.toString(), "TENANT", template.name, template.type, template.suggestedPrice, template.creditCount, template.unusedCreditPolicy, template.carryForwardDays, template.bookingRequiresApproval, template.dailyCapacity)
    private fun templateFromRequest(organizationId: UUID, request: UpsertServicePlanTemplateRequest) = ServicePlanTemplate(organizationId = organizationId, name = request.name.trim(), type = request.type, suggestedPrice = request.suggestedPrice, creditCount = request.creditCount, unusedCreditPolicy = request.unusedCreditPolicy, carryForwardDays = request.carryForwardDays, bookingRequiresApproval = request.bookingRequiresApproval, dailyCapacity = request.dailyCapacity)
    private fun entitlementResponse(entitlement: ServiceEntitlement): EntitlementResponse { val parent = users.findById(entitlement.ownerUserId).orElse(null); return EntitlementResponse(entitlement.id, entitlement.childId, childName(entitlement.childId), parent?.displayName, parent?.email, entitlement.planName, entitlement.planType, entitlement.status, entitlement.totalCredits, entitlement.totalCredits?.let { remainingCredits(entitlement) }, entitlement.validUntil) }
    private fun bookingResponse(booking: Booking, childName: String) = BookingResponse(booking.id, booking.childId, childName, booking.bookingDate, booking.status, booking.planName, booking.invoiceId)
    private fun invoiceResponse(invoice: Invoice, childId: UUID, childName: String): InvoiceResponse { val parent = users.findById(invoice.payerUserId).orElse(null); return InvoiceResponse(invoice.id, invoice.invoiceNumber, childId, childName, parent?.displayName, parent?.email, invoice.subtotalAmount, invoice.discountAmount, invoice.discountName, invoice.discountCode, invoice.totalAmount, invoice.status, invoice.dueDate, invoice.createdAt) }
    private fun requireInvoice(invoiceId: UUID, organizationId: UUID) = invoices.findById(invoiceId).orElseThrow { IllegalArgumentException("Invoice was not found") }.also { require(it.organizationId == organizationId) { "Invoice belongs to a different organization" } }
    private fun childName(childId: UUID) = children.findById(childId).orElseThrow { IllegalArgumentException("Child was not found") }.fullName()
    private fun com.daycare.api.persistence.Child.fullName() = listOfNotNull(firstName, lastName).joinToString(" ")
    private data class AppliedDiscount(val discount: ServicePlanDiscount, val amount: BigDecimal)

    private companion object {
        val systemTemplates = listOf(
            ServicePlanTemplateResponse("SYSTEM_DAILY", "SYSTEM", "Paket Harian", ServicePlanType.DAILY, null, 1, null, null, true, null),
            ServicePlanTemplateResponse("SYSTEM_WEEKLY", "SYSTEM", "Paket Mingguan 5 Hari", ServicePlanType.WEEKLY, null, 5, UnusedCreditPolicy.EXPIRE, null, true, null),
            ServicePlanTemplateResponse("SYSTEM_MONTHLY", "SYSTEM", "Paket Bulanan", ServicePlanType.MONTHLY, null, null, null, null, true, null),
        )
    }
}
