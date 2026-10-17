// Mories Deo Hutapea,S.E.,S.Kom
package com.daycare.api.persistence

import com.daycare.api.domain.BookingStatus
import com.daycare.api.domain.CapacityReservationStatus
import com.daycare.api.domain.ServicePlanType
import jakarta.persistence.LockModeType
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Lock
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import java.time.LocalDate
import java.util.UUID

interface ServicePlanRepository : JpaRepository<ServicePlan, UUID> { fun findAllByOrganizationIdAndActiveTrue(organizationId: UUID): List<ServicePlan>; @Lock(LockModeType.PESSIMISTIC_WRITE) fun findWithLockById(id: UUID): ServicePlan? }
interface InvoiceRepository : JpaRepository<Invoice, UUID> {
    fun findAllByOrganizationIdOrderByCreatedAtDesc(organizationId: UUID): List<Invoice>
    fun findAllByOrganizationIdAndPayerUserIdOrderByCreatedAtDesc(organizationId: UUID, payerUserId: UUID): List<Invoice>
    fun findAllByOrganizationIdAndStatusInAndDueDateBefore(organizationId: UUID, statuses: Collection<com.daycare.api.domain.InvoiceStatus>, dueDate: LocalDate): List<Invoice>
    @Lock(LockModeType.PESSIMISTIC_WRITE) @Query("select invoice from Invoice invoice where invoice.id = :id") fun findWithLockById(@Param("id") id: UUID): Invoice?
}
interface PaymentProofRepository : JpaRepository<PaymentProof, UUID> {
    fun findByInvoiceId(invoiceId: UUID): PaymentProof?
    @Lock(LockModeType.PESSIMISTIC_WRITE) @Query("select proof from PaymentProof proof where proof.invoiceId = :invoiceId") fun findWithLockByInvoiceId(@Param("invoiceId") invoiceId: UUID): PaymentProof?
}
interface BillingIdempotencyRecordRepository : JpaRepository<BillingIdempotencyRecord, UUID> {
    fun findByOrganizationIdAndActorUserIdAndOperationAndIdempotencyKey(organizationId: UUID, actorUserId: UUID, operation: String, idempotencyKey: UUID): BillingIdempotencyRecord?
}
interface ServiceEntitlementRepository : JpaRepository<ServiceEntitlement, UUID> { fun findAllByInvoiceId(invoiceId: UUID): List<ServiceEntitlement>; fun findAllByInvoiceIdIn(invoiceIds: Collection<UUID>): List<ServiceEntitlement>; fun findAllByOrganizationId(organizationId: UUID): List<ServiceEntitlement>; fun findAllByOrganizationIdAndOwnerUserId(organizationId: UUID, ownerUserId: UUID): List<ServiceEntitlement>; fun findAllByOrganizationIdAndChildId(organizationId: UUID, childId: UUID): List<ServiceEntitlement>; fun findAllByOrganizationIdAndChildIdAndPlanIdAndPlanTypeAndPeriodStartLessThanEqualAndPeriodEndGreaterThanEqual(organizationId: UUID, childId: UUID, planId: UUID, planType: ServicePlanType, periodStart: LocalDate, periodEnd: LocalDate): List<ServiceEntitlement>; @Lock(LockModeType.PESSIMISTIC_WRITE) @Query("select entitlement from ServiceEntitlement entitlement where entitlement.id = :id") fun findWithLockById(@Param("id") id: UUID): ServiceEntitlement? }
interface BookingRepository : JpaRepository<Booking, UUID> { fun findAllByInvoiceId(invoiceId: UUID): List<Booking>; fun findAllByOrganizationIdOrderByBookingDateDesc(organizationId: UUID): List<Booking>; fun findAllByOrganizationIdAndStatusOrderByBookingDateAsc(organizationId: UUID, status: BookingStatus): List<Booking>; fun findAllByOrganizationIdAndEntitlementIdAndBookingDateInOrderByBookingDateAsc(organizationId: UUID, entitlementId: UUID, bookingDates: Collection<LocalDate>): List<Booking>; fun findByOrganizationIdAndChildIdAndBookingDateAndStatus(organizationId: UUID, childId: UUID, bookingDate: LocalDate, status: BookingStatus): Booking?; @Lock(LockModeType.PESSIMISTIC_WRITE) fun findWithLockByOrganizationIdAndChildIdAndBookingDateAndStatus(organizationId: UUID, childId: UUID, bookingDate: LocalDate, status: BookingStatus): Booking?; fun existsByOrganizationIdAndChildIdAndBookingDateAndStatusIn(organizationId: UUID, childId: UUID, bookingDate: LocalDate, statuses: Collection<BookingStatus>): Boolean; @Lock(LockModeType.PESSIMISTIC_WRITE) @Query("select booking from Booking booking where booking.id = :id") fun findWithLockById(@Param("id") id: UUID): Booking? }
interface BranchCapacitySettingRepository : JpaRepository<BranchCapacitySetting, UUID> { fun findAllByOrganizationId(organizationId: UUID): List<BranchCapacitySetting>; fun findByOrganizationIdAndBranchId(organizationId: UUID, branchId: UUID): BranchCapacitySetting? }
interface ServiceExpiryReminderSettingsRepository : JpaRepository<ServiceExpiryReminderSettings, UUID>
interface ServiceExpiryReminderRepository : JpaRepository<ServiceExpiryReminder, UUID> { fun existsByEntitlementIdAndLeadDays(entitlementId: UUID, leadDays: Int): Boolean }
interface CapacityReservationRepository : JpaRepository<CapacityReservation, UUID> { fun countByOrganizationIdAndBranchIdAndCapacityDateAndStatus(organizationId: UUID, branchId: UUID, capacityDate: LocalDate, status: CapacityReservationStatus): Long; fun countByOrganizationIdAndServicePlanIdAndCapacityDateAndStatus(organizationId: UUID, servicePlanId: UUID, capacityDate: LocalDate, status: CapacityReservationStatus): Long; fun findAllByEntitlementIdIn(entitlementIds: Collection<UUID>): List<CapacityReservation>; fun findByEntitlementIdAndCapacityDate(entitlementId: UUID, capacityDate: LocalDate): CapacityReservation?; fun findAllByBookingId(bookingId: UUID): List<CapacityReservation>; fun findAllByOrganizationIdAndBranchIdAndCapacityDateGreaterThanEqualAndStatus(organizationId: UUID, branchId: UUID, capacityDate: LocalDate, status: CapacityReservationStatus): List<CapacityReservation> }
interface ServicePlanDiscountRepository : JpaRepository<ServicePlanDiscount, UUID> { fun findAllByOrganizationIdAndServicePlanIdOrderByCreatedAtDesc(organizationId: UUID, servicePlanId: UUID): List<ServicePlanDiscount>; fun findAllByOrganizationIdAndServicePlanIdAndActiveTrue(organizationId: UUID, servicePlanId: UUID): List<ServicePlanDiscount> }
interface ServicePlanDiscountRedemptionRepository : JpaRepository<ServicePlanDiscountRedemption, UUID> { fun countByDiscountId(discountId: UUID): Long; fun deleteAllByInvoiceId(invoiceId: UUID); fun deleteAllByInvoiceIdIn(invoiceIds: Collection<UUID>) }
interface ServicePlanTemplateRepository : JpaRepository<ServicePlanTemplate, UUID> { fun findAllByOrganizationIdOrderByNameAsc(organizationId: UUID): List<ServicePlanTemplate> }
