package com.daycare.api.persistence

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.math.BigDecimal
import java.time.DayOfWeek
import java.time.LocalDate
import java.time.LocalTime
import java.util.UUID

@Entity @Table(name = "branch_operating_hours")
class BranchOperatingHour(
    @Id var id: UUID = UUID.randomUUID(),
    @Column(name = "branch_id", nullable = false) var branchId: UUID = UUID.randomUUID(),
    @Enumerated(EnumType.STRING) @Column(nullable = false) var dayOfWeek: DayOfWeek = DayOfWeek.MONDAY,
    @Column(nullable = false) var active: Boolean = false,
    @Column(name = "opens_at") var opensAt: LocalTime? = null,
    @Column(name = "closes_at") var closesAt: LocalTime? = null,
)

@Entity @Table(name = "branch_overtime_rate_tiers")
class BranchOvertimeRateTier(
    @Id var id: UUID = UUID.randomUUID(),
    @Column(name = "branch_id", nullable = false) var branchId: UUID = UUID.randomUUID(),
    @Column(name = "display_order", nullable = false) var displayOrder: Int = 0,
    @Column(name = "duration_minutes", nullable = false) var durationMinutes: Int = 1,
    @Column(nullable = false, precision = 14, scale = 2) var amount: BigDecimal = BigDecimal.ZERO,
)

@Entity @Table(name = "overtime_charges")
class OvertimeCharge(
    @Id var id: UUID = UUID.randomUUID(),
    @Column(name = "organization_id", nullable = false) var organizationId: UUID = UUID.randomUUID(),
    @Column(name = "branch_id", nullable = false) var branchId: UUID = UUID.randomUUID(),
    @Column(name = "child_id", nullable = false) var childId: UUID = UUID.randomUUID(),
    @Column(name = "payer_user_id", nullable = false) var payerUserId: UUID = UUID.randomUUID(),
    @Column(name = "invoice_id", nullable = false, unique = true) var invoiceId: UUID = UUID.randomUUID(),
    @Column(name = "operational_date", nullable = false) var operationalDate: LocalDate = LocalDate.now(),
    @Column(name = "picked_up_at", nullable = false) var pickedUpAt: LocalTime = LocalTime.MIDNIGHT,
    @Column(name = "closes_at", nullable = false) var closesAt: LocalTime = LocalTime.MIDNIGHT,
    @Column(name = "overtime_minutes", nullable = false) var overtimeMinutes: Int = 0,
    @Column(nullable = false, precision = 14, scale = 2) var totalAmount: BigDecimal = BigDecimal.ZERO,
)

@Entity @Table(name = "overtime_charge_tier_snapshots")
class OvertimeChargeTierSnapshot(
    @Id var id: UUID = UUID.randomUUID(),
    @Column(name = "overtime_charge_id", nullable = false) var overtimeChargeId: UUID = UUID.randomUUID(),
    @Column(name = "display_order", nullable = false) var displayOrder: Int = 0,
    @Column(name = "duration_minutes", nullable = false) var durationMinutes: Int = 1,
    @Column(nullable = false, precision = 14, scale = 2) var amount: BigDecimal = BigDecimal.ZERO,
)
