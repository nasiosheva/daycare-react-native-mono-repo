package com.daycare.api.service

import com.daycare.api.persistence.DevelopmentProgramItemRepository
import com.daycare.api.persistence.DevelopmentProgramRepository
import com.daycare.api.persistence.LearningLevelRepository
import org.springframework.core.io.ClassPathResource
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.nio.charset.StandardCharsets

data class GlobalCurriculumSeedResult(val alreadySeeded: Boolean, val learningLevelCount: Int, val developmentProgramCount: Int, val developmentProgramItemCount: Int)

@Service
class GlobalCurriculumSeedingService(
    private val jdbcTemplate: JdbcTemplate,
    private val levels: LearningLevelRepository,
    private val developmentPrograms: DevelopmentProgramRepository,
    private val developmentProgramItems: DevelopmentProgramItemRepository,
) {
    @Transactional
    fun seed(): GlobalCurriculumSeedResult {
        val alreadySeeded = levels.findAllByOrganizationIdIsNullOrderByDisplayOrderAscNameAsc().isNotEmpty()
        val sql = ClassPathResource("db/seed/global-curriculum-seed.sql").inputStream.readBytes().toString(StandardCharsets.UTF_8)
        jdbcTemplate.execute(sql)
        val globalLevels = levels.findAllByOrganizationIdIsNullOrderByDisplayOrderAscNameAsc()
        val globalPrograms = developmentPrograms.findAllByOrganizationIdIsNullOrderByCreatedAtDesc()
        val itemCount = if (globalPrograms.isEmpty()) 0 else developmentProgramItems.findAllByDevelopmentProgramIdIn(globalPrograms.map { it.id }.toSet()).size
        return GlobalCurriculumSeedResult(alreadySeeded, globalLevels.size, globalPrograms.size, itemCount)
    }
}
