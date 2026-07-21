package com.daycare.api.service

import com.daycare.api.domain.BookingStatus
import com.daycare.api.domain.EntitlementStatus
import com.daycare.api.domain.ServicePlanType
import com.daycare.api.persistence.Booking
import com.daycare.api.persistence.BookingRepository
import com.daycare.api.persistence.ServiceEntitlement
import com.daycare.api.persistence.ServiceEntitlementRepository
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import org.mockito.Mockito.mock
import org.mockito.Mockito.never
import org.mockito.Mockito.verify
import org.mockito.Mockito.`when`
import java.time.LocalDate
import java.util.Optional
import java.util.UUID

class BookingEligibilityServiceTest {
    private val entitlements = mock(ServiceEntitlementRepository::class.java)
    private val bookings = mock(BookingRepository::class.java)
    private val service = BookingEligibilityService(entitlements, bookings)
    private val organizationId = UUID.randomUUID()
    private val childId = UUID.randomUUID()
    private val date = LocalDate.of(2026, 7, 21)

    @Test
    fun `active monthly entitlement permits check-in without daily booking`() {
        `when`(entitlements.findAllByOrganizationIdAndChildId(organizationId, childId)).thenReturn(listOf(ServiceEntitlement(organizationId = organizationId, childId = childId, status = EntitlementStatus.ACTIVE, planType = ServicePlanType.MONTHLY, periodStart = date.withDayOfMonth(1), validUntil = date.withDayOfMonth(31))))

        service.consumeCheckIn(organizationId, childId, date)

        verify(bookings, never()).findByOrganizationIdAndChildIdAndBookingDateAndStatus(organizationId, childId, date, BookingStatus.CONFIRMED)
    }

    @Test
    fun `confirmed daily booking consumes one reserved credit at check-in`() {
        val entitlement = ServiceEntitlement(organizationId = organizationId, childId = childId, status = EntitlementStatus.ACTIVE, planType = ServicePlanType.DAILY, totalCredits = 1, reservedCredits = 1)
        val booking = Booking(organizationId = organizationId, childId = childId, entitlementId = entitlement.id, bookingDate = date, status = BookingStatus.CONFIRMED)
        `when`(entitlements.findAllByOrganizationIdAndChildId(organizationId, childId)).thenReturn(emptyList())
        `when`(bookings.findByOrganizationIdAndChildIdAndBookingDateAndStatus(organizationId, childId, date, BookingStatus.CONFIRMED)).thenReturn(booking)
        `when`(entitlements.findById(entitlement.id)).thenReturn(Optional.of(entitlement))

        service.consumeCheckIn(organizationId, childId, date)

        assertEquals(BookingStatus.COMPLETED, booking.status)
        assertEquals(0, entitlement.reservedCredits)
        assertEquals(1, entitlement.usedCredits)
        assertEquals(EntitlementStatus.EXHAUSTED, entitlement.status)
    }
}
