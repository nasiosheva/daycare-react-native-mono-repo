package com.daycare.api.web

import com.fasterxml.jackson.databind.ObjectMapper
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.test.web.client.TestRestTemplate
import org.springframework.boot.test.web.client.getForEntity
import org.springframework.boot.test.web.client.postForEntity
import org.springframework.boot.test.web.server.LocalServerPort
import org.springframework.http.HttpEntity
import org.springframework.http.HttpHeaders
import org.springframework.http.HttpMethod
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.web.socket.TextMessage
import org.springframework.web.socket.WebSocketSession
import org.springframework.web.socket.client.standard.StandardWebSocketClient
import org.springframework.web.socket.handler.TextWebSocketHandler
import java.util.UUID
import java.util.concurrent.CompletableFuture
import java.util.concurrent.TimeUnit

@EnabledIfEnvironmentVariable(named = "INTEGRATION_DATABASE_URL", matches = ".+")
@SpringBootTest(
    webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
    properties = [
        "daycare.local-auth-enabled=true",
        "daycare.local-auth-jwt-secret=integration-test-secret-must-have-at-least-32-bytes",
        "daycare.local-seed-enabled=true",
        "daycare.local-seed-admin-email=admin@integration.test",
        "daycare.local-seed-admin-username=integration-admin",
        "daycare.local-seed-admin-display-name=Integration Admin",
        "daycare.local-seed-admin-password=integration-password",
        "spring.security.oauth2.resourceserver.jwt.issuer-uri=https://issuer.invalid",
        "spring.datasource.url=\${INTEGRATION_DATABASE_URL}",
        "spring.datasource.username=\${INTEGRATION_DATABASE_USERNAME}",
        "spring.datasource.password=\${INTEGRATION_DATABASE_PASSWORD}",
    ],
)
class ApiIntegrationTest(
    @Autowired private val rest: TestRestTemplate,
    @Autowired private val json: ObjectMapper,
    @LocalServerPort private val port: Int,
) {
    @Test
    fun `unauthenticated tenant route is rejected`() {
        val response = rest.getForEntity<String>(url("/v1/me"))

        assertEquals(HttpStatus.UNAUTHORIZED, response.statusCode)
    }

    @Test
    fun `logout revokes the active bearer token`() {
        val token = login("admin@integration.test", "integration-password")

        val logout = rest.exchange(url("/v1/auth/logout"), HttpMethod.POST, authenticated(token, null), String::class.java)
        val rejected = rest.exchange(url("/v1/me"), HttpMethod.GET, authenticated(token, null), String::class.java)

        assertEquals(HttpStatus.NO_CONTENT, logout.statusCode)
        assertEquals(HttpStatus.UNAUTHORIZED, rejected.statusCode)
    }

    @Test
    fun `local platform admin creates tenant and tenant admin reaches protected routes`() {
        val platformToken = login("admin@integration.test", "integration-password")
        val tenant = rest.exchange(
            url("/v1/platform/tenants"),
            HttpMethod.POST,
            authenticated(platformToken, mapOf(
                "tenantName" to "Tenant Integration",
                "branchName" to "Cabang Integration",
                "institutionTypes" to listOf("DAYCARE"),
                "subscriptionPlan" to "STARTER",
                "monthlyFee" to 250000,
                "trialMonths" to null,
                "staffAdminName" to "Admin Tenant",
                "staffAdminUsername" to "integration-tenant-admin",
                "staffAdminEmail" to "staff-admin@integration.test",
                "staffAdminPassword" to "tenant-password",
            )),
            String::class.java,
        )

        assertEquals(HttpStatus.CREATED, tenant.statusCode)
        val tenantId = json.readTree(tenant.body).path("id").asText()
        assertFalse(tenantId.isBlank())

        val tenantAdminToken = login("integration-tenant-admin", "tenant-password")
        val usernameUpdate = rest.exchange(
            url("/v1/me/username"),
            HttpMethod.PATCH,
            authenticated(tenantAdminToken, mapOf("username" to "integration-admin-updated")),
            String::class.java,
        )
        assertEquals(HttpStatus.OK, usernameUpdate.statusCode)
        val updatedUsernameToken = login("integration-admin-updated", "tenant-password")
        val children = rest.exchange(
            url("/v1/children"),
            HttpMethod.GET,
            authenticated(updatedUsernameToken, null, tenantId),
            String::class.java,
        )
        val notifications = rest.exchange(
            url("/v1/notifications"),
            HttpMethod.GET,
            authenticated(updatedUsernameToken, null, tenantId),
            String::class.java,
        )

        assertEquals(HttpStatus.OK, children.statusCode)
        assertEquals(0, json.readTree(children.body).size())
        assertEquals(HttpStatus.OK, notifications.statusCode)
        assertEquals(0, json.readTree(notifications.body).size())
    }

    @Test
    fun `authenticated tenant user receives realtime connection acknowledgement`() {
        val platformToken = login("admin@integration.test", "integration-password")
        val staffEmail = "realtime-${UUID.randomUUID()}@integration.test"
        val tenant = rest.exchange(
            url("/v1/platform/tenants"),
            HttpMethod.POST,
            authenticated(platformToken, mapOf(
                "tenantName" to "Realtime Tenant",
                "branchName" to "Realtime Branch",
                "institutionTypes" to listOf("DAYCARE"),
                "subscriptionPlan" to "STARTER",
                "monthlyFee" to 250000,
                "trialMonths" to 1,
                "staffAdminName" to "Realtime Admin",
                "staffAdminEmail" to staffEmail,
                "staffAdminPassword" to "tenant-password",
            )),
            String::class.java,
        )
        assertEquals(HttpStatus.CREATED, tenant.statusCode)
        val tenantId = json.readTree(tenant.body).path("id").asText()
        val token = login(staffEmail, "tenant-password")
        val received = CompletableFuture<String>()
        val session = StandardWebSocketClient().execute(object : TextWebSocketHandler() {
            override fun handleTextMessage(session: WebSocketSession, message: TextMessage) {
                received.complete(message.payload)
            }
        }, "ws://localhost:$port/api/v1/realtime").get(5, TimeUnit.SECONDS)

        session.sendMessage(TextMessage(json.writeValueAsString(mapOf("type" to "CONNECT", "token" to token, "organizationId" to tenantId))))

        assertEquals("CONNECTED", json.readTree(received.get(5, TimeUnit.SECONDS)).path("type").asText())
        session.close()
    }

    private fun login(identifier: String, password: String): String {
        val response = rest.postForEntity<String>(
            url("/v1/auth/local/login"),
            HttpEntity(mapOf("identifier" to identifier, "password" to password), jsonHeaders()),
        )
        assertEquals(HttpStatus.OK, response.statusCode)
        return json.readTree(response.body).path("token").asText().also { assertFalse(it.isBlank()) }
    }

    private fun authenticated(token: String, body: Any?, organizationId: String? = null): HttpEntity<Any?> = HttpEntity(body, jsonHeaders().apply {
        setBearerAuth(token)
        organizationId?.let { set("X-Organization-Id", it) }
    })

    private fun jsonHeaders() = HttpHeaders().apply { contentType = MediaType.APPLICATION_JSON }
    private fun url(path: String) = "http://localhost:$port/api$path"
}
