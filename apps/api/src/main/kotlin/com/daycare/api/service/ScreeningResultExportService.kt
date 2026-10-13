package com.daycare.api.service

// Mories Deo Hutapea,S.E.,S.Kom

import com.daycare.api.domain.ScreeningResultMainStatus
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
                domainsWithAttention(result).forEach { code -> add("- ${domainLabel(code, result.locale)}: ${domainGuidance(code, result.locale)}") }
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

    private val capabilityDomainCodes = listOf("BK", "MK", "MH", "KG", "SE", "AD")

    /**
     * Capability domains (fixed display order) whose summed attentionCount is positive on this
     * result. CTX is observation context, not a capability area, so it is excluded even if present.
     */
    private fun domainsWithAttention(result: ScreeningResultResponse): List<String> {
        val attentionByCode = result.domains
            .groupBy { it.domainCode.replace(Regex("\\d+$"), "") }
            .mapValues { (_, domains) -> domains.sumOf { it.attentionCount } }
        return capabilityDomainCodes.filter { (attentionByCode[it] ?: 0) > 0 }
    }

    private fun domainGuidance(code: String, locale: String): String {
        return if (locale == "en") when (code) {
            "BK" -> "Invite the child to name or point to familiar objects or pictures during play or shared reading, then note the words or gestures that come up. Bring this example when discussing with a health professional."
            "MK" -> "Watch the child walk, run, go up and down stairs, or throw a ball in a safe space, then note what came easily and what looked difficult. Bring this example when discussing with a health professional."
            "MH" -> "Watch the child hold small toys, scribble, stack blocks, or hold a spoon on their own, then note a concrete example. Bring this example when discussing with a health professional."
            "KG" -> "Watch the child play activities that involve sorting, stacking, or copying a simple step, then note the situation. Bring this example when discussing with a health professional."
            "SE" -> "Watch the child interact with family or other children, such as responding to a smile, showing expressions, or taking turns in play, then note the situation. Bring this example when discussing with a health professional."
            "AD" -> "Watch the child try daily activities such as eating, getting dressed, or washing hands on their own, then note how far they can do it. Bring this example when discussing with a health professional."
            else -> ""
        } else when (code) {
            "BK" -> "Ajak anak menyebut atau menunjuk benda/gambar yang dikenal saat bermain atau membaca bersama, lalu catat kata atau gestur yang muncul. Bawa contoh ini saat berdiskusi dengan tenaga kesehatan."
            "MK" -> "Amati anak saat berjalan, berlari, naik-turun tangga, atau melempar bola di tempat yang aman, lalu catat apa yang berhasil dilakukan dan apa yang tampak sulit. Bawa contoh ini saat berdiskusi dengan tenaga kesehatan."
            "MH" -> "Amati anak saat memegang mainan kecil, mencoret, menyusun balok, atau menggenggam sendok sendiri, lalu catat contoh konkretnya. Bawa contoh ini saat berdiskusi dengan tenaga kesehatan."
            "KG" -> "Amati anak saat bermain yang melibatkan menyortir, menyusun, atau menirukan langkah sederhana, lalu catat contoh situasinya. Bawa contoh ini saat berdiskusi dengan tenaga kesehatan."
            "SE" -> "Amati anak saat berinteraksi dengan keluarga atau anak lain, misalnya merespons senyuman, menunjukkan ekspresi, atau bermain bergantian, lalu catat contoh situasinya. Bawa contoh ini saat berdiskusi dengan tenaga kesehatan."
            "AD" -> "Amati anak saat mencoba kegiatan sehari-hari seperti makan, memakai baju, atau mencuci tangan sendiri, lalu catat sejauh mana anak sudah bisa melakukannya. Bawa contoh ini saat berdiskusi dengan tenaga kesehatan."
            else -> ""
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
        when (result.mainStatus) {
            ScreeningResultMainStatus.SEGERA_DISKUSIKAN -> "Note the change or capability that raised concern and discuss it promptly with a health professional. Bring concrete examples of what was observed."
            ScreeningResultMainStatus.DISKUSIKAN_PERKEMBANGAN -> "Note examples of when the capability appears or has not appeared. Observe again during play or routines, then bring the items to discuss with a health professional."
            ScreeningResultMainStatus.KEMAMPUAN_DILAPORKAN_TERLIHAT -> "Continue play and routine activities that give the child opportunities to use these capabilities. Keep examples for the next check."
            ScreeningResultMainStatus.PENGAMATAN_BELUM_CUKUP -> "Observe the capability during the next natural opportunity and record an example. Repeat the check when there is enough information; this result does not conclude the child's condition."
        }
    } else {
        when (result.mainStatus) {
            ScreeningResultMainStatus.SEGERA_DISKUSIKAN -> "Catat perubahan atau kemampuan yang menimbulkan perhatian, lalu diskusikan lebih cepat dengan tenaga kesehatan. Bawa contoh kejadian yang diamati."
            ScreeningResultMainStatus.DISKUSIKAN_PERKEMBANGAN -> "Catat contoh situasi ketika kemampuan muncul atau belum muncul. Ulangi pengamatan saat bermain atau rutinitas, lalu bawa butir yang perlu dibahas kepada tenaga kesehatan."
            ScreeningResultMainStatus.KEMAMPUAN_DILAPORKAN_TERLIHAT -> "Lanjutkan kegiatan bermain dan rutinitas yang memberi kesempatan anak menggunakan kemampuan tersebut. Simpan contoh pengamatan untuk cek berikutnya."
            ScreeningResultMainStatus.PENGAMATAN_BELUM_CUKUP -> "Amati kemampuan pada kesempatan alami berikutnya dan catat contohnya. Ulangi cek ketika informasi sudah cukup; hasil ini belum menyimpulkan kondisi anak."
        }
    }
}
