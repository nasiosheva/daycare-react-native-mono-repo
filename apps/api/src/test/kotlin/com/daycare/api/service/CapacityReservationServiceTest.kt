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
import org.mockito.Mockito.verify
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

    @Test
    fun `availability checks branch capacity and inactive plan rules`() {
        val plan = ServicePlan(id = planId, organizationId = organizationId, type = ServicePlanType.DAILY, price = BigDecimal.TEN, creditCount = 1, dailyCapacity = 2, active = false)
        `when`(branches.findWithLockById(branchId)).thenReturn(Branch(id = branchId, organizationId = organizationId, active = true))
        `when`(plans.findWithLockById(planId)).thenReturn(plan)
        assertThrows(IllegalArgumentException::class.java) { service.requireAvailability(organizationId, branchId, planId, listOf(date)) }
        assertThrows(IllegalArgumentException::class.java) { service.requireAvailability(UUID.randomUUID(), branchId, planId, listOf(date), requireActivePlan = false) }
        plan.active = true
        val setting = com.daycare.api.persistence.BranchCapacitySetting(organizationId = organizationId, branchId = branchId, dailyCapacity = 1)
        `when`(settings.findByOrganizationIdAndBranchId(organizationId, branchId)).thenReturn(setting)
        `when`(reservations.countByOrganizationIdAndBranchIdAndCapacityDateAndStatus(organizationId, branchId, date, CapacityReservationStatus.HELD)).thenReturn(0)
        `when`(reservations.countByOrganizationIdAndServicePlanIdAndCapacityDateAndStatus(organizationId, planId, date, CapacityReservationStatus.HELD)).thenReturn(0)
        assertEquals(plan, service.requireAvailability(organizationId, branchId, planId, listOf(date)))
    }

    @Test
    fun `reserve updates existing slots and releases entitlement reservations`() {
        val entitlementId = UUID.randomUUID()
        val existing = CapacityReservation(entitlementId = entitlementId, capacityDate = date, status = CapacityReservationStatus.RELEASED)
        `when`(reservations.findByEntitlementIdAndCapacityDate(entitlementId, date)).thenReturn(existing)
        service.reserve(organizationId, branchId, planId, entitlementId, listOf(date), mapOf(date to UUID.randomUUID()))
        assertEquals(CapacityReservationStatus.HELD, existing.status)
        service.releaseForEntitlements(emptyList())
        service.releaseForEntitlements(listOf(entitlementId))
        `when`(reservations.findAllByEntitlementIdIn(listOf(entitlementId))).thenReturn(listOf(existing))
        service.releaseForEntitlements(listOf(entitlementId))
        assertEquals(CapacityReservationStatus.RELEASED, existing.status)
        verify(reservations).saveAll(org.mockito.ArgumentMatchers.anyList())
    }

    @Test
    fun `set branch capacity respects held peak and creates or updates settings`() {
        val branch = Branch(id = branchId, organizationId = organizationId, active = true)
        `when`(branches.findWithLockById(branchId)).thenReturn(branch)
        `when`(reservations.findAllByOrganizationIdAndBranchIdAndCapacityDateGreaterThanEqualAndStatus(organizationId, branchId, LocalDate.now(), CapacityReservationStatus.HELD)).thenReturn(emptyList())
        `when`(settings.findByOrganizationIdAndBranchId(organizationId, branchId)).thenReturn(null)
        `when`(settings.save(org.mockito.ArgumentMatchers.any())).thenAnswer { it.arguments[0] }
        assertEquals(5, service.setBranchCapacity(organizationId, branchId, 5).dailyCapacity)
        assertThrows(IllegalArgumentException::class.java) { service.setBranchCapacity(organizationId, branchId, 0) }
        assertEquals(emptyList<com.daycare.api.persistence.BranchCapacitySetting>(), service.branchSettings(organizationId))
    }
}
