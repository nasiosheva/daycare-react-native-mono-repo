package com.daycare.api.config

import com.daycare.api.service.GlobalCurriculumSeedingService
import org.springframework.boot.ApplicationArguments
import org.springframework.boot.ApplicationRunner
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.stereotype.Component

// Optional, idempotent seed for the reference global curriculum (4 LearningLevel age bands, 24
// DevelopmentProgram rows, 138 DevelopmentProgramItem milestones). Off by default so a plain
// schema build stays empty - enable explicitly with daycare.seed-global-curriculum-enabled=true
// to populate it automatically at startup.
// Platform Admin can also trigger the same seed on demand from the API
// (PlatformCurriculumService.seedGlobalCurriculum), regardless of this flag.
// Safe to leave enabled across restarts: the underlying SQL script skips itself once the data
// already exists.
@Component
@ConditionalOnProperty(prefix = "daycare", name = ["seed-global-curriculum-enabled"], havingValue = "true")
class GlobalCurriculumSeeder(
    private val seeding: GlobalCurriculumSeedingService,
) : ApplicationRunner {
    override fun run(args: ApplicationArguments) {
        seeding.seed()
    }
}
