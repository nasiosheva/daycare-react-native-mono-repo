package com.daycare.api.persistence

import com.daycare.api.domain.BookingStatus
import com.daycare.api.domain.CapacityReservationStatus
import com.daycare.api.domain.EntitlementStatus
import com.daycare.api.domain.InvoiceStatus
import com.daycare.api.domain.InvoiceSource
import com.daycare.api.domain.PaymentProofStatus
import com.daycare.api.domain.ServicePlanDiscountKind
import com.daycare.api.domain.ServicePlanDiscountType
import com.daycare.api.domain.ServicePlanType
import com.daycare.api.domain.UnusedCreditPolicy
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.math.BigDecimal
import java.time.Instant
import java.time.LocalDate
import java.util.UUID

@Entity @Table(name = "service_plans")
class ServicePlan(
    @Id var id: UUID = UUID.randomUUID(), @Column(name = "organization_id", nullable = false) var organizationId: UUID = UUID.randomUUID(),
    @Column(nullable = false) var name: String = "", @Enumerated(EnumType.STRING) @Column(name = "plan_type", nullable = false) var type: ServicePlanType = ServicePlanType.DAILY,
    @Column(nullable = false, precision = 14, scale = 2) var price: BigDecimal = BigDecimal.ZERO, @Column(name = "credit_count") var creditCount: Int? = null,
    @Enumerated(EnumType.STRING) @Column(name = "unused_credit_policy") var unusedCreditPolicy: UnusedCreditPolicy? = null, @Column(name = "carry_forward_days") var carryForwardDays: Int? = null,
    @Column(name = "booking_requires_approval", nullable = false) var bookingRequiresApproval: Boolean = true, @Column(name = "daily_capacity") var dailyCapacity: Int? = null, @Column(nullable = false) var active: Boolean = true,
)

@Entity @Table(name = "invoices")
class Invoice(
    @Id var id: UUID = UUID.randomUUID(), @Column(name = "organization_id", nullable = false) var organizationId: UUID = UUID.randomUUID(), @Column(name = "payer_user_id", nullable = false) var payerUserId: UUID = UUID.randomUUID(),
    @Column(name = "invoice_number", nullable = false, unique = true) var invoiceNumber: String = "", @Column(name = "subtotal_amount", nullable = false, precision = 14, scale = 2) var subtotalAmount: BigDecimal = BigDecimal.ZERO, @Column(name = "discount_amount", nullable = false, precision = 14, scale = 2) var discountAmount: BigDecimal = BigDecimal.ZERO, @Column(name = "discount_name") var discountName: String? = null, @Column(name = "discount_code") var discountCode: String? = null, @Column(nullable = false, precision = 14, scale = 2) var totalAmount: BigDecimal = BigDecimal.ZERO,
    @Enumerated(EnumType.STRING) @Column(nullable = false) var status: InvoiceStatus = InvoiceStatus.PENDING, @Column(name = "due_date", nullable = false) var dueDate: LocalDate = LocalDate.now(),
    @Enumerated(EnumType.STRING) @Column(nullable = false) var source: InvoiceSource = InvoiceSource.SERVICE, @Column(name = "branch_id") var branchId: UUID? = null, @Column(name = "child_id") var childId: UUID? = null, @Column(length = 500) var description: String? = null,
    @Column(name = "created_at", nullable = false) var createdAt: Instant = Instant.now(), @Column(name = "paid_at") var paidAt: Instant? = null,
)

@Entity @Table(name = "payment_proofs")
class PaymentProof(
    @Id var id: UUID = UUID.randomUUID(), @Column(name = "invoice_id", nullable = false, unique = true) var invoiceId: UUID = UUID.randomUUID(),
    @Enumerated(EnumType.STRING) @Column(nullable = false) var status: PaymentProofStatus = PaymentProofStatus.SUBMITTED,
    @Column(name = "file_name", nullable = false) var fileName: String = "payment-proof.jpg", @Column(name = "content_type", nullable = false) var contentType: String = "image/jpeg",
    @Column(name = "image_data", nullable = false) var imageData: ByteArray = byteArrayOf(), @Column(name = "note", length = 500) var note: String? = null,
    @Column(name = "submitted_at", nullable = false) var submittedAt: Instant = Instant.now(), @Column(name = "reviewed_at") var reviewedAt: Instant? = null,
    @Column(name = "reviewed_by_user_id") var reviewedByUserId: UUID? = null, @Column(name = "rejection_reason", length = 500) var rejectionReason: String? = null,
)

@Entity @Table(name = "service_entitlements")
class ServiceEntitlement(
    @Id var id: UUID = UUID.randomUUID(), @Column(name = "organization_id", nullable = false) var organizationId: UUID = UUID.randomUUID(), @Column(name = "branch_id", nullable = false) var branchId: UUID = UUID.randomUUID(),
    @Column(name = "child_id", nullable = false) var childId: UUID = UUID.randomUUID(), @Column(name = "owner_user_id", nullable = false) var ownerUserId: UUID = UUID.randomUUID(), @Column(name = "plan_id", nullable = false) var planId: UUID = UUID.randomUUID(), @Column(name = "invoice_id", nullable = false) var invoiceId: UUID = UUID.randomUUID(),
    @Column(name = "plan_name", nullable = false) var planName: String = "", @Enumerated(EnumType.STRING) @Column(name = "plan_type", nullable = false) var planType: ServicePlanType = ServicePlanType.DAILY,
    @Enumerated(EnumType.STRING) @Column(nullable = false) var status: EntitlementStatus = EntitlementStatus.PENDING_PAYMENT, @Column(name = "total_credits") var totalCredits: Int? = null, @Column(name = "used_credits", nullable = false) var usedCredits: Int = 0, @Column(name = "reserved_credits", nullable = false) var reservedCredits: Int = 0,
    @Column(name = "booking_requires_approval", nullable = false) var bookingRequiresApproval: Boolean = true, @Column(name = "period_start", nullable = false) var periodStart: LocalDate = LocalDate.now(), @Column(name = "period_end", nullable = false) var periodEnd: LocalDate = LocalDate.now(), @Column(name = "valid_until", nullable = false) var validUntil: LocalDate = LocalDate.now(),
)

@Entity @Table(name = "bookings")
class Booking(
    @Id var id: UUID = UUID.randomUUID(), @Column(name = "organization_id", nullable = false) var organizationId: UUID = UUID.randomUUID(), @Column(name = "branch_id", nullable = false) var branchId: UUID = UUID.randomUUID(), @Column(name = "child_id", nullable = false) var childId: UUID = UUID.randomUUID(),
    @Column(name = "entitlement_id", nullable = false) var entitlementId: UUID = UUID.randomUUID(), @Column(name = "invoice_id", nullable = false) var invoiceId: UUID = UUID.randomUUID(), @Column(name = "booking_date", nullable = false) var bookingDate: LocalDate = LocalDate.now(),
    @Enumerated(EnumType.STRING) @Column(nullable = false) var status: BookingStatus = BookingStatus.PENDING_PAYMENT, @Column(name = "plan_name", nullable = false) var planName: String = "", @Column(name = "created_at", nullable = false) var createdAt: Instant = Instant.now(),
)

@Entity @Table(name = "branch_capacity_settings")
class BranchCapacitySetting(
    @Id var id: UUID = UUID.randomUUID(), @Column(name = "organization_id", nullable = false) var organizationId: UUID = UUID.randomUUID(),
    @Column(name = "branch_id", nullable = false, unique = true) var branchId: UUID = UUID.randomUUID(), @Column(name = "daily_capacity", nullable = false) var dailyCapacity: Int = 1,
)

@Entity @Table(name = "capacity_reservations")
class CapacityReservation(
    @Id var id: UUID = UUID.randomUUID(), @Column(name = "organization_id", nullable = false) var organizationId: UUID = UUID.randomUUID(),
    @Column(name = "branch_id", nullable = false) var branchId: UUID = UUID.randomUUID(), @Column(name = "service_plan_id", nullable = false) var servicePlanId: UUID = UUID.randomUUID(),
    @Column(name = "entitlement_id", nullable = false) var entitlementId: UUID = UUID.randomUUID(), @Column(name = "booking_id") var bookingId: UUID? = null,
    @Column(name = "capacity_date", nullable = false) var capacityDate: LocalDate = LocalDate.now(), @Enumerated(EnumType.STRING) @Column(nullable = false) var status: CapacityReservationStatus = CapacityReservationStatus.HELD,
)

@Entity @Table(name = "service_plan_discounts")
class ServicePlanDiscount(
    @Id var id: UUID = UUID.randomUUID(), @Column(name = "organization_id", nullable = false) var organizationId: UUID = UUID.randomUUID(),
    @Column(name = "service_plan_id", nullable = false) var servicePlanId: UUID = UUID.randomUUID(), @Enumerated(EnumType.STRING) @Column(nullable = false) var kind: ServicePlanDiscountKind = ServicePlanDiscountKind.AUTOMATIC,
    @Column(nullable = false) var name: String = "", @Column(name = "promo_code") var promoCode: String? = null, @Enumerated(EnumType.STRING) @Column(name = "discount_type", nullable = false) var type: ServicePlanDiscountType = ServicePlanDiscountType.PERCENTAGE,
    @Column(nullable = false, precision = 14, scale = 2) var value: BigDecimal = BigDecimal.ZERO, @Column(name = "starts_on") var startsOn: LocalDate? = null, @Column(name = "ends_on") var endsOn: LocalDate? = null,
    @Column(name = "usage_limit") var usageLimit: Int? = null, @Column(nullable = false) var active: Boolean = true, @Column(name = "created_at", nullable = false) var createdAt: Instant = Instant.now(),
)

@Entity @Table(name = "service_plan_discount_redemptions")
class ServicePlanDiscountRedemption(
    @Id var id: UUID = UUID.randomUUID(), @Column(name = "discount_id", nullable = false) var discountId: UUID = UUID.randomUUID(), @Column(name = "invoice_id", nullable = false, unique = true) var invoiceId: UUID = UUID.randomUUID(),
)

@Entity @Table(name = "service_plan_templates")
class ServicePlanTemplate(
    @Id var id: UUID = UUID.randomUUID(), @Column(name = "organization_id", nullable = false) var organizationId: UUID = UUID.randomUUID(),
    @Column(nullable = false) var name: String = "", @Enumerated(EnumType.STRING) @Column(name = "plan_type", nullable = false) var type: ServicePlanType = ServicePlanType.DAILY,
    @Column(name = "suggested_price", precision = 14, scale = 2) var suggestedPrice: BigDecimal? = null, @Column(name = "credit_count") var creditCount: Int? = null,
    @Enumerated(EnumType.STRING) @Column(name = "unused_credit_policy") var unusedCreditPolicy: UnusedCreditPolicy? = null, @Column(name = "carry_forward_days") var carryForwardDays: Int? = null,
    @Column(name = "booking_requires_approval", nullable = false) var bookingRequiresApproval: Boolean = true, @Column(name = "daily_capacity") var dailyCapacity: Int? = null,
)
