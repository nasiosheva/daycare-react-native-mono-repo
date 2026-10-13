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

    @Test
    fun `pdf renders every supported locale status domain and optional snapshot branch`() {
        val domains = listOf("CTX", "BK1", "MK2", "MH3", "KG4", "SE5", "AD6", "OTHER9")
            .mapIndexed { index, code ->
                ScreeningResultDomainResponse(
                    domainCode = code,
                    statusCode = ScreeningResultMainStatus.entries[index % ScreeningResultMainStatus.entries.size],
                    observedCount = index,
                    incompleteCount = if (index % 2 == 0) 1 else 0,
                    attentionCount = if (index % 3 == 0) 1 else 0,
                    displayOrder = index,
                )
            }
        val items = listOf(
            ScreeningResultItemResponse(UUID.randomUUID(), null, "Q-OBSERVED", "BK", "Kemampuan terlihat\u0000", "YA_SUDAH", "Ya, terlihat", null, 1),
            ScreeningResultItemResponse(UUID.randomUUID(), null, "Q-NO-LABEL", "BK", "Tanpa label", "YA_SUDAH", null, null, 2),
            ScreeningResultItemResponse(UUID.randomUUID(), null, "Q-NOT-OBSERVED", "CTX", "Belum diamati", "TIDAK_DIAMATI", "Tidak diamati", null, 3),
            ScreeningResultItemResponse(UUID.randomUUID(), null, "Q-NO-CODE", "OTHER", "Tanpa jawaban", null, null, null, 4),
        )
        val reasons = listOf(
            ScreeningResultReasonResponse("R1", null, null, null, null, null, "Reason fallback", 1, null, null),
            ScreeningResultReasonResponse("R2", null, null, null, null, "BK", "Reason with answer", 2, "Question", "Answer"),
        )

        ScreeningResultMainStatus.entries.forEach { status ->
            listOf("id", "en").forEach { locale ->
                val result = result(
                    subjectName = "Nama é\nAnak",
                    longText = true,
                ).copy(
                    locale = locale,
                    mainStatus = status,
                    statusSummarySnapshot = "Ringkasan\u0000" + "x".repeat(160),
                    nextStepSnapshot = "Langkah\u0000" + "x".repeat(160),
                    disclaimerTextSnapshot = "Disclaimer\u0000" + "x".repeat(160),
                    domains = domains,
                    reasons = reasons,
                    items = items,
                )
                `when`(completion.result(jwt, result.sessionId)).thenReturn(result)

                val export = service.pdf(jwt, result.sessionId)

                assertEquals("application/pdf", export.contentType)
                assertTrue(export.bytes.size > 500)
            }
        }
    }

    @Test
    fun `pdf handles an empty snapshot and unknown display values`() {
        val result = result(subjectName = "é".repeat(80), longText = false).copy(
            locale = "xx",
            mainStatus = ScreeningResultMainStatus.PENGAMATAN_BELUM_CUKUP,
            statusSummarySnapshot = "Ringkas",
            nextStepSnapshot = "Langkah",
            disclaimerTextSnapshot = "Disclaimer",
            domains = listOf(ScreeningResultDomainResponse("ZZ9", ScreeningResultMainStatus.PENGAMATAN_BELUM_CUKUP, 0, 0, 0, 1)),
            reasons = emptyList(),
            items = listOf(ScreeningResultItemResponse(UUID.randomUUID(), null, "Q1", "ZZ", "Tidak terlihat", "TIDAK", null, null, 1)),
        )
        `when`(completion.result(jwt, result.sessionId)).thenReturn(result)

        val export = service.pdf(jwt, result.sessionId)

        assertTrue(export.fileName.startsWith("screening-"))
        assertTrue(export.fileName.endsWith(".pdf"))
        assertTrue(export.bytes.size > 500)
    }

    @Test
    fun `private display helpers cover every status rank and unavailable label`() {
        fun invoke(name: String, vararg args: Any?): Any? {
            val method = ScreeningResultExportService::class.java.declaredMethods.single { it.name == name }
            method.isAccessible = true
            return method.invoke(service, *args)
        }
        assertEquals(4, invoke("statusRank", "SEGERA_DISKUSIKAN"))
        assertEquals(3, invoke("statusRank", "DISKUSIKAN_PERKEMBANGAN"))
        assertEquals(2, invoke("statusRank", "PENGAMATAN_BELUM_CUKUP"))
        assertEquals(1, invoke("statusRank", "KEMAMPUAN_DILAPORKAN_TERLIHAT"))
        assertEquals(0, invoke("statusRank", "UNKNOWN"))
        assertEquals("Not available", invoke("statusLabel", "UNKNOWN", "en"))
        assertEquals("Belum tersedia", invoke("statusLabel", "UNKNOWN", "id"))
        ScreeningResultMainStatus.entries.forEach { status ->
            assertTrue((invoke("statusLabel", status.name, "en") as String).isNotBlank())
            assertTrue((invoke("statusLabel", status.name, "id") as String).isNotBlank())
            assertTrue((invoke("productGuidance", result("Anak", false).copy(locale = "en", mainStatus = status)) as String).isNotBlank())
            assertTrue((invoke("productGuidance", result("Anak", false).copy(locale = "id", mainStatus = status)) as String).isNotBlank())
        }
    }

    @Test
    fun `domainsWithAttention sums by normalized code excludes CTX and zero-attention domains and keeps fixed order`() {
        fun invoke(name: String, vararg args: Any?): Any? {
            val method = ScreeningResultExportService::class.java.declaredMethods.single { it.name == name }
            method.isAccessible = true
            return method.invoke(service, *args)
        }
        val result = result(subjectName = "Anak", longText = false).copy(
            domains = listOf(
                ScreeningResultDomainResponse("AD1", ScreeningResultMainStatus.DISKUSIKAN_PERKEMBANGAN, 0, 0, 1, 1),
                ScreeningResultDomainResponse("BK1", ScreeningResultMainStatus.DISKUSIKAN_PERKEMBANGAN, 0, 0, 0, 2),
                ScreeningResultDomainResponse("BK2", ScreeningResultMainStatus.DISKUSIKAN_PERKEMBANGAN, 0, 0, 2, 3),
                ScreeningResultDomainResponse("CTX", ScreeningResultMainStatus.DISKUSIKAN_PERKEMBANGAN, 0, 0, 5, 4),
                ScreeningResultDomainResponse("ZZ9", ScreeningResultMainStatus.DISKUSIKAN_PERKEMBANGAN, 0, 0, 5, 5),
                ScreeningResultDomainResponse("MK1", ScreeningResultMainStatus.DISKUSIKAN_PERKEMBANGAN, 0, 0, 0, 6),
            ),
        )

        @Suppress("UNCHECKED_CAST")
        val domains = invoke("domainsWithAttention", result) as List<String>

        assertEquals(listOf("BK", "AD"), domains)
    }

    @Test
    fun `domainGuidance covers every capability domain in both locales and falls back to blank for unknown codes`() {
        fun invoke(name: String, vararg args: Any?): Any? {
            val method = ScreeningResultExportService::class.java.declaredMethods.single { it.name == name }
            method.isAccessible = true
            return method.invoke(service, *args)
        }
        listOf("id", "en").forEach { locale ->
            listOf("BK", "MK", "MH", "KG", "SE", "AD").forEach { code ->
                val guidance = invoke("domainGuidance", code, locale) as String
                assertTrue(guidance.isNotBlank(), "expected non-blank guidance for $code/$locale")
            }
        }
        assertEquals("", invoke("domainGuidance", "ZZ", "id"))
        assertEquals("", invoke("domainGuidance", "ZZ", "en"))
    }

    @Test
    fun `domain labels cover every supported and unknown code in both locales`() {
        fun invoke(name: String, vararg args: Any?): Any? {
            val method = ScreeningResultExportService::class.java.declaredMethods.single { it.name == name }
            method.isAccessible = true
            return method.invoke(service, *args)
        }
        listOf("CTX", "BK", "MK", "MH", "KG", "SE", "AD", "UNKNOWN").forEach { code ->
            assertTrue((invoke("domainLabel", code, "id") as String).isNotBlank())
            assertTrue((invoke("domainLabel", "${code}12", "en") as String).isNotBlank())
        }
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
