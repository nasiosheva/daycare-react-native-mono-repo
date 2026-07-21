package com.daycare.api.service

import com.daycare.api.domain.BookingStatus
import com.daycare.api.domain.EntitlementStatus
import com.daycare.api.domain.ServicePlanType
import com.daycare.api.persistence.BookingRepository
import com.daycare.api.persistence.ServiceEntitlementRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.LocalDate
import java.util.UUID

@Service
class BookingEligibilityService(
    private val entitlements: ServiceEntitlementRepository,
    private val bookings: BookingRepository,
) {
    @Transactional
    fun consumeCheckIn(organizationId: UUID, childId: UUID, date: LocalDate) {
        val monthlyEntitlement = entitlements.findAllByOrganizationIdAndChildId(organizationId, childId).firstOrNull {
            it.status == EntitlementStatus.ACTIVE && it.planType == ServicePlanType.MONTHLY && !date.isBefore(it.periodStart) && !date.isAfter(it.validUntil)
        }
        if (monthlyEntitlement != null) return

        val booking = bookings.findByOrganizationIdAndChildIdAndBookingDateAndStatus(organizationId, childId, date, BookingStatus.CONFIRMED)
            ?: throw AttendanceConflict("Child does not have a confirmed booking or active monthly plan")
        val entitlement = entitlements.findById(booking.entitlementId).orElseThrow { AttendanceConflict("Booking service entitlement was not found") }
        if (entitlement.status != EntitlementStatus.ACTIVE) throw AttendanceConflict("Booking service entitlement is not active")
        booking.status = BookingStatus.COMPLETED
        entitlement.reservedCredits = (entitlement.reservedCredits - 1).coerceAtLeast(0)
        entitlement.usedCredits += 1
        if (entitlement.totalCredits != null && entitlement.usedCredits >= entitlement.totalCredits!!) entitlement.status = EntitlementStatus.EXHAUSTED
    }
}
