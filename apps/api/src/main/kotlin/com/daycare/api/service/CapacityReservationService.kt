package com.daycare.api.service

import com.daycare.api.domain.CapacityReservationStatus
import com.daycare.api.persistence.BranchCapacitySetting
import com.daycare.api.persistence.BranchCapacitySettingRepository
import com.daycare.api.persistence.BranchRepository
import com.daycare.api.persistence.CapacityReservation
import com.daycare.api.persistence.CapacityReservationRepository
import com.daycare.api.persistence.ServicePlan
import com.daycare.api.persistence.ServicePlanRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.LocalDate
import java.util.UUID

@Service
class CapacityReservationService(
    private val branches: BranchRepository,
    private val plans: ServicePlanRepository,
    private val settings: BranchCapacitySettingRepository,
    private val reservations: CapacityReservationRepository,
) {
    @Transactional
    fun requireAvailability(organizationId: UUID, branchId: UUID, planId: UUID, dates: List<LocalDate>, requireActivePlan: Boolean = true): ServicePlan {
        val branch = branches.findWithLockById(branchId) ?: throw IllegalArgumentException("Branch was not found")
        require(branch.organizationId == organizationId) { "Branch belongs to a different organization" }
        val plan = plans.findWithLockById(planId) ?: throw IllegalArgumentException("Service plan was not found")
        require(plan.organizationId == organizationId && (!requireActivePlan || plan.active)) { "Service plan is not available" }
        val branchCapacity = settings.findByOrganizationIdAndBranchId(organizationId, branchId)?.dailyCapacity
        dates.forEach { date ->
            if (branchCapacity != null) require(reservations.countByOrganizationIdAndBranchIdAndCapacityDateAndStatus(organizationId, branchId, date, CapacityReservationStatus.HELD) < branchCapacity) { "Branch capacity is full for one or more booking dates" }
            if (plan.dailyCapacity != null) require(reservations.countByOrganizationIdAndServicePlanIdAndCapacityDateAndStatus(organizationId, plan.id, date, CapacityReservationStatus.HELD) < plan.dailyCapacity!!) { "Service plan capacity is full for one or more booking dates" }
        }
        return plan
    }

    @Transactional
    fun reserve(organizationId: UUID, branchId: UUID, planId: UUID, entitlementId: UUID, dates: List<LocalDate>, bookingIdsByDate: Map<LocalDate, UUID> = emptyMap()) {
        reservations.saveAll(dates.map { date ->
            reservations.findByEntitlementIdAndCapacityDate(entitlementId, date)?.also { reservation -> reservation.status = CapacityReservationStatus.HELD; reservation.bookingId = bookingIdsByDate[date] }
                ?: CapacityReservation(organizationId = organizationId, branchId = branchId, servicePlanId = planId, entitlementId = entitlementId, bookingId = bookingIdsByDate[date], capacityDate = date)
        })
    }

    @Transactional
    fun releaseForBooking(bookingId: UUID) = release(reservations.findAllByBookingId(bookingId))

    @Transactional
    fun releaseForEntitlements(entitlementIds: Collection<UUID>) {
        if (entitlementIds.isNotEmpty()) release(reservations.findAllByEntitlementIdIn(entitlementIds))
    }

    @Transactional(readOnly = true)
    fun branchSettings(organizationId: UUID): List<BranchCapacitySetting> = settings.findAllByOrganizationId(organizationId)

    @Transactional
    fun setBranchCapacity(organizationId: UUID, branchId: UUID, dailyCapacity: Int): BranchCapacitySetting {
        require(dailyCapacity in 1..999) { "Daily capacity must be an integer between 1 and 999" }
        val branch = branches.findWithLockById(branchId) ?: throw IllegalArgumentException("Branch was not found")
        require(branch.organizationId == organizationId && branch.active) { "Branch is not available for this organization" }
        val peakHeldReservations = reservations.findAllByOrganizationIdAndBranchIdAndCapacityDateGreaterThanEqualAndStatus(organizationId, branchId, LocalDate.now(), CapacityReservationStatus.HELD)
            .groupingBy { it.capacityDate }.eachCount().values.maxOrNull() ?: 0
        require(dailyCapacity >= peakHeldReservations) { "Daily capacity cannot be lower than held reservations" }
        val setting = settings.findByOrganizationIdAndBranchId(organizationId, branchId) ?: BranchCapacitySetting(organizationId = organizationId, branchId = branchId)
        setting.dailyCapacity = dailyCapacity
        return settings.save(setting)
    }

    private fun release(source: List<CapacityReservation>) { source.filter { it.status == CapacityReservationStatus.HELD }.forEach { it.status = CapacityReservationStatus.RELEASED } }
}
