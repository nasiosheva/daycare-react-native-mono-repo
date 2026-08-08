package com.daycare.api.service

import com.daycare.api.domain.EmergencyContactStatus
import com.daycare.api.domain.Role
import com.daycare.api.persistence.AuditLogRepository
import com.daycare.api.persistence.Child
import com.daycare.api.persistence.EmergencyContact
import com.daycare.api.persistence.EmergencyContactRepository
import com.daycare.api.persistence.Membership
import com.daycare.api.persistence.UserProfile
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.mockito.Mockito.any
import org.mockito.Mockito.mock
import org.mockito.Mockito.`when`
import org.springframework.security.access.AccessDeniedException
import org.springframework.security.oauth2.jwt.Jwt
import java.time.Instant
import java.util.Optional
import java.util.UUID

class EmergencyContactServiceTest {
    private val access = mock(AccessService::class.java)
    private val childScopes = mock(ChildScopeService::class.java)
    private val contacts = mock(EmergencyContactRepository::class.java)
    private val service = EmergencyContactService(access, childScopes, contacts, mock(AuditLogRepository::class.java))
    private val organizationId = UUID.randomUUID()
    private val jwt = mock(Jwt::class.java)
    private val child = Child(organizationId = organizationId)
    private val parent = UserProfile()
    private val parentScope = AccessScope(parent, Membership(userId = parent.id, organizationId = organizationId, role = Role.PARENT), emptySet(), emptySet())

    @Test
    fun `create stores an active contact with the requested expiry`() {
        `when`(access.require(jwt, organizationId, setOf(Role.PARENT))).thenReturn(parentScope)
        `when`(childScopes.requireParentLinkedChild(parentScope, child.id, organizationId)).thenReturn(child)
        `when`(contacts.save(any(EmergencyContact::class.java))).thenAnswer { it.arguments[0] }

        val effectiveUntil = Instant.now().plusSeconds(3600)
        val response = service.create(jwt, organizationId, child.id, CreateEmergencyContactRequest("Bibi Ani", "Bibi", "081234567890", effectiveUntil))

        assertEquals(EmergencyContactStatus.ACTIVE, response.status)
        assertEquals(effectiveUntil, response.effectiveUntil)
        assertTrue(response.canRevoke)
    }

    @Test
    fun `parent can revoke a contact they created`() {
        val contact = EmergencyContact(organizationId = organizationId, childId = child.id, name = "Bibi Ani", createdByUserId = parent.id)
        `when`(access.require(jwt, organizationId, setOf(Role.PARENT, Role.STAFF_ADMIN))).thenReturn(parentScope)
        `when`(childScopes.requireParentLinkedChild(parentScope, child.id, organizationId)).thenReturn(child)
        `when`(contacts.findById(contact.id)).thenReturn(Optional.of(contact))

        val response = service.revoke(jwt, organizationId, child.id, contact.id, RevokeEmergencyContactRequest("Sudah tidak relevan"))

        assertEquals(EmergencyContactStatus.REVOKED, response.status)
        assertEquals("Sudah tidak relevan", contact.revocationReason)
        assertEquals(parent.id, contact.revokedByUserId)
    }

    @Test
    fun `parent cannot revoke another guardian's contact`() {
        val otherGuardianId = UUID.randomUUID()
        val contact = EmergencyContact(organizationId = organizationId, childId = child.id, name = "Bibi Ani", createdByUserId = otherGuardianId)
        `when`(access.require(jwt, organizationId, setOf(Role.PARENT, Role.STAFF_ADMIN))).thenReturn(parentScope)
        `when`(childScopes.requireParentLinkedChild(parentScope, child.id, organizationId)).thenReturn(child)
        `when`(contacts.findById(contact.id)).thenReturn(Optional.of(contact))

        assertThrows(AccessDeniedException::class.java) {
            service.revoke(jwt, organizationId, child.id, contact.id, RevokeEmergencyContactRequest("Bukan kontak saya"))
        }
    }

    @Test
    fun `a contact past its expiry is reported as expired without a stored status change`() {
        val contact = EmergencyContact(organizationId = organizationId, childId = child.id, name = "Bibi Ani", createdByUserId = parent.id, effectiveUntil = Instant.now().minusSeconds(60))
        `when`(access.require(jwt, organizationId, setOf(Role.PARENT, Role.STAFF, Role.STAFF_ADMIN), readOnly = true)).thenReturn(parentScope)
        `when`(childScopes.requireParentLinkedChild(parentScope, child.id, organizationId)).thenReturn(child)
        `when`(contacts.findAllByOrganizationIdAndChildIdOrderByCreatedAtDesc(organizationId, child.id)).thenReturn(listOf(contact))

        val response = service.list(jwt, organizationId, child.id).single()

        assertEquals(EmergencyContactStatus.EXPIRED, response.status)
        assertFalse(response.canRevoke)
        assertEquals(EmergencyContactStatus.ACTIVE, contact.status)
    }
}
