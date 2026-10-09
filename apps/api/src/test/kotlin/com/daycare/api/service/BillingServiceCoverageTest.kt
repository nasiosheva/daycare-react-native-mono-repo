package com.daycare.api.service

import com.daycare.api.domain.EntitlementStatus
import com.daycare.api.domain.BookingStatus
import com.daycare.api.domain.InstitutionCapability
import com.daycare.api.domain.InvoiceStatus
import com.daycare.api.domain.Role
import com.daycare.api.domain.ServicePlanDiscountKind
import com.daycare.api.domain.ServicePlanDiscountType
import com.daycare.api.domain.ServicePlanType
import com.daycare.api.domain.UnusedCreditPolicy
import com.daycare.api.persistence.AuditLogRepository
import com.daycare.api.persistence.BookingRepository
import com.daycare.api.persistence.Booking
import com.daycare.api.persistence.BranchRepository
import com.daycare.api.persistence.Child
import com.daycare.api.persistence.ChildRepository
import com.daycare.api.persistence.Invoice
import com.daycare.api.persistence.InvoiceRepository
import com.daycare.api.persistence.Membership
import com.daycare.api.persistence.MembershipRepository
import com.daycare.api.persistence.ParentEnrollmentRepository
import com.daycare.api.persistence.PaymentProof
import com.daycare.api.persistence.PaymentProofRepository
import com.daycare.api.persistence.BranchCapacitySetting
import com.daycare.api.persistence.ServiceEntitlementRepository
import com.daycare.api.persistence.ServiceEntitlement
import com.daycare.api.persistence.ServicePlan
import com.daycare.api.persistence.ServicePlanDiscount
import com.daycare.api.persistence.ServicePlanDiscountRedemptionRepository
import com.daycare.api.persistence.ServicePlanDiscountRepository
import com.daycare.api.persistence.ServicePlanRepository
import com.daycare.api.persistence.ServicePlanTemplateRepository
import com.daycare.api.persistence.UserProfile
import com.daycare.api.persistence.UserProfileRepository
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Test
import org.mockito.Mockito.any
import org.mockito.Mockito.mock
import org.mockito.Mockito.verify
import org.mockito.Mockito.`when`
import org.springframework.context.ApplicationEventPublisher
import org.springframework.security.oauth2.jwt.Jwt
import java.math.BigDecimal
import java.time.LocalDate
import java.time.YearMonth
import java.util.Optional
import java.util.UUID

class BillingServiceCoverageTest {
    @Test
    fun `catalog capacity and tenant templates expose empty and system variants`() {
        val f = fixture()
        val branch = com.daycare.api.persistence.Branch(organizationId = f.organizationId, name = "Cabang")
        `when`(f.capacity.branchSettings(f.organizationId)).thenReturn(emptyList())
        `when`(f.branches.findAllByOrganizationIdAndActiveTrueOrderByNameAsc(f.organizationId)).thenReturn(listOf(branch))
        assertEquals(null, f.service.branchCapacities(f.jwt, f.organizationId).single().dailyCapacity)
        assertEquals(null, f.service.branchCapacityForCatalog(f.organizationId, branch.id))

        val tenantTemplate = com.daycare.api.persistence.ServicePlanTemplate(organizationId = f.organizationId, name = "Tenant")
        `when`(f.templates.findAllByOrganizationIdOrderByNameAsc(f.organizationId)).thenReturn(listOf(tenantTemplate))
        val templates = f.service.planTemplates(f.jwt, f.organizationId)
        assertEquals(4, templates.size)
        assertTrue(templates.any { it.source == "SYSTEM" })
        assertTrue(templates.any { it.name == "Tenant" })
    }

    @Test
    fun `approved enrollment creates weekly carry forward entitlement`() {
        val f = fixture()
        val today = LocalDate.now()
        val invoice = Invoice(id = f.invoiceId, organizationId = f.organizationId, payerUserId = f.parent.id, invoiceNumber = "INV-ENROLL", subtotalAmount = BigDecimal("500"), discountAmount = BigDecimal("50"), totalAmount = BigDecimal("450"), branchId = f.child.branchId, childId = f.child.id)
        val entitlement = ServiceEntitlement(id = UUID.randomUUID(), organizationId = f.organizationId, branchId = f.child.branchId, childId = f.child.id, ownerUserId = f.parent.id, planId = f.planId, invoiceId = invoice.id, planName = "Mingguan", planType = ServicePlanType.WEEKLY, totalCredits = 5, bookingRequiresApproval = true, periodStart = today, periodEnd = today.plusDays(6), validUntil = today.plusDays(20))
        `when`(f.invoices.findAllByOrganizationIdAndStatusInAndDueDateBefore(f.organizationId, setOf(InvoiceStatus.PENDING, InvoiceStatus.PAYMENT_SUBMITTED), today)).thenReturn(emptyList())
        `when`(f.invoices.save(any(Invoice::class.java))).thenReturn(invoice)
        `when`(f.entitlements.save(any(ServiceEntitlement::class.java))).thenReturn(entitlement)
        `when`(f.entitlements.findAllByInvoiceId(invoice.id)).thenReturn(listOf(entitlement))
        `when`(f.users.findById(f.parent.id)).thenReturn(Optional.of(f.parent))
        `when`(f.paymentProofs.findByInvoiceId(invoice.id)).thenReturn(null)
        val result = f.service.purchaseApprovedEnrollment(
            f.parent,
            f.organizationId,
            f.child,
            EnrollmentPlanSnapshot(f.planId, "Mingguan", ServicePlanType.WEEKLY, BigDecimal("500"), BigDecimal("50"), "Promo", "HEMAT", BigDecimal("450"), 5, UnusedCreditPolicy.CARRY_FORWARD, 14, true),
        )
        assertEquals(5, result.entitlement.totalCredits)
        assertEquals(today.plusDays(20), result.entitlement.validUntil)
        assertTrue(result.bookings.isEmpty())
    }

    @Test
    fun `create entitlement bookings reserves dates and selects approval status`() {
        val f = fixture()
        val today = LocalDate.now()
        val invoice = Invoice(id = f.invoiceId, organizationId = f.organizationId, payerUserId = f.parent.id, invoiceNumber = "INV-BOOK", totalAmount = BigDecimal("100"), branchId = f.child.branchId, childId = f.child.id)
        val entitlement = ServiceEntitlement(id = UUID.randomUUID(), organizationId = f.organizationId, branchId = f.child.branchId, childId = f.child.id, ownerUserId = f.parent.id, planId = f.planId, invoiceId = invoice.id, planName = "Harian", planType = ServicePlanType.DAILY, status = EntitlementStatus.ACTIVE, totalCredits = 2, bookingRequiresApproval = true, validUntil = today.plusDays(2))
        val booking = Booking(organizationId = f.organizationId, branchId = f.child.branchId, childId = f.child.id, entitlementId = entitlement.id, invoiceId = invoice.id, bookingDate = today, status = BookingStatus.PENDING_APPROVAL, planName = entitlement.planName)
        `when`(f.entitlements.findById(entitlement.id)).thenReturn(Optional.of(entitlement))
        `when`(f.childScopes.requireParentLinkedChild(f.parentScope, entitlement.childId, f.organizationId)).thenReturn(f.child)
        `when`(f.bookings.existsByOrganizationIdAndChildIdAndBookingDateAndStatusIn(f.organizationId, f.child.id, today, setOf(BookingStatus.PENDING_PAYMENT, BookingStatus.PENDING_APPROVAL, BookingStatus.CONFIRMED, BookingStatus.COMPLETED))).thenReturn(false)
        `when`(f.capacity.requireAvailability(f.organizationId, f.child.branchId, f.planId, listOf(today), false)).thenReturn(ServicePlan(id = f.planId, organizationId = f.organizationId, name = "Harian", type = ServicePlanType.DAILY, price = BigDecimal("100"), creditCount = 1))
        `when`(f.bookings.save(any(Booking::class.java))).thenReturn(booking)
        `when`(f.invoices.findById(invoice.id)).thenReturn(Optional.of(invoice))
        val result = f.service.createBookingsFromEntitlement(f.jwt, f.organizationId, entitlement.id, CreateEntitlementBookingsRequest(listOf(today, today)))
        assertEquals(1, result.size)
        assertEquals(BookingStatus.PENDING_APPROVAL, result.single().status)
        assertEquals(1, entitlement.reservedCredits)
        verify(f.capacity).reserve(f.organizationId, f.child.branchId, f.planId, entitlement.id, listOf(today), mapOf(today to booking.id))
    }

    @Test
    fun `reviewing payment proof approves or rejects with the correct state`() {
        val approved = fixture()
        val invoice = Invoice(id = approved.invoiceId, organizationId = approved.organizationId, payerUserId = approved.parent.id, invoiceNumber = "INV-REVIEW", subtotalAmount = BigDecimal("100"), totalAmount = BigDecimal("100"), branchId = approved.child.branchId, childId = approved.child.id, status = InvoiceStatus.PAYMENT_SUBMITTED)
        val entitlement = ServiceEntitlement(organizationId = approved.organizationId, branchId = approved.child.branchId, childId = approved.child.id, ownerUserId = approved.parent.id, invoiceId = invoice.id, planName = "Harian", planType = ServicePlanType.DAILY, status = EntitlementStatus.PENDING_PAYMENT, totalCredits = 1, validUntil = LocalDate.now().plusDays(1))
        val booking = Booking(organizationId = approved.organizationId, branchId = approved.child.branchId, childId = approved.child.id, entitlementId = entitlement.id, invoiceId = invoice.id, planName = entitlement.planName, status = BookingStatus.PENDING_PAYMENT)
        val proof = PaymentProof(invoiceId = invoice.id, imageData = byteArrayOf(1), fileName = "proof.png", contentType = "image/png")
        stubInvoiceGraph(approved, invoice, entitlement, proof, booking)
        val result = approved.service.reviewPaymentProof(approved.jwt, approved.organizationId, invoice.id, ReviewPaymentProofRequest(approved = true))
        assertEquals(InvoiceStatus.PAID, result.status)
        assertEquals(com.daycare.api.domain.PaymentProofStatus.VERIFIED, proof.status)
        assertEquals(EntitlementStatus.ACTIVE, entitlement.status)
        assertEquals(BookingStatus.PENDING_APPROVAL, booking.status)

        val rejected = fixture()
        val rejectedInvoice = Invoice(id = rejected.invoiceId, organizationId = rejected.organizationId, payerUserId = rejected.parent.id, invoiceNumber = "INV-REJECT", subtotalAmount = BigDecimal("100"), totalAmount = BigDecimal("100"), branchId = rejected.child.branchId, childId = rejected.child.id, status = InvoiceStatus.PAYMENT_SUBMITTED)
        val rejectedProof = PaymentProof(invoiceId = rejectedInvoice.id, imageData = byteArrayOf(1))
        stubInvoiceGraph(rejected, rejectedInvoice, null, rejectedProof, null)
        val rejectedResult = rejected.service.reviewPaymentProof(rejected.jwt, rejected.organizationId, rejectedInvoice.id, ReviewPaymentProofRequest(approved = false, rejectionReason = " Foto buram "))
        assertEquals(InvoiceStatus.PENDING, rejectedResult.status)
        assertEquals(com.daycare.api.domain.PaymentProofStatus.REJECTED, rejectedProof.status)
        assertEquals("Foto buram", rejectedProof.rejectionReason)
    }

    @Test
    fun `invoice and payment proof are readable by parent and staff admin`() {
        val f = fixture()
        val invoice = Invoice(id = f.invoiceId, organizationId = f.organizationId, payerUserId = f.parent.id, invoiceNumber = "INV-VIEW", subtotalAmount = BigDecimal("100"), totalAmount = BigDecimal("100"), branchId = f.child.branchId, childId = f.child.id)
        val proof = PaymentProof(invoiceId = invoice.id, fileName = "proof.jpg", contentType = "image/jpeg", imageData = byteArrayOf(0xFF.toByte(), 0xD8.toByte(), 0xFF.toByte()), note = "ok")
        stubInvoiceGraph(f, invoice, null, proof, null)
        `when`(f.identity.sync(f.jwt)).thenReturn(f.parent)
        assertEquals("proof.jpg", f.service.paymentProof(f.jwt, f.organizationId, invoice.id).fileName)
        assertEquals("/9j/", f.service.paymentProof(f.jwt, f.organizationId, invoice.id).dataBase64)
        assertEquals(invoice.id, f.service.invoice(f.jwt, f.organizationId, invoice.id).id)
        `when`(f.identity.sync(f.jwt)).thenReturn(f.staff)
        assertEquals(invoice.id, f.service.invoice(f.jwt, f.organizationId, invoice.id).id)
        assertEquals("proof.jpg", f.service.paymentProof(f.jwt, f.organizationId, invoice.id).fileName)
    }

    @Test
    fun `pending enrollment purchase can be cancelled and releases capacity`() {
        val f = fixture()
        val invoice = Invoice(id = f.invoiceId, organizationId = f.organizationId, payerUserId = f.parent.id, invoiceNumber = "INV-CANCEL", status = InvoiceStatus.PENDING)
        val entitlement = ServiceEntitlement(id = UUID.randomUUID(), organizationId = f.organizationId, invoiceId = invoice.id, status = EntitlementStatus.PENDING_PAYMENT)
        `when`(f.invoices.findById(invoice.id)).thenReturn(Optional.of(invoice))
        `when`(f.entitlements.findById(entitlement.id)).thenReturn(Optional.of(entitlement))
        f.service.cancelPendingEnrollmentPurchase(invoice.id, entitlement.id)
        assertEquals(InvoiceStatus.VOID, invoice.status)
        assertEquals(EntitlementStatus.EXPIRED, entitlement.status)
        verify(f.capacity).releaseForEntitlements(listOf(entitlement.id))
        verify(f.discountRedemptions).deleteAllByInvoiceId(invoice.id)
    }

    @Test
    fun `entitlements list is scoped by role branch and expires stale active records`() {
        val f = fixture()
        val expired = ServiceEntitlement(id = UUID.randomUUID(), organizationId = f.organizationId, branchId = f.child.branchId, childId = f.child.id, ownerUserId = f.parent.id, invoiceId = f.invoiceId, planName = "Lama", planType = ServicePlanType.DAILY, status = EntitlementStatus.ACTIVE, totalCredits = 2, usedCredits = 1, validUntil = LocalDate.now().minusDays(1))
        val pending = ServiceEntitlement(id = UUID.randomUUID(), organizationId = f.organizationId, branchId = UUID.randomUUID(), childId = f.child.id, ownerUserId = f.parent.id, invoiceId = UUID.randomUUID(), planName = "Baru", planType = ServicePlanType.MONTHLY, status = EntitlementStatus.PENDING_PAYMENT, validUntil = LocalDate.now().plusDays(10))
        `when`(f.invoices.findAllByOrganizationIdAndStatusInAndDueDateBefore(f.organizationId, setOf(InvoiceStatus.PENDING, InvoiceStatus.PAYMENT_SUBMITTED), LocalDate.now())).thenReturn(emptyList())
        `when`(f.entitlements.findAllByOrganizationId(f.organizationId)).thenReturn(listOf(expired, pending))
        `when`(f.users.findById(f.parent.id)).thenReturn(Optional.of(f.parent))
        val all = f.service.entitlements(f.jwt, f.organizationId, BranchListFilter())
        assertEquals(2, all.size)
        assertEquals(EntitlementStatus.EXPIRED, expired.status)
        assertEquals(1, f.service.entitlements(f.jwt, f.organizationId, BranchListFilter(branchId = expired.branchId)).size)

        val parentFixture = fixture()
        val parentExpired = ServiceEntitlement(id = UUID.randomUUID(), organizationId = parentFixture.organizationId, branchId = parentFixture.child.branchId, childId = parentFixture.child.id, ownerUserId = parentFixture.parent.id, invoiceId = parentFixture.invoiceId, planName = "Lama", planType = ServicePlanType.DAILY, status = EntitlementStatus.ACTIVE, totalCredits = 1, validUntil = LocalDate.now().minusDays(1))
        `when`(parentFixture.access.require(parentFixture.jwt, parentFixture.organizationId, setOf(Role.STAFF_ADMIN, Role.PARENT), InstitutionCapability.DAYCARE_OPERATIONS, true)).thenReturn(parentFixture.parentScope)
        `when`(parentFixture.invoices.findAllByOrganizationIdAndStatusInAndDueDateBefore(parentFixture.organizationId, setOf(InvoiceStatus.PENDING, InvoiceStatus.PAYMENT_SUBMITTED), LocalDate.now())).thenReturn(emptyList())
        `when`(parentFixture.entitlements.findAllByOrganizationIdAndOwnerUserId(parentFixture.organizationId, parentFixture.parent.id)).thenReturn(listOf(parentExpired))
        `when`(parentFixture.users.findById(parentFixture.parent.id)).thenReturn(Optional.of(parentFixture.parent))
        assertEquals(1, parentFixture.service.entitlements(parentFixture.jwt, parentFixture.organizationId).size)
    }

    @Test
    fun `bookings list applies pending filtering ownership scope and search`() {
        val f = fixture()
        val invoice = Invoice(id = f.invoiceId, organizationId = f.organizationId, payerUserId = f.parent.id, invoiceNumber = "INV-BOOK-LIST", totalAmount = BigDecimal("100"), branchId = f.child.branchId, childId = f.child.id)
        val entitlement = ServiceEntitlement(id = UUID.randomUUID(), organizationId = f.organizationId, branchId = f.child.branchId, childId = f.child.id, ownerUserId = f.parent.id, invoiceId = invoice.id, planName = "Paket Ayu", planType = ServicePlanType.DAILY, status = EntitlementStatus.ACTIVE, totalCredits = 1, validUntil = LocalDate.now().plusDays(1))
        val pending = Booking(organizationId = f.organizationId, branchId = f.child.branchId, childId = f.child.id, entitlementId = entitlement.id, invoiceId = invoice.id, bookingDate = LocalDate.now(), status = BookingStatus.PENDING_APPROVAL, planName = entitlement.planName)
        val confirmed = Booking(organizationId = f.organizationId, branchId = f.child.branchId, childId = f.child.id, entitlementId = entitlement.id, invoiceId = invoice.id, bookingDate = LocalDate.now(), status = BookingStatus.CONFIRMED, planName = entitlement.planName)
        `when`(f.invoices.findAllByOrganizationIdAndStatusInAndDueDateBefore(f.organizationId, setOf(InvoiceStatus.PENDING, InvoiceStatus.PAYMENT_SUBMITTED), LocalDate.now())).thenReturn(emptyList())
        `when`(f.access.require(f.jwt, f.organizationId, setOf(Role.STAFF_ADMIN, Role.STAFF), InstitutionCapability.DAYCARE_OPERATIONS, true)).thenReturn(f.adminScope)
        `when`(f.bookings.findAllByOrganizationIdAndStatusOrderByBookingDateAsc(f.organizationId, BookingStatus.PENDING_APPROVAL)).thenReturn(listOf(pending))
        `when`(f.parentEnrollments.findByInvoiceId(invoice.id)).thenReturn(null)
        `when`(f.childScopes.isStaffManagedChild(f.adminScope, f.child.id, f.organizationId)).thenReturn(true)
        `when`(f.invoices.findAllById(setOf(invoice.id))).thenReturn(listOf(invoice))
        val pendingResult = f.service.bookings(f.jwt, f.organizationId, pendingOnly = true, search = "ayu")
        assertEquals(1, pendingResult.size)

        val parentFixture = fixture()
        val parentInvoice = Invoice(id = parentFixture.invoiceId, organizationId = parentFixture.organizationId, payerUserId = parentFixture.parent.id, invoiceNumber = "INV-BOOK-PARENT", totalAmount = BigDecimal("100"), branchId = parentFixture.child.branchId, childId = parentFixture.child.id)
        val parentEntitlement = ServiceEntitlement(id = UUID.randomUUID(), organizationId = parentFixture.organizationId, branchId = parentFixture.child.branchId, childId = parentFixture.child.id, ownerUserId = parentFixture.parent.id, invoiceId = parentInvoice.id, planName = "Paket Ayu", planType = ServicePlanType.DAILY, status = EntitlementStatus.ACTIVE, totalCredits = 1, validUntil = LocalDate.now().plusDays(1))
        val parentConfirmed = Booking(organizationId = parentFixture.organizationId, branchId = parentFixture.child.branchId, childId = parentFixture.child.id, entitlementId = parentEntitlement.id, invoiceId = parentInvoice.id, bookingDate = LocalDate.now(), status = BookingStatus.CONFIRMED, planName = parentEntitlement.planName)
        `when`(parentFixture.access.require(parentFixture.jwt, parentFixture.organizationId, setOf(Role.STAFF_ADMIN, Role.STAFF, Role.PARENT), InstitutionCapability.DAYCARE_OPERATIONS, true)).thenReturn(parentFixture.parentScope)
        `when`(parentFixture.bookings.findAllByOrganizationIdOrderByBookingDateDesc(parentFixture.organizationId)).thenReturn(listOf(parentConfirmed))
        `when`(parentFixture.entitlements.findById(parentEntitlement.id)).thenReturn(Optional.of(parentEntitlement))
        `when`(parentFixture.invoices.findAllById(setOf(parentInvoice.id))).thenReturn(listOf(parentInvoice))
        `when`(parentFixture.children.findById(parentFixture.child.id)).thenReturn(Optional.of(parentFixture.child))
        assertEquals(1, parentFixture.service.bookings(parentFixture.jwt, parentFixture.organizationId, pendingOnly = false, search = "Paket" ).size)
    }

    @Test
    fun `invoices list scopes payer and supports branch and text filters`() {
        val f = fixture()
        val invoice = Invoice(id = f.invoiceId, organizationId = f.organizationId, payerUserId = f.parent.id, invoiceNumber = "INV-SEARCH", subtotalAmount = BigDecimal("100"), totalAmount = BigDecimal("100"), branchId = f.child.branchId, childId = f.child.id)
        `when`(f.invoices.findAllByOrganizationIdAndStatusInAndDueDateBefore(f.organizationId, setOf(InvoiceStatus.PENDING, InvoiceStatus.PAYMENT_SUBMITTED), LocalDate.now())).thenReturn(emptyList())
        `when`(f.invoices.findAllByOrganizationIdOrderByCreatedAtDesc(f.organizationId)).thenReturn(listOf(invoice))
        `when`(f.entitlements.findAllByInvoiceId(invoice.id)).thenReturn(emptyList())
        `when`(f.users.findById(f.parent.id)).thenReturn(Optional.of(f.parent))
        `when`(f.paymentProofs.findByInvoiceId(invoice.id)).thenReturn(null)
        `when`(f.children.findById(f.child.id)).thenReturn(Optional.of(f.child))
        val staffResult = f.service.invoices(f.jwt, f.organizationId, BranchListFilter(branchId = UUID.randomUUID()), search = "tidak-ada")
        assertTrue(staffResult.isEmpty())

        val parentFixture = fixture()
        `when`(parentFixture.access.require(parentFixture.jwt, parentFixture.organizationId, setOf(Role.STAFF_ADMIN, Role.PARENT), readOnly = true, allowSubscriptionRestrictedForRoles = setOf(Role.PARENT), allowInactiveRoles = setOf(Role.PARENT))).thenReturn(parentFixture.parentScope)
        `when`(parentFixture.invoices.findAllByOrganizationIdAndStatusInAndDueDateBefore(parentFixture.organizationId, setOf(InvoiceStatus.PENDING, InvoiceStatus.PAYMENT_SUBMITTED), LocalDate.now())).thenReturn(emptyList())
        val parentInvoice = Invoice(id = parentFixture.invoiceId, organizationId = parentFixture.organizationId, payerUserId = parentFixture.parent.id, invoiceNumber = "INV-PARENT", subtotalAmount = BigDecimal("100"), totalAmount = BigDecimal("100"), branchId = parentFixture.child.branchId, childId = parentFixture.child.id)
        `when`(parentFixture.invoices.findAllByOrganizationIdAndPayerUserIdOrderByCreatedAtDesc(parentFixture.organizationId, parentFixture.parent.id)).thenReturn(listOf(parentInvoice))
        `when`(parentFixture.entitlements.findAllByInvoiceId(parentInvoice.id)).thenReturn(emptyList())
        `when`(parentFixture.users.findById(parentFixture.parent.id)).thenReturn(Optional.of(parentFixture.parent))
        `when`(parentFixture.paymentProofs.findByInvoiceId(parentInvoice.id)).thenReturn(null)
        `when`(parentFixture.children.findById(parentFixture.child.id)).thenReturn(Optional.of(parentFixture.child))
        assertEquals(1, parentFixture.service.invoices(parentFixture.jwt, parentFixture.organizationId, search = "parent").size)
    }

    @Test
    fun `monthly purchase reserves the whole period while weekly purchase creates dated bookings`() {
        val monthly = fixture()
        val today = LocalDate.now()
        val monthlyPlan = ServicePlan(id = monthly.planId, organizationId = monthly.organizationId, name = "Bulanan", type = ServicePlanType.MONTHLY, price = BigDecimal("300"))
        val monthlyInvoice = Invoice(id = monthly.invoiceId, organizationId = monthly.organizationId, payerUserId = monthly.parent.id, invoiceNumber = "INV-MONTH", subtotalAmount = BigDecimal("300"), totalAmount = BigDecimal("300"), branchId = monthly.child.branchId, childId = monthly.child.id)
        val monthlyEntitlement = ServiceEntitlement(id = UUID.randomUUID(), organizationId = monthly.organizationId, branchId = monthly.child.branchId, childId = monthly.child.id, ownerUserId = monthly.parent.id, planId = monthlyPlan.id, invoiceId = monthlyInvoice.id, planName = monthlyPlan.name, planType = monthlyPlan.type, totalCredits = null, periodStart = today, periodEnd = YearMonth.from(today).atEndOfMonth(), validUntil = YearMonth.from(today).atEndOfMonth())
        val monthDates = generateSequence(today) { date -> date.plusDays(1).takeIf { !it.isAfter(monthlyEntitlement.periodEnd) } }.toList()
        `when`(monthly.plans.findById(monthlyPlan.id)).thenReturn(Optional.of(monthlyPlan))
        `when`(monthly.capacity.requireAvailability(monthly.organizationId, monthly.child.branchId, monthlyPlan.id, monthDates)).thenReturn(monthlyPlan)
        `when`(monthly.invoices.save(any(Invoice::class.java))).thenReturn(monthlyInvoice)
        `when`(monthly.entitlements.save(any(ServiceEntitlement::class.java))).thenReturn(monthlyEntitlement)
        stubInvoiceGraph(monthly, monthlyInvoice, monthlyEntitlement, null, null)
        val monthlyResult = monthly.service.purchase(monthly.jwt, monthly.organizationId, PurchaseServiceRequest(monthlyPlan.id, monthly.child.id, emptyList()))
        assertEquals(ServicePlanType.MONTHLY, monthlyResult.entitlement.type)
        assertTrue(monthlyResult.bookings.isEmpty())

        val weekly = fixture()
        val weeklyPlan = ServicePlan(id = weekly.planId, organizationId = weekly.organizationId, name = "Mingguan", type = ServicePlanType.WEEKLY, price = BigDecimal("200"), creditCount = 2, unusedCreditPolicy = UnusedCreditPolicy.EXPIRE, bookingRequiresApproval = false)
        val dates = listOf(today, today.plusDays(1))
        val weeklyInvoice = Invoice(id = weekly.invoiceId, organizationId = weekly.organizationId, payerUserId = weekly.parent.id, invoiceNumber = "INV-WEEK", subtotalAmount = BigDecimal("200"), totalAmount = BigDecimal("200"), branchId = weekly.child.branchId, childId = weekly.child.id)
        val weeklyEntitlement = ServiceEntitlement(id = UUID.randomUUID(), organizationId = weekly.organizationId, branchId = weekly.child.branchId, childId = weekly.child.id, ownerUserId = weekly.parent.id, planId = weeklyPlan.id, invoiceId = weeklyInvoice.id, planName = weeklyPlan.name, planType = weeklyPlan.type, totalCredits = 2, reservedCredits = 2, periodStart = today, periodEnd = today.plusDays(6), validUntil = today.plusDays(6))
        val bookings = dates.map { Booking(organizationId = weekly.organizationId, branchId = weekly.child.branchId, childId = weekly.child.id, entitlementId = weeklyEntitlement.id, invoiceId = weeklyInvoice.id, bookingDate = it, planName = weeklyPlan.name, status = BookingStatus.PENDING_PAYMENT) }
        `when`(weekly.plans.findById(weeklyPlan.id)).thenReturn(Optional.of(weeklyPlan))
        dates.forEach { date -> `when`(weekly.bookings.existsByOrganizationIdAndChildIdAndBookingDateAndStatusIn(weekly.organizationId, weekly.child.id, date, setOf(BookingStatus.PENDING_PAYMENT, BookingStatus.PENDING_APPROVAL, BookingStatus.CONFIRMED, BookingStatus.COMPLETED))).thenReturn(false) }
        `when`(weekly.capacity.requireAvailability(weekly.organizationId, weekly.child.branchId, weeklyPlan.id, dates)).thenReturn(weeklyPlan)
        `when`(weekly.invoices.save(any(Invoice::class.java))).thenReturn(weeklyInvoice)
        `when`(weekly.entitlements.save(any(ServiceEntitlement::class.java))).thenReturn(weeklyEntitlement)
        `when`(weekly.bookings.save(any(Booking::class.java))).thenAnswer { invocation -> bookings.first { it.bookingDate == (invocation.arguments[0] as Booking).bookingDate } }
        stubInvoiceGraph(weekly, weeklyInvoice, weeklyEntitlement, null, null)
        `when`(weekly.invoices.findById(weeklyInvoice.id)).thenReturn(Optional.of(weeklyInvoice))
        val weeklyResult = weekly.service.purchase(weekly.jwt, weekly.organizationId, PurchaseServiceRequest(weeklyPlan.id, weekly.child.id, dates))
        assertEquals(2, weeklyResult.bookings.size)
        verify(weekly.capacity).reserve(weekly.organizationId, weekly.child.branchId, weeklyPlan.id, weeklyEntitlement.id, dates, mapOf(dates[0] to bookings[0].id, dates[1] to bookings[1].id))
    }

    @Test
    fun `payment proof decoder rejects unsupported content invalid base64 empty and fake images`() {
        val f = fixture()
        val invoice = Invoice(id = f.invoiceId, organizationId = f.organizationId, payerUserId = f.parent.id, invoiceNumber = "INV-INVALID", status = InvoiceStatus.PENDING)
        `when`(f.identity.sync(f.jwt)).thenReturn(f.parent)
        `when`(f.invoices.findById(invoice.id)).thenReturn(Optional.of(invoice))
        val invalidRequests = listOf(
            SubmitPaymentProofRequest("x.gif", "image/gif", "AAAA"),
            SubmitPaymentProofRequest("x.png", "image/png", "not-base64"),
            SubmitPaymentProofRequest("x.png", "image/png", ""),
            SubmitPaymentProofRequest("x.png", "image/png", java.util.Base64.getEncoder().encodeToString(byteArrayOf(1, 2, 3))),
        )
        invalidRequests.forEach { request -> assertThrows(IllegalArgumentException::class.java) { f.service.submitPaymentProof(f.jwt, f.organizationId, invoice.id, request) } }
    }

    @Test
    fun `expired invoices become overdue and release related entitlement reservations`() {
        val f = fixture()
        val invoice = Invoice(id = f.invoiceId, organizationId = f.organizationId, payerUserId = f.parent.id, invoiceNumber = "INV-EXPIRED", status = InvoiceStatus.PENDING, dueDate = LocalDate.now().minusDays(1), branchId = f.child.branchId, childId = f.child.id)
        val entitlement = ServiceEntitlement(organizationId = f.organizationId, branchId = f.child.branchId, childId = f.child.id, ownerUserId = f.parent.id, invoiceId = invoice.id, planName = "Lama", planType = ServicePlanType.DAILY, status = EntitlementStatus.ACTIVE, totalCredits = 1, validUntil = LocalDate.now().plusDays(1))
        `when`(f.invoices.findAllByOrganizationIdAndStatusInAndDueDateBefore(f.organizationId, setOf(InvoiceStatus.PENDING, InvoiceStatus.PAYMENT_SUBMITTED), LocalDate.now())).thenReturn(listOf(invoice))
        `when`(f.entitlements.findAllByInvoiceIdIn(listOf(invoice.id))).thenReturn(listOf(entitlement))
        `when`(f.entitlements.findAllByOrganizationId(f.organizationId)).thenReturn(listOf(entitlement))
        `when`(f.users.findById(f.parent.id)).thenReturn(Optional.of(f.parent))
        `when`(f.children.findById(f.child.id)).thenReturn(Optional.of(f.child))
        f.service.entitlements(f.jwt, f.organizationId)
        assertEquals(InvoiceStatus.OVERDUE, invoice.status)
        assertEquals(EntitlementStatus.EXPIRED, entitlement.status)
        verify(f.events).publishEvent(InvoiceExpiredEvent(invoice.id))
        verify(f.capacity).releaseForEntitlements(listOf(entitlement.id))
        verify(f.discountRedemptions).deleteAllByInvoiceIdIn(listOf(invoice.id))
    }

    @Test
    fun `payment proof notification only targets active staff admins`() {
        val f = fixture()
        val invoice = Invoice(id = f.invoiceId, organizationId = f.organizationId, payerUserId = f.parent.id, invoiceNumber = "INV-NOTIFY", status = InvoiceStatus.PENDING, branchId = f.child.branchId, childId = f.child.id)
        `when`(f.identity.sync(f.jwt)).thenReturn(f.parent)
        `when`(f.invoices.findById(invoice.id)).thenReturn(Optional.of(invoice))
        val active = Membership(organizationId = f.organizationId, userId = UUID.randomUUID(), role = Role.STAFF_ADMIN, active = true)
        val inactive = Membership(organizationId = f.organizationId, userId = UUID.randomUUID(), role = Role.STAFF_ADMIN, active = false)
        val staff = Membership(organizationId = f.organizationId, userId = UUID.randomUUID(), role = Role.STAFF, active = true)
        `when`(f.memberships.findAllByOrganizationId(f.organizationId)).thenReturn(listOf(active, inactive, staff))
        stubInvoiceGraph(f, invoice, null, null, null)
        val png = java.util.Base64.getEncoder().encodeToString(byteArrayOf(0x89.toByte(), 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A))
        f.service.submitPaymentProof(f.jwt, f.organizationId, invoice.id, SubmitPaymentProofRequest("proof.png", "image/png", png))
        verify(f.notifications).notify(f.organizationId, active.userId, "Bukti pembayaran baru", "Tagihan ${invoice.invoiceNumber} menunggu verifikasi.", "/parent-payments", setOf(com.daycare.api.realtime.RealtimeFlag.INVOICES, com.daycare.api.realtime.RealtimeFlag.PARENT_ENROLLMENTS, com.daycare.api.realtime.RealtimeFlag.ENTITLEMENTS, com.daycare.api.realtime.RealtimeFlag.BOOKINGS))
        org.mockito.Mockito.verifyNoMoreInteractions(f.notifications)
    }
    @Test
    fun `admin manages plans discounts templates and branch capacity`() {
        val fixture = fixture()
        val plan = ServicePlan(id = fixture.planId, organizationId = fixture.organizationId, name = "Harian", type = ServicePlanType.DAILY, price = BigDecimal("100"), creditCount = 1)
        `when`(fixture.plans.save(any(ServicePlan::class.java))).thenAnswer { it.arguments[0] }
        assertEquals("Harian", fixture.service.createPlan(fixture.jwt, fixture.organizationId, CreateServicePlanRequest(" Harian ", ServicePlanType.DAILY, BigDecimal("100"), 1, null, null, true)).name)
        `when`(fixture.plans.findById(fixture.planId)).thenReturn(Optional.of(plan))
        val discount = ServicePlanDiscount(id = fixture.discountId, organizationId = fixture.organizationId, servicePlanId = fixture.planId, kind = ServicePlanDiscountKind.PROMO_CODE, name = "Promo", promoCode = "HEMAT", type = ServicePlanDiscountType.PERCENTAGE, value = BigDecimal("10"))
        `when`(fixture.discounts.save(any(ServicePlanDiscount::class.java))).thenAnswer { it.arguments[0] }
        val createdDiscount = fixture.service.createPlanDiscount(fixture.jwt, fixture.organizationId, fixture.planId, CreateServicePlanDiscountRequest(ServicePlanDiscountKind.PROMO_CODE, " Promo ", " hemat ", ServicePlanDiscountType.PERCENTAGE, BigDecimal("10"), null, null, 10))
        assertEquals("HEMAT", createdDiscount.promoCode)
        `when`(fixture.discounts.findById(fixture.discountId)).thenReturn(Optional.of(discount))
        assertFalse(fixture.service.deactivatePlanDiscount(fixture.jwt, fixture.organizationId, fixture.planId, fixture.discountId).active)

        `when`(fixture.templates.save(any(com.daycare.api.persistence.ServicePlanTemplate::class.java))).thenAnswer { it.arguments[0] }
        val template = fixture.service.createPlanTemplate(fixture.jwt, fixture.organizationId, UpsertServicePlanTemplateRequest(" Paket ", ServicePlanType.WEEKLY, BigDecimal("300"), 5, UnusedCreditPolicy.CARRY_FORWARD, 14, true, 10))
        assertEquals("Paket", template.name)
        `when`(fixture.templates.findById(UUID.fromString(template.id))).thenReturn(Optional.of(com.daycare.api.persistence.ServicePlanTemplate(id = UUID.fromString(template.id), organizationId = fixture.organizationId)))
        assertEquals("Baru", fixture.service.updatePlanTemplate(fixture.jwt, fixture.organizationId, UUID.fromString(template.id), UpsertServicePlanTemplateRequest(" Baru ", ServicePlanType.WEEKLY, BigDecimal("300"), 5, UnusedCreditPolicy.EXPIRE, null, false, null)).name)
        fixture.service.deletePlanTemplate(fixture.jwt, fixture.organizationId, UUID.fromString(template.id))
        verify(fixture.templates).delete(any(com.daycare.api.persistence.ServicePlanTemplate::class.java))

        val branch = com.daycare.api.persistence.Branch(organizationId = fixture.organizationId, name = "Cabang")
        `when`(fixture.branches.findAllByOrganizationIdAndActiveTrueOrderByNameAsc(fixture.organizationId)).thenReturn(listOf(branch))
        `when`(fixture.capacity.branchSettings(fixture.organizationId)).thenReturn(listOf(com.daycare.api.persistence.BranchCapacitySetting(organizationId = fixture.organizationId, branchId = branch.id, dailyCapacity = 8)))
        assertEquals(8, fixture.service.branchCapacities(fixture.jwt, fixture.organizationId).single().dailyCapacity)
    }

    @Test
    fun `quote applies the best valid discount and payment proof updates invoice`() {
        val fixture = fixture()
        val plan = ServicePlan(id = fixture.planId, organizationId = fixture.organizationId, name = "Mingguan", type = ServicePlanType.WEEKLY, price = BigDecimal("500"), creditCount = 5, unusedCreditPolicy = UnusedCreditPolicy.EXPIRE)
        `when`(fixture.plans.findById(fixture.planId)).thenReturn(Optional.of(plan))
        val automatic = ServicePlanDiscount(organizationId = fixture.organizationId, servicePlanId = fixture.planId, kind = ServicePlanDiscountKind.AUTOMATIC, name = "Auto", type = ServicePlanDiscountType.FIXED_AMOUNT, value = BigDecimal("50"))
        val promo = ServicePlanDiscount(id = fixture.discountId, organizationId = fixture.organizationId, servicePlanId = fixture.planId, kind = ServicePlanDiscountKind.PROMO_CODE, name = "Promo", promoCode = "HEMAT", type = ServicePlanDiscountType.PERCENTAGE, value = BigDecimal("20"), usageLimit = 2)
        `when`(fixture.discounts.findAllByOrganizationIdAndServicePlanIdAndActiveTrue(fixture.organizationId, fixture.planId)).thenReturn(listOf(automatic, promo))
        `when`(fixture.discountRedemptions.countByDiscountId(fixture.discountId)).thenReturn(0)
        val quote = fixture.service.quoteEnrollment(fixture.organizationId, fixture.planId, " hemat ")
        assertEquals(BigDecimal("100.00"), quote.discountAmount)
        assertEquals(BigDecimal("400.00"), quote.totalAmount)

        val parent = fixture.parent
        `when`(fixture.identity.sync(fixture.jwt)).thenReturn(parent)
        val invoice = Invoice(id = fixture.invoiceId, organizationId = fixture.organizationId, payerUserId = parent.id, invoiceNumber = "INV-1", subtotalAmount = BigDecimal("100"), totalAmount = BigDecimal("100"), branchId = fixture.child.branchId, childId = fixture.child.id, status = InvoiceStatus.PENDING)
        `when`(fixture.invoices.findById(fixture.invoiceId)).thenReturn(Optional.of(invoice))
        `when`(fixture.children.findById(fixture.child.id)).thenReturn(Optional.of(fixture.child))
        `when`(fixture.entitlements.findAllByInvoiceId(fixture.invoiceId)).thenReturn(emptyList())
        `when`(fixture.users.findById(parent.id)).thenReturn(Optional.of(parent))
        `when`(fixture.paymentProofs.findByInvoiceId(fixture.invoiceId)).thenReturn(null)
        val png = java.util.Base64.getEncoder().encodeToString(byteArrayOf(0x89.toByte(), 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A))
        val submitted = fixture.service.submitPaymentProof(fixture.jwt, fixture.organizationId, fixture.invoiceId, SubmitPaymentProofRequest(" proof.png ", "image/png", png, " note "))
        assertEquals(InvoiceStatus.PAYMENT_SUBMITTED, submitted.status)
        verify(fixture.paymentProofs).save(any(PaymentProof::class.java))
    }

    @Test
    fun `purchase creates entitlement bookings and paid invoice activates them`() {
        val f = fixture()
        val plan = ServicePlan(id = f.planId, organizationId = f.organizationId, name = "Harian", type = ServicePlanType.DAILY, price = BigDecimal("100"), creditCount = 1, bookingRequiresApproval = true)
        val today = LocalDate.now()
        val invoice = Invoice(id = f.invoiceId, organizationId = f.organizationId, payerUserId = f.parent.id, invoiceNumber = "INV-1", subtotalAmount = BigDecimal("100"), totalAmount = BigDecimal("100"), branchId = f.child.branchId, childId = f.child.id, status = InvoiceStatus.PENDING)
        val entitlement = ServiceEntitlement(id = UUID.randomUUID(), organizationId = f.organizationId, branchId = f.child.branchId, childId = f.child.id, ownerUserId = f.parent.id, planId = plan.id, invoiceId = invoice.id, planName = plan.name, planType = plan.type, totalCredits = 1, bookingRequiresApproval = true, periodStart = today, periodEnd = today, validUntil = today)
        val booking = Booking(id = UUID.randomUUID(), organizationId = f.organizationId, branchId = f.child.branchId, childId = f.child.id, entitlementId = entitlement.id, invoiceId = invoice.id, bookingDate = today, planName = plan.name, status = BookingStatus.PENDING_PAYMENT)
        `when`(f.plans.findById(plan.id)).thenReturn(Optional.of(plan))
        `when`(f.capacity.requireAvailability(f.organizationId, f.child.branchId, plan.id, listOf(today))).thenReturn(plan)
        `when`(f.invoices.save(any(Invoice::class.java))).thenReturn(invoice)
        `when`(f.entitlements.save(any(ServiceEntitlement::class.java))).thenReturn(entitlement)
        `when`(f.bookings.save(any(Booking::class.java))).thenReturn(booking)
        `when`(f.invoices.findById(invoice.id)).thenReturn(Optional.of(invoice))
        `when`(f.entitlements.findAllByInvoiceId(invoice.id)).thenReturn(listOf(entitlement))
        `when`(f.bookings.findAllByInvoiceId(invoice.id)).thenReturn(listOf(booking))
        `when`(f.users.findById(f.parent.id)).thenReturn(Optional.of(f.parent))
        `when`(f.paymentProofs.findByInvoiceId(invoice.id)).thenReturn(null)
        val result = f.service.purchase(f.jwt, f.organizationId, PurchaseServiceRequest(plan.id, f.child.id, listOf(today)))
        assertEquals(1, result.bookings.size)
        assertEquals(BookingStatus.PENDING_PAYMENT, booking.status)

        f.service.markInvoicePaid(f.jwt, f.organizationId, invoice.id)
        assertEquals(InvoiceStatus.PAID, invoice.status)
        assertEquals(EntitlementStatus.ACTIVE, entitlement.status)
        assertEquals(BookingStatus.PENDING_APPROVAL, booking.status)
        verify(f.events).publishEvent(any(InvoicePaidEvent::class.java))
    }

    @Test
    fun `billing validation rejects invalid plan discount promo and booking combinations`() {
        val f = fixture()
        assertThrows(IllegalArgumentException::class.java) {
            f.service.createPlan(f.jwt, f.organizationId, CreateServicePlanRequest("Monthly", ServicePlanType.MONTHLY, BigDecimal("10"), 1, null, null, true))
        }
        assertThrows(IllegalArgumentException::class.java) {
            f.service.createPlan(f.jwt, f.organizationId, CreateServicePlanRequest("Daily", ServicePlanType.DAILY, BigDecimal("10"), 2, null, null, true))
        }
        val plan = ServicePlan(id = f.planId, organizationId = f.organizationId, name = "Weekly", type = ServicePlanType.WEEKLY, price = BigDecimal("100"), creditCount = 2)
        `when`(f.plans.findById(f.planId)).thenReturn(Optional.of(plan))
        val invalidPromo = ServicePlanDiscount(organizationId = f.organizationId, servicePlanId = f.planId, kind = ServicePlanDiscountKind.PROMO_CODE, name = "Promo", promoCode = "OTHER", type = ServicePlanDiscountType.PERCENTAGE, value = BigDecimal("10"))
        `when`(f.discounts.findAllByOrganizationIdAndServicePlanIdAndActiveTrue(f.organizationId, f.planId)).thenReturn(listOf(invalidPromo))
        assertThrows(IllegalArgumentException::class.java) { f.service.quoteEnrollment(f.organizationId, f.planId, "MISSING") }
        assertThrows(IllegalArgumentException::class.java) {
            f.service.purchase(f.jwt, f.organizationId, PurchaseServiceRequest(f.planId, f.child.id, listOf(LocalDate.now(), LocalDate.now().plusDays(1), LocalDate.now().plusDays(2))))
        }
    }

    @Test
    fun `plan and discount validation covers all supported boundary combinations`() {
        val f = fixture()
        `when`(f.plans.save(any(ServicePlan::class.java))).thenAnswer { it.arguments[0] }
        assertEquals(ServicePlanType.MONTHLY, f.service.createPlan(f.jwt, f.organizationId, CreateServicePlanRequest("Monthly", ServicePlanType.MONTHLY, BigDecimal("100"), null, null, null, false, 999)).type)
        assertEquals(ServicePlanType.DAILY, f.service.createPlan(f.jwt, f.organizationId, CreateServicePlanRequest("Daily", ServicePlanType.DAILY, BigDecimal("100"), 1, UnusedCreditPolicy.EXPIRE, null, false, 1)).type)
        assertEquals(ServicePlanType.WEEKLY, f.service.createPlan(f.jwt, f.organizationId, CreateServicePlanRequest("Weekly", ServicePlanType.WEEKLY, BigDecimal("100"), 2, UnusedCreditPolicy.CARRY_FORWARD, 1, false, null)).type)
        val invalidPlans = listOf(
            CreateServicePlanRequest("Price", ServicePlanType.DAILY, BigDecimal.ZERO, 1, null, null, false),
            CreateServicePlanRequest("Capacity", ServicePlanType.DAILY, BigDecimal.ONE, 1, null, null, false, 0),
            CreateServicePlanRequest("Capacity", ServicePlanType.DAILY, BigDecimal.ONE, 1, null, null, false, 1000),
            CreateServicePlanRequest("Monthly credits", ServicePlanType.MONTHLY, BigDecimal.ONE, 1, null, null, false),
            CreateServicePlanRequest("Daily credits", ServicePlanType.DAILY, BigDecimal.ONE, 2, null, null, false),
            CreateServicePlanRequest("Daily missing", ServicePlanType.DAILY, BigDecimal.ONE, null, null, null, false),
            CreateServicePlanRequest("Weekly missing", ServicePlanType.WEEKLY, BigDecimal.ONE, null, null, null, false),
            CreateServicePlanRequest("Carry", ServicePlanType.WEEKLY, BigDecimal.ONE, 2, UnusedCreditPolicy.CARRY_FORWARD, 0, false),
        )
        invalidPlans.forEach { request -> assertThrows(IllegalArgumentException::class.java) { f.service.createPlan(f.jwt, f.organizationId, request) } }

        val plan = ServicePlan(id = f.planId, organizationId = f.organizationId, name = "Plan", type = ServicePlanType.DAILY, price = BigDecimal("100"), creditCount = 1)
        `when`(f.plans.findById(f.planId)).thenReturn(Optional.of(plan))
        `when`(f.discounts.save(any(ServicePlanDiscount::class.java))).thenAnswer { it.arguments[0] }
        val validPromo = CreateServicePlanDiscountRequest(ServicePlanDiscountKind.PROMO_CODE, "Promo", " code ", ServicePlanDiscountType.PERCENTAGE, BigDecimal("10"), null, null, 1)
        assertEquals("CODE", f.service.createPlanDiscount(f.jwt, f.organizationId, f.planId, validPromo).promoCode)
        assertEquals(ServicePlanDiscountKind.AUTOMATIC, f.service.createPlanDiscount(f.jwt, f.organizationId, f.planId, validPromo.copy(kind = ServicePlanDiscountKind.AUTOMATIC, promoCode = null, usageLimit = null, type = ServicePlanDiscountType.FIXED_AMOUNT, value = BigDecimal("10"))).kind)
        val invalidDiscounts = listOf(
            validPromo.copy(startsOn = LocalDate.now().plusDays(2), endsOn = LocalDate.now()),
            validPromo.copy(usageLimit = 0),
            validPromo.copy(promoCode = null),
            validPromo.copy(value = BigDecimal.ZERO),
            validPromo.copy(value = BigDecimal("100")),
            validPromo.copy(type = ServicePlanDiscountType.FIXED_AMOUNT, value = BigDecimal("100")),
            validPromo.copy(kind = ServicePlanDiscountKind.AUTOMATIC, promoCode = "CODE"),
            validPromo.copy(kind = ServicePlanDiscountKind.AUTOMATIC, promoCode = null, usageLimit = 1),
        )
        invalidDiscounts.forEach { request -> assertThrows(IllegalArgumentException::class.java) { f.service.createPlanDiscount(f.jwt, f.organizationId, f.planId, request) } }
    }

    @Test
    fun `purchase date validation covers monthly daily weekly and deferred enrollment rules`() {
        val f = fixture()
        val today = LocalDate.now()
        fun stub(plan: ServicePlan) { `when`(f.plans.findById(plan.id)).thenReturn(Optional.of(plan)) }
        val monthly = ServicePlan(id = f.planId, organizationId = f.organizationId, name = "Monthly", type = ServicePlanType.MONTHLY, price = BigDecimal("100"))
        stub(monthly)
        assertThrows(IllegalArgumentException::class.java) { f.service.purchaseForEnrollment(f.parent, f.organizationId, f.child, PurchaseServiceRequest(f.planId, f.child.id, listOf(today))) }
        val daily = ServicePlan(id = f.planId, organizationId = f.organizationId, name = "Daily", type = ServicePlanType.DAILY, price = BigDecimal("100"), creditCount = 1)
        stub(daily)
        assertThrows(IllegalArgumentException::class.java) { f.service.purchaseForEnrollment(f.parent, f.organizationId, f.child, PurchaseServiceRequest(f.planId, f.child.id, listOf(today))) }
        val weekly = ServicePlan(id = f.planId, organizationId = f.organizationId, name = "Weekly", type = ServicePlanType.WEEKLY, price = BigDecimal("100"), creditCount = 2)
        stub(weekly)
        assertThrows(IllegalArgumentException::class.java) { f.service.purchase(f.jwt, f.organizationId, PurchaseServiceRequest(f.planId, f.child.id, emptyList())) }
        assertThrows(IllegalArgumentException::class.java) { f.service.purchase(f.jwt, f.organizationId, PurchaseServiceRequest(f.planId, f.child.id, listOf(today, today.plusDays(1), today.plusDays(2)))) }
        assertThrows(IllegalArgumentException::class.java) { f.service.purchase(f.jwt, f.organizationId, PurchaseServiceRequest(f.planId, f.child.id, listOf(today.minusDays(1), today))) }
        assertThrows(IllegalArgumentException::class.java) { f.service.purchase(f.jwt, f.organizationId, PurchaseServiceRequest(f.planId, f.child.id, listOf(today.plusDays(7)))) }
    }

    @Test
    fun `discount selection ignores inactive windows and exhausted usage while honoring promo codes`() {
        val f = fixture()
        val plan = ServicePlan(id = f.planId, organizationId = f.organizationId, name = "Plan", type = ServicePlanType.DAILY, price = BigDecimal("100"), creditCount = 1)
        `when`(f.plans.findById(f.planId)).thenReturn(Optional.of(plan))
        val future = ServicePlanDiscount(organizationId = f.organizationId, servicePlanId = f.planId, kind = ServicePlanDiscountKind.AUTOMATIC, name = "Future", type = ServicePlanDiscountType.FIXED_AMOUNT, value = BigDecimal("10"), startsOn = LocalDate.now().plusDays(1))
        val expired = ServicePlanDiscount(organizationId = f.organizationId, servicePlanId = f.planId, kind = ServicePlanDiscountKind.AUTOMATIC, name = "Expired", type = ServicePlanDiscountType.FIXED_AMOUNT, value = BigDecimal("20"), endsOn = LocalDate.now().minusDays(1))
        val exhausted = ServicePlanDiscount(id = f.discountId, organizationId = f.organizationId, servicePlanId = f.planId, kind = ServicePlanDiscountKind.PROMO_CODE, name = "Used", promoCode = "USED", type = ServicePlanDiscountType.PERCENTAGE, value = BigDecimal("30"), usageLimit = 1)
        val valid = ServicePlanDiscount(organizationId = f.organizationId, servicePlanId = f.planId, kind = ServicePlanDiscountKind.AUTOMATIC, name = "Valid", type = ServicePlanDiscountType.FIXED_AMOUNT, value = BigDecimal("5"))
        `when`(f.discounts.findAllByOrganizationIdAndServicePlanIdAndActiveTrue(f.organizationId, f.planId)).thenReturn(listOf(future, expired, exhausted, valid))
        `when`(f.discountRedemptions.countByDiscountId(f.discountId)).thenReturn(1)
        assertEquals(BigDecimal("5"), f.service.quoteEnrollment(f.organizationId, f.planId, null).discountAmount)
        assertThrows(IllegalArgumentException::class.java) { f.service.quoteEnrollment(f.organizationId, f.planId, "USED") }
    }

    private data class Fixture(
        val organizationId: UUID,
        val planId: UUID,
        val discountId: UUID,
        val invoiceId: UUID,
        val child: Child,
        val parent: UserProfile,
        val staff: UserProfile,
        val jwt: Jwt,
        val access: AccessService,
        val childScopes: ChildScopeService,
        val identity: IdentityService,
        val plans: ServicePlanRepository,
        val invoices: InvoiceRepository,
        val bookings: BookingRepository,
        val paymentProofs: PaymentProofRepository,
        val entitlements: ServiceEntitlementRepository,
        val discounts: ServicePlanDiscountRepository,
        val discountRedemptions: ServicePlanDiscountRedemptionRepository,
        val templates: ServicePlanTemplateRepository,
        val capacity: CapacityReservationService,
        val branches: BranchRepository,
        val children: ChildRepository,
        val users: UserProfileRepository,
        val events: ApplicationEventPublisher,
        val notifications: NotificationService,
        val parentEnrollments: ParentEnrollmentRepository,
        val memberships: MembershipRepository,
        val branchFilters: BranchListFilterService,
        val adminScope: AccessScope,
        val parentScope: AccessScope,
        val service: BillingService,
    )

    private fun stubInvoiceGraph(f: Fixture, invoice: Invoice, entitlement: ServiceEntitlement?, proof: PaymentProof?, booking: Booking?) {
        `when`(f.invoices.findById(invoice.id)).thenReturn(Optional.of(invoice))
        `when`(f.entitlements.findAllByInvoiceId(invoice.id)).thenReturn(if (entitlement == null) emptyList() else listOf(entitlement))
        `when`(f.users.findById(invoice.payerUserId)).thenReturn(Optional.of(f.parent))
        `when`(f.children.findById(f.child.id)).thenReturn(Optional.of(f.child))
        `when`(f.paymentProofs.findByInvoiceId(invoice.id)).thenReturn(proof)
        `when`(f.bookings.findAllByInvoiceId(invoice.id)).thenReturn(if (booking == null) emptyList() else listOf(booking))
        `when`(f.invoices.findAllByOrganizationIdAndStatusInAndDueDateBefore(f.organizationId, setOf(InvoiceStatus.PENDING, InvoiceStatus.PAYMENT_SUBMITTED), LocalDate.now())).thenReturn(emptyList())
    }

    private fun fixture(): Fixture {
        val organizationId = UUID.randomUUID(); val planId = UUID.randomUUID(); val discountId = UUID.randomUUID(); val invoiceId = UUID.randomUUID()
        val jwt = mock(Jwt::class.java); val parent = UserProfile(displayName = "Parent", registrationRole = com.daycare.api.domain.RegistrationRole.PARENT); val staff = UserProfile(displayName = "Admin")
        val child = Child(organizationId = organizationId, firstName = "Ayu")
        val access = mock(AccessService::class.java); val childScopes = mock(ChildScopeService::class.java); val children = mock(ChildRepository::class.java); val branches = mock(BranchRepository::class.java)
        val plans = mock(ServicePlanRepository::class.java); val invoices = mock(InvoiceRepository::class.java); val paymentProofs = mock(PaymentProofRepository::class.java); val entitlements = mock(ServiceEntitlementRepository::class.java); val bookings = mock(BookingRepository::class.java)
        val users = mock(UserProfileRepository::class.java); val discounts = mock(ServicePlanDiscountRepository::class.java); val discountRedemptions = mock(ServicePlanDiscountRedemptionRepository::class.java); val templates = mock(ServicePlanTemplateRepository::class.java); val capacity = mock(CapacityReservationService::class.java)
        val notifications = mock(NotificationService::class.java); val events = mock(ApplicationEventPublisher::class.java); val parentEnrollments = mock(ParentEnrollmentRepository::class.java); val memberships = mock(MembershipRepository::class.java); val identity = mock(IdentityService::class.java); val branchFilters = mock(BranchListFilterService::class.java)
        val adminScope = AccessScope(staff, Membership(organizationId = organizationId, role = Role.STAFF_ADMIN, active = true), setOf("DAYCARE"), setOf(InstitutionCapability.DAYCARE_OPERATIONS))
        val parentScope = AccessScope(parent, Membership(organizationId = organizationId, role = Role.PARENT, active = true), setOf("DAYCARE"), setOf(InstitutionCapability.DAYCARE_OPERATIONS))
        `when`(access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN), InstitutionCapability.DAYCARE_OPERATIONS)).thenReturn(adminScope)
        `when`(access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN))).thenReturn(adminScope)
        `when`(access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN), InstitutionCapability.DAYCARE_OPERATIONS, true)).thenReturn(adminScope)
        `when`(access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN, Role.PARENT), InstitutionCapability.DAYCARE_OPERATIONS, true)).thenReturn(adminScope)
        `when`(access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN, Role.PARENT), readOnly = true, allowSubscriptionRestrictedForRoles = setOf(Role.PARENT), allowInactiveRoles = setOf(Role.PARENT))).thenReturn(adminScope)
        `when`(access.require(jwt, organizationId, Role.entries.toSet(), InstitutionCapability.DAYCARE_OPERATIONS, true)).thenReturn(adminScope)
        `when`(access.require(jwt, organizationId, setOf(Role.PARENT), InstitutionCapability.DAYCARE_OPERATIONS)).thenReturn(parentScope)
        `when`(childScopes.requireParentLinkedChild(parentScope, child.id, organizationId)).thenReturn(child)
        `when`(children.findById(child.id)).thenReturn(Optional.of(child))
        return Fixture(organizationId, planId, discountId, invoiceId, child, parent, staff, jwt, access, childScopes, identity, plans, invoices, bookings, paymentProofs, entitlements, discounts, discountRedemptions, templates, capacity, branches, children, users, events, notifications, parentEnrollments, memberships, branchFilters, adminScope, parentScope, BillingService(access, childScopes, children, branches, plans, invoices, paymentProofs, entitlements, bookings, users, discounts, discountRedemptions, templates, capacity, notifications, events, parentEnrollments, memberships, identity, branchFilters))
    }
}
