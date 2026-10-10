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
import org.junit.jupiter.api.Assertions.assertThrows
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
    fun `eligibility reports a readable reason when no active service is available`() {
        `when`(entitlements.findAllByOrganizationIdAndChildId(organizationId, childId)).thenReturn(emptyList())
        `when`(bookings.findByOrganizationIdAndChildIdAndBookingDateAndStatus(organizationId, childId, date, BookingStatus.CONFIRMED)).thenReturn(null)

        val eligibility = service.checkInEligibility(organizationId, childId, date)

        assertEquals(false, eligibility.allowed)
        assertEquals("Tidak ada booking terkonfirmasi atau paket bulanan aktif untuk hari ini", eligibility.reason)
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

    @Test
    fun `eligibility checks monthly boundaries then booking entitlement status`() {
        val monthly = ServiceEntitlement(organizationId = organizationId, childId = childId, status = EntitlementStatus.ACTIVE, planType = ServicePlanType.MONTHLY, periodStart = date.plusDays(1), validUntil = date.plusDays(30))
        `when`(entitlements.findAllByOrganizationIdAndChildId(organizationId, childId)).thenReturn(listOf(monthly))
        val booking = Booking(organizationId = organizationId, childId = childId, entitlementId = UUID.randomUUID(), bookingDate = date, status = BookingStatus.CONFIRMED)
        `when`(bookings.findByOrganizationIdAndChildIdAndBookingDateAndStatus(organizationId, childId, date, BookingStatus.CONFIRMED)).thenReturn(booking)
        `when`(entitlements.findById(booking.entitlementId)).thenReturn(Optional.empty())
        assertEquals(false, service.checkInEligibility(organizationId, childId, date).allowed)
        `when`(entitlements.findById(booking.entitlementId)).thenReturn(Optional.of(ServiceEntitlement(status = EntitlementStatus.EXPIRED)))
        assertEquals("Entitlement layanan booking tidak aktif", service.checkInEligibility(organizationId, childId, date).reason)
        `when`(entitlements.findById(booking.entitlementId)).thenReturn(Optional.of(ServiceEntitlement(status = EntitlementStatus.ACTIVE)))
        assertEquals(true, service.checkInEligibility(organizationId, childId, date).allowed)
    }

    @Test
    fun `consume rejects missing or inactive bookings and preserves monthly plans`() {
        `when`(entitlements.findAllByOrganizationIdAndChildId(organizationId, childId)).thenReturn(emptyList())
        `when`(bookings.findByOrganizationIdAndChildIdAndBookingDateAndStatus(organizationId, childId, date, BookingStatus.CONFIRMED)).thenReturn(null)
        assertThrows(AttendanceConflict::class.java) { service.consumeCheckIn(organizationId, childId, date) }
        val booking = Booking(organizationId = organizationId, childId = childId, entitlementId = UUID.randomUUID(), bookingDate = date, status = BookingStatus.CONFIRMED)
        `when`(bookings.findByOrganizationIdAndChildIdAndBookingDateAndStatus(organizationId, childId, date, BookingStatus.CONFIRMED)).thenReturn(booking)
        `when`(entitlements.findById(booking.entitlementId)).thenReturn(Optional.empty())
        assertThrows(AttendanceConflict::class.java) { service.consumeCheckIn(organizationId, childId, date) }
        `when`(entitlements.findById(booking.entitlementId)).thenReturn(Optional.of(ServiceEntitlement(status = EntitlementStatus.EXPIRED)))
        assertThrows(AttendanceConflict::class.java) { service.consumeCheckIn(organizationId, childId, date) }
        val monthly = ServiceEntitlement(organizationId = organizationId, childId = childId, status = EntitlementStatus.ACTIVE, planType = ServicePlanType.MONTHLY, periodStart = date.minusDays(1), validUntil = date.plusDays(1))
        `when`(entitlements.findAllByOrganizationIdAndChildId(organizationId, childId)).thenReturn(listOf(monthly))
        service.consumeCheckIn(organizationId, childId, date)
        verify(bookings, org.mockito.Mockito.times(3)).findByOrganizationIdAndChildIdAndBookingDateAndStatus(organizationId, childId, date, BookingStatus.CONFIRMED)
    }

    @Test
    fun `consume handles non-exhausted credits and null credit plans`() {
        val entitlement = ServiceEntitlement(organizationId = organizationId, childId = childId, status = EntitlementStatus.ACTIVE, planType = ServicePlanType.WEEKLY, totalCredits = 3, reservedCredits = 2, usedCredits = 0)
        val booking = Booking(organizationId = organizationId, childId = childId, entitlementId = entitlement.id, bookingDate = date, status = BookingStatus.CONFIRMED)
        `when`(entitlements.findAllByOrganizationIdAndChildId(organizationId, childId)).thenReturn(emptyList())
        `when`(bookings.findByOrganizationIdAndChildIdAndBookingDateAndStatus(organizationId, childId, date, BookingStatus.CONFIRMED)).thenReturn(booking)
        `when`(entitlements.findById(entitlement.id)).thenReturn(Optional.of(entitlement))
        service.consumeCheckIn(organizationId, childId, date)
        assertEquals(EntitlementStatus.ACTIVE, entitlement.status)
        val unlimited = ServiceEntitlement(organizationId = organizationId, childId = childId, status = EntitlementStatus.ACTIVE, planType = ServicePlanType.WEEKLY, totalCredits = null, reservedCredits = 0)
        val second = Booking(organizationId = organizationId, childId = childId, entitlementId = unlimited.id, bookingDate = date, status = BookingStatus.CONFIRMED)
        `when`(bookings.findByOrganizationIdAndChildIdAndBookingDateAndStatus(organizationId, childId, date, BookingStatus.CONFIRMED)).thenReturn(second)
        `when`(entitlements.findById(unlimited.id)).thenReturn(Optional.of(unlimited))
        service.consumeCheckIn(organizationId, childId, date)
        assertEquals(EntitlementStatus.ACTIVE, unlimited.status)
    }
}
