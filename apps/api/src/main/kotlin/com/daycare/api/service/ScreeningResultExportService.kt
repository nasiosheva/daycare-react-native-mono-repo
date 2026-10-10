package com.daycare.api.service

// Mories Deo Hutapea,S.E.,S.Kom

import org.apache.pdfbox.pdmodel.PDDocument
import org.apache.pdfbox.pdmodel.PDPage
import org.apache.pdfbox.pdmodel.PDPageContentStream
import org.apache.pdfbox.pdmodel.common.PDRectangle
import org.apache.pdfbox.pdmodel.font.PDType1Font
import org.apache.pdfbox.pdmodel.font.Standard14Fonts
import org.springframework.stereotype.Service
import org.springframework.security.oauth2.jwt.Jwt
import java.io.ByteArrayOutputStream
import java.time.format.DateTimeFormatter
import java.util.UUID

data class ScreeningResultExport(val fileName: String, val contentType: String, val bytes: ByteArray)

/**
 * Produces a portable, snapshot-only PDF. It never queries live catalog text,
 * so a later catalog edit cannot rewrite a report already issued to a parent.
 */
@Service
class ScreeningResultExportService(private val completion: ScreeningCompletionService) {
    fun pdf(jwt: Jwt, sessionId: UUID): ScreeningResultExport {
        val result = completion.result(jwt, sessionId)
        val timestamp = DateTimeFormatter.ISO_INSTANT.format(result.generatedAt).replace(":", "-")
        val safeName = result.subjectNameSnapshot.replace(Regex("[^A-Za-z0-9_-]"), "_").take(60).ifBlank { "anak" }
        return ScreeningResultExport("screening-$safeName-$timestamp.pdf", "application/pdf", createPdf(result))
    }

    private fun createPdf(result: ScreeningResultResponse): ByteArray = ByteArrayOutputStream().use { output ->
        PDDocument().use { document ->
            val font = PDType1Font(Standard14Fonts.FontName.HELVETICA)
            val bold = PDType1Font(Standard14Fonts.FontName.HELVETICA_BOLD)
            val lines = buildList {
                add("Hasil skrining perkembangan anak")
                add("Nama: ${result.subjectNameSnapshot}")
                add("Tanggal lahir: ${result.dateOfBirthSnapshot}")
                add("Usia saat skrining: ${result.ageMonths} bulan")
                add("")
                add("Ringkasan Usia Emas")
                add("Ringkasan ini berbasis jawaban Parent untuk membantu pengamatan sehari-hari; ini bukan diagnosis medis.")
                val observedItems = result.items.filter { it.answerCode?.split(',')?.contains("YA_SUDAH") == true && !it.answerLabelSnapshot.isNullOrBlank() }
                if (observedItems.isNotEmpty()) {
                    add("Kemampuan yang dilaporkan terlihat")
                    observedItems.forEach { item ->
                        add("- ${item.questionTextSnapshot}")
                        add("  Jawaban: ${item.answerLabelSnapshot}")
                    }
                }
                add("")
                add(result.statusTitleSnapshot)
                add(result.statusSummarySnapshot)
                add(if (result.locale == "en") "Practical next steps from Usia Emas" else "Langkah praktis dari Usia Emas")
                add(productGuidance(result))
                add("Langkah berikutnya: ${result.nextStepSnapshot}")
                add("")
                add("Alasan dan catatan")
                result.reasons.forEach { reason ->
                    add("- ${reason.questionTextSnapshot ?: reason.textSnapshot}")
                    reason.answerLabelSnapshot?.let { add("  Jawaban: $it") }
                }
                add("")
                add("Ringkasan per domain")
                result.domains
                    .groupBy { domainLabel(it.domainCode, result.locale) }
                    .forEach { (label, domains) ->
                        val status = domains.maxByOrNull { statusRank(it.statusCode.name) }?.statusCode?.name.orEmpty()
                        val observed = domains.sumOf { it.observedCount }
                        val attention = domains.sumOf { it.attentionCount }
                        add("$label: ${statusLabel(status, result.locale)} (teramati $observed, perhatian $attention)")
                    }
                add("")
                add(result.disclaimerTextSnapshot)
            }.map(::sanitize).flatMap { wrap(it, 110) }
            lines.chunked(34).forEach { pageLines ->
                val page = PDPage(PDRectangle.A4)
                document.addPage(page)
                PDPageContentStream(document, page).use { content ->
                    content.beginText(); content.newLineAtOffset(42f, 800f)
                    pageLines.forEachIndexed { index, line ->
                        content.setFont(if (index == 0) bold else font, if (index == 0) 15f else 9f)
                        content.showText(line.take(150)); content.newLineAtOffset(0f, if (index == 0) -24f else -18f)
                    }
                    content.endText()
                }
            }
            document.save(output)
        }
        output.toByteArray()
    }

    private fun wrap(value: String, width: Int): List<String> = if (value.length <= width) listOf(value) else value.chunked(width)
    private fun sanitize(value: String): String = value.replace(Regex("[^\\x20-\\x7E]"), "?")

    private fun domainLabel(code: String, locale: String): String {
        val normalized = code.replace(Regex("\\d+$"), "")
        return if (locale == "en") when (normalized) {
            "CTX" -> "Observation context"
            "BK" -> "Language and communication"
            "MK" -> "Gross motor"
            "MH" -> "Fine motor"
            "KG" -> "Cognitive"
            "SE" -> "Social and emotional"
            "AD" -> "Adaptive skills"
            else -> "Development area"
        } else when (normalized) {
            "CTX" -> "Konteks pengamatan"
            "BK" -> "Bahasa dan komunikasi"
            "MK" -> "Motorik kasar"
            "MH" -> "Motorik halus"
            "KG" -> "Kognitif"
            "SE" -> "Sosial dan emosi"
            "AD" -> "Kemandirian"
            else -> "Area perkembangan"
        }
    }

    private fun statusLabel(status: String, locale: String): String {
        return if (locale == "en") when (status) {
            "SEGERA_DISKUSIKAN" -> "Discuss soon"
            "DISKUSIKAN_PERKEMBANGAN" -> "Discuss development"
            "PENGAMATAN_BELUM_CUKUP" -> "More observation needed"
            "KEMAMPUAN_DILAPORKAN_TERLIHAT" -> "Capabilities reported as observed"
            else -> "Not available"
        } else when (status) {
            "SEGERA_DISKUSIKAN" -> "Perlu segera dibahas"
            "DISKUSIKAN_PERKEMBANGAN" -> "Perlu dibahas"
            "PENGAMATAN_BELUM_CUKUP" -> "Pengamatan belum cukup"
            "KEMAMPUAN_DILAPORKAN_TERLIHAT" -> "Kemampuan dilaporkan terlihat"
            else -> "Belum tersedia"
        }
    }

    private fun statusRank(status: String): Int = when (status) {
        "SEGERA_DISKUSIKAN" -> 4
        "DISKUSIKAN_PERKEMBANGAN" -> 3
        "PENGAMATAN_BELUM_CUKUP" -> 2
        "KEMAMPUAN_DILAPORKAN_TERLIHAT" -> 1
        else -> 0
    }

    private fun productGuidance(result: ScreeningResultResponse): String = if (result.locale == "en") {
        when (result.mainStatus.name) {
            "SEGERA_DISKUSIKAN" -> "Note the change or capability that raised concern and discuss it promptly with a health professional. Bring concrete examples of what was observed."
            "DISKUSIKAN_PERKEMBANGAN" -> "Note examples of when the capability appears or has not appeared. Observe again during play or routines, then bring the items to discuss with a health professional."
            "KEMAMPUAN_DILAPORKAN_TERLIHAT" -> "Continue play and routine activities that give the child opportunities to use these capabilities. Keep examples for the next check."
            else -> "Observe the capability during the next natural opportunity and record an example. Repeat the check when there is enough information; this result does not conclude the child's condition."
        }
    } else {
        when (result.mainStatus.name) {
            "SEGERA_DISKUSIKAN" -> "Catat perubahan atau kemampuan yang menimbulkan perhatian, lalu diskusikan lebih cepat dengan tenaga kesehatan. Bawa contoh kejadian yang diamati."
            "DISKUSIKAN_PERKEMBANGAN" -> "Catat contoh situasi ketika kemampuan muncul atau belum muncul. Ulangi pengamatan saat bermain atau rutinitas, lalu bawa butir yang perlu dibahas kepada tenaga kesehatan."
            "KEMAMPUAN_DILAPORKAN_TERLIHAT" -> "Lanjutkan kegiatan bermain dan rutinitas yang memberi kesempatan anak menggunakan kemampuan tersebut. Simpan contoh pengamatan untuk cek berikutnya."
            else -> "Amati kemampuan pada kesempatan alami berikutnya dan catat contohnya. Ulangi cek ketika informasi sudah cukup; hasil ini belum menyimpulkan kondisi anak."
        }
    }
}
