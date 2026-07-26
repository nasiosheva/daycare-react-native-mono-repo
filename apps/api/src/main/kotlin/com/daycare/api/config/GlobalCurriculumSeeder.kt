package com.daycare.api.config

import org.springframework.boot.ApplicationArguments
import org.springframework.boot.ApplicationRunner
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.core.io.ClassPathResource
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.stereotype.Component
import org.springframework.transaction.annotation.Transactional
import java.nio.charset.StandardCharsets

// Optional, idempotent seed for the reference global curriculum (4 LearningLevel age bands, 24
// DevelopmentProgram rows, 138 DevelopmentProgramItem milestones). Off by default so a plain
// schema build stays empty - enable explicitly with daycare.seed-global-curriculum-enabled=true
// to populate it.
// Safe to leave enabled across restarts: the underlying SQL script skips itself once the data
// already exists.
@Component
@ConditionalOnProperty(prefix = "daycare", name = ["seed-global-curriculum-enabled"], havingValue = "true")
class GlobalCurriculumSeeder(
    private val jdbcTemplate: JdbcTemplate,
) : ApplicationRunner {
    @Transactional
    override fun run(args: ApplicationArguments) {
        val sql = ClassPathResource("db/seed/global-curriculum-seed.sql").inputStream.readBytes().toString(StandardCharsets.UTF_8)
        jdbcTemplate.execute(sql)
    }
}
