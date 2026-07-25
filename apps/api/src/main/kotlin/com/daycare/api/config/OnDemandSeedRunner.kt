package com.daycare.api.config

import com.daycare.api.service.PlatformSeedService
import com.daycare.api.service.SeederName
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.boot.ApplicationArguments
import org.springframework.boot.ApplicationRunner
import org.springframework.core.annotation.Order
import org.springframework.stereotype.Component
import org.springframework.transaction.annotation.Transactional

/**
 * Manual, opt-in seeding for any environment including production.
 * Set SEED_RUN=<SeederName> before starting the JVM to run exactly one whitelisted
 * seeder once at startup, then the app continues serving traffic as usual.
 * Unset (the default) means this runner does nothing.
 */
@Component
@Order(10)
class OnDemandSeedRunner(
    private val seed: PlatformSeedService,
    @Value("\${daycare.seed-run:}") private val seedRun: String,
) : ApplicationRunner {
    private val log = LoggerFactory.getLogger(OnDemandSeedRunner::class.java)

    @Transactional
    override fun run(args: ApplicationArguments) {
        if (seedRun.isBlank()) return
        val name = runCatching { SeederName.valueOf(seedRun.trim()) }.getOrElse {
            log.error("SEED_RUN='{}' is not a whitelisted seeder name. Allowed values: {}", seedRun, SeederName.entries)
            return
        }
        log.warn("SEED_RUN={} detected — running seeder on demand", name)
        seed.run(name)
        log.warn("Seeder {} completed", name)
    }
}
