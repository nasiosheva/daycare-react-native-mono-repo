package com.daycare.api.service

import com.daycare.api.domain.InstitutionCapability
import com.daycare.api.domain.InvoiceSource
import com.daycare.api.domain.InvoiceStatus
import com.daycare.api.domain.Role
import com.daycare.api.persistence.AttendanceRecord
import com.daycare.api.persistence.AttendanceRepository
import com.daycare.api.persistence.Branch
import com.daycare.api.persistence.BranchOperatingHour
import com.daycare.api.persistence.BranchOperatingHourRepository
import com.daycare.api.persistence.BranchOvertimeRateTier
import com.daycare.api.persistence.BranchOvertimeRateTierRepository
import com.daycare.api.persistence.BranchRepository
import com.daycare.api.persistence.Child
import com.daycare.api.persistence.ChildRepository
import com.daycare.api.persistence.GuardianLink
import com.daycare.api.persistence.GuardianLinkRepository
import com.daycare.api.persistence.InvoiceRepository
import com.daycare.api.persistence.Invoice
import com.daycare.api.persistence.MembershipRepository
import com.daycare.api.persistence.OrganizationRepository
import com.daycare.api.persistence.UserProfile
import com.daycare.api.persistence.OvertimeChargeRepository
import com.daycare.api.persistence.OvertimeChargeTierSnapshotRepository
import com.daycare.api.persistence.OvertimeChargeTierSnapshot
import com.daycare.api.realtime.RealtimeFlag
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Test
import org.mockito.ArgumentCaptor
import org.mockito.ArgumentMatchers.any
import org.mockito.Mockito.mock
import org.mockito.Mockito.never
import org.mockito.Mockito.verify
import org.mockito.Mockito.verifyNoInteractions
import org.mockito.Mockito.`when`
import java.math.BigDecimal
import java.time.ZoneId
import java.time.ZonedDateTime
import java.util.Optional
import java.util.UUID

class OvertimeServiceTest {
    private val access = mock(AccessService::class.java)
    private val branches = mock(BranchRepository::class.java)
    private val children = mock(ChildRepository::class.java)
    private val guardians = mock(GuardianLinkRepository::class.java)
    private val hours = mock(BranchOperatingHourRepository::class.java)
    private val tiers = mock(BranchOvertimeRateTierRepository::class.java)
    private val attendance = mock(AttendanceRepository::class.java)
    private val notifications = mock(NotificationService::class.java)
    private val publishedOfferings = mock(PublishedOfferingCapabilityService::class.java)
    private val invoices = mock(InvoiceRepository::class.java)
    private val charges = mock(OvertimeChargeRepository::class.java)
    private val snapshots = mock(OvertimeChargeTierSnapshotRepository::class.java)
    private val memberships = mock(MembershipRepository::class.java)

    private fun service() = OvertimeService(
        access, branches, children, guardians, invoices,
        hours, tiers, charges, snapshots,
        attendance, notifications, mock(IdentityService::class.java), memberships,
        mock(OrganizationRepository::class.java), publishedOfferings,
    )

    @Test
    fun `notifies guardians and marks the record once a child is still checked in past closing time`() {
        val organizationId = UUID.randomUUID()
        val now = ZonedDateTime.now(ZoneId.of("UTC"))
        val branch = Branch(organizationId = organizationId, name = "Utama", timezone = "UTC")
        val child = Child(organizationId = organizationId, branchId = branch.id, firstName = "Alya")
        val record = AttendanceRecord(organizationId = organizationId, branchId = branch.id, childId = child.id, operationalDate = now.toLocalDate(), checkedInAt = now.toInstant().minusSeconds(3600))
        val guardianLink = GuardianLink(childId = child.id, userId = UUID.randomUUID())

        `when`(attendance.findAllByCheckedOutAtIsNull()).thenReturn(listOf(record))
        `when`(branches.findAllById(setOf(branch.id))).thenReturn(listOf(branch))
        `when`(branches.findById(branch.id)).thenReturn(Optional.of(branch))
        `when`(hours.findAllByBranchIdIn(setOf(branch.id))).thenReturn(listOf(BranchOperatingHour(branchId = branch.id, dayOfWeek = now.dayOfWeek, active = true, closesAt = now.toLocalTime().minusMinutes(1))))
        `when`(tiers.findAllByBranchIdIn(setOf(branch.id))).thenReturn(listOf(BranchOvertimeRateTier(branchId = branch.id, durationMinutes = 15, amount = BigDecimal("10000"))))
        `when`(guardians.findAllByChildIdIn(setOf(child.id))).thenReturn(listOf(guardianLink))
        `when`(children.findById(child.id)).thenReturn(Optional.of(child))
        `when`(publishedOfferings.hasPublishedCapability(organizationId, InstitutionCapability.DAYCARE_OPERATIONS, branch.id)).thenReturn(true)

        service().sendOvertimeAlerts()

        verify(notifications).notify(organizationId, guardianLink.userId, "Anak masih di lokasi", "Alya masih tercatat hadir melewati jam operasional cabang dan dapat dikenakan biaya tambahan.", null, setOf(RealtimeFlag.ATTENDANCE))
        val saved = ArgumentCaptor.forClass(AttendanceRecord::class.java)
        verify(attendance).save(saved.capture())
        assertNotNull(saved.value.overtimeAlertSentAt)
        verify(invoices, never()).save(any(Invoice::class.java))
    }

    @Test
    fun `does not notify while the branch is still within operating hours`() {
        val organizationId = UUID.randomUUID()
        val now = ZonedDateTime.now(ZoneId.of("UTC"))
        val branch = Branch(organizationId = organizationId, name = "Utama", timezone = "UTC")
        val child = Child(organizationId = organizationId, branchId = branch.id, firstName = "Alya")
        val record = AttendanceRecord(organizationId = organizationId, branchId = branch.id, childId = child.id, operationalDate = now.toLocalDate(), checkedInAt = now.toInstant().minusSeconds(3600))

        `when`(attendance.findAllByCheckedOutAtIsNull()).thenReturn(listOf(record))
        `when`(branches.findAllById(setOf(branch.id))).thenReturn(listOf(branch))
        `when`(hours.findAllByBranchIdIn(setOf(branch.id))).thenReturn(listOf(BranchOperatingHour(branchId = branch.id, dayOfWeek = now.dayOfWeek, active = true, closesAt = now.toLocalTime().plusHours(2))))
        `when`(tiers.findAllByBranchIdIn(setOf(branch.id))).thenReturn(listOf(BranchOvertimeRateTier(branchId = branch.id, durationMinutes = 15, amount = BigDecimal("10000"))))
        `when`(publishedOfferings.hasPublishedCapability(organizationId, InstitutionCapability.DAYCARE_OPERATIONS, branch.id)).thenReturn(true)

        service().sendOvertimeAlerts()

        verifyNoInteractions(notifications)
    }

    @Test
    fun `does not notify when the branch has no overtime rate tiers configured`() {
        val organizationId = UUID.randomUUID()
        val now = ZonedDateTime.now(ZoneId.of("UTC"))
        val branch = Branch(organizationId = organizationId, name = "Utama", timezone = "UTC")
        val child = Child(organizationId = organizationId, branchId = branch.id, firstName = "Alya")
        val record = AttendanceRecord(organizationId = organizationId, branchId = branch.id, childId = child.id, operationalDate = now.toLocalDate(), checkedInAt = now.toInstant().minusSeconds(3600))

        `when`(attendance.findAllByCheckedOutAtIsNull()).thenReturn(listOf(record))
        `when`(branches.findAllById(setOf(branch.id))).thenReturn(listOf(branch))
        `when`(hours.findAllByBranchIdIn(setOf(branch.id))).thenReturn(listOf(BranchOperatingHour(branchId = branch.id, dayOfWeek = now.dayOfWeek, active = true, closesAt = now.toLocalTime().minusMinutes(1))))
        `when`(tiers.findAllByBranchIdIn(setOf(branch.id))).thenReturn(emptyList())

        service().sendOvertimeAlerts()

        verifyNoInteractions(notifications)
    }

    @Test
    fun `creates a pending overtime invoice after the enabled branch grace period`() {
        val organizationId = UUID.randomUUID()
        val now = ZonedDateTime.now(ZoneId.of("UTC"))
        val branch = Branch(organizationId = organizationId, name = "Utama", timezone = "UTC", autoOvertimeBillingEnabled = true, overtimeGraceMinutes = 0)
        val child = Child(organizationId = organizationId, branchId = branch.id, firstName = "Alya")
        val record = AttendanceRecord(organizationId = organizationId, branchId = branch.id, childId = child.id, operationalDate = now.toLocalDate(), checkedInAt = now.toInstant().minusSeconds(3600))
        val guardianLink = GuardianLink(childId = child.id, userId = UUID.randomUUID())

        `when`(attendance.findAllByCheckedOutAtIsNull()).thenReturn(listOf(record))
        `when`(branches.findAllById(setOf(branch.id))).thenReturn(listOf(branch))
        `when`(branches.findById(branch.id)).thenReturn(Optional.of(branch))
        `when`(hours.findAllByBranchIdIn(setOf(branch.id))).thenReturn(listOf(BranchOperatingHour(branchId = branch.id, dayOfWeek = now.dayOfWeek, active = true, closesAt = now.toLocalTime().minusMinutes(2))))
        `when`(tiers.findAllByBranchIdIn(setOf(branch.id))).thenReturn(listOf(BranchOvertimeRateTier(branchId = branch.id, durationMinutes = 15, amount = BigDecimal("10000"))))
        `when`(guardians.findAllByChildIdIn(setOf(child.id))).thenReturn(listOf(guardianLink))
        `when`(children.findById(child.id)).thenReturn(Optional.of(child))
        `when`(publishedOfferings.hasPublishedCapability(organizationId, InstitutionCapability.DAYCARE_OPERATIONS, branch.id)).thenReturn(true)
        `when`(memberships.findAllByUserIdAndOrganizationId(guardianLink.userId, organizationId)).thenReturn(listOf(com.daycare.api.persistence.Membership(userId = guardianLink.userId, organizationId = organizationId, role = Role.PARENT, active = true)))
        `when`(charges.findAllByOrganizationIdAndChildIdAndOperationalDate(organizationId, child.id, now.toLocalDate())).thenReturn(emptyList())
        `when`(hours.findAllByBranchIdOrderByDayOfWeekAsc(branch.id)).thenReturn(listOf(BranchOperatingHour(branchId = branch.id, dayOfWeek = now.dayOfWeek, active = true, closesAt = now.toLocalTime().minusMinutes(2))))
        `when`(tiers.findAllByBranchIdOrderByDisplayOrderAsc(branch.id)).thenReturn(listOf(BranchOvertimeRateTier(branchId = branch.id, durationMinutes = 15, amount = BigDecimal("10000"))))
        `when`(invoices.save(any(Invoice::class.java))).thenAnswer { it.arguments[0] }
        `when`(charges.save(any(com.daycare.api.persistence.OvertimeCharge::class.java))).thenAnswer { it.arguments[0] }

        service().sendOvertimeAlerts()

        val invoice = ArgumentCaptor.forClass(com.daycare.api.persistence.Invoice::class.java)
        verify(invoices).save(invoice.capture())
        assertEquals(InvoiceSource.OVERTIME, invoice.value.source)
        assertEquals(guardianLink.userId, invoice.value.payerUserId)
    }

    @Test
    fun `does not create a duplicate automatic invoice for the same child and operational date`() {
        val organizationId = UUID.randomUUID()
        val now = ZonedDateTime.now(ZoneId.of("UTC"))
        val branch = Branch(organizationId = organizationId, name = "Utama", timezone = "UTC", autoOvertimeBillingEnabled = true, overtimeGraceMinutes = 0)
        val child = Child(organizationId = organizationId, branchId = branch.id, firstName = "Alya")
        val record = AttendanceRecord(organizationId = organizationId, branchId = branch.id, childId = child.id, operationalDate = now.toLocalDate(), checkedInAt = now.toInstant().minusSeconds(3600))
        val existingInvoice = Invoice(organizationId = organizationId, payerUserId = UUID.randomUUID(), invoiceNumber = "INV-EXISTS", status = InvoiceStatus.PENDING)
        val existingCharge = com.daycare.api.persistence.OvertimeCharge(organizationId = organizationId, branchId = branch.id, childId = child.id, payerUserId = existingInvoice.payerUserId, invoiceId = existingInvoice.id, operationalDate = now.toLocalDate())

        `when`(attendance.findAllByCheckedOutAtIsNull()).thenReturn(listOf(record))
        `when`(branches.findAllById(setOf(branch.id))).thenReturn(listOf(branch))
        `when`(hours.findAllByBranchIdIn(setOf(branch.id))).thenReturn(listOf(BranchOperatingHour(branchId = branch.id, dayOfWeek = now.dayOfWeek, active = true, closesAt = now.toLocalTime().minusMinutes(2))))
        `when`(tiers.findAllByBranchIdIn(setOf(branch.id))).thenReturn(listOf(BranchOvertimeRateTier(branchId = branch.id, durationMinutes = 15, amount = BigDecimal("10000"))))
        `when`(children.findById(child.id)).thenReturn(Optional.of(child))
        `when`(publishedOfferings.hasPublishedCapability(organizationId, InstitutionCapability.DAYCARE_OPERATIONS, branch.id)).thenReturn(true)
        `when`(charges.findAllByOrganizationIdAndChildIdAndOperationalDate(organizationId, child.id, now.toLocalDate())).thenReturn(listOf(existingCharge))
        `when`(invoices.findById(existingInvoice.id)).thenReturn(Optional.of(existingInvoice))

        service().sendOvertimeAlerts()

        verify(invoices).findById(existingInvoice.id)
        verify(invoices, never()).save(any(Invoice::class.java))
    }

    @Test
    fun `staff admin can read and replace branch operating hours with overtime tiers`() {
        val organizationId = UUID.randomUUID()
        val branch = Branch(organizationId = organizationId, name = "Utama", timezone = "Asia/Jakarta")
        val scope = AccessScope(UserProfile(), com.daycare.api.persistence.Membership(organizationId = organizationId, role = Role.STAFF_ADMIN), emptySet(), setOf(InstitutionCapability.DAYCARE_OPERATIONS))
        val jwt = mock(org.springframework.security.oauth2.jwt.Jwt::class.java)
        `when`(access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN), InstitutionCapability.DAYCARE_OPERATIONS, readOnly = true)).thenReturn(scope)
        `when`(access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN), InstitutionCapability.DAYCARE_OPERATIONS)).thenReturn(scope)
        `when`(branches.findById(branch.id)).thenReturn(Optional.of(branch))
        `when`(hours.findAllByBranchIdOrderByDayOfWeekAsc(branch.id)).thenReturn(listOf(BranchOperatingHour(branchId = branch.id, dayOfWeek = java.time.DayOfWeek.MONDAY, active = true, opensAt = java.time.LocalTime.of(7, 0), closesAt = java.time.LocalTime.of(16, 0))))
        `when`(tiers.findAllByBranchIdOrderByDisplayOrderAsc(branch.id)).thenReturn(listOf(BranchOvertimeRateTier(branchId = branch.id, durationMinutes = 30, amount = BigDecimal("10000"))))

        val response = service().branchHours(jwt, organizationId, branch.id)
        assertEquals("Utama", response.branchName)
        assertEquals(1, response.tiers.size)
        val allHours = java.time.DayOfWeek.entries.map { OperatingHourInput(it, true, java.time.LocalTime.of(7, 0), java.time.LocalTime.of(16, 0)) }
        assertEquals(1, service().updateBranchHours(jwt, organizationId, branch.id, UpdateBranchOperatingHoursRequest(allHours, listOf(OvertimeRateTierInput(30, BigDecimal("10000"))), autoOvertimeBillingEnabled = true)).tiers.size)
        verify(hours).deleteAllByBranchId(branch.id)
        verify(tiers).deleteAllByBranchId(branch.id)
    }

    @Test
    fun `operating hour update rejects incomplete days and automatic billing without tiers`() {
        val organizationId = UUID.randomUUID()
        val branch = Branch(organizationId = organizationId, name = "Utama")
        val jwt = mock(org.springframework.security.oauth2.jwt.Jwt::class.java)
        val scope = AccessScope(UserProfile(), com.daycare.api.persistence.Membership(organizationId = organizationId, role = Role.STAFF_ADMIN), emptySet(), emptySet())
        `when`(access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN), InstitutionCapability.DAYCARE_OPERATIONS)).thenReturn(scope)
        `when`(branches.findById(branch.id)).thenReturn(Optional.of(branch))
        assertThrows(IllegalArgumentException::class.java) { service().updateBranchHours(jwt, organizationId, branch.id, UpdateBranchOperatingHoursRequest(emptyList(), emptyList())) }
        val allHours = java.time.DayOfWeek.entries.map { OperatingHourInput(it, true, java.time.LocalTime.of(7, 0), java.time.LocalTime.of(6, 0)) }
        assertThrows(IllegalArgumentException::class.java) { service().updateBranchHours(jwt, organizationId, branch.id, UpdateBranchOperatingHoursRequest(allHours, emptyList())) }
        val validHours = java.time.DayOfWeek.entries.map { OperatingHourInput(it, false) }
        assertThrows(IllegalArgumentException::class.java) { service().updateBranchHours(jwt, organizationId, branch.id, UpdateBranchOperatingHoursRequest(validHours, emptyList(), autoOvertimeBillingEnabled = true)) }
    }

    @Test
    fun `staff admin creates updates voids and lists an overtime charge`() {
        val organizationId = UUID.randomUUID()
        val branch = Branch(organizationId = organizationId, name = "Utama")
        val child = Child(organizationId = organizationId, branchId = branch.id, firstName = "Alya")
        val parentId = UUID.randomUUID()
        val jwt = mock(org.springframework.security.oauth2.jwt.Jwt::class.java)
        val scope = AccessScope(UserProfile(), com.daycare.api.persistence.Membership(organizationId = organizationId, role = Role.STAFF_ADMIN), emptySet(), emptySet())
        `when`(access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN), InstitutionCapability.DAYCARE_OPERATIONS)).thenReturn(scope)
        `when`(access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN), InstitutionCapability.DAYCARE_OPERATIONS, readOnly = true)).thenReturn(scope)
        `when`(children.findById(child.id)).thenReturn(Optional.of(child))
        `when`(branches.findById(branch.id)).thenReturn(Optional.of(branch))
        `when`(hours.findAllByBranchIdOrderByDayOfWeekAsc(branch.id)).thenReturn(listOf(BranchOperatingHour(branchId = branch.id, dayOfWeek = java.time.LocalDate.now().dayOfWeek, active = true, closesAt = java.time.LocalTime.of(16, 0))))
        `when`(tiers.findAllByBranchIdOrderByDisplayOrderAsc(branch.id)).thenReturn(listOf(BranchOvertimeRateTier(branchId = branch.id, durationMinutes = 30, amount = BigDecimal("10000"))))
        `when`(guardians.findAllByChildId(child.id)).thenReturn(listOf(GuardianLink(childId = child.id, userId = parentId)))
        `when`(charges.findAllByOrganizationIdAndChildIdAndOperationalDate(organizationId, child.id, java.time.LocalDate.now())).thenReturn(emptyList())
        val savedInvoice = Invoice(organizationId = organizationId, payerUserId = parentId, invoiceNumber = "INV", status = InvoiceStatus.PENDING)
        `when`(invoices.save(any(Invoice::class.java))).thenReturn(savedInvoice)
        `when`(invoices.findById(savedInvoice.id)).thenReturn(Optional.of(savedInvoice))
        `when`(charges.save(any(com.daycare.api.persistence.OvertimeCharge::class.java))).thenAnswer { it.arguments[0] }
        val service = service()
        val date = java.time.LocalDate.now()
        val request = CreateOvertimeChargeRequest(child.id, date, java.time.LocalTime.of(16, 30), date.plusDays(2))
        val charge = service.createCharge(jwt, organizationId, request)
        assertEquals(parentId, charge.invoiceId.let { invoices.findById(it).orElseThrow().payerUserId })
        val existing = com.daycare.api.persistence.OvertimeCharge(organizationId = organizationId, branchId = branch.id, childId = child.id, payerUserId = parentId, invoiceId = charge.invoiceId, operationalDate = date)
        `when`(charges.findById(existing.id)).thenReturn(Optional.of(existing))
        `when`(invoices.findById(existing.invoiceId)).thenReturn(Optional.of(Invoice(id = existing.invoiceId, organizationId = organizationId, payerUserId = parentId, invoiceNumber = "INV", status = InvoiceStatus.PENDING)))
        `when`(snapshots.findAllByOvertimeChargeIdOrderByDisplayOrderAsc(existing.id)).thenReturn(emptyList())
        service.updateCharge(jwt, organizationId, existing.id, request)
        service.voidCharge(jwt, organizationId, existing.id)
        verify(notifications).notify(organizationId, parentId, "Tagihan overtime dibatalkan", "Tagihan overtime untuk $date telah dibatalkan.", null, setOf(RealtimeFlag.INVOICES))
    }

    @Test
    fun `Parent operating hours only include linked children with published daycare offerings`() {
        val organizationId = UUID.randomUUID()
        val parent = UserProfile(registrationRole = com.daycare.api.domain.RegistrationRole.PARENT)
        val jwt = mock(org.springframework.security.oauth2.jwt.Jwt::class.java)
        val parentScope = AccessScope(parent, com.daycare.api.persistence.Membership(userId = parent.id, organizationId = organizationId, role = Role.PARENT), emptySet(), setOf(InstitutionCapability.DAYCARE_OPERATIONS))
        `when`(access.require(jwt, organizationId, setOf(Role.PARENT), InstitutionCapability.DAYCARE_OPERATIONS, readOnly = true)).thenReturn(parentScope)
        val branch = Branch(organizationId = organizationId, name = "Cabang")
        val child = Child(organizationId = organizationId, branchId = branch.id, firstName = "Alya")
        val unrelated = Child(organizationId = UUID.randomUUID(), branchId = UUID.randomUUID(), firstName = "Lain")
        val link = GuardianLink(childId = child.id, userId = parent.id)
        val foreignLink = GuardianLink(childId = unrelated.id, userId = parent.id)
        `when`(guardians.findAllByUserId(parent.id)).thenReturn(listOf(link, foreignLink))
        `when`(children.findById(child.id)).thenReturn(Optional.of(child))
        `when`(children.findById(unrelated.id)).thenReturn(Optional.of(unrelated))
        `when`(branches.findAllByOrganizationIdAndActiveTrueOrderByNameAsc(organizationId)).thenReturn(listOf(branch))
        `when`(publishedOfferings.hasPublishedCapability(organizationId, InstitutionCapability.DAYCARE_OPERATIONS, branch.id)).thenReturn(true)
        `when`(hours.findAllByBranchIdOrderByDayOfWeekAsc(branch.id)).thenReturn(emptyList())
        `when`(tiers.findAllByBranchIdOrderByDisplayOrderAsc(branch.id)).thenReturn(emptyList())
        assertEquals(listOf(branch.id), service().parentHours(jwt, organizationId).map { it.branchId })
    }

    @Test
    fun `Parent all-tenant operating hours skips inactive memberships missing branches and unpublished offerings`() {
        val user = UserProfile(registrationRole = com.daycare.api.domain.RegistrationRole.PARENT)
        val jwt = mock(org.springframework.security.oauth2.jwt.Jwt::class.java)
        val orgA = UUID.randomUUID(); val orgB = UUID.randomUUID(); val orgMissing = UUID.randomUUID()
        // Rebuild the service with the identity mock used by this scenario.
        val identity = mock(IdentityService::class.java)
        `when`(identity.sync(jwt)).thenReturn(user)
        val organizationRepository = mock(OrganizationRepository::class.java)
        val scopedService = OvertimeService(access, branches, children, guardians, invoices, hours, tiers, charges, snapshots, attendance, notifications, identity, memberships, organizationRepository, publishedOfferings)
        `when`(memberships.findAllByUserId(user.id)).thenReturn(listOf(
            com.daycare.api.persistence.Membership(userId = user.id, organizationId = orgA, role = Role.PARENT, active = true),
            com.daycare.api.persistence.Membership(userId = user.id, organizationId = orgB, role = Role.PARENT, active = false),
            com.daycare.api.persistence.Membership(userId = user.id, organizationId = orgMissing, role = Role.STAFF, active = true),
        ))
        val branch = Branch(organizationId = orgA, name = "Cabang A", timezone = "UTC")
        val child = Child(organizationId = orgA, branchId = branch.id, firstName = "Alya")
        val childNoBranch = Child(organizationId = orgA, branchId = UUID.randomUUID(), firstName = "Bima")
        val childUnpublished = Child(organizationId = orgB, branchId = UUID.randomUUID(), firstName = "Citra")
        `when`(guardians.findAllByUserId(user.id)).thenReturn(listOf(GuardianLink(childId = child.id, userId = user.id), GuardianLink(childId = childNoBranch.id, userId = user.id), GuardianLink(childId = childUnpublished.id, userId = user.id)))
        `when`(children.findById(child.id)).thenReturn(Optional.of(child))
        `when`(children.findById(childNoBranch.id)).thenReturn(Optional.of(childNoBranch))
        `when`(children.findById(childUnpublished.id)).thenReturn(Optional.of(childUnpublished))
        `when`(publishedOfferings.hasPublishedCapability(orgA, InstitutionCapability.DAYCARE_OPERATIONS, branch.id)).thenReturn(true)
        `when`(publishedOfferings.hasPublishedCapability(orgA, InstitutionCapability.DAYCARE_OPERATIONS, childNoBranch.branchId)).thenReturn(true)
        `when`(publishedOfferings.hasPublishedCapability(orgB, InstitutionCapability.DAYCARE_OPERATIONS, childUnpublished.branchId)).thenReturn(false)
        `when`(branches.findById(branch.id)).thenReturn(Optional.of(branch))
        `when`(branches.findById(childNoBranch.branchId)).thenReturn(Optional.empty())
        `when`(hours.findAllByBranchIdOrderByDayOfWeekAsc(branch.id)).thenReturn(emptyList())
        `when`(tiers.findAllByBranchIdOrderByDisplayOrderAsc(branch.id)).thenReturn(emptyList())
        `when`(organizationRepository.findById(orgA)).thenReturn(Optional.of(com.daycare.api.persistence.Organization(id = orgA, name = "A")))
        assertEquals(listOf("Alya"), scopedService.parentHoursAllTenants(jwt).map { it.childName })
    }

    @Test
    fun `charge listing maps invoice child and snapshots`() {
        val organizationId = UUID.randomUUID(); val branch = Branch(organizationId = organizationId); val child = Child(organizationId = organizationId, branchId = branch.id, firstName = "Alya")
        val jwt = mock(org.springframework.security.oauth2.jwt.Jwt::class.java)
        val scope = AccessScope(UserProfile(), com.daycare.api.persistence.Membership(organizationId = organizationId, role = Role.STAFF_ADMIN), emptySet(), setOf(InstitutionCapability.DAYCARE_OPERATIONS))
        `when`(access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN), InstitutionCapability.DAYCARE_OPERATIONS, readOnly = true)).thenReturn(scope)
        val invoice = Invoice(organizationId = organizationId, payerUserId = UUID.randomUUID(), invoiceNumber = "INV", dueDate = java.time.LocalDate.now().plusDays(1), status = com.daycare.api.domain.InvoiceStatus.PENDING)
        val charge = com.daycare.api.persistence.OvertimeCharge(organizationId = organizationId, branchId = branch.id, childId = child.id, invoiceId = invoice.id, operationalDate = java.time.LocalDate.now(), pickedUpAt = java.time.LocalTime.of(17, 0), closesAt = java.time.LocalTime.of(16, 0), overtimeMinutes = 60, totalAmount = BigDecimal("100"))
        `when`(charges.findAllByOrganizationIdOrderByOperationalDateDesc(organizationId)).thenReturn(listOf(charge))
        `when`(invoices.findById(invoice.id)).thenReturn(Optional.of(invoice))
        `when`(children.findById(child.id)).thenReturn(Optional.of(child))
        `when`(snapshots.findAllByOvertimeChargeIdOrderByDisplayOrderAsc(charge.id)).thenReturn(listOf(OvertimeChargeTierSnapshot(overtimeChargeId = charge.id, displayOrder = 0, durationMinutes = 15, amount = BigDecimal("100"))))
        assertEquals(1, service().charges(jwt, organizationId).single().tiers.size)
    }
}
