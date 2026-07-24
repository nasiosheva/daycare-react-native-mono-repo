package com.daycare.api

import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.runApplication
import org.springframework.scheduling.annotation.EnableScheduling

@SpringBootApplication
@EnableScheduling
class DaycareApplication

fun main(args: Array<String>) {
    runApplication<DaycareApplication>(*args)
}
