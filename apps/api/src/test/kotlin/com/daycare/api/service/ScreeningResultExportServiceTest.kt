package com.daycare.api.service

// Mories Deo Hutapea,S.E.,S.Kom

import com.daycare.api.domain.ScreeningResultMainStatus
import com.daycare.api.service.ScreeningResultItemResponse
import org.junit.jupiter.api.Assertions.assertArrayEquals
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.mockito.Mockito.mock
import org.mockito.Mockito.`when`
import org.springframework.security.oauth2.jwt.Jwt
import java.time.Instant
import java.time.LocalDate
import java.util.UUID

class ScreeningResultExportServiceTest {
    private val completion = mock(ScreeningCompletionService::class.java)
    private val service = ScreeningResultExportService(completion)
    private val jwt = mock(Jwt::class.java)

    @Test
    fun `pdf creates a snapshot report with wrapped narrative and safe file name`() {
        val result = result(subjectName = "Alya / Putri", longText = true)
        `when`(completion.result(jwt, result.sessionId)).thenReturn(result)

        val export = service.pdf(jwt, result.sessionId)

        assertEquals("application/pdf", export.contentType)
        assertTrue(export.fileName.startsWith("screening-Alya___Putri-"))
        assertTrue(export.fileName.endsWith(".pdf"))
        assertTrue(export.bytes.size > 500)
        assertArrayEquals(byteArrayOf(0x25, 0x50, 0x44, 0x46), export.bytes.copyOfRange(0, 4))
    }

    @Test
    fun `pdf falls back to anak when subject name has no safe characters`() {
        val result = result(subjectName = "", longText = false)
        `when`(completion.result(jwt, result.sessionId)).thenReturn(result)

        val export = service.pdf(jwt, result.sessionId)

        assertTrue(export.fileName.startsWith("screening-anak-"))
    }

    private fun result(subjectName: String, longText: Boolean): ScreeningResultResponse {
        val id = UUID.randomUUID()
        val text = if (longText) "x".repeat(160) else "Ringkasan"
        return ScreeningResultResponse(
            id = id,
            sessionId = UUID.randomUUID(),
            templateCode = "DEV_24_35",
            templateVersion = 1,
            ruleVersion = 1,
            locale = "id",
            mainStatus = ScreeningResultMainStatus.DISKUSIKAN_PERKEMBANGAN,
            completenessStatus = "COMPLETE",
            disclaimerVersion = "v1",
            statusTitleSnapshot = "Status",
            statusSummarySnapshot = text,
            nextStepSnapshot = text,
            disclaimerTextSnapshot = text,
            subjectNameSnapshot = subjectName,
            dateOfBirthSnapshot = LocalDate.of(2022, 1, 1),
            ageMonths = 30,
            correctedAgeMonths = null,
            generatedAt = Instant.parse("2026-10-10T00:00:00Z"),
            domains = listOf(ScreeningResultDomainResponse("BK", ScreeningResultMainStatus.DISKUSIKAN_PERKEMBANGAN, 2, 0, 1, 1)),
            reasons = listOf(ScreeningResultReasonResponse("REASON", null, null, null, null, "BK", text, 1, "Apakah anak mencoba aktivitas ini?", "Kadang")),
            items = listOf(ScreeningResultItemResponse(UUID.randomUUID(), null, "Q1", "BK", "Apakah anak mencoba aktivitas ini?", "YA_SUDAH", "Ya, terlihat", null, 1)),
        )
    }
}
