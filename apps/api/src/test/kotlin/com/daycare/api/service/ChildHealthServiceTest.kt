package com.daycare.api.service

import com.daycare.api.domain.Role
import com.daycare.api.persistence.AuditLogRepository
import com.daycare.api.persistence.Child
import com.daycare.api.persistence.ChildHealthNote
import com.daycare.api.persistence.ChildHealthNoteRepository
import com.daycare.api.persistence.ChildHealthRecord
import com.daycare.api.persistence.ChildHealthRecordRepository
import com.daycare.api.persistence.GuardianLink
import com.daycare.api.persistence.GuardianLinkRepository
import com.daycare.api.persistence.Membership
import com.daycare.api.persistence.UserProfile
import com.daycare.api.persistence.UserProfileRepository
import com.daycare.api.realtime.RealtimeFlag
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Test
import org.mockito.Mockito.any
import org.mockito.Mockito.mock
import org.mockito.Mockito.verify
import org.mockito.Mockito.`when`
import org.springframework.security.oauth2.jwt.Jwt
import java.util.Optional
import java.util.UUID

class ChildHealthServiceTest {
    @Test
    fun `parent and staff can read health record and missing record returns null`() {
        val access = mock(AccessService::class.java)
        val childScopes = mock(ChildScopeService::class.java)
        val records = mock(ChildHealthRecordRepository::class.java)
        val notes = mock(ChildHealthNoteRepository::class.java)
        val audits = mock(AuditLogRepository::class.java)
        val guardianLinks = mock(GuardianLinkRepository::class.java)
        val notifications = mock(NotificationService::class.java)
        val users = mock(UserProfileRepository::class.java)
        val jwt = mock(Jwt::class.java)
        val organizationId = UUID.randomUUID()
        val child = Child(organizationId = organizationId, firstName = "Alya")
        val parent = UserProfile(displayName = "Parent")
        val staff = UserProfile(displayName = "Staff")
        val parentScope = AccessScope(parent, Membership(role = Role.PARENT), emptySet(), emptySet())
        val staffScope = AccessScope(staff, Membership(role = Role.STAFF), emptySet(), emptySet())
        val record = ChildHealthRecord(organizationId = organizationId, childId = child.id, bloodType = "O")
        `when`(access.require(jwt, organizationId, Role.entries.toSet())).thenReturn(parentScope, staffScope)
        `when`(childScopes.requireParentLinkedChild(parentScope, child.id, organizationId)).thenReturn(child)
        `when`(childScopes.requireStaffManagedChild(staffScope, child.id, organizationId)).thenReturn(child)
        `when`(records.findByOrganizationIdAndChildId(organizationId, child.id)).thenReturn(record, null)
        val service = ChildHealthService(access, childScopes, records, notes, audits, guardianLinks, notifications, users)

        assertEquals("O", service.get(jwt, organizationId, child.id)?.bloodType)
        assertNull(service.get(jwt, organizationId, child.id))
    }

    @Test
    fun `listing notes supports parent access and unknown author fallback`() {
        val access = mock(AccessService::class.java)
        val childScopes = mock(ChildScopeService::class.java)
        val records = mock(ChildHealthRecordRepository::class.java)
        val notes = mock(ChildHealthNoteRepository::class.java)
        val audits = mock(AuditLogRepository::class.java)
        val guardianLinks = mock(GuardianLinkRepository::class.java)
        val notifications = mock(NotificationService::class.java)
        val users = mock(UserProfileRepository::class.java)
        val jwt = mock(Jwt::class.java)
        val organizationId = UUID.randomUUID()
        val child = Child(organizationId = organizationId, firstName = "Alya")
        val parentScope = AccessScope(UserProfile(), Membership(role = Role.PARENT), emptySet(), emptySet())
        val note = ChildHealthNote(organizationId = organizationId, childId = child.id, authorUserId = UUID.randomUUID(), note = "Catatan")
        `when`(access.require(jwt, organizationId, Role.entries.toSet())).thenReturn(parentScope)
        `when`(childScopes.requireParentLinkedChild(parentScope, child.id, organizationId)).thenReturn(child)
        `when`(notes.findAllByOrganizationIdAndChildIdOrderByRecordedAtDesc(organizationId, child.id)).thenReturn(listOf(note))
        `when`(users.findById(note.authorUserId)).thenReturn(Optional.empty())
        val service = ChildHealthService(access, childScopes, records, notes, audits, guardianLinks, notifications, users)

        assertEquals("Unknown", service.listNotes(jwt, organizationId, child.id).single().authorName)
    }

    @Test
    fun `upserting existing record clears blank optional fields and handles child without guardians`() {
        val access = mock(AccessService::class.java)
        val childScopes = mock(ChildScopeService::class.java)
        val records = mock(ChildHealthRecordRepository::class.java)
        val notes = mock(ChildHealthNoteRepository::class.java)
        val audits = mock(AuditLogRepository::class.java)
        val guardianLinks = mock(GuardianLinkRepository::class.java)
        val notifications = mock(NotificationService::class.java)
        val users = mock(UserProfileRepository::class.java)
        val jwt = mock(Jwt::class.java)
        val organizationId = UUID.randomUUID()
        val child = Child(organizationId = organizationId, firstName = "Alya")
        val staff = UserProfile(displayName = "Staff")
        val scope = AccessScope(staff, Membership(role = Role.STAFF), emptySet(), emptySet())
        val existing = ChildHealthRecord(organizationId = organizationId, childId = child.id, bloodType = "A", allergies = "Old")
        `when`(access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN, Role.STAFF))).thenReturn(scope)
        `when`(childScopes.requireStaffManagedChild(scope, child.id, organizationId)).thenReturn(child)
        `when`(records.findByOrganizationIdAndChildId(organizationId, child.id)).thenReturn(existing)
        `when`(records.save(any(ChildHealthRecord::class.java))).thenAnswer { it.arguments[0] }
        `when`(guardianLinks.findAllByChildId(child.id)).thenReturn(emptyList())
        val service = ChildHealthService(access, childScopes, records, notes, audits, guardianLinks, notifications, users)

        val response = service.upsert(jwt, organizationId, child.id, UpsertChildHealthRecordRequest("  ", " ", null, "  ", ""))

        assertNull(response.bloodType)
        assertNull(response.allergies)
        assertNull(response.medicalConditions)
        assertNull(response.medications)
        assertNull(response.emergencyInstructions)
    }

    @Test
    fun `upserting a health record notifies every guardian`() {
        val access = mock(AccessService::class.java)
        val childScopes = mock(ChildScopeService::class.java)
        val records = mock(ChildHealthRecordRepository::class.java)
        val notes = mock(ChildHealthNoteRepository::class.java)
        val audits = mock(AuditLogRepository::class.java)
        val guardianLinks = mock(GuardianLinkRepository::class.java)
        val notifications = mock(NotificationService::class.java)
        val users = mock(UserProfileRepository::class.java)
        val jwt = mock(Jwt::class.java)
        val organizationId = UUID.randomUUID()
        val child = Child(organizationId = organizationId, firstName = "Alya", lastName = "Putri")
        val parentUserId = UUID.randomUUID()
        val scope = AccessScope(UserProfile(), Membership(), emptySet(), emptySet())
        `when`(access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN, Role.STAFF))).thenReturn(scope)
        `when`(childScopes.requireStaffManagedChild(scope, child.id, organizationId)).thenReturn(child)
        `when`(records.findByOrganizationIdAndChildId(organizationId, child.id)).thenReturn(null)
        `when`(records.save(any(ChildHealthRecord::class.java))).thenAnswer { it.arguments[0] }
        `when`(guardianLinks.findAllByChildId(child.id)).thenReturn(listOf(GuardianLink(childId = child.id, userId = parentUserId)))
        val service = ChildHealthService(access, childScopes, records, notes, audits, guardianLinks, notifications, users)

        service.upsert(jwt, organizationId, child.id, UpsertChildHealthRecordRequest(allergies = "Kacang"))

        verify(notifications).notify(
            organizationId, parentUserId, "Catatan kesehatan Alya Putri diperbarui",
            "Staf telah memperbarui informasi kesehatan Alya Putri.",
            "/child-health?childId=${child.id}",
            setOf(RealtimeFlag.HEALTH),
        )
    }

    @Test
    fun `adding a health note resolves the author name and notifies guardians`() {
        val access = mock(AccessService::class.java)
        val childScopes = mock(ChildScopeService::class.java)
        val records = mock(ChildHealthRecordRepository::class.java)
        val notes = mock(ChildHealthNoteRepository::class.java)
        val audits = mock(AuditLogRepository::class.java)
        val guardianLinks = mock(GuardianLinkRepository::class.java)
        val notifications = mock(NotificationService::class.java)
        val users = mock(UserProfileRepository::class.java)
        val jwt = mock(Jwt::class.java)
        val organizationId = UUID.randomUUID()
        val child = Child(organizationId = organizationId, firstName = "Alya", lastName = "Putri")
        val parentUserId = UUID.randomUUID()
        val author = UserProfile(displayName = "Bu Sinta")
        val scope = AccessScope(author, Membership(), emptySet(), emptySet())
        `when`(access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN, Role.STAFF))).thenReturn(scope)
        `when`(childScopes.requireStaffManagedChild(scope, child.id, organizationId)).thenReturn(child)
        `when`(notes.save(any(ChildHealthNote::class.java))).thenAnswer { it.arguments[0] }
        `when`(users.findById(author.id)).thenReturn(Optional.of(author))
        `when`(guardianLinks.findAllByChildId(child.id)).thenReturn(listOf(GuardianLink(childId = child.id, userId = parentUserId)))
        val service = ChildHealthService(access, childScopes, records, notes, audits, guardianLinks, notifications, users)

        val response = service.addNote(jwt, organizationId, child.id, CreateChildHealthNoteRequest(note = "Demam ringan"))

        assertEquals("Demam ringan", response.note)
        assertEquals("Bu Sinta", response.authorName)
        verify(notifications).notify(
            organizationId, parentUserId, "Catatan kesehatan Alya Putri diperbarui",
            "Staf telah memperbarui informasi kesehatan Alya Putri.",
            "/child-health?childId=${child.id}",
            setOf(RealtimeFlag.HEALTH),
        )
    }
}
