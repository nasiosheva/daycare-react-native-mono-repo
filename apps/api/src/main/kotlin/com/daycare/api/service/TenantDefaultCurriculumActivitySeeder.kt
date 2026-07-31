package com.daycare.api.service

import com.daycare.api.persistence.CurriculumActivity
import com.daycare.api.persistence.CurriculumActivityRepository
import org.springframework.stereotype.Service
import java.util.UUID

private data class DefaultCurriculumActivity(val name: String, val description: String)

@Service
class TenantDefaultCurriculumActivitySeeder(
    private val activities: CurriculumActivityRepository,
) {
    fun seed(organizationId: UUID) {
        activities.saveAll(defaultActivities.map { activity ->
            CurriculumActivity(
                organizationId = organizationId,
                name = activity.name,
                description = activity.description,
                active = true,
            )
        })
    }

    private companion object {
        val defaultActivities = listOf(
            DefaultCurriculumActivity("Morning circle", "Pembukaan hari untuk menyapa, membangun rutinitas, dan menyampaikan agenda."),
            DefaultCurriculumActivity("Doa pagi", "Kegiatan doa bersama untuk memulai hari."),
            DefaultCurriculumActivity("Senam dan gerak lagu", "Aktivitas gerak dan lagu untuk melatih motorik kasar."),
            DefaultCurriculumActivity("Snack time", "Waktu makan camilan dengan pembiasaan makan mandiri dan tertib."),
            DefaultCurriculumActivity("Kegiatan tematik", "Kegiatan belajar yang mengikuti tema pembelajaran harian."),
            DefaultCurriculumActivity("Sensory play", "Eksplorasi melalui pancaindra dengan bahan dan permainan yang aman."),
            DefaultCurriculumActivity("Outdoor play", "Permainan luar ruang untuk aktivitas fisik dan eksplorasi."),
            DefaultCurriculumActivity("Story telling", "Kegiatan mendengarkan dan berinteraksi dengan cerita anak."),
            DefaultCurriculumActivity("Art & craft", "Kegiatan seni dan kerajinan untuk kreativitas serta motorik halus."),
            DefaultCurriculumActivity("Lunch time", "Waktu makan siang dengan pembiasaan makan mandiri dan tertib."),
            DefaultCurriculumActivity("Nap time", "Waktu tidur siang atau istirahat sesuai kebutuhan anak."),
            DefaultCurriculumActivity("Free play", "Waktu bermain bebas yang tetap terawasi."),
            DefaultCurriculumActivity("Review kegiatan", "Meninjau kembali pengalaman dan kegiatan anak pada hari tersebut."),
            DefaultCurriculumActivity("Persiapan pulang", "Merapikan perlengkapan dan menyiapkan anak untuk pulang."),
        )
    }
}
