package com.daycare.api.config

import com.daycare.api.service.ScreeningInitialDataset
import com.daycare.api.service.ScreeningSeedBatchService
import org.springframework.boot.ApplicationArguments
import org.springframework.boot.ApplicationRunner
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.stereotype.Component

/**
 * Explicit operator-only screening seed invocation. It is absent from normal
 * API startup and therefore cannot mutate a database during deploy/restart.
 */
@Component
@ConditionalOnProperty(prefix = "daycare", name = ["screening-seed-run"], havingValue = "true")
class ScreeningSeedRunner(private val seed: ScreeningSeedBatchService) : ApplicationRunner {
    override fun run(args: ApplicationArguments) {
        runWithConfiguration(
            batchId = System.getenv("SCREENING_SEED_BATCH_ID"),
            apply = System.getenv("SCREENING_SEED_APPLY")?.trim()?.equals("true", ignoreCase = true) == true,
            appliedBy = System.getenv("SCREENING_SEED_APPLIED_BY"),
        )
    }

    internal fun runWithConfiguration(batchId: String?, apply: Boolean, appliedBy: String?) {
        val normalizedBatchId = batchId?.trim().orEmpty()
        require(normalizedBatchId == ScreeningInitialDataset.BATCH_ID) { "SCREENING_SEED_BATCH_ID must name an approved seed package" }
        val normalizedAppliedBy = appliedBy?.trim().orEmpty()
        require(normalizedAppliedBy.isNotBlank()) { "SCREENING_SEED_APPLIED_BY is required" }
        val definition = ScreeningInitialDataset.definition(normalizedAppliedBy)
        val result = if (apply) seed.apply(definition) else seed.preview(definition)
        println("Screening seed ${result.status}: batch=${result.batchId}, templates=${result.templateCount}, questions=${result.questionCount}, choices=${result.choiceCount}, texts=${result.translationCount}")
    }
}
