package com.daycare.api.config

import com.daycare.api.service.PlatformSeedService
import org.springframework.boot.ApplicationArguments
import org.springframework.boot.ApplicationRunner
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.context.annotation.Profile
import org.springframework.core.annotation.Order
import org.springframework.stereotype.Component
import org.springframework.transaction.annotation.Transactional

@Component
@Profile("default")
@Order(0)
@ConditionalOnProperty(prefix = "daycare", name = ["local-seed-enabled"], havingValue = "true", matchIfMissing = true)
class LocalPlatformAdminSeeder(private val seed: PlatformSeedService) : ApplicationRunner {
    @Transactional
    override fun run(args: ApplicationArguments) = seed.seedPlatformAdmin()
}
