package com.daycare.api.service

import com.daycare.api.domain.ScreeningCatalogResourceType
import com.daycare.api.domain.ScreeningQuestionAnswerType
import com.daycare.api.domain.ScreeningResultMainStatus
import com.daycare.api.domain.ScreeningResultReasonCode
import com.daycare.api.domain.ScreeningRuleTriggerKind
import java.nio.charset.StandardCharsets
import java.util.UUID

/**
 * The first content package is deliberately deterministic and remains DRAFT.
 * Clinical review, translations and publication are separate Platform Admin
 * actions; deploying this object never executes it.
 */
object ScreeningInitialDataset {
    const val BATCH_ID = "screening-initial-v1-2026-10-09"
    const val SEED_VERSION = "v1"
    const val CHECKSUM = "sha256:screening-initial-v1-2026-10-09"

private val developmentalItems = mapOf(
        2 to listOf(
            "B02-BK1" to "Apakah anak mengeluarkan suara lain selain tangisan?",
            "B02-BK2" to "Apakah anak tampak bereaksi saat mendengar suara orang di dekatnya?",
            "B02-MK1" to "Apakah anak mengangkat kepalanya sebentar saat tengkurap dengan pengawasan?",
            "B02-MK2" to "Apakah kedua lengan dan kakinya aktif bergerak?",
            "B02-MH1" to "Apakah telapak tangannya kadang terbuka, tidak selalu mengepal?",
            "B02-KG1" to "Apakah anak mengikuti gerak wajah orang di dekatnya dengan pandangan?",
            "B02-KG2" to "Apakah anak menatap benda menarik selama beberapa saat?",
            "B02-SE1" to "Apakah anak menatap wajah pengasuh saat diajak berinteraksi?",
            "B02-SE2" to "Apakah anak sesekali membalas senyum atau sapaan dengan senyum?",
            "B02-AD1" to "Apakah suara lembut atau dipeluk membantu anak menjadi lebih tenang? *(Konteks saja; bukan skor kemandirian.)*",
        ),
        4 to listOf(
            "B04-BK1" to "Apakah anak membuat bunyi vokal saat nyaman?",
            "B04-BK2" to "Apakah anak membalas suara ketika diajak bicara?",
            "B04-BK3" to "Apakah anak menoleh ke arah suara pengasuh?",
            "B04-MK1" to "Apakah kepala anak relatif tegak saat digendong tegak?",
            "B04-MK2" to "Saat tengkurap, apakah ia bertumpu pada lengan bawah?",
            "B04-MH1" to "Apakah anak memegang mainan aman yang diletakkan di tangannya?",
            "B04-MH2" to "Apakah ia mencoba meraih atau menyentuh mainan di dekatnya?",
            "B04-KG1" to "Apakah anak memperhatikan tangannya sendiri?",
            "B04-KG2" to "Apakah ia tampak mengenali isyarat rutin menjelang diberi minum/makan?",
            "B04-SE1" to "Apakah anak tersenyum untuk mengajak berinteraksi?",
            "B04-SE2" to "Apakah ia tertawa kecil saat diajak bermain?",
            "B04-AD1" to "Apakah anak memberi isyarat berbeda ketika lapar dan ketika sudah cukup? *(Konteks saja.)*",
        ),
        6 to listOf(
            "B06-BK1" to "Apakah anak bergantian bersuara dengan orang yang mengajaknya bicara?",
            "B06-BK2" to "Apakah ia membuat beberapa jenis suara selain menangis?",
            "B06-MK1" to "Apakah anak dapat berguling dari tengkurap ke telentang?",
            "B06-MK2" to "Apakah ia bisa menopang badan dengan kedua lengan saat tengkurap?",
            "B06-MK3" to "Apakah ia mulai duduk dengan bertumpu pada tangan?",
            "B06-MH1" to "Apakah anak mengulurkan tangan untuk mengambil mainan?",
            "B06-MH2" to "Apakah ia mempertahankan pegangan sebentar saat mainan sudah diraih?",
            "B06-KG1" to "Apakah anak mencari dan meraih benda yang menarik perhatiannya?",
            "B06-KG2" to "Apakah ia mengeksplorasi benda aman dengan tangan atau mulut?",
            "B06-SE1" to "Apakah anak mengenali pengasuh yang akrab?",
            "B06-SE2" to "Apakah ia tertawa saat bermain interaktif?",
            "B06-AD1" to "Apakah anak menunjukkan isyarat jelas saat ingin berhenti makan/minum? *(Konteks saja.)*",
        ),
        9 to listOf(
            "B09-BK1" to "Apakah anak membuat rangkaian bunyi berulang yang bervariasi?",
            "B09-BK2" to "Apakah ia mengangkat tangan atau memakai gestur lain untuk meminta digendong?",
            "B09-BK3" to "Apakah ia menoleh ketika namanya dipanggil dalam suasana tenang?",
            "B09-MK1" to "Apakah anak berpindah ke posisi duduk sendiri?",
            "B09-MK2" to "Apakah ia duduk tanpa ditopang?",
            "B09-MH1" to "Apakah anak memindahkan benda dari satu tangan ke tangan lain?",
            "B09-MH2" to "Apakah ia memakai jari untuk mendekatkan potongan makanan aman yang sesuai usianya?",
            "B09-KG1" to "Apakah anak mencari benda yang terlihat jatuh atau tertutup?",
            "B09-KG2" to "Apakah ia mencoba membenturkan dua benda saat bermain?",
            "B09-SE1" to "Apakah anak menunjukkan ekspresi berbeda saat senang atau kecewa?",
            "B09-SE2" to "Apakah ia tertarik bermain cilukba atau permainan balas-balasan?",
            "B09-AD1" to "Apakah anak ikut mengambil makanan aman dengan jari saat diberi kesempatan? *(Dicatat sebagai partisipasi, bukan tuntutan makan mandiri.)*",
        ),
        12 to listOf(
            "B12-BK1" to "Apakah anak memakai panggilan khusus untuk orang yang akrab?",
            "B12-BK2" to "Apakah ia melambaikan tangan atau gestur lain untuk menyampaikan maksud?",
            "B12-BK3" to "Apakah ia berhenti sejenak ketika diberi larangan sederhana?",
            "B12-MK1" to "Apakah anak menarik badan untuk berdiri dengan berpegangan?",
            "B12-MK2" to "Apakah ia bergerak menyusuri perabot sambil berpegangan?",
            "B12-MH1" to "Apakah anak mengambil benda kecil yang aman dengan ibu jari dan telunjuk?",
            "B12-MH2" to "Apakah ia memasukkan benda ke dalam wadah saat bermain?",
            "B12-KG1" to "Apakah anak mencari mainan yang disembunyikan di depan matanya?",
            "B12-KG2" to "Apakah ia mencoba memakai wadah untuk memasukkan atau mengeluarkan benda?",
            "B12-SE1" to "Apakah anak menikmati permainan bergantian dengan pengasuh?",
            "B12-SE2" to "Apakah ia mencari respons pengasuh setelah melakukan sesuatu yang menarik?",
            "B12-AD1" to "Dengan gelas yang dipegang orang dewasa, apakah anak ikut minum dari gelas terbuka?",
            "B12-AD2" to "Apakah anak mencoba mengambil makanan aman sendiri dengan jari?",
        ),
        15 to listOf(
            "B15-BK1" to "Apakah anak mencoba mengucapkan satu atau lebih kata bermakna selain panggilan orang tua, dalam bahasa apa pun yang dikenalnya?",
            "B15-BK2" to "Apakah ia melihat benda yang akrab saat bendanya disebut?",
            "B15-BK3" to "Apakah ia mengikuti permintaan yang disertai kata dan gestur?",
            "B15-BK4" to "Apakah ia menunjuk untuk meminta bantuan atau benda?",
            "B15-MK1" to "Apakah anak melangkah beberapa langkah tanpa pegangan?",
            "B15-MK2" to "Apakah ia berpindah dari duduk ke berdiri dan mulai bergerak mengeksplorasi ruang dengan aman?",
            "B15-MH1" to "Apakah anak memakai jari untuk mengambil makanan kecil yang aman?",
            "B15-MH2" to "Apakah ia menyusun dua benda ringan di atas satu sama lain?",
            "B15-KG1" to "Apakah anak mencoba memakai benda sesuai fungsi sederhananya, misalnya gelas untuk minum?",
            "B15-KG2" to "Apakah ia meniru tindakan sederhana orang dewasa saat bermain?",
            "B15-SE1" to "Apakah anak menunjukkan benda yang menarik kepadanya kepada pengasuh?",
            "B15-SE2" to "Apakah ia meniru permainan anak lain atau pengasuh?",
            "B15-AD1" to "Apakah anak mulai ikut saat berpakaian atau diberi makan, misalnya mengulurkan tangan atau memegang alat makan?",
            "B15-AD2" to "Apakah ia memberi isyarat ketika membutuhkan bantuan?",
        ),
        18 to listOf(
            "B18-BK1" to "Apakah anak mencoba memakai beberapa kata bermakna selain panggilan orang tua?",
            "B18-BK2" to "Apakah ia mengikuti satu instruksi sederhana tanpa perlu gestur?",
            "B18-BK3" to "Apakah ia menunjuk untuk menunjukkan sesuatu yang menarik, bukan hanya meminta?",
            "B18-MK1" to "Apakah anak berjalan tanpa berpegangan?",
            "B18-MK2" to "Apakah ia memanjat naik atau turun kursi rendah dengan pengawasan?",
            "B18-MH1" to "Apakah anak membuat coretan dengan alat tulis yang sesuai dan diawasi?",
            "B18-MH2" to "Apakah ia mencoba memegang dan memakai sendok?",
            "B18-KG1" to "Apakah anak meniru aktivitas rumah sederhana saat bermain?",
            "B18-KG2" to "Apakah ia menggunakan mainan secara sederhana sesuai kegunaannya?",
            "B18-SE1" to "Apakah anak menjelajah sebentar lalu memastikan pengasuh masih dekat?",
            "B18-SE2" to "Apakah ia melihat buku bersama pengasuh beberapa halaman?",
            "B18-AD1" to "Apakah anak ikut memasukkan tangan/kaki saat dipakaikan baju?",
            "B18-AD2" to "Apakah ia minum dari gelas terbuka dengan tumpahan yang masih wajar?",
            "B18-AD3" to "Apakah ia mencoba makan sendiri dengan jari atau sendok?",
        ),
        24 to listOf(
            "B24-BK1" to "Apakah anak menggabungkan sedikitnya dua kata bermakna untuk menyampaikan maksud, dalam bahasa yang ia pakai?",
            "B24-BK2" to "Apakah ia menunjuk benda pada buku saat diminta?",
            "B24-BK3" to "Apakah ia menunjukkan sedikitnya dua anggota tubuh ketika diminta?",
            "B24-BK4" to "Apakah ia menggunakan beberapa gestur untuk berkomunikasi selain menunjuk?",
            "B24-MK1" to "Apakah anak berlari?",
            "B24-MK2" to "Apakah ia menendang bola?",
            "B24-MK3" to "Apakah ia menaiki beberapa anak tangga dengan bantuan/pegangan bila diperlukan?",
            "B24-MH1" to "Apakah anak memegang satu benda sambil memakai tangan lain untuk membuka atau memindahkan sesuatu?",
            "B24-MH2" to "Apakah ia mencoba memakai tombol, sakelar, atau putaran pada mainan aman?",
            "B24-KG1" to "Apakah anak memakai dua mainan bersama dalam permainan sederhana, misalnya piring dan makanan mainan?",
            "B24-KG2" to "Apakah ia mencoba cara lain ketika mainan tidak langsung bekerja?",
            "B24-SE1" to "Apakah anak memperhatikan ketika orang lain tampak sedih atau terluka?",
            "B24-SE2" to "Apakah ia melihat reaksi pengasuh saat menghadapi situasi baru?",
            "B24-AD1" to "Apakah anak makan sebagian makanan dengan sendok?",
            "B24-AD2" to "Apakah ia membantu membereskan benda dengan arahan sederhana?",
        ),
        30 to listOf(
            "B30-BK1" to "Apakah anak sering menggabungkan dua kata atau lebih, termasuk kata kerja, untuk bercerita atau meminta?",
            "B30-BK2" to "Apakah ia menamai benda yang ditunjuk pada buku?",
            "B30-BK3" to "Apakah ia memakai kata ganti diri yang dikenal dalam bahasa yang digunakannya?",
            "B30-BK4" to "Apakah ia mengikuti dua instruksi sederhana yang berurutan?",
            "B30-MK1" to "Apakah anak melompat sehingga kedua kaki terangkat dari lantai?",
            "B30-MK2" to "Apakah ia dapat bergerak cepat dan berhenti saat bermain dengan pengawasan?",
            "B30-MH1" to "Apakah anak membuka tutup wadah atau memutar bagian mainan dengan tangan?",
            "B30-MH2" to "Apakah ia membalik halaman buku satu per satu?",
            "B30-KG1" to "Apakah anak bermain pura-pura dengan mengganti fungsi suatu benda?",
            "B30-KG2" to "Apakah ia menemukan cara sederhana untuk mencapai benda yang tidak langsung terjangkau?",
            "B30-KG3" to "Apakah ia menunjukkan satu warna yang diminta bila warna tersebut sudah dikenalkan?",
            "B30-SE1" to "Apakah anak bermain dekat anak lain dan sesekali terlibat bersama?",
            "B30-SE2" to "Apakah ia menunjukkan hasil permainannya kepada pengasuh?",
            "B30-AD1" to "Apakah anak melepas sebagian pakaian sederhana sendiri?",
            "B30-AD2" to "Apakah ia mengikuti rutinitas membereskan mainan setelah diingatkan?",
        ),
        36 to listOf(
            "B36-BK1" to "Apakah anak melakukan percakapan timbal balik lebih dari satu giliran?",
            "B36-BK2" to "Apakah ia bertanya tentang orang, benda, tempat, atau alasan?",
            "B36-BK3" to "Apakah ia menyebut tindakan pada gambar?",
            "B36-BK4" to "Apakah orang yang tidak serumah biasanya memahami sebagian besar ucapannya?",
            "B36-MK1" to "Apakah anak dapat melompat di tempat dengan kedua kaki?",
            "B36-MK2" to "Apakah ia menaiki tangga dengan pegangan bila perlu?",
            "B36-MK3" to "Apakah ia melempar bola ringan ke arah orang lain saat bermain?",
            "B36-MH1" to "Apakah anak meniru gambar lingkaran setelah dicontohkan?",
            "B36-MH2" to "Apakah ia meronce benda besar yang aman atau memasukkan tali ke lubang besar?",
            "B36-KG1" to "Apakah anak memasangkan benda/gambar yang serupa?",
            "B36-KG2" to "Apakah ia memahami arahan sederhana tentang bahaya setelah dijelaskan?",
            "B36-KG3" to "Apakah ia mencoba menyelesaikan masalah permainan sederhana sebelum meminta bantuan?",
            "B36-SE1" to "Apakah anak memperhatikan anak lain dan ikut bermain ketika ada kesempatan?",
            "B36-SE2" to "Apakah ia dapat menenangkan diri secara bertahap dengan bantuan pengasuh setelah berpisah sebentar?",
            "B36-AD1" to "Apakah anak memakai sebagian pakaian sederhana sendiri?",
            "B36-AD2" to "Apakah ia memakai garpu/sendok saat makan dengan pengawasan?",
            "B36-AD3" to "Apakah ia mulai menyampaikan kebutuhan ke toilet atau bantuan kebersihan? *(Tidak dipakai sebagai syarat lulus/gagal.)*",
        ),
        48 to listOf(
            "B48-BK1" to "Apakah anak memakai kalimat beberapa kata untuk menjelaskan kejadian?",
            "B48-BK2" to "Apakah ia menceritakan sesuatu yang terjadi hari itu?",
            "B48-BK3" to "Apakah ia menjawab pertanyaan sederhana tentang kegunaan benda?",
            "B48-BK4" to "Apakah ia mengingat bagian pendek dari lagu atau cerita yang disukai?",
            "B48-MK1" to "Apakah anak menangkap bola besar yang dilempar pelan dari jarak dekat?",
            "B48-MK2" to "Apakah ia dapat berlari, berhenti, dan mengubah arah saat bermain tanpa sering kehilangan keseimbangan?",
            "B48-MH1" to "Apakah anak memegang pensil/krayon terutama dengan jari dan ibu jari?",
            "B48-MH2" to "Apakah ia melepas beberapa kancing sederhana?",
            "B48-MH3" to "Apakah ia menggambar orang dengan beberapa bagian tubuh setelah diberi kesempatan berlatih?",
            "B48-KG1" to "Apakah anak menamai beberapa warna yang dikenal?",
            "B48-KG2" to "Apakah ia menceritakan apa yang terjadi berikutnya dalam cerita yang akrab?",
            "B48-KG3" to "Apakah ia mengikuti aturan sederhana saat permainan yang sudah dikenal?",
            "B48-SE1" to "Apakah anak berpura-pura menjadi tokoh lain saat bermain?",
            "B48-SE2" to "Apakah ia mencari teman bermain saat ada kesempatan?",
            "B48-SE3" to "Apakah ia mencoba menghibur orang yang sedih dengan caranya sendiri?",
            "B48-AD1" to "Dengan pengawasan, apakah anak mengambil makanan/minuman untuk dirinya sendiri sesuai kemampuan?",
            "B48-AD2" to "Apakah ia membantu tugas rumah yang aman dan sederhana?",
            "B48-AD3" to "Apakah ia menyesuaikan perilaku ketika berada di tempat yang berbeda setelah dijelaskan aturannya?",
        ),
        60 to listOf(
            "B60-BK1" to "Apakah anak menceritakan dua kejadian berurutan dalam satu cerita?",
            "B60-BK2" to "Apakah ia menjawab pertanyaan sederhana tentang cerita yang baru didengar?",
            "B60-BK3" to "Apakah ia mempertahankan percakapan beberapa giliran tanpa sering kehilangan topik?",
            "B60-MK1" to "Apakah anak mencoba melompat dengan satu kaki setelah diperagakan?",
            "B60-MK2" to "Apakah ia bisa mengikuti permainan gerak sederhana yang membutuhkan berhenti dan mulai kembali?",
            "B60-MH1" to "Apakah anak mengancingkan beberapa kancing yang mudah dijangkau?",
            "B60-MH2" to "Apakah ia menulis beberapa huruf dari namanya setelah punya kesempatan belajar?",
            "B60-KG1" to "Apakah anak menghitung benda dalam jumlah kecil sambil menunjuknya satu per satu?",
            "B60-KG2" to "Apakah ia memahami urutan sederhana seperti pagi/siang/malam atau kemarin/besok dalam percakapan?",
            "B60-KG3" to "Apakah ia fokus beberapa menit pada cerita atau kegiatan tangan yang disukainya?",
            "B60-SE1" to "Apakah anak bergiliran dalam permainan bersama anak lain ketika diberi kesempatan?",
            "B60-SE2" to "Apakah ia mengikuti aturan permainan sederhana yang sudah dijelaskan?",
            "B60-AD1" to "Apakah anak melakukan tugas rumah sederhana sesuai kemampuannya, misalnya memasangkan kaus kaki?",
            "B60-AD2" to "Apakah ia mencoba menyiapkan sebagian barang pribadi untuk kegiatan dengan pengingat?",
        ),
    )
    private val contextItems = mapOf(
        "CTX-01" to "Kapan tanggal lahir anak?",
        "CTX-02" to "Apakah anak lahir sebelum 37 minggu?",
        "CTX-03" to "Bahasa apa saja yang biasa digunakan anak dan orang yang berinteraksi dengannya?",
        "CTX-04" to "Apakah Parent saat ini khawatir pada bicara, pemahaman, pendengaran, gerak, interaksi, belajar, atau kegiatan sehari-hari?",
        "CTX-05" to "Apakah ada kemampuan yang dahulu bisa dilakukan anak lalu hilang atau jelas berkurang?",
        "CTX-06" to "Apakah anak sering tidak menanggapi suara atau panggilan?",
        "ALERT-02" to "Apakah gerak sisi kanan dan kiri tubuh anak tampak berbeda sehingga mengganggu aktivitas?",
    )

    fun definition(appliedBy: String): ScreeningSeedBatchDefinition {
        val ages = listOf(2, 4, 6, 9, 12, 15, 18, 24, 30, 36, 48, 60)
        val templates = mutableListOf<ScreeningTemplateSeedDefinition>()
        val rules = mutableListOf<ScreeningRuleSetSeedDefinition>()
        val questions = mutableListOf<ScreeningQuestionSeedDefinition>()
        val choices = mutableListOf<ScreeningChoiceSeedDefinition>()
        val texts = mutableListOf<ScreeningCatalogTextSeedDefinition>()
        val triggers = mutableListOf<ScreeningRuleTriggerSeedDefinition>()
        val answerCodes = listOf("YA_SUDAH", "KADANG", "BELUM", "TIDAK_DIAMATI")
        ages.forEachIndexed { index, minAge ->
            val maxAge = ages.getOrNull(index + 1)?.minus(1) ?: 60
            val templateId = stable("template:B${minAge.toString().padStart(2, '0')}")
            val ruleSetId = stable("rules:B${minAge.toString().padStart(2, '0')}")
            val code = "B${minAge.toString().padStart(2, '0')}"
            templates += ScreeningTemplateSeedDefinition(templateId, code, 1, minAge, maxAge, 1, "$CHECKSUM:$code", ruleSetId = ruleSetId)
            rules += ScreeningRuleSetSeedDefinition(ruleSetId, "$code-rules", 1, "$CHECKSUM:$code-rules")
            val itemIds = listOf("CTX-02", "CTX-03", "CTX-04", "CTX-05", "CTX-06", "ALERT-02") + (developmentalItems[minAge] ?: error("Missing initial screening age band")).map { it.first }
            itemIds.forEachIndexed { questionOrder, stableQuestionId ->
                val questionId = stable("question:$code:$stableQuestionId")
                val domain = when {
                    stableQuestionId.startsWith("CTX") || stableQuestionId.startsWith("ALERT") -> "CTX"
                    else -> stableQuestionId.substringAfter('-').substringBefore('-').ifBlank { "OTHER" }
                }
                val answerType = when (stableQuestionId) {
                    "CTX-03", "CTX-04" -> ScreeningQuestionAnswerType.MULTI_CHOICE
                    else -> ScreeningQuestionAnswerType.SINGLE_CHOICE
                }
                questions += ScreeningQuestionSeedDefinition(questionId, templateId, stableQuestionId, domain, answerType = answerType, displayOrder = questionOrder)
                val codes = contextChoiceCodes[stableQuestionId] ?: answerCodes
                codes.forEachIndexed { choiceOrder, answerCode ->
                    val choiceId = stable("choice:$code:$stableQuestionId:$answerCode")
                    choices += ScreeningChoiceSeedDefinition(choiceId, questionId, answerCode, choiceOrder)
                    texts += text(ScreeningCatalogResourceType.CHOICE, choiceId, "choice.label", choiceLabel(answerCode, "id"))
                    texts += text(ScreeningCatalogResourceType.CHOICE, choiceId, "choice.label", choiceLabel(answerCode, "en"), "en")
                }
                val questionLabel = contextItems[stableQuestionId] ?: developmentalItems[minAge]?.firstOrNull { it.first == stableQuestionId }?.second ?: "${domain.replace("CTX", "Konteks")} · $stableQuestionId"
                texts += text(ScreeningCatalogResourceType.QUESTION, questionId, "question.label", questionLabel)
                texts += text(ScreeningCatalogResourceType.QUESTION, questionId, "question.label", questionLabel, "en")
            }
            listOf(
                ScreeningResultMainStatus.SEGERA_DISKUSIKAN to "Segera diskusikan hasil ini dengan dokter anak.",
                ScreeningResultMainStatus.DISKUSIKAN_PERKEMBANGAN to "Ada jawaban yang perlu dibahas lebih lanjut bersama tenaga kesehatan.",
                ScreeningResultMainStatus.PENGAMATAN_BELUM_CUKUP to "Data pengamatan belum cukup untuk menyimpulkan area perkembangan.",
                ScreeningResultMainStatus.KEMAMPUAN_DILAPORKAN_TERLIHAT to "Kemampuan yang ditanyakan dilaporkan terlihat pada kesempatan yang diamati.",
            ).forEach { (status, idText) ->
                texts += text(ScreeningCatalogResourceType.TEMPLATE, templateId, "result.status.${status.name}.title", idText)
                texts += text(ScreeningCatalogResourceType.TEMPLATE, templateId, "result.status.${status.name}.summary", idText)
                texts += text(ScreeningCatalogResourceType.TEMPLATE, templateId, "result.status.${status.name}.next_step", "Simpan hasil ini dan diskusikan bila ada kekhawatiran.")
                texts += text(ScreeningCatalogResourceType.TEMPLATE, templateId, "result.status.${status.name}.title", idText, "en")
                texts += text(ScreeningCatalogResourceType.TEMPLATE, templateId, "result.status.${status.name}.summary", idText, "en")
                texts += text(ScreeningCatalogResourceType.TEMPLATE, templateId, "result.status.${status.name}.next_step", "Keep this result and discuss concerns with a health professional.", "en")
            }
            listOf(
                ScreeningResultReasonCode.DISKUSIKAN_BUTIR_PERKEMBANGAN,
                ScreeningResultReasonCode.DISKUSIKAN_KEKHAWATIRAN_PARENT,
                ScreeningResultReasonCode.DISKUSIKAN_PENDENGARAN,
                ScreeningResultReasonCode.DISKUSIKAN_PERBEDAAN_GERAK,
                ScreeningResultReasonCode.OBSERVASI_BELUM_CUKUP,
                ScreeningResultReasonCode.SEGERA_DISKUSIKAN_KEHILANGAN_KEMAMPUAN,
            ).forEach { reason ->
                texts += text(ScreeningCatalogResourceType.TEMPLATE, templateId, "result.reason.${reason.name}", "Perlu dibahas: ${reason.name}.")
                texts += text(ScreeningCatalogResourceType.TEMPLATE, templateId, "result.reason.${reason.name}", "Discuss: ${reason.name}.", "en")
            }
            texts += text(ScreeningCatalogResourceType.TEMPLATE, templateId, "disclaimer.v1", "Hasil ini bukan diagnosis medis. Diskusikan dengan tenaga kesehatan.")
            texts += text(ScreeningCatalogResourceType.TEMPLATE, templateId, "disclaimer.v1", "This result is not a medical diagnosis. Discuss it with a health professional.", "en")
            triggers += ScreeningRuleTriggerSeedDefinition(stable("trigger:$code:belum"), ruleSetId, ScreeningRuleTriggerKind.ANSWER, priority = 10, answerCode = "BELUM", outputStatus = ScreeningResultMainStatus.DISKUSIKAN_PERKEMBANGAN, reasonCode = ScreeningResultReasonCode.DISKUSIKAN_BUTIR_PERKEMBANGAN, displayOrder = 1)
            triggers += ScreeningRuleTriggerSeedDefinition(stable("trigger:$code:tidak-diamati"), ruleSetId, ScreeningRuleTriggerKind.ANSWER, priority = 20, answerCode = "TIDAK_DIAMATI", outputStatus = ScreeningResultMainStatus.PENGAMATAN_BELUM_CUKUP, reasonCode = ScreeningResultReasonCode.OBSERVASI_BELUM_CUKUP, displayOrder = 2)
        }
        return ScreeningSeedBatchDefinition(BATCH_ID, SEED_VERSION, CHECKSUM, appliedBy, templates, questions, choices, texts, rules, triggers)
    }

    private val contextChoiceCodes = mapOf(
        "CTX-02" to listOf("YA", "TIDAK", "TIDAK_TAHU"),
        "CTX-03" to listOf("BAHASA_INDONESIA", "BAHASA_DAERAH", "BAHASA_LAIN", "TIDAK_TAHU"),
        "CTX-04" to listOf("TIDAK_ADA", "BICARA", "MEMAHAMI_UCAPAN", "PENDENGARAN", "GERAK", "INTERAKSI", "BELAJAR", "AKTIVITAS_SEHARI_HARI"),
        "CTX-05" to listOf("TIDAK", "YA", "TIDAK_YAKIN"),
        "CTX-06" to listOf("MERESPONS_BIASANYA", "KADANG_TIDAK", "SERING_TIDAK", "TIDAK_YAKIN"),
        "ALERT-02" to listOf("GERAK_SERUPA", "PERBEDAAN_MENGGANGGU", "TIDAK_YAKIN"),
    )

    private fun choiceLabel(code: String, locale: String): String = when (locale to code) {
        "id" to "YA_SUDAH" -> "Ya, sudah terlihat"
        "id" to "KADANG" -> "Kadang"
        "id" to "BELUM" -> "Belum terlihat"
        "id" to "TIDAK_DIAMATI" -> "Tidak diamati"
        "en" to "YA_SUDAH" -> "Yes, observed"
        "en" to "KADANG" -> "Sometimes"
        "en" to "BELUM" -> "Not yet observed"
        "en" to "TIDAK_DIAMATI" -> "Not observed"
        "id" to "YA" -> "Ya"
        "en" to "YA" -> "Yes"
        "id" to "TIDAK" -> "Tidak"
        "en" to "TIDAK" -> "No"
        "id" to "TIDAK_TAHU" -> "Tidak tahu"
        "en" to "TIDAK_TAHU" -> "Not sure"
        "id" to "BAHASA_INDONESIA" -> "Bahasa Indonesia"
        "en" to "BAHASA_INDONESIA" -> "Indonesian"
        "id" to "BAHASA_DAERAH" -> "Bahasa daerah"
        "en" to "BAHASA_DAERAH" -> "Local language"
        "id" to "BAHASA_LAIN" -> "Bahasa lain"
        "en" to "BAHASA_LAIN" -> "Another language"
        "id" to "TIDAK_ADA" -> "Tidak ada kekhawatiran"
        "en" to "TIDAK_ADA" -> "No concern"
        "id" to "BICARA" -> "Bicara"
        "en" to "BICARA" -> "Speech"
        "id" to "MEMAHAMI_UCAPAN" -> "Memahami ucapan"
        "en" to "MEMAHAMI_UCAPAN" -> "Understanding speech"
        "id" to "PENDENGARAN" -> "Pendengaran"
        "en" to "PENDENGARAN" -> "Hearing"
        "id" to "GERAK" -> "Gerak"
        "en" to "GERAK" -> "Movement"
        "id" to "INTERAKSI" -> "Interaksi"
        "en" to "INTERAKSI" -> "Interaction"
        "id" to "BELAJAR" -> "Belajar"
        "en" to "BELAJAR" -> "Learning"
        "id" to "AKTIVITAS_SEHARI_HARI" -> "Aktivitas sehari-hari"
        "en" to "AKTIVITAS_SEHARI_HARI" -> "Daily activities"
        "id" to "TIDAK_YAKIN" -> "Tidak yakin"
        "en" to "TIDAK_YAKIN" -> "Not sure"
        "id" to "MERESPONS_BIASANYA" -> "Biasanya merespons"
        "en" to "MERESPONS_BIASANYA" -> "Usually responds"
        "id" to "KADANG_TIDAK" -> "Kadang tidak merespons"
        "en" to "KADANG_TIDAK" -> "Sometimes does not respond"
        "id" to "SERING_TIDAK" -> "Sering tidak merespons"
        "en" to "SERING_TIDAK" -> "Often does not respond"
        "id" to "GERAK_SERUPA" -> "Gerak kanan-kiri tampak serupa"
        "en" to "GERAK_SERUPA" -> "Left and right movement appears similar"
        "id" to "PERBEDAAN_MENGGANGGU" -> "Ada perbedaan yang mengganggu"
        "en" to "PERBEDAAN_MENGGANGGU" -> "A concerning difference is noticed"
        else -> code
    }

    private fun text(resourceType: ScreeningCatalogResourceType, resourceId: UUID, key: String, value: String, locale: String = "id") = ScreeningCatalogTextSeedDefinition(stable("text:$resourceType:$resourceId:$locale:$key"), resourceType, resourceId, locale, key, value)
    private fun stable(value: String): UUID = UUID.nameUUIDFromBytes(value.toByteArray(StandardCharsets.UTF_8))
}
