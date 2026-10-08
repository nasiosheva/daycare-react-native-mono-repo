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
import java.util.Optional
import java.util.UUID

class BillingServiceCoverageTest {
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
        val service: BillingService,
    )

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
        `when`(access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN), InstitutionCapability.DAYCARE_OPERATIONS, true)).thenReturn(adminScope)
        `when`(access.require(jwt, organizationId, Role.entries.toSet(), InstitutionCapability.DAYCARE_OPERATIONS, true)).thenReturn(adminScope)
        `when`(access.require(jwt, organizationId, setOf(Role.PARENT), InstitutionCapability.DAYCARE_OPERATIONS)).thenReturn(parentScope)
        `when`(childScopes.requireParentLinkedChild(parentScope, child.id, organizationId)).thenReturn(child)
        `when`(children.findById(child.id)).thenReturn(Optional.of(child))
        return Fixture(organizationId, planId, discountId, invoiceId, child, parent, staff, jwt, access, childScopes, identity, plans, invoices, bookings, paymentProofs, entitlements, discounts, discountRedemptions, templates, capacity, branches, children, users, events, notifications, parentEnrollments, memberships, branchFilters, BillingService(access, childScopes, children, branches, plans, invoices, paymentProofs, entitlements, bookings, users, discounts, discountRedemptions, templates, capacity, notifications, events, parentEnrollments, memberships, identity, branchFilters))
    }
}
