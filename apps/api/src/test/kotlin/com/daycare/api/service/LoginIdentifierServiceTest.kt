package com.daycare.api.service

import com.daycare.api.persistence.UserProfile
import com.daycare.api.persistence.UserProfileRepository
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import org.mockito.Mockito.mock
import org.mockito.Mockito.`when`

class LoginIdentifierServiceTest {
    @Test
    fun `resolves a normalized username to its registered email`() {
        val users = mock(UserProfileRepository::class.java)
        `when`(users.findByUsernameIgnoreCase("staff-satu")).thenReturn(UserProfile(username = "staff-satu", email = "staff@example.test"))

        val result = LoginIdentifierService(users).resolveUsername("  staff-satu  ")

        assertEquals("staff@example.test", result.email)
    }

    @Test
    fun `returns no email when username is not registered`() {
        val users = mock(UserProfileRepository::class.java)
        `when`(users.findByUsernameIgnoreCase("tidak-ada")).thenReturn(null)

        val result = LoginIdentifierService(users).resolveUsername("tidak-ada")

        assertEquals(null, result.email)
    }
}
