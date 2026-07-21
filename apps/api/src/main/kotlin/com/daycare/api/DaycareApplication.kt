package com.daycare.api

import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.runApplication

@SpringBootApplication
class DaycareApplication

fun main(args: Array<String>) {
    runApplication<DaycareApplication>(*args)
}
