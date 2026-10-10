package com.daycare.api.service

import com.daycare.api.persistence.UserProfile
import com.daycare.api.persistence.UserProfileRepository
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Test
import org.mockito.Mockito.any
import org.mockito.Mockito.mock
import org.mockito.Mockito.`when`
import org.springframework.security.crypto.password.PasswordEncoder
import java.util.UUID

class TenantUserAccountServiceTest {
    @Test
    fun `create normalizes fields and stores encoded local password`() {
        val users = mock(UserProfileRepository::class.java)
        val encoder = mock(PasswordEncoder::class.java)
        `when`(users.findByEmailIgnoreCase("staff@example.test")).thenReturn(null)
        `when`(users.findByUsernameIgnoreCase("staff")).thenReturn(null)
        `when`(encoder.encode("secret")).thenReturn("hash")
        `when`(users.save(any(UserProfile::class.java))).thenAnswer { it.arguments[0] }
        val service = TenantUserAccountService(users, encoder)

        val user = service.create("  Staff  ", " STAFF@EXAMPLE.TEST ", "secret", " staff ")

        assertEquals("Staff", user.displayName)
        assertEquals("staff@example.test", user.email)
        assertEquals("staff", user.username)
        assertEquals("hash", user.localPasswordHash)
    }

    @Test
    fun `create validates required values and uniqueness`() {
        val users = mock(UserProfileRepository::class.java)
        val encoder = mock(PasswordEncoder::class.java)
        val service = TenantUserAccountService(users, encoder)
        fun create(name: String = "Staff", email: String = "staff@example.test", password: String = "secret", username: String? = null) =
            service.create(name, email, password, username)

        assertThrows(IllegalArgumentException::class.java) { create(name = " ") }
        assertThrows(IllegalArgumentException::class.java) { create(username = " ") }
        assertThrows(IllegalArgumentException::class.java) { create(email = "invalid") }
        assertThrows(IllegalArgumentException::class.java) { create(password = "12345") }
        assertThrows(IllegalArgumentException::class.java) { create(password = "x".repeat(129)) }
        `when`(users.findByEmailIgnoreCase("staff@example.test")).thenReturn(UserProfile(email = "staff@example.test"))
        assertThrows(IllegalArgumentException::class.java) { create() }
        `when`(users.findByEmailIgnoreCase("staff@example.test")).thenReturn(null)
        `when`(users.findByUsernameIgnoreCase("taken")).thenReturn(UserProfile(username = "taken"))
        assertThrows(IllegalArgumentException::class.java) { create(username = "taken") }
    }

    @Test
    fun `change password enforces bounds and encodes valid password`() {
        val users = mock(UserProfileRepository::class.java)
        val encoder = mock(PasswordEncoder::class.java)
        `when`(encoder.encode("new-secret")).thenReturn("new-hash")
        val service = TenantUserAccountService(users, encoder)
        val user = UserProfile()

        assertThrows(IllegalArgumentException::class.java) { service.changePassword(user, "short") }
        assertThrows(IllegalArgumentException::class.java) { service.changePassword(user, "x".repeat(129)) }
        service.changePassword(user, "new-secret")
        assertEquals("new-hash", user.localPasswordHash)
    }

    @Test
    fun `update preserves own identities and clears blank username`() {
        val users = mock(UserProfileRepository::class.java)
        val encoder = mock(PasswordEncoder::class.java)
        val user = UserProfile(displayName = "Old", email = "old@example.test", username = "old")
        `when`(users.findByEmailIgnoreCase("new@example.test")).thenReturn(user)
        val service = TenantUserAccountService(users, encoder)

        service.update(user, " New Name ", "NEW@EXAMPLE.TEST", " ")

        assertEquals("New Name", user.displayName)
        assertEquals("new@example.test", user.email)
        assertNull(user.username)
    }

    @Test
    fun `update rejects invalid or conflicting identities`() {
        val users = mock(UserProfileRepository::class.java)
        val encoder = mock(PasswordEncoder::class.java)
        val service = TenantUserAccountService(users, encoder)
        val user = UserProfile(email = "current@example.test", username = "current")
        assertThrows(IllegalArgumentException::class.java) { service.update(user, " ", "valid@example.test", null) }
        assertThrows(IllegalArgumentException::class.java) { service.update(user, "Name", "invalid", null) }
        `when`(users.findByEmailIgnoreCase("taken@example.test")).thenReturn(UserProfile(email = "taken@example.test"))
        assertThrows(IllegalArgumentException::class.java) { service.update(user, "Name", "taken@example.test", null) }
        `when`(users.findByEmailIgnoreCase("valid@example.test")).thenReturn(null)
        `when`(users.findByUsernameIgnoreCase("taken")).thenReturn(UserProfile(username = "taken"))
        assertThrows(IllegalArgumentException::class.java) { service.update(user, "Name", "valid@example.test", "taken") }
        `when`(users.findByUsernameIgnoreCase("current")).thenReturn(user)
        service.update(user, "Name", "valid@example.test", "current")
        assertEquals("current", user.username)
    }
}
