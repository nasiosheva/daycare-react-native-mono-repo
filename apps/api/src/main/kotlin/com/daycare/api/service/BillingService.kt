package com.daycare.api.service

import com.daycare.api.domain.BookingStatus
import com.daycare.api.domain.EntitlementStatus
import com.daycare.api.domain.InvoiceStatus
import com.daycare.api.domain.InstitutionCapability
import com.daycare.api.domain.Role
import com.daycare.api.domain.ServicePlanType
import com.daycare.api.domain.UnusedCreditPolicy
import com.daycare.api.persistence.Booking
import com.daycare.api.persistence.BookingRepository
import com.daycare.api.persistence.ChildRepository
import com.daycare.api.persistence.Invoice
import com.daycare.api.persistence.InvoiceRepository
import com.daycare.api.persistence.ServiceEntitlement
import com.daycare.api.persistence.ServiceEntitlementRepository
import com.daycare.api.persistence.ServicePlan
import com.daycare.api.persistence.ServicePlanRepository
import com.daycare.api.persistence.UserProfileRepository
import jakarta.validation.constraints.DecimalMin
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.NotEmpty
import jakarta.validation.constraints.Size
import org.springframework.security.access.AccessDeniedException
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.math.BigDecimal
import java.time.Instant
import java.time.LocalDate
import java.time.YearMonth
import java.util.UUID

data class CreateServicePlanRequest(@field:NotBlank @field:Size(max = 120) val name: String, val type: ServicePlanType, @field:DecimalMin("1") val price: BigDecimal, val creditCount: Int?, val unusedCreditPolicy: UnusedCreditPolicy?, val carryForwardDays: Int?, val bookingRequiresApproval: Boolean)
data class PurchaseServiceRequest(val planId: UUID, val childId: UUID, val bookingDates: List<LocalDate>)
data class CreateEntitlementBookingsRequest(@field:NotEmpty val bookingDates: List<LocalDate>)
data class BookingApprovalRequest(val approved: Boolean)
data class ServicePlanResponse(val id: UUID, val name: String, val type: ServicePlanType, val price: BigDecimal, val creditCount: Int?, val unusedCreditPolicy: UnusedCreditPolicy?, val carryForwardDays: Int?, val bookingRequiresApproval: Boolean)
data class EntitlementResponse(val id: UUID, val childId: UUID, val childName: String, val parentName: String?, val parentEmail: String?, val planName: String, val type: ServicePlanType, val status: EntitlementStatus, val totalCredits: Int?, val remainingCredits: Int?, val validUntil: LocalDate)
data class BookingResponse(val id: UUID, val childId: UUID, val childName: String, val bookingDate: LocalDate, val status: BookingStatus, val planName: String, val invoiceId: UUID)
data class InvoiceResponse(val id: UUID, val invoiceNumber: String, val childId: UUID, val childName: String, val parentName: String?, val parentEmail: String?, val totalAmount: BigDecimal, val status: InvoiceStatus, val dueDate: LocalDate, val createdAt: Instant)
data class PurchaseServiceResponse(val entitlement: EntitlementResponse, val invoice: InvoiceResponse, val bookings: List<BookingResponse>)

@Service
class BillingService(
    private val access: AccessService,
    private val childScopes: ChildScopeService,
    private val children: ChildRepository,
    private val plans: ServicePlanRepository,
    private val invoices: InvoiceRepository,
    private val entitlements: ServiceEntitlementRepository,
    private val bookings: BookingRepository,
    private val users: UserProfileRepository,
    private val notifications: NotificationService,
) {
    @Transactional
    fun plans(jwt: Jwt, organizationId: UUID): List<ServicePlanResponse> {
        access.require(jwt, organizationId, Role.entries.toSet(), InstitutionCapability.DAYCARE_OPERATIONS)
        return plans.findAllByOrganizationIdAndActiveTrue(organizationId).map(::planResponse)
    }

    @Transactional
    fun createPlan(jwt: Jwt, organizationId: UUID, request: CreateServicePlanRequest): ServicePlanResponse {
        access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN), InstitutionCapability.DAYCARE_OPERATIONS)
        validatePlan(request)
        return planResponse(plans.save(ServicePlan(organizationId = organizationId, name = request.name.trim(), type = request.type, price = request.price, creditCount = request.creditCount, unusedCreditPolicy = request.unusedCreditPolicy, carryForwardDays = request.carryForwardDays, bookingRequiresApproval = request.bookingRequiresApproval)))
    }

    @Transactional
    fun purchase(jwt: Jwt, organizationId: UUID, request: PurchaseServiceRequest): PurchaseServiceResponse {
        val scope = access.require(jwt, organizationId, setOf(Role.PARENT), InstitutionCapability.DAYCARE_OPERATIONS)
        val child = childScopes.requireParentLinkedChild(scope, request.childId, organizationId)
        val plan = plans.findById(request.planId).orElseThrow { IllegalArgumentException("Service plan was not found") }
        require(plan.organizationId == organizationId && plan.active) { "Service plan is not available" }
        val today = LocalDate.now()
        val dates = request.bookingDates.distinct().sorted()
        validatePurchase(plan, dates, today)
        requireAvailableDates(organizationId, child.id, dates)
        val periodEnd = when (plan.type) { ServicePlanType.DAILY -> dates.single(); ServicePlanType.WEEKLY -> today.plusDays(6); ServicePlanType.MONTHLY -> YearMonth.from(today).atEndOfMonth() }
        val validUntil = if (plan.type == ServicePlanType.WEEKLY && plan.unusedCreditPolicy == UnusedCreditPolicy.CARRY_FORWARD) periodEnd.plusDays(plan.carryForwardDays?.toLong() ?: 30) else periodEnd
        val invoice = invoices.save(Invoice(organizationId = organizationId, payerUserId = scope.user.id, invoiceNumber = "INV-${UUID.randomUUID().toString().take(8).uppercase()}", totalAmount = plan.price, dueDate = today.plusDays(2)))
        val entitlement = entitlements.save(ServiceEntitlement(organizationId = organizationId, branchId = child.branchId, childId = child.id, ownerUserId = scope.user.id, planId = plan.id, invoiceId = invoice.id, planName = plan.name, planType = plan.type, totalCredits = plan.creditCount, reservedCredits = dates.size, bookingRequiresApproval = plan.bookingRequiresApproval, periodStart = today, periodEnd = periodEnd, validUntil = validUntil))
        val createdBookings = dates.map { date -> bookings.save(Booking(organizationId = organizationId, branchId = child.branchId, childId = child.id, entitlementId = entitlement.id, invoiceId = invoice.id, bookingDate = date, planName = plan.name)) }
        return PurchaseServiceResponse(entitlementResponse(entitlement), invoiceResponse(invoice, child.id, child.fullName()), createdBookings.map { bookingResponse(it, child.fullName()) })
    }

    @Transactional
    fun createBookingsFromEntitlement(jwt: Jwt, organizationId: UUID, entitlementId: UUID, request: CreateEntitlementBookingsRequest): List<BookingResponse> {
        val scope = access.require(jwt, organizationId, setOf(Role.PARENT), InstitutionCapability.DAYCARE_OPERATIONS)
        val entitlement = entitlements.findById(entitlementId).orElseThrow { IllegalArgumentException("Service entitlement was not found") }
        require(entitlement.organizationId == organizationId && entitlement.ownerUserId == scope.user.id) { "Service entitlement is not available" }
        require(entitlement.status == EntitlementStatus.ACTIVE) { "Service entitlement is not active" }
        require(entitlement.planType != ServicePlanType.MONTHLY) { "Monthly plans do not require daily bookings" }
        val dates = request.bookingDates.distinct().sorted()
        require(dates.isNotEmpty()) { "At least one booking date is required" }
        require(dates.all { !it.isBefore(LocalDate.now()) && !it.isAfter(entitlement.validUntil) }) { "Booking dates are outside the valid service period" }
        require(dates.size <= remainingCredits(entitlement)) { "Booking dates exceed remaining service credits" }
        requireAvailableDates(organizationId, entitlement.childId, dates)
        val child = childScopes.requireParentLinkedChild(scope, entitlement.childId, organizationId)
        return dates.map { date ->
            val booking = bookings.save(Booking(organizationId = organizationId, branchId = child.branchId, childId = child.id, entitlementId = entitlement.id, invoiceId = entitlement.invoiceId, bookingDate = date, status = if (entitlement.bookingRequiresApproval) BookingStatus.PENDING_APPROVAL else BookingStatus.CONFIRMED, planName = entitlement.planName))
            entitlement.reservedCredits += 1
            bookingResponse(booking, child.fullName())
        }
    }

    @Transactional
    fun markInvoicePaid(jwt: Jwt, organizationId: UUID, invoiceId: UUID): InvoiceResponse {
        access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN), InstitutionCapability.DAYCARE_OPERATIONS)
        val invoice = requireInvoice(invoiceId, organizationId)
        require(invoice.status == InvoiceStatus.PENDING) { "Invoice is not awaiting payment" }
        invoice.status = InvoiceStatus.PAID; invoice.paidAt = Instant.now()
        val entitlement = entitlements.findAllByInvoiceId(invoice.id).singleOrNull() ?: throw IllegalArgumentException("Invoice entitlement was not found")
        entitlement.status = if (entitlement.validUntil.isBefore(LocalDate.now())) EntitlementStatus.EXPIRED else EntitlementStatus.ACTIVE
        bookings.findAllByInvoiceId(invoice.id).forEach { booking -> if (booking.status == BookingStatus.PENDING_PAYMENT) booking.status = if (entitlement.bookingRequiresApproval) BookingStatus.PENDING_APPROVAL else BookingStatus.CONFIRMED }
        notifications.notify(organizationId, invoice.payerUserId, "Pembayaran diterima", "Tagihan ${invoice.invoiceNumber} telah dikonfirmasi.")
        return invoiceResponse(invoice, entitlement.childId, childName(entitlement.childId))
    }

    @Transactional
    fun approveBooking(jwt: Jwt, organizationId: UUID, bookingId: UUID, request: BookingApprovalRequest): BookingResponse {
        val scope = access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN, Role.STAFF), InstitutionCapability.DAYCARE_OPERATIONS)
        val booking = bookings.findById(bookingId).orElseThrow { IllegalArgumentException("Booking was not found") }
        require(booking.organizationId == organizationId && booking.status == BookingStatus.PENDING_APPROVAL) { "Booking cannot be approved" }
        childScopes.requireStaffManagedChild(scope, booking.childId, organizationId)
        booking.status = if (request.approved) BookingStatus.CONFIRMED else BookingStatus.REJECTED
        if (!request.approved) entitlements.findById(booking.entitlementId).ifPresent { entitlement -> entitlement.reservedCredits = (entitlement.reservedCredits - 1).coerceAtLeast(0) }
        val entitlement = entitlements.findById(booking.entitlementId).orElseThrow()
        notifications.notify(organizationId, entitlement.ownerUserId, "Booking ${if (request.approved) "disetujui" else "ditolak"}", "Booking ${childName(booking.childId)} pada ${booking.bookingDate} ${if (request.approved) "disetujui" else "ditolak"}.")
        return bookingResponse(booking, childName(booking.childId))
    }

    @Transactional
    fun entitlements(jwt: Jwt, organizationId: UUID): List<EntitlementResponse> {
        val scope = access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN, Role.PARENT), InstitutionCapability.DAYCARE_OPERATIONS)
        val source = if (scope.membership.role == Role.STAFF_ADMIN) entitlements.findAllByOrganizationId(organizationId) else entitlements.findAllByOrganizationIdAndOwnerUserId(organizationId, scope.user.id)
        return source.onEach(::expireIfNeeded).sortedByDescending { it.validUntil }.map(::entitlementResponse)
    }

    @Transactional
    fun bookings(jwt: Jwt, organizationId: UUID, pendingOnly: Boolean): List<BookingResponse> {
        val scope = access.require(jwt, organizationId, if (pendingOnly) setOf(Role.STAFF_ADMIN, Role.STAFF) else setOf(Role.STAFF_ADMIN, Role.STAFF, Role.PARENT), InstitutionCapability.DAYCARE_OPERATIONS)
        val source = if (pendingOnly) bookings.findAllByOrganizationIdAndStatusOrderByBookingDateAsc(organizationId, BookingStatus.PENDING_APPROVAL) else bookings.findAllByOrganizationIdOrderByBookingDateDesc(organizationId)
        return source.filter { booking ->
            if (scope.membership.role == Role.PARENT) entitlements.findById(booking.entitlementId).map { it.ownerUserId == scope.user.id }.orElse(false)
            else scope.membership.role == Role.STAFF_ADMIN || scope.membership.branchId == null || scope.membership.branchId == booking.branchId
        }.map { bookingResponse(it, childName(it.childId)) }
    }

    @Transactional
    fun invoices(jwt: Jwt, organizationId: UUID): List<InvoiceResponse> {
        val scope = access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN, Role.PARENT), InstitutionCapability.DAYCARE_OPERATIONS)
        val source = if (scope.membership.role == Role.STAFF_ADMIN) invoices.findAllByOrganizationIdOrderByCreatedAtDesc(organizationId) else invoices.findAllByOrganizationIdAndPayerUserIdOrderByCreatedAtDesc(organizationId, scope.user.id)
        return source.map { invoice ->
            val entitlement = entitlements.findAllByInvoiceId(invoice.id).singleOrNull() ?: throw IllegalArgumentException("Invoice entitlement was not found")
            invoiceResponse(invoice, entitlement.childId, childName(entitlement.childId))
        }
    }

    private fun validatePlan(request: CreateServicePlanRequest) {
        require(request.price > BigDecimal.ZERO) { "Price must be positive" }
        if (request.type == ServicePlanType.MONTHLY) require(request.creditCount == null) { "Monthly plans do not use credits" }
        else require((request.creditCount ?: 0) > 0) { "Daily and weekly plans require credits" }
        if (request.type == ServicePlanType.DAILY) require(request.creditCount == 1) { "Daily plans require exactly one credit" }
        if (request.type == ServicePlanType.WEEKLY && request.unusedCreditPolicy == UnusedCreditPolicy.CARRY_FORWARD) require((request.carryForwardDays ?: 0) > 0) { "Carry-forward plans require a valid carry-forward period" }
    }
    private fun validatePurchase(plan: ServicePlan, dates: List<LocalDate>, today: LocalDate) {
        when (plan.type) {
            ServicePlanType.MONTHLY -> require(dates.isEmpty()) { "Monthly plans do not require daily bookings" }
            ServicePlanType.DAILY -> require(dates.size == 1) { "Daily plans require one booking date" }
            ServicePlanType.WEEKLY -> require(dates.isNotEmpty() && dates.size <= (plan.creditCount ?: 0)) { "Booking dates exceed available weekly credits" }
        }
        require(dates.all { !it.isBefore(today) }) { "Bookings cannot be in the past" }
        if (plan.type == ServicePlanType.WEEKLY) require(dates.all { !it.isAfter(today.plusDays(6)) }) { "Weekly booking dates must be within seven days" }
    }
    private fun requireAvailableDates(organizationId: UUID, childId: UUID, dates: List<LocalDate>) {
        val blockingStatuses = setOf(BookingStatus.PENDING_PAYMENT, BookingStatus.PENDING_APPROVAL, BookingStatus.CONFIRMED, BookingStatus.COMPLETED)
        require(dates.none { bookings.existsByOrganizationIdAndChildIdAndBookingDateAndStatusIn(organizationId, childId, it, blockingStatuses) }) { "One or more dates already have a booking" }
    }
    private fun expireIfNeeded(entitlement: ServiceEntitlement) { if (entitlement.status == EntitlementStatus.ACTIVE && entitlement.validUntil.isBefore(LocalDate.now())) entitlement.status = EntitlementStatus.EXPIRED }
    private fun planResponse(plan: ServicePlan) = ServicePlanResponse(plan.id, plan.name, plan.type, plan.price, plan.creditCount, plan.unusedCreditPolicy, plan.carryForwardDays, plan.bookingRequiresApproval)
    private fun entitlementResponse(entitlement: ServiceEntitlement): EntitlementResponse {
        val parent = users.findById(entitlement.ownerUserId).orElse(null)
        return EntitlementResponse(entitlement.id, entitlement.childId, childName(entitlement.childId), parent?.displayName, parent?.email, entitlement.planName, entitlement.planType, entitlement.status, entitlement.totalCredits, entitlement.totalCredits?.let { remainingCredits(entitlement) }, entitlement.validUntil)
    }
    private fun remainingCredits(entitlement: ServiceEntitlement) = (entitlement.totalCredits!! - entitlement.usedCredits - entitlement.reservedCredits).coerceAtLeast(0)
    private fun bookingResponse(booking: Booking, childName: String) = BookingResponse(booking.id, booking.childId, childName, booking.bookingDate, booking.status, booking.planName, booking.invoiceId)
    private fun invoiceResponse(invoice: Invoice, childId: UUID, childName: String): InvoiceResponse {
        val parent = users.findById(invoice.payerUserId).orElse(null)
        return InvoiceResponse(invoice.id, invoice.invoiceNumber, childId, childName, parent?.displayName, parent?.email, invoice.totalAmount, invoice.status, invoice.dueDate, invoice.createdAt)
    }
    private fun requireInvoice(invoiceId: UUID, organizationId: UUID) = invoices.findById(invoiceId).orElseThrow { IllegalArgumentException("Invoice was not found") }.also { require(it.organizationId == organizationId) { "Invoice belongs to a different organization" } }
    private fun childName(childId: UUID) = children.findById(childId).orElseThrow { IllegalArgumentException("Child was not found") }.fullName()
    private fun com.daycare.api.persistence.Child.fullName() = listOfNotNull(firstName, lastName).joinToString(" ")
}
