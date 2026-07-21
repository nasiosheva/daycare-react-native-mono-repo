package com.daycare.api.persistence

import com.daycare.api.domain.BookingStatus
import org.springframework.data.jpa.repository.JpaRepository
import java.time.LocalDate
import java.util.UUID

interface ServicePlanRepository : JpaRepository<ServicePlan, UUID> { fun findAllByOrganizationIdAndActiveTrue(organizationId: UUID): List<ServicePlan> }
interface InvoiceRepository : JpaRepository<Invoice, UUID> { fun findAllByOrganizationIdOrderByCreatedAtDesc(organizationId: UUID): List<Invoice>; fun findAllByOrganizationIdAndPayerUserIdOrderByCreatedAtDesc(organizationId: UUID, payerUserId: UUID): List<Invoice> }
interface ServiceEntitlementRepository : JpaRepository<ServiceEntitlement, UUID> { fun findAllByInvoiceId(invoiceId: UUID): List<ServiceEntitlement>; fun findAllByOrganizationId(organizationId: UUID): List<ServiceEntitlement>; fun findAllByOrganizationIdAndOwnerUserId(organizationId: UUID, ownerUserId: UUID): List<ServiceEntitlement>; fun findAllByOrganizationIdAndChildId(organizationId: UUID, childId: UUID): List<ServiceEntitlement> }
interface BookingRepository : JpaRepository<Booking, UUID> { fun findAllByInvoiceId(invoiceId: UUID): List<Booking>; fun findAllByOrganizationIdOrderByBookingDateDesc(organizationId: UUID): List<Booking>; fun findAllByOrganizationIdAndStatusOrderByBookingDateAsc(organizationId: UUID, status: BookingStatus): List<Booking>; fun findByOrganizationIdAndChildIdAndBookingDateAndStatus(organizationId: UUID, childId: UUID, bookingDate: LocalDate, status: BookingStatus): Booking?; fun existsByOrganizationIdAndChildIdAndBookingDateAndStatusIn(organizationId: UUID, childId: UUID, bookingDate: LocalDate, statuses: Collection<BookingStatus>): Boolean }
