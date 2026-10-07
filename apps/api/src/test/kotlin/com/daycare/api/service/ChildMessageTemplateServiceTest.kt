package com.daycare.api.service

import com.daycare.api.domain.Role
import com.daycare.api.persistence.ChildMessageTemplate
import com.daycare.api.persistence.ChildMessageTemplateRepository
import com.daycare.api.persistence.Membership
import com.daycare.api.persistence.UserProfile
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Test
import org.mockito.Mockito.any
import org.mockito.Mockito.mock
import org.mockito.Mockito.never
import org.mockito.Mockito.verify
import org.mockito.Mockito.`when`
import org.springframework.security.access.AccessDeniedException
import org.springframework.security.oauth2.jwt.Jwt
import java.util.UUID

class ChildMessageTemplateServiceTest {
    private val access = mock(AccessService::class.java)
    private val templates = mock(ChildMessageTemplateRepository::class.java)
    private val service = ChildMessageTemplateService(access, templates)
    private val jwt = mock(Jwt::class.java)
    private val organizationId = UUID.randomUUID()

    private fun scope(role: Role) = UserProfile().let { user -> AccessScope(user, Membership(organizationId = organizationId, userId = user.id, role = role, active = true), emptySet(), emptySet()) }

    @Test
    fun `Staff can read the tenant quick replies in creation order`() {
        val first = ChildMessageTemplate(organizationId = organizationId, body = "Anak sudah dijemput")
        `when`(access.require(jwt, organizationId, setOf(Role.STAFF, Role.STAFF_ADMIN))).thenReturn(scope(Role.STAFF))
        `when`(templates.findAllByOrganizationIdOrderByCreatedAtAsc(organizationId)).thenReturn(listOf(first))

        assertEquals(listOf("Anak sudah dijemput"), service.list(jwt, organizationId).map { it.body })
    }

    @Test
    fun `Staff Admin creates a trimmed quick reply`() {
        `when`(access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN))).thenReturn(scope(Role.STAFF_ADMIN))
        `when`(templates.countByOrganizationId(organizationId)).thenReturn(0)
        `when`(templates.save(any(ChildMessageTemplate::class.java))).thenAnswer { it.arguments[0] }

        val created = service.create(jwt, organizationId, ChildMessageTemplateRequest("  Mohon bawa baju ganti  "))

        assertEquals("Mohon bawa baju ganti", created.body)
    }

    @Test
    fun `creation stops at the tenant limit`() {
        `when`(access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN))).thenReturn(scope(Role.STAFF_ADMIN))
        `when`(templates.countByOrganizationId(organizationId)).thenReturn(MAX_CHILD_MESSAGE_TEMPLATES.toLong())

        val error = assertThrows(IllegalArgumentException::class.java) { service.create(jwt, organizationId, ChildMessageTemplateRequest("Halo")) }

        assertEquals(ChildMessageTemplateError.LIMIT_REACHED, error.message)
        verify(templates, never()).save(any(ChildMessageTemplate::class.java))
    }

    @Test
    fun `only Staff Admin can manage and only templates of the same tenant`() {
        `when`(access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN))).thenThrow(AccessDeniedException("denied"))
        assertThrows(AccessDeniedException::class.java) { service.create(jwt, organizationId, ChildMessageTemplateRequest("Halo")) }

        val adminJwt = mock(Jwt::class.java)
        val otherTenantTemplateId = UUID.randomUUID()
        `when`(access.require(adminJwt, organizationId, setOf(Role.STAFF_ADMIN))).thenReturn(scope(Role.STAFF_ADMIN))
        `when`(templates.findByIdAndOrganizationId(otherTenantTemplateId, organizationId)).thenReturn(null)
        val error = assertThrows(IllegalArgumentException::class.java) { service.delete(adminJwt, organizationId, otherTenantTemplateId) }
        assertEquals(ChildMessageTemplateError.NOT_FOUND, error.message)
    }
}
