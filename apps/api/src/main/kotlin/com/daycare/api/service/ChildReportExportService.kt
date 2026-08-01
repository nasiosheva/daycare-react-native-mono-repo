package com.daycare.api.service

import com.daycare.api.domain.Role
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
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.UUID

enum class ReportExportFormat { PDF, XLSX }
data class ReportExport(val fileName: String, val contentType: String, val bytes: ByteArray)

@Service
class ChildReportExportService(
    private val attendance: AttendanceService,
    private val access: AccessService,
) {
    fun children(jwt: Jwt, organizationId: UUID, format: ReportExportFormat, filter: ChildListFilter = ChildListFilter()): ReportExport {
        requireActiveExportAccess(jwt, organizationId, setOf(Role.STAFF_ADMIN, Role.STAFF))
        val labels = ChildReportLabels.forLocale(LocaleContextHolder.getLocale().language)
        val rows = attendance.listChildren(jwt, organizationId, filter)
        val timestamp = DateTimeFormatter.ISO_INSTANT.format(Instant.now()).replace(":", "-")
        val fileName = "children-$timestamp"
        return when (format) {
            ReportExportFormat.PDF -> ReportExport("$fileName.pdf", "application/pdf", createPdf(labels, rows))
            ReportExportFormat.XLSX -> ReportExport("$fileName.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", createExcel(labels, rows))
        }
    }

    fun childAttendance(jwt: Jwt, organizationId: UUID, format: ReportExportFormat, branchId: UUID, startsOn: LocalDate, endsOn: LocalDate): ReportExport {
        requireActiveExportAccess(jwt, organizationId, setOf(Role.STAFF_ADMIN))
        val labels = ChildAttendanceReportLabels.forLocale(LocaleContextHolder.getLocale().language)
        val report = attendance.childAttendanceReport(jwt, organizationId, branchId, startsOn, endsOn)
        val timestamp = DateTimeFormatter.ISO_INSTANT.format(Instant.now()).replace(":", "-")
        val fileName = "child-attendance-$timestamp"
        return when (format) {
            ReportExportFormat.PDF -> ReportExport("$fileName.pdf", "application/pdf", createAttendancePdf(labels, report))
            ReportExportFormat.XLSX -> ReportExport("$fileName.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", createAttendanceExcel(labels, report))
        }
    }

    private fun requireActiveExportAccess(jwt: Jwt, organizationId: UUID, allowedRoles: Set<Role>) {
        access.require(jwt, organizationId, allowedRoles, readOnly = false)
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

    private fun createAttendanceExcel(labels: ChildAttendanceReportLabels, report: ChildAttendanceReport): ByteArray = ByteArrayOutputStream().use { output ->
        XSSFWorkbook().use { workbook ->
            val sheet = workbook.createSheet(labels.sheetName)
            sheet.createRow(0).apply { createCell(0).setCellValue(labels.title) }
            sheet.createRow(1).apply { createCell(0).setCellValue(labels.branch); createCell(1).setCellValue(report.branchName) }
            sheet.createRow(2).apply { createCell(0).setCellValue(labels.period); createCell(1).setCellValue("${report.startsOn} - ${report.endsOn}") }
            val headers = listOf(labels.name, labels.nisn, labels.checkIns, labels.checkOuts, labels.pendingCheckOuts)
            sheet.createRow(4).apply { headers.forEachIndexed { index, value -> createCell(index).setCellValue(value) } }
            report.rows.forEachIndexed { index, row -> sheet.createRow(index + 5).apply {
                createCell(0).setCellValue(row.fullName)
                createCell(1).setCellValue(row.nisn ?: "-")
                createCell(2).setCellValue(row.totalCheckIns.toDouble())
                createCell(3).setCellValue(row.totalCheckOuts.toDouble())
                createCell(4).setCellValue(row.pendingCheckOuts.toDouble())
            } }
            headers.indices.forEach(sheet::autoSizeColumn)
            workbook.write(output)
        }
        output.toByteArray()
    }

    private fun createAttendancePdf(labels: ChildAttendanceReportLabels, report: ChildAttendanceReport): ByteArray = ByteArrayOutputStream().use { output ->
        PDDocument().use { document ->
            val font = PDType1Font(Standard14Fonts.FontName.HELVETICA)
            val bold = PDType1Font(Standard14Fonts.FontName.HELVETICA_BOLD)
            val headingLines = listOf(labels.title, "${labels.branch}: ${report.branchName}", "${labels.period}: ${report.startsOn} - ${report.endsOn}", labels.headers)
            val rowLines = report.rows.map { row -> listOf(row.fullName, row.nisn ?: "-", row.totalCheckIns, row.totalCheckOuts, row.pendingCheckOuts).joinToString(" | ") }
            (headingLines + rowLines).chunked(34).forEachIndexed { pageIndex, pageLines ->
                val page = PDPage(PDRectangle.A4); document.addPage(page)
                PDPageContentStream(document, page).use { content ->
                    content.beginText(); content.newLineAtOffset(42f, 800f)
                    pageLines.forEachIndexed { index, line ->
                        val isTitle = pageIndex == 0 && index == 0
                        content.setFont(if (isTitle || line == labels.headers) bold else font, if (isTitle) 16f else 9f)
                        content.showText(sanitizePdf(line).take(150)); content.newLineAtOffset(0f, if (isTitle) -24f else -20f)
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

private data class ChildAttendanceReportLabels(val title: String, val sheetName: String, val branch: String, val period: String, val name: String, val nisn: String, val checkIns: String, val checkOuts: String, val pendingCheckOuts: String, val headers: String) {
    companion object {
        fun forLocale(language: String) = if (language == "id") ChildAttendanceReportLabels(
            title = "Rekap Kehadiran Anak", sheetName = "Kehadiran Anak", branch = "Cabang", period = "Periode", name = "Nama anak", nisn = "NISN", checkIns = "Total check-in", checkOuts = "Total check-out", pendingCheckOuts = "Belum check-out", headers = "Nama anak | NISN | Total check-in | Total check-out | Belum check-out",
        ) else ChildAttendanceReportLabels(
            title = "Child attendance recap", sheetName = "Child attendance", branch = "Branch", period = "Period", name = "Child name", nisn = "NISN", checkIns = "Total check-ins", checkOuts = "Total check-outs", pendingCheckOuts = "Pending check-outs", headers = "Child name | NISN | Total check-ins | Total check-outs | Pending check-outs",
        )
    }
}
