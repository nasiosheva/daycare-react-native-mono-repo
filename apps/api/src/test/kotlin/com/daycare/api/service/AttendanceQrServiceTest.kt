package com.daycare.api.service

import org.junit.jupiter.api.Assertions.assertDoesNotThrow
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Test
import java.util.UUID

class AttendanceQrServiceTest {
    private val service = AttendanceQrService("this-is-a-test-secret-with-at-least-32-characters")

    @Test
    fun `issued token validates only for its child`() {
        val childId = UUID.randomUUID()
        val childName = "Alya Putri"
        val issued = service.issue(childId, childName)
        assertDoesNotThrow { service.verify(childId, childName, issued.token) }
        assertThrows(IllegalArgumentException::class.java) { service.verify(UUID.randomUUID(), childName, issued.token) }
        assertThrows(IllegalArgumentException::class.java) { service.verify(childId, "Anak Lain", issued.token) }
    }
}
