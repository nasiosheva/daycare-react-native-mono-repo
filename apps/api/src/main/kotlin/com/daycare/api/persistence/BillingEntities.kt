package com.daycare.api.persistence

import com.daycare.api.domain.BookingStatus
import com.daycare.api.domain.EntitlementStatus
import com.daycare.api.domain.InvoiceStatus
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
    @Column(name = "booking_requires_approval", nullable = false) var bookingRequiresApproval: Boolean = true, @Column(nullable = false) var active: Boolean = true,
)

@Entity @Table(name = "invoices")
class Invoice(
    @Id var id: UUID = UUID.randomUUID(), @Column(name = "organization_id", nullable = false) var organizationId: UUID = UUID.randomUUID(), @Column(name = "payer_user_id", nullable = false) var payerUserId: UUID = UUID.randomUUID(),
    @Column(name = "invoice_number", nullable = false, unique = true) var invoiceNumber: String = "", @Column(nullable = false, precision = 14, scale = 2) var totalAmount: BigDecimal = BigDecimal.ZERO,
    @Enumerated(EnumType.STRING) @Column(nullable = false) var status: InvoiceStatus = InvoiceStatus.PENDING, @Column(name = "due_date", nullable = false) var dueDate: LocalDate = LocalDate.now(),
    @Column(name = "created_at", nullable = false) var createdAt: Instant = Instant.now(), @Column(name = "paid_at") var paidAt: Instant? = null,
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
