package com.daycare.api.service

import com.daycare.api.domain.InstitutionCapability
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
import com.daycare.api.persistence.MembershipRepository
import com.daycare.api.persistence.OrganizationRepository
import com.daycare.api.persistence.OvertimeChargeRepository
import com.daycare.api.persistence.OvertimeChargeTierSnapshotRepository
import com.daycare.api.realtime.RealtimeFlag
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Test
import org.mockito.ArgumentCaptor
import org.mockito.Mockito.mock
import org.mockito.Mockito.verify
import org.mockito.Mockito.verifyNoInteractions
import org.mockito.Mockito.`when`
import java.math.BigDecimal
import java.time.ZoneId
import java.time.ZonedDateTime
import java.util.Optional
import java.util.UUID

class OvertimeServiceTest {
    private val branches = mock(BranchRepository::class.java)
    private val children = mock(ChildRepository::class.java)
    private val guardians = mock(GuardianLinkRepository::class.java)
    private val hours = mock(BranchOperatingHourRepository::class.java)
    private val tiers = mock(BranchOvertimeRateTierRepository::class.java)
    private val attendance = mock(AttendanceRepository::class.java)
    private val notifications = mock(NotificationService::class.java)
    private val publishedOfferings = mock(PublishedOfferingCapabilityService::class.java)

    private fun service() = OvertimeService(
        mock(AccessService::class.java), branches, children, guardians, mock(InvoiceRepository::class.java),
        hours, tiers, mock(OvertimeChargeRepository::class.java), mock(OvertimeChargeTierSnapshotRepository::class.java),
        attendance, notifications, mock(IdentityService::class.java), mock(MembershipRepository::class.java),
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

        `when`(attendance.findAllByCheckedOutAtIsNullAndOvertimeAlertSentAtIsNull()).thenReturn(listOf(record))
        `when`(branches.findAllById(setOf(branch.id))).thenReturn(listOf(branch))
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
    }

    @Test
    fun `does not notify while the branch is still within operating hours`() {
        val organizationId = UUID.randomUUID()
        val now = ZonedDateTime.now(ZoneId.of("UTC"))
        val branch = Branch(organizationId = organizationId, name = "Utama", timezone = "UTC")
        val child = Child(organizationId = organizationId, branchId = branch.id, firstName = "Alya")
        val record = AttendanceRecord(organizationId = organizationId, branchId = branch.id, childId = child.id, operationalDate = now.toLocalDate(), checkedInAt = now.toInstant().minusSeconds(3600))

        `when`(attendance.findAllByCheckedOutAtIsNullAndOvertimeAlertSentAtIsNull()).thenReturn(listOf(record))
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

        `when`(attendance.findAllByCheckedOutAtIsNullAndOvertimeAlertSentAtIsNull()).thenReturn(listOf(record))
        `when`(branches.findAllById(setOf(branch.id))).thenReturn(listOf(branch))
        `when`(hours.findAllByBranchIdIn(setOf(branch.id))).thenReturn(listOf(BranchOperatingHour(branchId = branch.id, dayOfWeek = now.dayOfWeek, active = true, closesAt = now.toLocalTime().minusMinutes(1))))
        `when`(tiers.findAllByBranchIdIn(setOf(branch.id))).thenReturn(emptyList())

        service().sendOvertimeAlerts()

        verifyNoInteractions(notifications)
    }
}
