package com.daycare.api.config

import com.daycare.api.persistence.ClassroomRepository
import com.daycare.api.persistence.GoalTemplate
import com.daycare.api.persistence.GoalTemplateIndicator
import com.daycare.api.persistence.GoalTemplateIndicatorRepository
import com.daycare.api.persistence.GoalTemplateRepository
import com.daycare.api.persistence.LearningLevelRepository
import com.daycare.api.persistence.OrganizationRepository
import org.springframework.boot.ApplicationArguments
import org.springframework.boot.ApplicationRunner
import org.springframework.context.annotation.Profile
import org.springframework.core.annotation.Order
import org.springframework.stereotype.Component
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

private const val seedTenantName = "Daycare Pelangi"

// No property gate needed: no-ops unless LocalDemoDataSeeder/SimulationDataSeeder already created this tenant.
@Component
@Profile("default", "simulation")
@Order(2)
class GoalTemplateSeeder(
    private val organizations: OrganizationRepository,
    private val levels: LearningLevelRepository,
    private val classrooms: ClassroomRepository,
    private val goalTemplates: GoalTemplateRepository,
    private val goalTemplateIndicators: GoalTemplateIndicatorRepository,
) : ApplicationRunner {
    @Transactional
    override fun run(args: ApplicationArguments) {
        val tenant = organizations.findAllByNameContainingIgnoreCase(seedTenantName).firstOrNull() ?: return
        if (goalTemplates.findAllByOrganizationIdOrderByCreatedAtDesc(tenant.id).isNotEmpty()) return
        val level = levels.findAllByOrganizationIdOrderByDisplayOrderAscNameAsc(tenant.id).firstOrNull()
        val classroom = classrooms.findAllByOrganizationIdOrderByNameAsc(tenant.id).firstOrNull()
        if (level == null && classroom == null) return

        val goalTemplateRows = goalSeeds.map { seed ->
            seed to GoalTemplate(
                id = goalId(seed.key),
                organizationId = tenant.id,
                learningLevelId = level?.id,
                classroomId = if (level == null) classroom?.id else null,
                name = seed.name,
                description = seed.description,
                durationDays = seed.durationDays,
                minimumYesPercent = seed.minimumYesPercent,
                minimumYesStreak = seed.minimumYesStreak,
            )
        }
        goalTemplates.saveAll(goalTemplateRows.map { it.second })
        goalTemplateIndicators.saveAll(goalTemplateRows.map { (seed, template) -> GoalTemplateIndicator(id = goalIndicatorId(seed.key), organizationId = tenant.id, goalTemplateId = template.id, name = template.name) })
    }

    private fun goalId(key: String): UUID = UUID.nameUUIDFromBytes("umur-emas-goal-seed:goal:$key".toByteArray())
    private fun goalIndicatorId(key: String): UUID = UUID.nameUUIDFromBytes("umur-emas-goal-seed:goal-indicator:$key".toByteArray())
}

private data class GoalSeed(val key: String, val name: String, val description: String, val durationDays: Int, val minimumYesPercent: Int, val minimumYesStreak: Int)

private val goalSeeds = listOf(
    GoalSeed("toilet-training", "Lepas pempers (toilet training)", "Anak mampu menggunakan toilet secara mandiri tanpa popok, termasuk memberi tahu saat ingin buang air.", 30, 80, 5),
    GoalSeed("colors", "Mengenali warna", "Anak mampu menyebutkan dan mencocokkan warna-warna dasar dengan benar.", 30, 70, 3),
    GoalSeed("shapes", "Mengenali bentuk (lingkaran, persegi, segitiga, dll.)", "Anak mampu mengenali dan menyebutkan bentuk-bentuk dasar geometri.", 30, 70, 3),
    GoalSeed("numbers", "Mengenali angka 1–10", "Anak mampu menyebutkan dan mengurutkan angka 1 sampai 10.", 30, 70, 3),
    GoalSeed("letters", "Mengenali huruf A–Z", "Anak mampu menyebutkan dan mengenali huruf A sampai Z.", 30, 70, 3),
    GoalSeed("full-name", "Menyebutkan nama lengkap", "Anak mampu menyebutkan nama lengkapnya sendiri ketika ditanya.", 30, 70, 3),
    GoalSeed("parents-name", "Mengingat nama orang tua", "Anak mampu menyebutkan nama ayah dan ibunya.", 30, 70, 3),
    GoalSeed("home-address", "Menghafal alamat rumah (minimal area tempat tinggal)", "Anak mampu menyebutkan alamat rumah atau minimal nama area tempat tinggalnya.", 30, 70, 3),
    GoalSeed("eat-neatly", "Makan sendiri dengan rapi", "Anak mampu makan menggunakan sendok/tangan sendiri tanpa banyak tumpah/berantakan.", 21, 80, 7),
    GoalSeed("drink-no-spill", "Minum dari gelas tanpa tumpah", "Anak mampu minum dari gelas secara mandiri tanpa menumpahkan isinya.", 21, 80, 7),
    GoalSeed("wash-hands", "Cuci tangan dengan benar", "Anak mampu mencuci tangan dengan sabun dan air mengalir sesuai langkah yang benar.", 21, 80, 7),
    GoalSeed("brush-teeth", "Menggosok gigi dengan bantuan, lalu mandiri", "Anak mampu menggosok gigi, mulai dengan bantuan menuju mandiri.", 21, 80, 7),
    GoalSeed("dress-self", "Memakai dan melepas baju sendiri", "Anak mampu memakai dan melepas baju sendiri tanpa bantuan.", 21, 80, 7),
    GoalSeed("wear-shoes", "Memakai sepatu dan sandal sendiri", "Anak mampu memakai sepatu/sandal sendiri dengan benar.", 21, 80, 7),
    GoalSeed("tidy-toys", "Merapikan mainan setelah digunakan", "Anak mampu merapikan dan menyimpan kembali mainan setelah selesai bermain.", 21, 80, 7),
    GoalSeed("share-toys", "Berbagi mainan dengan teman", "Anak mampu berbagi mainan dan bergiliran bermain dengan teman.", 21, 70, 5),
    GoalSeed("polite-words", "Mengucapkan \"tolong\", \"maaf\", dan \"terima kasih\"", "Anak mampu menggunakan kata tolong, maaf, dan terima kasih pada situasi yang tepat.", 21, 70, 5),
    GoalSeed("follow-instructions", "Mengikuti instruksi 2–3 langkah", "Anak mampu mengikuti dan menyelesaikan instruksi sederhana yang terdiri dari 2-3 langkah.", 21, 70, 5),
    GoalSeed("draw-shapes", "Menggambar garis, lingkaran, dan bentuk sederhana", "Anak mampu menggambar garis, lingkaran, dan bentuk sederhana lainnya.", 30, 70, 3),
    GoalSeed("cut-lines", "Menggunting mengikuti garis sederhana", "Anak mampu menggunting kertas mengikuti garis yang sudah digambar.", 30, 70, 3),
    GoalSeed("simple-puzzle", "Menyusun puzzle sederhana", "Anak mampu menyusun puzzle dengan jumlah kepingan sederhana.", 30, 70, 3),
    GoalSeed("jump-two-feet", "Melompat dengan dua kaki", "Anak mampu melompat menggunakan kedua kaki secara bersamaan.", 21, 70, 3),
    GoalSeed("stand-one-leg", "Berdiri dengan satu kaki beberapa detik", "Anak mampu menjaga keseimbangan berdiri dengan satu kaki selama beberapa detik.", 21, 70, 3),
    GoalSeed("run-and-stop", "Berlari dan berhenti dengan seimbang", "Anak mampu berlari kemudian berhenti tanpa kehilangan keseimbangan.", 21, 70, 3),
    GoalSeed("short-prayers", "Menghafal doa-doa pendek (jika relevan dengan keluarga)", "Anak mampu menghafal dan melafalkan doa-doa pendek sehari-hari sesuai kebiasaan keluarga.", 30, 70, 3),
    GoalSeed("children-songs", "Menghafal lagu anak-anak sederhana", "Anak mampu menghafal dan menyanyikan lagu anak-anak sederhana.", 30, 70, 3),
    GoalSeed("basic-emotions", "Mengenali emosi dasar (senang, sedih, marah, takut)", "Anak mampu mengenali dan menyebutkan emosi dasar seperti senang, sedih, marah, dan takut.", 30, 70, 3),
    GoalSeed("polite-speaking", "Berani berbicara dengan orang lain secara sopan", "Anak mampu berbicara dengan orang lain di luar keluarga inti secara sopan dan percaya diri.", 21, 70, 5),
    GoalSeed("focused-sitting", "Duduk fokus selama 10–20 menit untuk belajar atau membaca", "Anak mampu duduk fokus mengikuti kegiatan belajar atau membaca selama 10-20 menit.", 21, 70, 5),
    GoalSeed("daily-reading", "Menyukai kegiatan membaca buku bersama setiap hari", "Anak menunjukkan ketertarikan dan antusiasme pada kegiatan membaca buku bersama setiap hari.", 21, 70, 5),
)
