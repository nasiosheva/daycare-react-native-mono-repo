package com.daycare.api.service

import com.daycare.api.domain.CapacityReservationStatus
import com.daycare.api.domain.ServicePlanType
import com.daycare.api.persistence.Branch
import com.daycare.api.persistence.BranchCapacitySettingRepository
import com.daycare.api.persistence.BranchRepository
import com.daycare.api.persistence.CapacityReservation
import com.daycare.api.persistence.CapacityReservationRepository
import com.daycare.api.persistence.ServicePlan
import com.daycare.api.persistence.ServicePlanRepository
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Test
import org.mockito.Mockito.`when`
import org.mockito.Mockito.mock
import java.math.BigDecimal
import java.time.LocalDate
import java.util.UUID

class CapacityReservationServiceTest {
    private val branches = mock(BranchRepository::class.java)
    private val plans = mock(ServicePlanRepository::class.java)
    private val settings = mock(BranchCapacitySettingRepository::class.java)
    private val reservations = mock(CapacityReservationRepository::class.java)
    private val service = CapacityReservationService(branches, plans, settings, reservations)
    private val organizationId = UUID.randomUUID()
    private val branchId = UUID.randomUUID()
    private val planId = UUID.randomUUID()
    private val date = LocalDate.of(2026, 7, 21)

    @Test
    fun `rejects a booking when its package daily capacity is full`() {
        val plan = ServicePlan(id = planId, organizationId = organizationId, type = ServicePlanType.DAILY, price = BigDecimal.TEN, creditCount = 1, dailyCapacity = 1)
        `when`(branches.findWithLockById(branchId)).thenReturn(Branch(id = branchId, organizationId = organizationId))
        `when`(plans.findWithLockById(planId)).thenReturn(plan)
        `when`(settings.findByOrganizationIdAndBranchId(organizationId, branchId)).thenReturn(null)
        `when`(reservations.countByOrganizationIdAndServicePlanIdAndCapacityDateAndStatus(organizationId, planId, date, CapacityReservationStatus.HELD)).thenReturn(1)

        assertThrows(IllegalArgumentException::class.java) { service.requireAvailability(organizationId, branchId, planId, listOf(date)) }
    }

    @Test
    fun `releases held slots after a booking is rejected`() {
        val bookingId = UUID.randomUUID()
        val reservation = CapacityReservation(bookingId = bookingId, status = CapacityReservationStatus.HELD)
        `when`(reservations.findAllByBookingId(bookingId)).thenReturn(listOf(reservation))

        service.releaseForBooking(bookingId)

        assertEquals(CapacityReservationStatus.RELEASED, reservation.status)
    }
}
