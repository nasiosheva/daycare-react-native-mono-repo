package com.daycare.api.service

import com.daycare.api.domain.Gender
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.mockito.Mockito.mock
import org.mockito.Mockito.`when`
import org.springframework.security.oauth2.jwt.Jwt
import java.time.LocalDate
import java.util.UUID

class ChildReportExportServiceTest {
    private val jwt = mock(Jwt::class.java)
    private val organizationId = UUID.randomUUID()
    private val attendance = mock(AttendanceService::class.java)
    private val service = ChildReportExportService(attendance)

    @Test
    fun `builds binary PDF and XLSX child reports from authorized child data`() {
        `when`(attendance.listChildren(jwt, organizationId)).thenReturn(listOf(ChildResponse(UUID.randomUUID(), organizationId, UUID.randomUUID(), null, "Alya", null, "123", Gender.FEMALE, LocalDate.of(2021, 4, 5))))

        val pdf = service.children(jwt, organizationId, ReportExportFormat.PDF)
        val xlsx = service.children(jwt, organizationId, ReportExportFormat.XLSX)

        assertEquals("application/pdf", pdf.contentType)
        assertTrue(pdf.bytes.copyOfRange(0, 4).decodeToString() == "%PDF")
        assertEquals("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", xlsx.contentType)
        assertTrue(xlsx.bytes.copyOfRange(0, 2).decodeToString() == "PK")
    }
}
