package com.daycare.api.service

import org.apache.pdfbox.pdmodel.PDDocument
import org.apache.pdfbox.pdmodel.PDPage
import org.apache.pdfbox.pdmodel.PDPageContentStream
import org.apache.pdfbox.pdmodel.common.PDRectangle
import org.apache.pdfbox.pdmodel.font.PDType1Font
import org.apache.pdfbox.pdmodel.font.Standard14Fonts
import org.apache.poi.xssf.usermodel.XSSFWorkbook
import org.springframework.context.i18n.LocaleContextHolder
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.stereotype.Service
import java.io.ByteArrayOutputStream
import java.time.Instant
import java.time.format.DateTimeFormatter
import java.util.UUID

enum class ReportExportFormat { PDF, XLSX }
data class ReportExport(val fileName: String, val contentType: String, val bytes: ByteArray)

@Service
class ChildReportExportService(private val attendance: AttendanceService) {
    fun children(jwt: Jwt, organizationId: UUID, format: ReportExportFormat, filter: ChildListFilter = ChildListFilter()): ReportExport {
        val labels = ChildReportLabels.forLocale(LocaleContextHolder.getLocale().language)
        val rows = attendance.listChildren(jwt, organizationId, filter)
        val timestamp = DateTimeFormatter.ISO_INSTANT.format(Instant.now()).replace(":", "-")
        val fileName = "children-$timestamp"
        return when (format) {
            ReportExportFormat.PDF -> ReportExport("$fileName.pdf", "application/pdf", createPdf(labels, rows))
            ReportExportFormat.XLSX -> ReportExport("$fileName.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", createExcel(labels, rows))
        }
    }

    private fun createExcel(labels: ChildReportLabels, rows: List<ChildResponse>): ByteArray = ByteArrayOutputStream().use { output ->
        XSSFWorkbook().use { workbook ->
            val sheet = workbook.createSheet(labels.sheetName)
            val headers = listOf(labels.name, labels.nisn, labels.gender, labels.birthDate, labels.attendance)
            sheet.createRow(0).apply { headers.forEachIndexed { index, value -> createCell(index).setCellValue(value) } }
            rows.forEachIndexed { rowIndex, child -> sheet.createRow(rowIndex + 1).apply {
                createCell(0).setCellValue(child.fullName)
                createCell(1).setCellValue(child.nisn ?: "-")
                createCell(2).setCellValue(labels.gender(child.gender.name))
                createCell(3).setCellValue(child.dateOfBirth.toString())
                createCell(4).setCellValue(labels.attendance(child.todayCheckedInAt != null, child.todayCheckedOutAt != null))
            } }
            headers.indices.forEach(sheet::autoSizeColumn)
            workbook.write(output)
        }
        output.toByteArray()
    }

    private fun createPdf(labels: ChildReportLabels, rows: List<ChildResponse>): ByteArray = ByteArrayOutputStream().use { output ->
        PDDocument().use { document ->
            val font = PDType1Font(Standard14Fonts.FontName.HELVETICA)
            val bold = PDType1Font(Standard14Fonts.FontName.HELVETICA_BOLD)
            val lines = listOf(labels.title, labels.headers) + rows.map { child -> listOf(child.fullName, child.nisn ?: "-", labels.gender(child.gender.name), child.dateOfBirth.toString(), labels.attendance(child.todayCheckedInAt != null, child.todayCheckedOutAt != null)).joinToString(" | ") }
            lines.chunked(34).forEach { pageLines ->
                val page = PDPage(PDRectangle.A4); document.addPage(page)
                PDPageContentStream(document, page).use { content ->
                    content.beginText(); content.newLineAtOffset(42f, 800f)
                    pageLines.forEachIndexed { index, line ->
                        content.setFont(if (index == 0) bold else font, if (index == 0) 16f else 9f)
                        content.showText(sanitizePdf(line).take(150)); content.newLineAtOffset(0f, if (index == 0) -24f else -20f)
                    }
                    content.endText()
                }
            }
            document.save(output)
        }
        output.toByteArray()
    }

    private fun sanitizePdf(value: String): String = value.map { if (it.code in 32..126) it else '?' }.joinToString("")
}

private data class ChildReportLabels(val title: String, val sheetName: String, val name: String, val nisn: String, val gender: String, val birthDate: String, val attendance: String, val headers: String, val checkedInLabel: String, val checkedOutLabel: String, val notCheckedInLabel: String) {
    fun gender(value: String): String = when (value) { "MALE" -> if (title == "Laporan Anak") "Laki-laki" else "Male"; "FEMALE" -> if (title == "Laporan Anak") "Perempuan" else "Female"; else -> "-" }
    fun attendance(checkedIn: Boolean, checkedOut: Boolean): String = if (checkedOut) checkedOutLabel else if (checkedIn) checkedInLabel else notCheckedInLabel
    companion object {
        fun forLocale(language: String) = if (language == "id") ChildReportLabels("Laporan Anak", "Anak", "Nama", "NISN", "Jenis kelamin", "Tanggal lahir", "Kehadiran", "Nama | NISN | Jenis kelamin | Tanggal lahir | Kehadiran", "Sudah check-in", "Sudah check-out", "Belum check-in") else ChildReportLabels("Children report", "Children", "Name", "NISN", "Gender", "Date of birth", "Attendance", "Name | NISN | Gender | Date of birth | Attendance", "Checked in", "Checked out", "Not checked in")
    }
}
