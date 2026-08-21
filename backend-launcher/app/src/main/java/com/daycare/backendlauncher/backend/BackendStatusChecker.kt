package com.daycare.backendlauncher.backend

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.net.HttpURLConnection
import java.net.URL

enum class BackendStatus { RUNNING, NOT_RESPONDING, CHECKING }

private const val HEALTH_URL = "http://127.0.0.1:8080/api/v1/actuator/health"
private const val TIMEOUT_MS = 2_000

object BackendStatusChecker {
    suspend fun check(): BackendStatus = withContext(Dispatchers.IO) {
        try {
            val connection = URL(HEALTH_URL).openConnection() as HttpURLConnection
            connection.connectTimeout = TIMEOUT_MS
            connection.readTimeout = TIMEOUT_MS
            connection.requestMethod = "GET"
            val responding = connection.responseCode in 200..299
            connection.disconnect()
            if (responding) BackendStatus.RUNNING else BackendStatus.NOT_RESPONDING
        } catch (_: Exception) {
            BackendStatus.NOT_RESPONDING
        }
    }
}
