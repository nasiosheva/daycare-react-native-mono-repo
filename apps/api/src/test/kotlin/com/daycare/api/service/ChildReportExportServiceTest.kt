package com.daycare.api.service

import com.daycare.api.domain.Gender
import com.daycare.api.domain.Role
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.mockito.Mockito.mock
import org.mockito.Mockito.times
import org.mockito.Mockito.verify
import org.mockito.Mockito.verifyNoInteractions
import org.mockito.Mockito.`when`
import org.springframework.security.access.AccessDeniedException
import org.springframework.security.oauth2.jwt.Jwt
import java.time.LocalDate
import java.util.UUID

class ChildReportExportServiceTest {
    private val jwt = mock(Jwt::class.java)
    private val organizationId = UUID.randomUUID()
    private val attendance = mock(AttendanceService::class.java)
    private val access = mock(AccessService::class.java)
    private val service = ChildReportExportService(attendance, access)

    @Test
    fun `builds binary PDF and XLSX child reports from authorized child data`() {
        `when`(attendance.listChildren(jwt, organizationId)).thenReturn(listOf(ChildResponse(UUID.randomUUID(), organizationId, UUID.randomUUID(), null, "Alya", null, "123", Gender.FEMALE, LocalDate.of(2021, 4, 5))))

        val pdf = service.children(jwt, organizationId, ReportExportFormat.PDF)
        val xlsx = service.children(jwt, organizationId, ReportExportFormat.XLSX)

        assertEquals("application/pdf", pdf.contentType)
        assertTrue(pdf.bytes.copyOfRange(0, 4).decodeToString() == "%PDF")
        assertEquals("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", xlsx.contentType)
        assertTrue(xlsx.bytes.copyOfRange(0, 2).decodeToString() == "PK")
        verify(access, times(2)).require(jwt, organizationId, setOf(Role.STAFF_ADMIN, Role.STAFF), null, false)
    }

    @Test
    fun `builds binary child attendance recap reports from authorized summary data`() {
        val branchId = UUID.randomUUID()
        val startsOn = LocalDate.of(2026, 7, 1)
        val endsOn = LocalDate.of(2026, 7, 31)
        `when`(attendance.childAttendanceReport(jwt, organizationId, branchId, startsOn, endsOn)).thenReturn(
            ChildAttendanceReport("Cabang Utama", startsOn, endsOn, listOf(ChildAttendanceSummary(UUID.randomUUID(), "Alya", "123", 3, 2, 1))),
        )

        val pdf = service.childAttendance(jwt, organizationId, ReportExportFormat.PDF, branchId, startsOn, endsOn)
        val xlsx = service.childAttendance(jwt, organizationId, ReportExportFormat.XLSX, branchId, startsOn, endsOn)

        assertEquals("application/pdf", pdf.contentType)
        assertTrue(pdf.bytes.copyOfRange(0, 4).decodeToString() == "%PDF")
        assertEquals("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", xlsx.contentType)
        assertTrue(xlsx.bytes.copyOfRange(0, 2).decodeToString() == "PK")
        verify(access, times(2)).require(jwt, organizationId, setOf(Role.STAFF_ADMIN), null, false)
    }

    @Test
    fun `does not generate child reports after active export access is denied`() {
        `when`(access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN, Role.STAFF), readOnly = false))
            .thenThrow(AccessDeniedException("Your tenant access is read-only"))

        assertThrows(AccessDeniedException::class.java) {
            service.children(jwt, organizationId, ReportExportFormat.PDF)
        }

        verifyNoInteractions(attendance)
    }

    @Test
    fun `does not generate attendance recap after active export access is denied`() {
        val branchId = UUID.randomUUID()
        val startsOn = LocalDate.of(2026, 7, 1)
        val endsOn = LocalDate.of(2026, 7, 31)
        `when`(access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN), readOnly = false))
            .thenThrow(AccessDeniedException("Your tenant access is read-only"))

        assertThrows(AccessDeniedException::class.java) {
            service.childAttendance(jwt, organizationId, ReportExportFormat.PDF, branchId, startsOn, endsOn)
        }

        verifyNoInteractions(attendance)
    }
}
