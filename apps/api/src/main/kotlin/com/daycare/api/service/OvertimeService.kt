package com.daycare.api.service

import com.daycare.api.domain.InvoiceSource
import com.daycare.api.domain.InvoiceStatus
import com.daycare.api.domain.InstitutionCapability
import com.daycare.api.domain.Role
import com.daycare.api.persistence.BranchOperatingHour
import com.daycare.api.persistence.BranchOperatingHourRepository
import com.daycare.api.persistence.BranchOvertimeRateTier
import com.daycare.api.persistence.BranchOvertimeRateTierRepository
import com.daycare.api.persistence.BranchRepository
import com.daycare.api.persistence.ChildRepository
import com.daycare.api.persistence.GuardianLinkRepository
import com.daycare.api.persistence.Invoice
import com.daycare.api.persistence.InvoiceRepository
import com.daycare.api.persistence.OvertimeCharge
import com.daycare.api.persistence.OvertimeChargeRepository
import com.daycare.api.persistence.OvertimeChargeTierSnapshot
import com.daycare.api.persistence.OvertimeChargeTierSnapshotRepository
import com.daycare.api.realtime.RealtimeFlag
import jakarta.validation.constraints.DecimalMin
import jakarta.validation.constraints.NotEmpty
import jakarta.validation.constraints.NotNull
import jakarta.validation.constraints.Positive
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.math.BigDecimal
import java.time.DayOfWeek
import java.time.LocalDate
import java.time.LocalTime
import java.util.UUID

data class OperatingHourInput(@field:NotNull val dayOfWeek: DayOfWeek, val active: Boolean, val opensAt: LocalTime? = null, val closesAt: LocalTime? = null)
data class OvertimeRateTierInput(@field:Positive val durationMinutes: Int, @field:DecimalMin("0.01") val amount: BigDecimal)
data class BranchOperatingHoursResponse(val branchId: UUID, val branchName: String, val timezone: String, val hours: List<OperatingHourInput>, val tiers: List<OvertimeRateTierInput>)
data class UpdateBranchOperatingHoursRequest(@field:NotEmpty val hours: List<OperatingHourInput>, @field:NotEmpty val tiers: List<OvertimeRateTierInput>)
data class CreateOvertimeChargeRequest(@field:NotNull val childId: UUID, @field:NotNull val operationalDate: LocalDate, @field:NotNull val pickedUpAt: LocalTime, @field:NotNull val dueDate: LocalDate)
data class OvertimeChargeResponse(val id: UUID, val invoiceId: UUID, val branchId: UUID, val childId: UUID, val childName: String, val operationalDate: LocalDate, val pickedUpAt: LocalTime, val closesAt: LocalTime, val overtimeMinutes: Int, val totalAmount: BigDecimal, val dueDate: LocalDate, val status: InvoiceStatus, val tiers: List<OvertimeRateTierInput>)

@Service
class OvertimeService(
    private val access: AccessService,
    private val branches: BranchRepository,
    private val children: ChildRepository,
    private val guardians: GuardianLinkRepository,
    private val invoices: InvoiceRepository,
    private val hours: BranchOperatingHourRepository,
    private val tiers: BranchOvertimeRateTierRepository,
    private val charges: OvertimeChargeRepository,
    private val snapshots: OvertimeChargeTierSnapshotRepository,
    private val notifications: NotificationService,
) {
    @Transactional(readOnly = true)
    fun branchHours(jwt: Jwt, organizationId: UUID, branchId: UUID): BranchOperatingHoursResponse {
        access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN), InstitutionCapability.DAYCARE_OPERATIONS, readOnly = true)
        return response(requireBranch(branchId, organizationId))
    }

    @Transactional
    fun updateBranchHours(jwt: Jwt, organizationId: UUID, branchId: UUID, request: UpdateBranchOperatingHoursRequest): BranchOperatingHoursResponse {
        access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN), InstitutionCapability.DAYCARE_OPERATIONS)
        val branch = requireBranch(branchId, organizationId)
        require(request.hours.size == DayOfWeek.entries.size && request.hours.map { it.dayOfWeek }.toSet().size == DayOfWeek.entries.size) { "Every day of week must be configured" }
        request.hours.forEach { hour -> require(!hour.active || (hour.opensAt != null && hour.closesAt != null && hour.closesAt.isAfter(hour.opensAt))) { "Operating hours are not valid" } }
        hours.deleteAllByBranchId(branchId)
        hours.saveAll(request.hours.map { hour -> BranchOperatingHour(branchId = branchId, dayOfWeek = hour.dayOfWeek, active = hour.active, opensAt = hour.opensAt, closesAt = hour.closesAt) })
        tiers.deleteAllByBranchId(branchId)
        tiers.saveAll(request.tiers.mapIndexed { index, tier -> BranchOvertimeRateTier(branchId = branchId, displayOrder = index, durationMinutes = tier.durationMinutes, amount = tier.amount) })
        return response(branch)
    }

    @Transactional(readOnly = true)
    fun parentHours(jwt: Jwt, organizationId: UUID): List<BranchOperatingHoursResponse> {
        val scope = access.require(jwt, organizationId, setOf(Role.PARENT), InstitutionCapability.DAYCARE_OPERATIONS, readOnly = true)
        val branchIds = guardians.findAllByUserId(scope.user.id).mapNotNull { link -> children.findById(link.childId).orElse(null)?.takeIf { it.organizationId == organizationId }?.branchId }.toSet()
        return branches.findAllByOrganizationIdAndActiveTrueOrderByNameAsc(organizationId).filter { it.id in branchIds }.map(::response)
    }

    @Transactional(readOnly = true)
    fun charges(jwt: Jwt, organizationId: UUID): List<OvertimeChargeResponse> {
        access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN), InstitutionCapability.DAYCARE_OPERATIONS, readOnly = true)
        return charges.findAllByOrganizationIdOrderByOperationalDateDesc(organizationId).map(::chargeResponse)
    }

    @Transactional
    fun createCharge(jwt: Jwt, organizationId: UUID, request: CreateOvertimeChargeRequest): OvertimeChargeResponse {
        access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN), InstitutionCapability.DAYCARE_OPERATIONS)
        val child = children.findById(request.childId).orElseThrow { IllegalArgumentException("Child was not found") }
        require(child.organizationId == organizationId) { "Child belongs to a different organization" }
        require(charges.findAllByOrganizationIdAndChildIdAndOperationalDate(organizationId, child.id, request.operationalDate).none { invoices.findById(it.invoiceId).orElseThrow().status != InvoiceStatus.VOID }) { "Overtime charge already exists" }
        return persistCharge(organizationId, child.id, child.branchId, request, null)
    }

    @Transactional
    fun updateCharge(jwt: Jwt, organizationId: UUID, chargeId: UUID, request: CreateOvertimeChargeRequest): OvertimeChargeResponse {
        access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN), InstitutionCapability.DAYCARE_OPERATIONS)
        val charge = charges.findById(chargeId).orElseThrow { IllegalArgumentException("Overtime charge was not found") }
        require(charge.organizationId == organizationId) { "Overtime charge belongs to a different organization" }
        val invoice = invoices.findById(charge.invoiceId).orElseThrow { IllegalArgumentException("Invoice was not found") }
        require(invoice.status == InvoiceStatus.PENDING) { "Overtime charge is not awaiting payment" }
        require(request.childId == charge.childId && request.operationalDate == charge.operationalDate) { "Child and operational date cannot change" }
        return persistCharge(organizationId, charge.childId, charge.branchId, request, charge)
    }

    @Transactional
    fun voidCharge(jwt: Jwt, organizationId: UUID, chargeId: UUID) {
        access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN), InstitutionCapability.DAYCARE_OPERATIONS)
        val charge = charges.findById(chargeId).orElseThrow { IllegalArgumentException("Overtime charge was not found") }
        require(charge.organizationId == organizationId) { "Overtime charge belongs to a different organization" }
        val invoice = invoices.findById(charge.invoiceId).orElseThrow { IllegalArgumentException("Invoice was not found") }
        require(invoice.status == InvoiceStatus.PENDING) { "Overtime charge is not awaiting payment" }
        invoice.status = InvoiceStatus.VOID
        notifications.notify(organizationId, charge.payerUserId, "Tagihan overtime dibatalkan", "Tagihan overtime untuk ${charge.operationalDate} telah dibatalkan.", realtimeFlags = setOf(RealtimeFlag.INVOICES))
    }

    private fun persistCharge(organizationId: UUID, childId: UUID, branchId: UUID, request: CreateOvertimeChargeRequest, existing: OvertimeCharge?): OvertimeChargeResponse {
        require(!request.dueDate.isBefore(LocalDate.now())) { "Invoice due date is not valid" }
        val branch = requireBranch(branchId, organizationId)
        val closing = hours.findAllByBranchIdOrderByDayOfWeekAsc(branch.id).singleOrNull { it.dayOfWeek == request.operationalDate.dayOfWeek && it.active } ?: throw IllegalArgumentException("Branch is not operating on this day")
        val closesAt = closing.closesAt ?: throw IllegalArgumentException("Branch operating hours are not valid")
        require(request.pickedUpAt.isAfter(closesAt)) { "Pickup time is within operating hours" }
        val minutes = java.time.Duration.between(closesAt, request.pickedUpAt).toMinutes().toInt()
        val configured = tiers.findAllByBranchIdOrderByDisplayOrderAsc(branch.id)
        require(configured.isNotEmpty()) { "Overtime rates are not configured" }
        val amount = calculateCappedCumulativeOvertimeAmount(minutes, configured.map { OvertimePricingTier(it.durationMinutes, it.amount) })
        val parentId = existing?.payerUserId ?: guardians.findAllByChildId(childId).firstOrNull()?.userId ?: throw IllegalArgumentException("Child does not have a linked parent")
        val invoice = existing?.let { invoices.findById(it.invoiceId).orElseThrow { IllegalArgumentException("Invoice was not found") } } ?: invoices.save(Invoice(organizationId = organizationId, payerUserId = parentId, invoiceNumber = "INV-${UUID.randomUUID().toString().take(8).uppercase()}", subtotalAmount = amount, totalAmount = amount, dueDate = request.dueDate, source = InvoiceSource.OVERTIME, branchId = branchId, childId = childId))
        invoice.subtotalAmount = amount; invoice.totalAmount = amount; invoice.dueDate = request.dueDate; invoice.branchId = branchId; invoice.childId = childId; invoice.description = null
        val charge = existing ?: OvertimeCharge(organizationId = organizationId, branchId = branchId, childId = childId, payerUserId = parentId, invoiceId = invoice.id)
        charge.pickedUpAt = request.pickedUpAt; charge.operationalDate = request.operationalDate; charge.closesAt = closesAt; charge.overtimeMinutes = minutes; charge.totalAmount = amount
        charges.save(charge)
        snapshots.deleteAllByOvertimeChargeId(charge.id)
        snapshots.saveAll(configured.map { tier -> OvertimeChargeTierSnapshot(overtimeChargeId = charge.id, displayOrder = tier.displayOrder, durationMinutes = tier.durationMinutes, amount = tier.amount) })
        notifications.notify(organizationId, parentId, if (existing == null) "Tagihan overtime baru" else "Tagihan overtime diperbarui", "Tagihan overtime untuk ${request.operationalDate} menunggu pembayaran.", realtimeFlags = setOf(RealtimeFlag.INVOICES))
        return chargeResponse(charge)
    }

    private fun response(branch: com.daycare.api.persistence.Branch) = BranchOperatingHoursResponse(branch.id, branch.name, branch.timezone, hours.findAllByBranchIdOrderByDayOfWeekAsc(branch.id).map { OperatingHourInput(it.dayOfWeek, it.active, it.opensAt, it.closesAt) }, tiers.findAllByBranchIdOrderByDisplayOrderAsc(branch.id).map { OvertimeRateTierInput(it.durationMinutes, it.amount) })
    private fun chargeResponse(charge: OvertimeCharge): OvertimeChargeResponse { val invoice = invoices.findById(charge.invoiceId).orElseThrow(); val child = children.findById(charge.childId).orElseThrow(); return OvertimeChargeResponse(charge.id, invoice.id, charge.branchId, charge.childId, listOfNotNull(child.firstName, child.lastName).joinToString(" "), charge.operationalDate, charge.pickedUpAt, charge.closesAt, charge.overtimeMinutes, charge.totalAmount, invoice.dueDate, invoice.status, snapshots.findAllByOvertimeChargeIdOrderByDisplayOrderAsc(charge.id).map { OvertimeRateTierInput(it.durationMinutes, it.amount) }) }
    private fun requireBranch(branchId: UUID, organizationId: UUID) = branches.findById(branchId).orElseThrow { IllegalArgumentException("Branch was not found") }.also { require(it.organizationId == organizationId) { "Branch belongs to a different organization" } }
}
